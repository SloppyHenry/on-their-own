"""Ausführung geprüfter Operationen (§10.1 Schritt 6): alles eines Ereignisses in **einer Transaktion** über die Welt-Engine. Scheitert eine Operation, bleibt der Zustand
unverändert. Läuft auf dem DB-Thread.
"""

import re
from dataclasses import dataclass, field
from typing import Any

from ..params.registry import REGISTRY as PARAMS
from ..world import clock
from ..world.extend import WorldEditError, _free_tile_in, add_location, remove_object, spawn_object
from ..world.models import Event
from . import knowledge
from .scheduler import Scheduler
from .schema import Op, parse_ops

DIRS = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0)}
THEMES = {"höhle": ["explore", "calm"], "hütte": ["calm"], "lichtung": ["calm", "explore"], "hügel": ["explore"], "bucht": ["calm"]}


@dataclass
class Run:
    sim: Any
    inject_id: str | None
    mode: str
    names: dict[str, str] = field(default_factory=dict)       # Kennung -> Name
    events: list[Event] = field(default_factory=list)
    directive: bool = False

    @property
    def sched(self) -> Scheduler:
        return Scheduler(self.sim.engine.state.conn)


def execute(sim, ops: list[Op], inject_id: str | None, mode: str) -> list[Event]:
    """Alle Operationen atomar ausführen; gibt alle erzeugten Ereignisse zurück (Welt-Ereignisse, Auslieferungen, Planungseinträge)."""
    run = Run(sim, inject_id, mode, {a.id: a.name for a in sim.engine.state.agents()})

    def work(ctx) -> None:
        for op in ops:
            globals()[f"_op_{op.op}"](ctx, op, run)

    events = sim.engine._run(work)
    return list(events) + run.events


def _sched_revert(ctx, run: Run, minute: int, revert: dict[str, Any], text: str) -> None:
    run.sched.add(minute, "revert", [revert], text, ctx.minute, run.inject_id)


# --- Welt -----------------------------------------------------------------------------------------------------
def _op_set_weather(ctx, op, run):
    old = ctx.state.weather()
    ctx.state.set_weather(op.weather, ctx.minute, ctx.minute + op.duration_minutes)
    ctx.emit("world.weather_changed", data={"from": old["kind"], "to": op.weather, "until": ctx.minute + op.duration_minutes, "cause": "user_event"})


def _describe(kind: str, description: str, state: dict[str, Any]) -> dict[str, Any]:
    from ..world import object_kinds
    schema = object_kinds.KINDS[kind].schema
    for key in ("description", "text"):
        if description and key in schema and not state.get(key):
            state[key] = description
    return state


def _op_spawn_object(ctx, op, run):
    state = _describe(op.kind, op.description, dict(op.state))
    obj = spawn_object(ctx, op.kind, op.name, tile=op.tile, location_id=op.location if not op.tile else None, hidden=op.hidden, known_by=op.known_by, state=state, cause="user_event")
    for a in op.known_by:                                              # „Alex findet …“: er entdeckt es, andere noch nicht
        ctx.emit("world.object_discovered", [a], obj.location_id, {"object": ctx.object_data(obj)})
    if op.duration_minutes:
        _sched_revert(ctx, run, ctx.minute + op.duration_minutes, {"revert": "remove_objects", "ids": [obj.id]}, f"„{obj.name}“ verschwindet wieder")


def _op_give_object(ctx, op, run):
    obj = spawn_object(ctx, op.kind, op.name, holder=op.agent, state=_describe(op.kind, op.description, {}), cause="user_event")
    knowledge.deliver(ctx, [op.agent], "situation", f"{op.name} wurde dir überreicht", inject_id=run.inject_id)
    ctx.emit("world.object_discovered", [op.agent], None, {"object": ctx.object_data(obj)})


def _targets(ctx, op) -> list:
    if op.object_id:
        return [ctx.state.obj(op.object_id)]
    return [o for o in ctx.state.all_objects() if o.kind == op.kind and (op.location is None or (o.location_id or "").startswith(op.location))]


def _op_change_object(ctx, op, run):
    from ..world import object_kinds
    olds, where = [], set()
    for o in _targets(ctx, op):
        olds.append({"id": o.id, "state": dict(o.state)})
        o.state = object_kinds.normalize_state(o.kind, {**o.state, **op.changes})
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [], o.location_id, {**ctx.object_data(o), "change": "user_event"})
        where.add(o.location_id)
    if "powered" in op.changes:
        word = "Der Strom ist wieder da." if op.changes["powered"] else "Der Strom fällt aus."
        if op.location:                                                 # „im Haus“: alle Räume des Hauses merken es
            where |= {i for i in ctx.state.locations if i == op.location or i.startswith(op.location + ".")}
        _tell_present(ctx, run, where, word, "situation")
    if op.duration_minutes:
        _sched_revert(ctx, run, ctx.minute + op.duration_minutes, {"revert": "object_states", "items": olds}, "Der Zustand wird wieder wie vorher")


def _tell_present(ctx, run: Run, locations: set, text: str, kind: str) -> None:
    here = [a.id for a in ctx.state.agents() if a.location_id in locations and a.id in run.sim.store.ai_agent_ids()]
    knowledge.deliver(ctx, here, kind, text, inject_id=run.inject_id)


def find_spot(ctx, anchor: list[int], direction: str, w: int = 6, h: int = 5) -> list[int] | None:
    """Ein freies Rechteck (nur freie, begehbare Kacheln außerhalb aller Orte) neben dem Anker in der gewünschten Richtung."""
    st, g = ctx.state, ctx.state.grid
    ax, ay, aw, ah = anchor
    dx, dy = DIRS[direction]
    for gap in range(1, 9):
        for lat in (0, 2, -2, 4, -4, 6, -6, 8, -8):
            if dx == 0:
                x = ax + (aw - w) // 2 + lat
                y = ay - gap - h + 1 if dy < 0 else ay + ah + gap - 1
            else:
                y = ay + (ah - h) // 2 + lat
                x = ax + aw + gap - 1 if dx > 0 else ax - gap - w + 1
            if x < 0 or y < 0 or x + w > g.width or y + h > g.height:
                continue
            tiles = [(x + i, y + j) for j in range(h) for i in range(w)]
            if all(g.walkable(*t) and (t not in g.blocked) and (st.locations.get(st.location_at(*t)) is None or st.locations[st.location_at(*t)].props.get("fallback")) for t in tiles):
                return [x, y, w, h]
    return None


def _op_add_location(ctx, op, run):
    anchor = ctx.state.locations[op.near]
    rect = find_spot(ctx, list(anchor.rect), op.direction)
    if rect is None:
        raise WorldEditError("blocked", f"Dort ist kein freier Platz für „{op.name}“. Versuche eine andere Himmelsrichtung.")
    base = re.sub(r"[^a-z0-9]+", "_", op.name.lower().replace("ö", "oe").replace("ä", "ae").replace("ü", "ue").replace("ß", "ss")).strip("_") or "ort"
    lid, n = base, 1
    while lid in ctx.state.locations:
        n += 1
        lid = f"{base}{n}"
    themes = next((t for w, t in THEMES.items() if w in op.name.lower()), ["explore"])
    add_location(ctx, lid, op.name, rect, props={"themes": themes, "created_by": "user_event"})


def _op_change_resource(ctx, op, run):
    olds = []
    for n in ctx.state.all_nodes():
        if n.cap >= 900 or (op.resource and n.resource != op.resource) or (op.location and not (n.location_id or "").startswith(op.location)):
            continue
        olds.append({"id": n.id, "cap": n.cap, "regen": n.regen_per_hour, "factor": op.factor})
        cap, regen = n.cap * op.factor, n.regen_per_hour * op.factor
        ctx.state.conn.execute("UPDATE resources SET cap=?, regen_per_hour=?, amount=? WHERE id=?", (cap, regen, min(cap, n.amount * op.factor), n.id))
        ctx.emit("world.resource_changed", [], n.location_id, {"node": n.id, "resource": n.resource, "amount": min(cap, n.amount * op.factor), "cause": "user_event"})
    if op.duration_minutes:
        _sched_revert(ctx, run, ctx.minute + op.duration_minutes, {"revert": "resources", "items": olds}, "Die Vorräte sind wieder wie sonst")


# --- Wissen ---------------------------------------------------------------------------------------------------------
def _about(run: Run, text: str) -> list[str]:
    low = text.lower()
    return [i for i, n in run.names.items() if re.search(rf"(?<![\wäöüß]){re.escape(n.lower())}", low)]


def _op_inform(ctx, op, run):
    src = knowledge.source_phrase(run.mode, op.source, {})
    sender = f"von {op.source}" if op.source else src
    knowledge.deliver(ctx, op.recipients, "inform", op.content, sender=sender, truth=op.truth, about=_about(run, op.content), inject_id=run.inject_id)


def _op_message(ctx, op, run):
    sender = knowledge.source_phrase(run.mode, op.sender, run.names)
    kind = "invite" if op.invite else "message"
    knowledge.deliver(ctx, op.recipients, kind, op.content, sender=sender, when=op.when, where=op.location, about=_about(run, op.content), inject_id=run.inject_id)
    if op.invite and op.when:                                           # eine offene Absicht, damit der Agent es nicht vergisst
        for r in op.recipients:
            run.sim.memory.writer.remember(r, "intention", f"Ich bin eingeladen: {op.content} ({clock.fmt(op.when)}).", 7, ctx.minute, location_id=op.location, force=True,
                                           intention_state="open", intention_due=op.when)


def _op_situation(ctx, op, run):
    if op.object_kind:
        spawn_object(ctx, op.object_kind, op.object_name or op.object_kind, location_id=op.location, state=dict(op.object_state), cause="user_event")
    knowledge.deliver(ctx, op.agents, "situation", op.description, where=op.location, inject_id=run.inject_id)


def _op_schedule(ctx, op, run):
    inner = [o if isinstance(o, dict) else o.model_dump(exclude_none=True) for o in op.ops]
    sid = run.sched.add(op.at, "fire", [{"ops": inner, "duration_minutes": op.duration_minutes}], op.label, ctx.minute, run.inject_id)
    ctx.emit("simulation.event_scheduled", data={"inject_id": run.inject_id, "scheduled_id": sid, "at": op.at, "text": op.label or "Geplantes Ereignis"})


def _op_spawn_npc(ctx, op, run):
    run.sim.npcs.spawn(ctx, op.name, op.description, op.location, op.stay_minutes, run.inject_id)


# --- Anweisungen (nur im Eingriffsmodus) -------------------------------------------------------------------------------
def _op_move_agent(ctx, op, run):
    st = ctx.state
    a = st.agent(op.agent)
    old, act = a.location_id, a.action
    a.x, a.y = _free_tile_in(ctx, op.location)
    a.location_id, a.action = op.location, None
    st.save_agent(a)
    if act is not None:                      # ein laufender Weg oder eine Tätigkeit endet mit dem Versetzen
        ctx.emit("agent.action_interrupted", [op.agent], old, {"action": act.type, "reason": "versetzt", "at": [a.x, a.y]})
    if st.mark_discovered(op.location, op.agent):
        ctx.emit("agent.location_discovered", [op.agent], op.location, {"location": op.location})
    ctx.emit("agent.location_changed", [op.agent], op.location, {"from_location": old, "to_location": op.location, "at": [a.x, a.y]})


def _op_suggest_goal(ctx, op, run):
    sender = knowledge.source_phrase(run.mode, "", {}) or "von außen"
    knowledge.deliver(ctx, [op.agent], "suggestion", op.text, sender=sender, inject_id=run.inject_id)
    run.sim.memory.writer.remember(op.agent, "intention", f"Ich möchte: {op.text}", 7, ctx.minute, force=True, intention_state="open")


def _op_temp_param(ctx, op, run):
    spec = PARAMS[op.key]
    old = spec.read(run.sim, None)
    spec.apply(run.sim, op.value, None)
    _sched_revert(ctx, run, ctx.minute + op.duration_minutes, {"revert": "param", "key": op.key, "value": old}, f"{spec.label} ist wieder {old}")


# --- Rücknahme befristeter Wirkungen -------------------------------------------------------------------------------------
def revert(sim, ctx, rv: dict[str, Any]) -> None:
    kind = rv["revert"]
    st = ctx.state
    if kind == "remove_objects":
        for oid in rv["ids"]:
            if st.obj(oid) is not None:
                remove_object(ctx, oid, cause="expired")
    elif kind == "object_states":
        for it in rv["items"]:
            o = st.obj(it["id"])
            if o is not None:
                o.state = it["state"]
                st.save_object(o)
                ctx.emit("world.object_changed", [], o.location_id, {**ctx.object_data(o), "change": "expired"})
        informed = {st.obj(i["id"]).location_id for i in rv["items"] if st.obj(i["id"])}
        if any("powered" in i["state"] for i in rv["items"]):
            here = [a.id for a in st.agents() if a.location_id in informed and a.id in sim.store.ai_agent_ids()]
            knowledge.deliver(ctx, here, "situation", "Der Strom ist wieder da.")
    elif kind == "resources":
        for it in rv["items"]:
            n = st.node(it["id"])
            if n is not None:
                st.conn.execute("UPDATE resources SET cap=?, regen_per_hour=?, amount=? WHERE id=?", (it["cap"], it["regen"], min(it["cap"], n.amount / it["factor"]), n.id))
    elif kind == "param":
        PARAMS[rv["key"]].apply(sim, rv["value"], None)
