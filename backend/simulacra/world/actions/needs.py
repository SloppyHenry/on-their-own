"""Bedürfnisse: Ruhen und Schlafen (Essen und Trinken stehen in resources.py)."""

import math

from ..models import Accepted, ActiveAction, AgentBody, RejectCode, Rejected, WorldObject
from .base import Action, Ctx, find_object, local_objects, rej

SLEEP_RATE = 0.25      # Energie je Minute im Bett
REST_RATE = 0.10       # Energie je Minute ohne Sitzgelegenheit
REST_RATE_COMFY = 0.30


def validate_sleep(ctx: Ctx, actor: AgentBody, bed: WorldObject | None, params: dict) -> Accepted | Rejected:
    if bed is None:
        beds = [b for b in local_objects(ctx, actor, "bed") if b.owner in (None, actor.id)]
        if not beds:
            return rej(RejectCode.NOT_HERE, "Hier gibt es kein Bett, das du benutzen kannst.")
        bed = beds[0]
    if bed.owner not in (None, actor.id):
        return rej(RejectCode.FORBIDDEN_BY_RULES, f"{bed.name} gehört jemand anderem.")
    minutes = params.get("minutes")
    if minutes is None:
        minutes = min(600, max(30, math.ceil((100 - actor.needs["energy"]) / SLEEP_RATE)))
    if isinstance(minutes, bool) or not isinstance(minutes, int) or not 10 <= minutes <= 600:
        return rej(RejectCode.INVALID_TARGET, "Schlafen geht von 10 bis 600 Minuten.")
    return Accepted(duration=minutes, data={"bed": bed.id})


def validate_rest(ctx: Ctx, actor: AgentBody, seat: WorldObject | None, params: dict) -> Accepted | Rejected:
    minutes = params.get("minutes", 15)
    if isinstance(minutes, bool) or not isinstance(minutes, int) or not 5 <= minutes <= 120:
        return rej(RejectCode.INVALID_TARGET, "Ausruhen geht von 5 bis 120 Minuten.")
    comfy = seat is not None or bool(local_objects(ctx, actor, "sofa", "bench"))
    return Accepted(duration=minutes, data={"comfy": comfy})


def sleep_step(ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
    actor.needs["energy"] = min(100.0, actor.needs["energy"] + SLEEP_RATE)


def rest_step(ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
    rate = REST_RATE_COMFY if act.data.get("comfy") else REST_RATE
    actor.needs["energy"] = min(100.0, actor.needs["energy"] + rate)


class Sleep(Action):
    name = "sleep"

    def validate(self, ctx, actor, params):
        bed = None
        if params.get("object_id") is not None:
            bed = find_object(ctx, actor, params["object_id"], kinds=("bed",))
            if isinstance(bed, Rejected):
                return bed
        return validate_sleep(ctx, actor, bed, params)

    def step(self, ctx, actor, act):
        sleep_step(ctx, actor, act)

    def finish(self, ctx, actor, act):
        ctx.emit("agent.slept", [actor.id], actor.location_id, {"energy": round(actor.needs["energy"], 1), "minutes": act.ends_at - act.started_at})
        return None


class Rest(Action):
    name = "rest"

    def validate(self, ctx, actor, params):
        seat = None
        if params.get("object_id") is not None:
            seat = find_object(ctx, actor, params["object_id"], kinds=("sofa", "bench", "bed"))
            if isinstance(seat, Rejected):
                return seat
        return validate_rest(ctx, actor, seat, params)

    def step(self, ctx, actor, act):
        rest_step(ctx, actor, act)

    def finish(self, ctx, actor, act):
        ctx.emit("agent.rested", [actor.id], actor.location_id, {"energy": round(actor.needs["energy"], 1)})
        return None
