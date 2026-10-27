"""Parameter, Presets und Systemstatus. Verändernde Anfragen brauchen einen Idempotency-Key."""

from fastapi import APIRouter, HTTPException, Request

from ..params.presets import PresetError
from ..params.registry import schema as param_schema
from .models_params import (ModelStatus, ParamPatch, ParamPatchOut, ParamResetRequest, ParamSchema, ParamValues, PresetBrief, PresetDuplicate,
                            PresetLoadOut, PresetLoadRequest, PresetOut, PresetPreview, PresetRename, PresetSave, StatusOut, SystemLoad)

router = APIRouter(prefix="/api")


async def _values(sim) -> ParamValues:
    def read():
        values, defaults = sim.params.values(), sim.params.defaults()
        return ParamValues(agents=sim.params.agents(), values=values, defaults=defaults, changed=[k for k in values if values[k] != defaults[k]])
    return await sim.engine.db.run(read)


async def _command(request: Request, payload, action):
    sim = request.app.state.sim

    async def handler():
        try:
            return await action(sim)
        except PresetError as e:
            raise HTTPException(409 if e.code in ("exists", "builtin") else 404 if e.code == "not_found" else 422, e.text) from None
    return await request.app.state.idempotency.run(sim, request, payload, handler)


# --- Parameter ---------------------------------------------------------------------------------------------
@router.get("/params/schema", response_model=ParamSchema)
async def schema() -> ParamSchema:
    return ParamSchema(**param_schema())


@router.get("/params", response_model=ParamValues)
async def values(request: Request) -> ParamValues:
    return await _values(request.app.state.sim)


@router.patch("/params", response_model=ParamPatchOut)
async def patch(request: Request, body: ParamPatch):
    async def action(sim):
        results = await sim.params.patch([c.model_dump() for c in body.changes])
        return ParamPatchOut(results=results, values=await _values(sim))
    return await _command(request, body, action)


@router.post("/params/reset", response_model=ParamPatchOut)
async def reset(request: Request, body: ParamResetRequest | None = None):
    body = body or ParamResetRequest()

    async def action(sim):
        results = await sim.params.reset(body.keys, body.group, body.agent)
        return ParamPatchOut(results=results, values=await _values(sim))
    return await _command(request, body, action)


# --- Presets -----------------------------------------------------------------------------------------------
def _brief(p: dict) -> PresetBrief:
    return PresetBrief(id=p["id"], name=p["name"], description=p["description"], builtin=p["builtin"], count=len(p["data"]))


@router.get("/presets", response_model=list[PresetBrief])
async def presets(request: Request):
    sim = request.app.state.sim
    return await sim.engine.db.run(sim.presets.list)


@router.get("/presets/{preset_id}", response_model=PresetOut)
async def preset(request: Request, preset_id: str):
    sim = request.app.state.sim
    try:
        return await sim.engine.db.run(lambda: sim.presets.get(preset_id))
    except PresetError as e:
        raise HTTPException(404, e.text) from None


@router.get("/presets/{preset_id}/preview", response_model=PresetPreview)
async def preview(request: Request, preset_id: str):
    sim = request.app.state.sim
    try:
        return await sim.engine.db.run(lambda: PresetPreview(preset=_brief(sim.presets.get(preset_id)), diff=sim.presets.preview(preset_id)))
    except PresetError as e:
        raise HTTPException(404, e.text) from None


@router.post("/presets", response_model=PresetOut)
async def save(request: Request, body: PresetSave):
    async def action(sim):
        return await sim.engine.db.run(lambda: PresetOut(**sim.presets.save(body.name, body.description, body.groups)))
    return await _command(request, body, action)


@router.post("/presets/{preset_id}/duplicate", response_model=PresetOut)
async def duplicate(request: Request, preset_id: str, body: PresetDuplicate | None = None):
    body = body or PresetDuplicate()

    async def action(sim):
        return await sim.engine.db.run(lambda: PresetOut(**sim.presets.duplicate(preset_id, body.name)))
    return await _command(request, body, action)


@router.patch("/presets/{preset_id}", response_model=PresetOut)
async def rename(request: Request, preset_id: str, body: PresetRename):
    async def action(sim):
        return await sim.engine.db.run(lambda: PresetOut(**sim.presets.rename(preset_id, body.name, body.description)))
    return await _command(request, body, action)


@router.delete("/presets/{preset_id}", response_model=PresetBrief)
async def delete(request: Request, preset_id: str, confirm: bool = False):
    if not confirm:
        raise HTTPException(400, "Löschen braucht die ausdrückliche Bestätigung (?confirm=true).")

    async def action(sim):
        def work():
            brief = _brief(sim.presets.get(preset_id))
            sim.presets.delete(preset_id)
            return brief
        return await sim.engine.db.run(work)
    return await _command(request, None, action)


@router.post("/presets/{preset_id}/load", response_model=PresetLoadOut)
async def load(request: Request, preset_id: str, body: PresetLoadRequest | None = None):
    body = body or PresetLoadRequest()
    if not body.confirm:
        raise HTTPException(400, "Das Laden ändert viele Werte. Zuerst die Vorschau ansehen, dann mit {\"confirm\": true} laden.")

    async def action(sim):
        brief = _brief(await sim.engine.db.run(lambda: sim.presets.get(preset_id)))
        changes = await sim.engine.db.run(lambda: sim.presets.changes(preset_id))
        results = await sim.params.patch(changes)
        return PresetLoadOut(preset=brief, results=results, values=await _values(sim))
    return await _command(request, body, action)


# --- Status ---------------------------------------------------------------------------------------------------
@router.get("/status", response_model=StatusOut)
async def status(request: Request) -> StatusOut:
    sim = request.app.state.sim
    m, st = sim.client.metrics, sim.runner.stats
    last = m.records[-1] if m.records else None
    s = m.summary()
    ok = max(0, st.decisions - st.rejected - st.fallback)
    run = st.summary()
    return StatusOut(
        model=ModelStatus(reachable=None if last is None else last.error is None, model=sim.client.params.model, base_url=sim.params.current_value("llm.base_url"),
                          avg_response_s=s["avg_response_s"], avg_tokens_per_s=s["avg_tokens_per_s"], errors_15min=s["errors_15min"], queue=sim.client.waiting, calls=s["calls"]),
        load=SystemLoad(decisions_per_minute=run["decisions_per_minute"], sim_minutes_per_minute=run["sim_minutes_per_minute"], actions_ok=ok, actions_failed=st.rejected + st.fallback,
                        state=sim.runner.state.value, speed_level=sim.params.current_value("sim.speed"), max_concurrent=sim.client._max_concurrent, power_save=sim.runner.power_save))
