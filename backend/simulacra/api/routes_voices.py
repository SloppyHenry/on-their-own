"""Stimmen der Figuren (AP17d): einstellen oder auf den Vorschlag zurücksetzen. Verändernde Anfragen brauchen einen Idempotency-Key."""

from fastapi import APIRouter, HTTPException, Request

from ..world.voices import set_voice
from .models import VoiceOut, VoiceSet

router = APIRouter(prefix="/api")


@router.put("/agents/{agent_id}/voice", response_model=VoiceOut)
async def put_voice(request: Request, agent_id: str, body: VoiceSet):
    """Setzt die Stimme einer Figur (`voice: null` setzt sie zurück). Gilt sofort für alle Browser und wandert mit dem Spielstand."""
    sim = request.app.state.sim

    async def handler():
        voice = body.voice.model_dump() if body.voice else None
        if not await sim.engine.db.run(lambda: set_voice(sim.engine, agent_id, voice)):
            raise HTTPException(404, f"Es gibt keine Figur '{agent_id}'.")
        return VoiceOut(agent=agent_id, voice=body.voice)
    return await request.app.state.idempotency.run(sim, request, body, handler)
