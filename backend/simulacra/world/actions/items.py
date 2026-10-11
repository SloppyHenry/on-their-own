"""Gegenstände: inspect, take, drop, give und use (objektspezifische Modi)."""

from typing import Any

from .. import object_kinds
from ..models import Accepted, ActiveAction, AgentBody, RejectCode, Rejected, WorldObject
from .base import Action, Ctx, dist, find_object, held_kind, rej
from .use_modes import MODES

REVEAL_RADIUS = 3.0
HEARING = 4.0


class Inspect(Action):
    name = "inspect"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        oid = params.get("object_id")
        if isinstance(oid, str) and (n := ctx.state.node(oid)):
            if n.location_id != actor.location_id:
                return rej(RejectCode.NOT_HERE, f"Die Quelle '{oid}' ist nicht hier.")
            return Accepted(duration=1, data={"node": oid})
        o = find_object(ctx, actor, oid, allow_held=True)
        if isinstance(o, Rejected):
            return o
        return Accepted(duration=1, data={"object": o.id})

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        if "node" in act.data:
            n = ctx.state.node(act.data["node"])
            if n is None:
                return rej(RejectCode.INVALID_TARGET, "Die Quelle gibt es nicht mehr.")
            ctx.emit("agent.inspected", [actor.id], actor.location_id,
                     {"node": n.id, "resource": n.resource, "amount": int(n.amount), "requires_tool": n.requires_tool})
            return None
        o = ctx.state.obj(act.data["object"])
        if o is None:
            return rej(RejectCode.INVALID_TARGET, "Das Objekt gibt es nicht mehr.")
        ctx.emit("agent.inspected", [actor.id], actor.location_id, {"object": ctx.object_data(o)})
        if o.holder is None and o.x is not None:  # verborgene Objekte in Reichweite entdecken
            for h in ctx.state.objects_at(actor.location_id):
                if h.hidden and actor.id not in h.known_by and dist(actor.pos, (h.x, h.y)) <= REVEAL_RADIUS:
                    h.known_by = sorted({*h.known_by, actor.id})
                    ctx.state.save_object(h)
                    ctx.emit("world.object_discovered", [actor.id], actor.location_id, {"object": ctx.object_data(h)})
        return None


class Take(Action):
    name = "take"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        o = find_object(ctx, actor, params.get("object_id"))
        if isinstance(o, Rejected):
            return o
        if not o.portable:
            return rej(RejectCode.FORBIDDEN_BY_RULES, f"{o.name} lässt sich nicht tragen.")
        if ctx.free_slots(actor) < 1:
            return rej(RejectCode.CAPACITY, "Du kannst nichts mehr tragen.")
        return Accepted(duration=1, data={"object": o.id})

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        o = ctx.state.obj(act.data["object"])
        if o is None or o.holder is not None or o.location_id != actor.location_id:
            return rej(RejectCode.NOT_HERE, "Der Gegenstand ist nicht mehr da.")
        if ctx.free_slots(actor) < 1:
            return rej(RejectCode.CAPACITY, "Du kannst nichts mehr tragen.")
        o.holder, o.location_id, o.x, o.y = actor.id, None, None, None
        ctx.state.save_object(o)
        ctx.emit("agent.item_taken", [actor.id], actor.location_id, {"object": ctx.object_data(o)})
        return None


class Drop(Action):
    name = "drop"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        o = ctx.state.obj(params.get("object_id")) if isinstance(params.get("object_id"), str) else None
        if o is None or o.holder != actor.id:
            return rej(RejectCode.INVALID_TARGET, "Diesen Gegenstand trägst du nicht.")
        return Accepted(duration=1, data={"object": o.id})

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        o = ctx.state.obj(act.data["object"])
        if o is None or o.holder != actor.id:
            return rej(RejectCode.INVALID_TARGET, "Diesen Gegenstand trägst du nicht mehr.")
        o.holder, o.location_id, o.x, o.y = None, actor.location_id, actor.x, actor.y
        ctx.state.save_object(o)
        ctx.emit("agent.item_dropped", [actor.id], actor.location_id, {"object": ctx.object_data(o)})
        return None


class Give(Action):
    name = "give"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        to = ctx.state.agent(params.get("to")) if isinstance(params.get("to"), str) else None
        if to is None or to.id == actor.id:
            return rej(RejectCode.INVALID_TARGET, "Der Empfänger ist ungültig.")
        if to.location_id != actor.location_id:
            return rej(RejectCode.NOT_HERE, f"{to.name} ist nicht am selben Ort.")
        if params.get("object_id") is not None:
            o = ctx.state.obj(params["object_id"]) if isinstance(params["object_id"], str) else None
            if o is None or o.holder != actor.id:
                return rej(RejectCode.INVALID_TARGET, "Diesen Gegenstand trägst du nicht.")
            if ctx.free_slots(to) < 1:
                return rej(RejectCode.CAPACITY, f"{to.name} kann nichts mehr tragen.")
            return Accepted(duration=1, data={"to": to.id, "object": o.id})
        res, amount = params.get("resource"), params.get("amount", 1)
        if not isinstance(res, str) or isinstance(amount, bool) or not isinstance(amount, int) or amount < 1:
            return rej(RejectCode.INVALID_TARGET, "Gib einen Gegenstand oder eine Ressource mit Menge an.")
        if actor.inventory.get(res, 0) < amount:
            return rej(RejectCode.MISSING_RESOURCE, f"Du hast nicht genug {res}.")
        if ctx.free_slots(to) < amount:
            return rej(RejectCode.CAPACITY, f"{to.name} kann nicht so viel tragen.")
        return Accepted(duration=1, data={"to": to.id, "resource": res, "amount": amount})

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        to = ctx.state.agent(act.data["to"])
        if to is None or to.location_id != actor.location_id:
            return rej(RejectCode.NOT_HERE, "Der Empfänger ist nicht mehr da.")
        if "object" in act.data:
            o = ctx.state.obj(act.data["object"])
            if o is None or o.holder != actor.id or ctx.free_slots(to) < 1:
                return rej(RejectCode.CAPACITY, "Die Übergabe ist nicht mehr möglich.")
            o.holder = to.id
            ctx.state.save_object(o)
            ctx.emit("agent.item_given", [actor.id, to.id], actor.location_id, {"object": ctx.object_data(o), "from": actor.id, "to": to.id})
            return None
        res, amount = act.data["resource"], act.data["amount"]
        if actor.inventory.get(res, 0) < amount or ctx.free_slots(to) < amount:
            return rej(RejectCode.CAPACITY, "Die Übergabe ist nicht mehr möglich.")
        ctx.inv_add(actor, res, -amount)
        ctx.inv_add(to, res, amount)
        ctx.emit("agent.item_given", [actor.id, to.id], actor.location_id, {"resource": res, "amount": amount, "from": actor.id, "to": to.id})
        return None


class Use(Action):
    name = "use"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        o = find_object(ctx, actor, params.get("object_id"))
        if isinstance(o, Rejected):
            return o
        mode = params.get("mode")
        spec = object_kinds.get(o.kind)
        if mode not in spec.modes:
            have = ", ".join(spec.modes) or "keine"
            return rej(RejectCode.INVALID_TARGET, f"{o.name} kennt den Modus '{mode}' nicht (möglich: {have}).")
        res = MODES[(o.kind, mode)].validate(ctx, actor, o, params)
        if isinstance(res, Rejected):
            return res
        res.data.update(object=o.id, mode=mode)
        return res

    def start(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        o = ctx.state.obj(act.data["object"])
        MODES[(o.kind, act.data["mode"])].start(ctx, actor, o, act)

    def step(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        o = ctx.state.obj(act.data["object"])
        if o is not None:
            MODES[(o.kind, act.data["mode"])].step(ctx, actor, o, act)

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        o = ctx.state.obj(act.data["object"])
        if o is None or (o.location_id != actor.location_id and o.holder != actor.id):
            return rej(RejectCode.NOT_HERE, "Das Objekt ist nicht mehr da.")
        return MODES[(o.kind, act.data["mode"])].finish(ctx, actor, o, act)
