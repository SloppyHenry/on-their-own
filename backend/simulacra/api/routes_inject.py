"""Freie Ereigniseingabe (AP08). Verändernde Anfragen brauchen einen Idempotency-Key."""

from fastapi import APIRouter, HTTPException, Request

from ..events_user.service import InjectError
from .models_inject import InjectConfirmRequest, InjectParseRequest, InjectProposal, ScheduledOut

router = APIRouter(prefix="/api")


async def _command(request: Request, payload, action):
    sim = request.app.state.sim

    async def handler():
        try:
            return InjectProposal(**await action(sim))
        except InjectError as e:
            raise HTTPException(e.status, e.text) from None
    return await request.app.state.idempotency.run(sim, request, payload, handler)


@router.post("/inject/parse", response_model=InjectProposal)
async def parse(request: Request, body: InjectParseRequest):
    """Text → Vorschlag (Operationen, Rückfrage oder Vorschau). Ändert die Welt nicht."""
    async def action(sim):
        return await sim.inject.parse(body.text, body.agents, body.at, body.answer_to, body.answer)
    return await _command(request, body, action)


@router.post("/inject/confirm", response_model=InjectProposal)
async def confirm(request: Request, body: InjectConfirmRequest):
    """Bestätigten Vorschlag ausführen."""
    async def action(sim):
        return await sim.engine.db.run(lambda: sim.inject.confirm(body.proposal_id))
    return await _command(request, body, action)


@router.get("/inject/history", response_model=list[InjectProposal])
async def history(request: Request, limit: int = 30):
    sim = request.app.state.sim
    return await sim.engine.db.run(lambda: sim.inject.history(max(1, min(200, limit))))


@router.get("/scheduled", response_model=list[ScheduledOut])
async def scheduled(request: Request):
    sim = request.app.state.sim
    return [{"id": s["id"], "minute": s["minute"], "text": s["text"], "inject_id": s["inject_id"]} for s in await sim.engine.db.run(sim.inject.scheduled)]


@router.delete("/scheduled/{sid}", response_model=ScheduledOut)
async def cancel(request: Request, sid: str):
    sim = request.app.state.sim

    def work():
        s = next((x for x in sim.inject.scheduled() if x["id"] == sid), None)
        if s is None or not sim.inject.sched.cancel(sid):
            raise HTTPException(404, "Dieses geplante Ereignis gibt es nicht (mehr).")
        return {"id": s["id"], "minute": s["minute"], "text": s["text"], "inject_id": s["inject_id"]}
    return await sim.engine.db.run(work)
