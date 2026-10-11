"""Spielstände: speichern, laden, löschen, exportieren, importieren. Verändernde Anfragen brauchen einen Idempotency-Key; Destruktives braucht eine Bestätigung."""

import hashlib

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from ..saves.service import SaveError
from .models_saves import ImportMeta, SaveCreate, SaveLoadRequest, SaveOut

router = APIRouter(prefix="/api/saves")
MAX_UPLOAD = 520 * 1024 * 1024


async def _command(request: Request, payload, action):
    sim = request.app.state.sim
    if sim.saves is None:
        raise HTTPException(409, "Spielstände gibt es nur mit einer Datenbankdatei.")

    async def handler():
        try:
            return await action(sim)
        except SaveError as e:
            raise HTTPException(e.status, e.text) from None
    return await request.app.state.idempotency.run(sim, request, payload, handler)


def _out(sim, entry) -> SaveOut:
    return next(SaveOut(**e) for e in sim.saves.list() if e["id"] == entry["id"])


@router.get("", response_model=list[SaveOut])
async def list_saves(request: Request):
    sim = request.app.state.sim
    return [] if sim.saves is None else await sim.engine.db.run(sim.saves.list)


@router.post("", response_model=SaveOut)
async def save(request: Request, body: SaveCreate):
    """Konsistente Kopie des Live-Standes: kurz anhalten (zwischen zwei Takten), kopieren, wieder fortsetzen, falls es lief."""
    async def action(sim):
        was_running = sim.runner.state.value == "running"
        if was_running:
            await sim.runner.pause()
        try:
            entry = await sim.engine.db.run(lambda: sim.saves.create(body.name, body.description, "manual", body.overwrite))
        finally:
            if was_running:
                await sim.runner.resume()
        return _out(sim, entry)
    return await _command(request, body, action)


@router.post("/{save_id}/load", response_model=SaveOut)
async def load(request: Request, save_id: str, body: SaveLoadRequest | None = None):
    body = body or SaveLoadRequest()
    if not body.confirm:
        raise HTTPException(400, "Laden ersetzt den aktuellen Stand (er wird vorher als „Vor dem Laden“ gesichert). Bestätige mit {\"confirm\": true}.")

    async def action(sim):
        entry = await sim.load_save(save_id)
        return _out(sim, entry)
    return await _command(request, body, action)


@router.delete("/{save_id}", response_model=SaveOut)
async def delete(request: Request, save_id: str, confirm: bool = Query(False)):
    if not confirm:
        raise HTTPException(400, "Löschen braucht die ausdrückliche Bestätigung (?confirm=true).")

    async def action(sim):
        entry = await sim.engine.db.run(lambda: _out(sim, sim.saves.get(save_id)))
        await sim.engine.db.run(lambda: sim.saves.delete(save_id))
        return entry
    return await _command(request, None, action)


@router.get("/{save_id}/export")
async def export(request: Request, save_id: str):
    sim = request.app.state.sim
    if sim.saves is None:
        raise HTTPException(409, "Spielstände gibt es nur mit einer Datenbankdatei.")
    try:
        data, filename = await sim.engine.db.run(lambda: sim.saves.export(save_id))
    except SaveError as e:
        raise HTTPException(e.status, e.text) from None
    return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.post("/import", response_model=SaveOut)
async def import_save(request: Request):
    """ZIP als rohen Anfragekörper. Wird immer als **neuer** Spielstand angelegt, nie über den Live-Stand."""
    data = await request.body()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Die Datei ist zu groß.")
    meta = ImportMeta(sha256=hashlib.sha256(data).hexdigest())

    async def action(sim):
        entry = await sim.engine.db.run(lambda: sim.saves.import_bytes(data))
        return _out(sim, entry)
    return await _command(request, meta, action)
