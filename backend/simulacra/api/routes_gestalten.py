"""Gestalten (AP16a): Entwurf aus Aktionen (Wege, Seen, Gärten, Häuser, Deko, Löschen, Karte erweitern).

Im Spiel (nur Spielart Gott): `POST /api/world/draft/preview` rechnet den Entwurf auf dem Zustand und wendet den Patch im Trockenlauf an, `POST /api/world/draft/apply` übernimmt ihn
(Bestätigung, Prüfsumme, Idempotency-Key, Sicherung „Vor dem Gestalten“, Ereignis `world.edited` nur im Protokoll). In der Welt-Werkstatt: `POST /api/worlds/draft` rechnet zustandslos
auf einer Weltdatei. `GET /api/gestalten/katalog` nennt, was sich setzen lässt.
"""

from fastapi import APIRouter, HTTPException, Request

from ..generator import service
from ..generator.edit import dienst
from ..generator.edit.katalog import katalog
from ..generator.service import ServiceError
from ..simulation.builder import Simulation
from ..welten import store
from .models_gestalten import DraftApplied, DraftApplyRequest, DraftPreview, DraftRequest, FileDraft, FileDraftRequest
from .spielart_schutz import nur_gott

router = APIRouter(prefix="/api/world/draft")
router_welten = APIRouter(prefix="/api/worlds")
router_katalog = APIRouter(prefix="/api/gestalten")


@router_katalog.get("/katalog")
async def get_katalog():
    return katalog()


@router.post("/preview", response_model=DraftPreview)
async def preview(request: Request, body: DraftRequest):
    """Trockenlauf des Entwurfs im Spiel: Prüfbericht je Aktion und die Welt, wie sie nach dem Übernehmen aussähe. Ändert nichts."""
    sim = request.app.state.sim
    await nur_gott(sim, "Welt gestalten")

    def work():
        erg, dry = dienst.spiel_entwurf(sim, body.actions)
        ok = all(s["ok"] for s in erg.stati) and not erg.fehler and dry["ok"]
        return DraftPreview(ok=ok, error=dry["error"], digest=dienst.summe(erg.patch), counts=dry["counts"], snapshot=dry["snapshot"], **dienst.kopf(erg))
    return await sim.engine.db.run(work)


@router.post("/apply", response_model=DraftApplied)
async def apply(request: Request, body: DraftApplyRequest):
    if not body.confirm:
        raise HTTPException(400, "Das Übernehmen verändert die Welt. Bestätige mit {\"confirm\": true}; vorher wird der Stand gesichert.")
    sim = request.app.state.sim
    await nur_gott(sim, "Welt gestalten")

    async def action():
        was_running = sim.runner.state.value == "running"
        if was_running:
            await sim.runner.pause()
        try:
            return DraftApplied(**await sim.engine.db.run(lambda: dienst.uebernehmen(sim, body.actions, body.digest)))
        except ServiceError as e:
            raise HTTPException(e.status, e.text) from None
        finally:
            if was_running:
                await sim.runner.resume()
    return await request.app.state.idempotency.run(sim, request, body, action)


@router_welten.post("/draft", response_model=FileDraft)
async def datei_entwurf(request: Request, body: FileDraftRequest):
    """Werkstatt: zustandslos. Weltdatei und Aktionen → neue Weltdatei, Prüfbericht; mit `snapshot` auch der Zustandsabzug (Wegwerf-Simulation im Speicher, zwischengespeichert)."""
    errs = store.check_world(body.world)
    if errs:
        raise HTTPException(422, "\n".join(errs))
    erg, digest = dienst.datei_entwurf(body.world, body.actions)
    snap = None
    if body.snapshot:
        snap = dienst.abzug_merken(digest)
        if snap is None:
            sim = request.app.state.sim
            tmp = Simulation.create(sim.settings, ":memory:", sim.provider, world=erg.welt)
            try:
                from . import state as api_state
                snap = await tmp.engine.db.run(lambda: api_state.snapshot(tmp).model_dump())
            finally:
                tmp.close()
            dienst.abzug_ablegen(digest, snap)
    return FileDraft(ok=all(s["ok"] for s in erg.stati) and not erg.fehler, spielbar=not erg.fehler, digest=digest, world=erg.welt, snapshot=snap, **dienst.kopf(erg))
