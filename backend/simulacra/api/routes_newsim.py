"""Neue Simulation nach Maß (AP17b): Vorlagen für Bewohner (Liste, Eigene, Export, Import) und der Assistent (Prüfung und Vorschau, Anlegen)."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response

from ..agents.schema import MAX_RESIDENTS, SECONDS_PER_DECISION, TEMPLATE_FORMAT, TEMPLATE_VERSION, template_errors
from ..agents.model import AgentProfile, Personality
from ..agents.templates import TemplateError, TemplateStore
from ..generator import service
from ..simulation import newsim
from ..simulation.newsim import SpecError
from .models_newsim import (HouseOut, NewSimApplied, NewSimApplyRequest, NewSimLimits, NewSimPreview, NewSimRequest, ResidentOut, TemplateImported, TemplateIn,
                            TemplateOut)

router = APIRouter(prefix="/api")


def _templates(request: Request) -> TemplateStore:
    app = request.app
    if getattr(app.state, "templates", None) is None:
        db_path = app.state.sim.db_path
        app.state.templates = TemplateStore(None if db_path == ":memory:" else Path(db_path).parent / "vorlagen")
    return app.state.templates


def _fail(e: TemplateError) -> HTTPException:
    lines = [e.text] + [x for x in e.errors if x != e.text]
    return HTTPException(e.status, "\n".join(lines))


def _models(body: TemplateIn) -> tuple[AgentProfile, Personality]:
    errs = template_errors({"format": TEMPLATE_FORMAT, "version": TEMPLATE_VERSION, "profile": body.profile, "personality": body.personality})
    if errs:
        raise _fail(TemplateError(422, "Die Vorlage ist nicht gültig.", errs))
    p, q = AgentProfile(**body.profile), Personality(**body.personality)
    return p, q


# --- Vorlagen -------------------------------------------------------------------------------------------------------------------------

@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(request: Request):
    return _templates(request).list()


@router.get("/templates/{tid}", response_model=TemplateOut)
async def get_template(request: Request, tid: str):
    try:
        return _templates(request).get(tid)
    except TemplateError as e:
        raise _fail(e) from None


@router.get("/templates/{tid}/export")
async def export_template(request: Request, tid: str):
    """Die Vorlage als Datei (Format `simulacra-vorlage`, Version 1)."""
    try:
        data = _templates(request).export(tid)
    except TemplateError as e:
        raise _fail(e) from None
    return Response(json.dumps(data, ensure_ascii=False, indent=1), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="vorlage-{tid}.json"'})


@router.post("/templates", response_model=TemplateOut)
async def create_template(request: Request, body: TemplateIn):
    p, q = _models(body)
    try:
        return _templates(request).create(p, q)
    except TemplateError as e:
        raise _fail(e) from None


@router.put("/templates/{tid}", response_model=TemplateOut)
async def update_template(request: Request, tid: str, body: TemplateIn):
    p, q = _models(body)
    try:
        return _templates(request).update(tid, p, q)
    except TemplateError as e:
        raise _fail(e) from None


@router.delete("/templates/{tid}")
async def delete_template(request: Request, tid: str):
    try:
        _templates(request).delete(tid)
    except TemplateError as e:
        raise _fail(e) from None
    return {"deleted": tid}


@router.post("/templates/{tid}/duplicate", response_model=TemplateOut)
async def duplicate_template(request: Request, tid: str):
    try:
        return _templates(request).duplicate(tid)
    except TemplateError as e:
        raise _fail(e) from None


@router.post("/templates/import", response_model=TemplateImported)
async def import_template(request: Request):
    """Importiert den Inhalt einer Vorlagendatei (Anfragekörper = die Datei) als neue Vorlage; Fehler kommen alle auf einmal, bestehende Vorlagen bleiben unberührt."""
    try:
        t, warnings = _templates(request).import_bytes(await request.body())
    except TemplateError as e:
        raise _fail(e) from None
    return TemplateImported(template=TemplateOut(**t), warnings=warnings)


# --- Assistent „Neue Simulation“ ------------------------------------------------------------------------------------------------------

@router.get("/sim/new/limits", response_model=NewSimLimits)
async def limits():
    return NewSimLimits(max_residents=MAX_RESIDENTS, seconds_per_decision=SECONDS_PER_DECISION)


def _out(res: newsim.Resolved) -> list[ResidentOut]:
    return [ResidentOut(id=r.id, name=r.profile.name, home=r.home) for r in res.residents]


@router.post("/sim/new/preview", response_model=NewSimPreview)
async def preview(request: Request, body: NewSimRequest):
    """Prüft den Entwurf und zeigt die Welt unter dem Schleier. Ändert nichts; Fehler stehen in `errors`, Hinweise der Wortprüfung in `warnings`."""
    sim = request.app.state.sim
    try:
        res = newsim.resolve(body)
        world, rep = newsim.make_new_world(body, res)
    except SpecError as e:
        return NewSimPreview(ok=False, errors=e.errors)
    pv = await service.preview_world(sim, world, rep)
    houses = [HouseOut(n=h["n"], name=h["name"], beds=h["beds"]) for h in newsim.houses_of(world)]
    return NewSimPreview(ok=pv["ok"], warnings=res.warnings, residents=_out(res), houses=houses, report=pv["report"], digest=pv["digest"], village=pv["village"],
                         seed=pv["seed"], counts=pv["counts"], snapshot=pv["snapshot"])


@router.post("/sim/new", response_model=NewSimApplied)
async def apply(request: Request, body: NewSimApplyRequest):
    if not body.confirm:
        raise HTTPException(400, "Eine neue Simulation ersetzt die laufende. Bestätige mit {\"confirm\": true}; die bisherige Welt wird vorher als Spielstand gesichert.")
    try:
        res = newsim.resolve(body)
        world, rep = newsim.make_new_world(body, res)
    except SpecError as e:
        raise HTTPException(e.status, "\n".join(e.errors)) from None
    if not rep.ok:
        raise HTTPException(422, "Das Dorf besteht die Prüfung nicht: " + "; ".join(rep.errors))
    if service.digest(world) != body.digest:
        raise HTTPException(409, "Die Vorschau passt nicht mehr zu diesem Entwurf. Bitte die Vorschau neu erstellen.")

    async def action(sim):
        if sim.runner.state.value == "running":
            await sim.runner.pause()
        saved = await sim.reset(world=world, backup_label="Vor der neuen Simulation", setup=lambda fresh: newsim.setup(fresh, res, world))
        gen = world.get("generator")
        if gen:
            meta = {"kind": "new", "seed": gen["seed"], "requested_seed": gen["requested_seed"], "village": gen["village"]}
            await sim.engine.db.run(lambda: sim.engine.emit_event("world.generated", data={**meta, "patch": None, "summary": service.world_counts(world)}))
        if body.run == "running":
            await sim.runner.start()
        return NewSimApplied(village=(gen or {}).get("village") or world["name"], seed=(gen or {}).get("seed"), residents=_out(res), backup=saved.name if saved else None,
                             counts=service.world_counts(world), state=sim.runner.state.value)
    return await request.app.state.idempotency.run(request.app.state.sim, request, body, lambda: action(request.app.state.sim))
