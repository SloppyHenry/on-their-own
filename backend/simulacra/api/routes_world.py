"""Weltgenerator in der Leitstelle: Vorschau (Trockenlauf, ändert nichts) und Anwenden (Bestätigung, Sicherung, Idempotency-Key)."""

from fastapi import APIRouter, HTTPException, Request

from ..generator import service
from ..generator.service import ServiceError, Wish
from ..world.extend import WorldEditError
from .spielart_schutz import nur_gott
from .models_world import GenerateApplied, GenerateApplyRequest, GeneratePreview, GenerateRequest, PatchPreview, PatchPreviewRequest

router = APIRouter(prefix="/api/world")


def _wish(body: GenerateRequest) -> Wish:
    try:
        return Wish.of(body.kind, body.seed, body.lake, body.mix, body.style.model_dump() if body.style else None)
    except ServiceError as e:
        raise HTTPException(e.status, e.text) from None


@router.post("/generate", response_model=GeneratePreview)
async def generate(request: Request, body: GenerateRequest):
    """Trockenlauf: erzeugt das Dorf, prüft es und wendet es auf einer Kopie an (Rollback). Die Welt bleibt unverändert."""
    sim, w = request.app.state.sim, _wish(body)
    if w.kind == "new":
        return await service.preview_new(sim, w)
    await nur_gott(sim, "Dorf anfügen")
    return await sim.engine.db.run(lambda: service.preview_extension(sim, w))


@router.post("/patch/preview", response_model=PatchPreview)
async def patch_preview(request: Request, body: PatchPreviewRequest):
    """Trockenlauf eines beliebigen Patches (Einzeländerungen des Editors): Fehler der Engine oder die Welt, wie sie danach aussähe. Ändert nichts."""
    sim = request.app.state.sim
    await nur_gott(sim, "Welt verändern")
    return await sim.engine.db.run(lambda: service.preview_patch(sim, body.patch))


@router.post("/generate/apply", response_model=GenerateApplied)
async def apply(request: Request, body: GenerateApplyRequest):
    if not body.confirm:
        raise HTTPException(400, "Das Übernehmen verändert die Welt. Bestätige mit {\"confirm\": true}; vorher wird der Stand gesichert.")
    w = _wish(body)
    if w.kind == "extend":
        await nur_gott(request.app.state.sim, "Dorf anfügen")

    async def action(sim):
        was_running = sim.runner.state.value == "running"
        if was_running:
            await sim.runner.pause()
        try:
            if w.kind == "new":
                return await _apply_new(sim, w, body)
            return GenerateApplied(**await sim.engine.db.run(lambda: service.apply_extension(sim, w, body.digest)))
        except ServiceError as e:
            raise HTTPException(e.status, e.text) from None
        finally:
            if was_running and w.kind == "extend":
                await sim.runner.resume()                         # nach einer neuen Simulation bleibt sie angehalten
    return await request.app.state.idempotency.run(request.app.state.sim, request, body, lambda: action(request.app.state.sim))


async def _apply_new(sim, w: Wish, body: GenerateApplyRequest) -> GenerateApplied:
    world, _ = service.make_world(w)
    if service.digest(world) != body.digest:
        raise ServiceError(409, "Die Vorschau passt nicht mehr zu diesem Wunsch. Bitte die Vorschau neu erstellen.")
    gen = world["generator"]
    saved = await sim.reset(keep_profiles=body.keep_profiles, world=world, backup_label="Vor der neuen Simulation")
    meta = {"kind": "new", "seed": gen["seed"], "requested_seed": gen["requested_seed"], "village": gen["village"]}
    await sim.engine.db.run(lambda: sim.engine.emit_event("world.generated", data={**meta, "patch": None, "summary": service.world_counts(world)}))
    return GenerateApplied(kind="new", village=gen["village"], seed=gen["seed"], backup=saved.name if saved else None, counts=service.world_counts(world))
