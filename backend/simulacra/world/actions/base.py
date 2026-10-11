"""Rahmen für Aktionen: Kontext, Ablehnungen, gemeinsame Prüfungen."""

import math
import random
from typing import TYPE_CHECKING, Any

from ..models import (Accepted, ActiveAction, AgentBody, Event, RejectCode, Rejected, WorldObject)

if TYPE_CHECKING:
    from ..engine import WorldEngine


def rej(code: RejectCode, text: str) -> Rejected:
    return Rejected(code=code, text=text)


class Ctx:
    """Handlungskontext einer Transaktion: Zustand, Ereignissammlung, Zufall."""

    def __init__(self, engine: "WorldEngine", minute: int):
        self.engine = engine
        self.state = engine.state
        self.minute = minute
        self.events: list[Event] = []
        self.default_parent: int | None = None      # Standard-Ursache für Ereignisse dieser Operation
        self.blueprints = engine.blueprints

    @property
    def rules(self):
        return self.state.rules

    def rng(self, *salt: Any) -> random.Random:
        return random.Random(f"{self.state.get_meta('seed')}:{self.minute}:" + ":".join(map(str, salt)))

    def emit(self, type_: str, agents: list[str] | None = None, location_id: str | None = None,
             data: dict | None = None, parent: Event | int | None = None) -> Event:
        from ..events import insert_event
        parent_seq = parent.seq if isinstance(parent, Event) else (parent if parent is not None else self.default_parent)
        ev = insert_event(self.state.conn, self.minute, type_, agents, location_id, data, parent_seq)
        self.events.append(ev)
        return ev

    def object_data(self, o: WorldObject) -> dict[str, Any]:
        return {"id": o.id, "kind": o.kind, "name": o.name, "x": o.x, "y": o.y, "location_id": o.location_id,
                "holder": o.holder, "state": o.state}

    def inv_add(self, actor: AgentBody, resource: str, delta: int) -> int:
        qty = max(0, actor.inventory.get(resource, 0) + delta)
        actor.inventory[resource] = qty
        if qty == 0:
            actor.inventory.pop(resource)
        self.state.inv_set(actor.id, resource, qty)
        self.emit("agent.inventory_changed", [actor.id], actor.location_id, {"resource": resource, "delta": delta, "qty": qty})
        return qty

    def free_slots(self, actor: AgentBody) -> int:
        return actor.capacity - self.state.inv_load(actor)


class Action:
    """Eine Aktionsart. `validate` ändert nichts; `start`/`step`/`finish` ändern den Zustand."""
    name = ""

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        raise NotImplementedError

    def start(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        pass

    def step(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        pass

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        return None


def dist(a: tuple[int, int], b: tuple[int, int]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def find_object(ctx: Ctx, actor: AgentBody, object_id: Any, *, kinds: tuple[str, ...] | None = None,
                allow_held: bool = False) -> WorldObject | Rejected:
    """Objekt per ID: muss existieren, dem Agenten bekannt sein und am selben Ort liegen (oder getragen werden)."""
    if not isinstance(object_id, str) or not object_id:
        return rej(RejectCode.INVALID_TARGET, "Es wurde kein Objekt angegeben.")
    o = ctx.state.obj(object_id)
    if o is None or not o.visible_to(actor.id):
        return rej(RejectCode.INVALID_TARGET, f"Ein Objekt '{object_id}' ist nicht bekannt.")
    if kinds and o.kind not in kinds:
        return rej(RejectCode.INVALID_TARGET, f"{o.name} passt nicht zu dieser Aktion.")
    if o.holder == actor.id:
        return o if allow_held else rej(RejectCode.INVALID_TARGET, f"{o.name} trägst du bei dir.")
    if o.holder is not None:
        return rej(RejectCode.NOT_HERE, f"{o.name} gehört gerade jemand anderem.")
    if o.location_id != actor.location_id:
        return rej(RejectCode.NOT_HERE, f"{o.name} ist nicht hier, sondern an einem anderen Ort.")
    return o


def held_kind(ctx: Ctx, actor: AgentBody, kind: str) -> WorldObject | None:
    return next((o for o in ctx.state.objects_held(actor.id) if o.kind == kind), None)


def local_objects(ctx: Ctx, actor: AgentBody, *kinds: str) -> list[WorldObject]:
    return [o for o in ctx.state.objects_at(actor.location_id) if o.kind in kinds and o.visible_to(actor.id)]
