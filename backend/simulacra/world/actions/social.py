"""Soziales: speak. Die Gesprächslogik (wer wann spricht) liegt im Agentenzyklus (AP02)."""

from ..models import Accepted, RejectCode
from .base import Action, dist, rej

HEARING_RANGE = 4.0
MAX_TEXT = 500


class Speak(Action):
    name = "speak"

    def validate(self, ctx, actor, params):
        to = ctx.state.agent(params["to"]) if isinstance(params.get("to"), str) else None
        if to is None or to.id == actor.id:
            return rej(RejectCode.INVALID_TARGET, "Der Gesprächspartner ist ungültig.")
        if to.location_id != actor.location_id and dist(actor.pos, to.pos) > HEARING_RANGE:
            return rej(RejectCode.NOT_HERE, f"{to.name} ist zu weit weg, um dich zu hören.")
        text = params.get("text")
        if not isinstance(text, str) or not text.strip():
            return rej(RejectCode.INVALID_TARGET, "Es fehlt der Text.")
        if len(text) > MAX_TEXT:
            return rej(RejectCode.INVALID_TARGET, f"Der Text darf höchstens {MAX_TEXT} Zeichen lang sein.")
        return Accepted(duration=1 + len(text) // 80, data={"to": to.id, "text": text.strip()})

    def finish(self, ctx, actor, act):
        to = ctx.state.agent(act.data["to"])
        if to is None or (to.location_id != actor.location_id and dist(actor.pos, to.pos) > HEARING_RANGE):
            return rej(RejectCode.NOT_HERE, "Der Gesprächspartner ist inzwischen außer Hörweite.")
        ctx.emit("agent.dialogue", [actor.id, to.id], actor.location_id, {"speaker": actor.id, "to": to.id, "text": act.data["text"]})
        return None
