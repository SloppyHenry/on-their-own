"""Bewegung: move_to (Ort, Objekt, Ressourcenquelle, Agent oder Kachel) und wait."""

from typing import Any

from .. import weather
from ..models import Accepted, ActiveAction, AgentBody, RejectCode, Rejected
from .base import Action, Ctx, rej

Pos = tuple[int, int]
NEIGHBORS = ((0, 0), (0, 1), (0, -1), (1, 0), (-1, 0))


def _resolve_goal_candidates(ctx: Ctx, actor: AgentBody, params: dict[str, Any]) -> tuple[list[Pos], str] | Rejected:
    """Mögliche Zielkacheln (nach Nähe zum Ziel sortiert) und eine Beschreibung."""
    st = ctx.state
    if "tile" in params:
        t = params["tile"]
        if not (isinstance(t, (list, tuple)) and len(t) == 2 and all(isinstance(v, int) for v in t)):
            return rej(RejectCode.INVALID_TARGET, "Die Kachel muss als [x, y] angegeben werden.")
        return [(t[0], t[1])], f"Kachel {t[0]},{t[1]}"
    target = params.get("target")
    if not isinstance(target, str) or not target:
        return rej(RejectCode.INVALID_TARGET, "Es wurde kein Ziel angegeben.")
    if target in st.locations:
        loc = st.locations[target]
        if loc.props.get("fallback"):
            return rej(RejectCode.INVALID_TARGET, f"'{loc.name}' ist kein einzelnes Ziel; nenne einen konkreten Ort oder eine Kachel.")
        rx, ry, w, h = loc.rect
        cx, cy = rx + w / 2, ry + h / 2
        tiles = [(x, y) for y in range(ry, ry + h) for x in range(rx, rx + w) if st.location_at(x, y) == loc.id]
        tiles += [t for t in loc.extra_tiles if t not in tiles]
        tiles.sort(key=lambda t: abs(t[0] - cx) + abs(t[1] - cy))
        return tiles, loc.name
    o = st.obj(target)
    if o is not None:
        if not o.visible_to(actor.id):
            return rej(RejectCode.INVALID_TARGET, f"Ein Objekt '{target}' ist nicht bekannt.")
        if o.holder is not None:
            return rej(RejectCode.NOT_REACHABLE, f"{o.name} wird getragen.")
        return _around(ctx, (o.x, o.y), o.location_id), o.name
    n = st.node(target)
    if n is not None:
        return _around(ctx, (n.x, n.y), n.location_id), n.resource
    other = st.agent(target)
    if other is not None and other.id != actor.id:
        return _around(ctx, other.pos, None), other.name
    return rej(RejectCode.INVALID_TARGET, f"Das Ziel '{target}' gibt es nicht.")


def _around(ctx: Ctx, pos: Pos, location_id: str | None) -> list[Pos]:
    cands = [(pos[0] + dx, pos[1] + dy) for dx, dy in NEIGHBORS]
    cands = [c for c in cands if ctx.state.grid.is_open(*c)]
    if location_id:  # nur Kacheln, von denen aus das Objekt benutzbar ist
        same = [c for c in cands if ctx.state.location_at(*c) == location_id]
        cands = same or cands
    return cands


class MoveTo(Action):
    name = "move_to"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        res = _resolve_goal_candidates(ctx, actor, params)
        if isinstance(res, Rejected):
            return res
        cands, label = res
        grid = ctx.state.grid
        cands = [c for c in cands if grid.in_bounds(*c)]
        if not cands:
            return rej(RejectCode.NOT_REACHABLE, f"{label} liegt außerhalb der Karte oder ist nicht erreichbar.")
        if all(c in grid.forbidden for c in cands):
            return rej(RejectCode.FORBIDDEN_BY_RULES, f"{label} darf nach den Weltregeln nicht betreten werden.")
        best: list[Pos] | None = None
        best_cost = 1 << 30
        for goal in cands[:8]:
            path = ctx.state.pathfinder.find(actor.pos, goal)
            if path is None:
                continue
            cost = sum(grid.cost(*p) for p in path)
            if cost < best_cost:
                best, best_cost = path, cost
            if params.get("target") in ctx.state.locations:
                break  # bei Orten reicht der erste erreichbare Punkt nahe der Mitte
        if best is None:
            return rej(RejectCode.NOT_REACHABLE, f"Zu {label} gibt es von hier aus keinen Weg.")
        if not best:
            return Accepted(duration=1, data={"path": [], "goal": list(actor.pos), "label": label, "done_immediately": True})
        return Accepted(duration=None, data={"path": [list(p) for p in best], "goal": list(best[-1]), "label": label})

    def start(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        if act.data.get("done_immediately"):
            act.data["done"] = True
        act.data["from_location"] = actor.location_id

    def step(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        path = act.data["path"]
        if not path:
            act.data["done"] = True
            return
        nx, ny = path[0]
        grid = ctx.state.grid
        if not grid.is_open(nx, ny):  # Weg wurde versperrt: einmal neu planen
            goal = tuple(act.data["goal"])
            new = ctx.state.pathfinder.find(actor.pos, goal)
            if new is None:
                act.data["failed"] = (RejectCode.NOT_REACHABLE.value, "Der Weg ist versperrt.")
                return
            act.data["path"] = path = [list(p) for p in new]
            nx, ny = path[0]
        mult = weather.MOVE_MULT[ctx.state.weather()["kind"]]
        need = grid.cost(nx, ny) * mult
        actor.move_budget += 1.0
        if actor.move_budget + 1e-9 < need:
            return
        actor.move_budget -= need
        old, old_loc = actor.pos, actor.location_id
        actor.x, actor.y = nx, ny
        actor.facing = "right" if nx > old[0] else "left" if nx < old[0] else "down" if ny > old[1] else "up"
        actor.location_id = ctx.state.location_at(nx, ny)
        path.pop(0)
        if ctx.rules.needs_enabled:
            actor.needs["energy"] = max(0.0, actor.needs["energy"] - ctx.rules.energy_per_tile)
        ctx.emit("agent.moved", [actor.id], actor.location_id, {"from": list(old), "to": [nx, ny], "facing": actor.facing})
        if actor.location_id != old_loc:
            ctx.emit("agent.location_changed", [actor.id], actor.location_id, {"from_location": old_loc, "to_location": actor.location_id})
            if ctx.state.mark_discovered(actor.location_id, actor.id):
                ctx.emit("agent.location_discovered", [actor.id], actor.location_id, {"location": actor.location_id})
        if not path:
            act.data["done"] = True

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        ctx.emit("agent.arrived", [actor.id], actor.location_id, {"target": act.params.get("target"), "label": act.data.get("label"), "at": [actor.x, actor.y]})
        return None


class Wait(Action):
    name = "wait"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        m = params.get("minutes", 5)
        if isinstance(m, bool) or not isinstance(m, int) or not 1 <= m <= 60:
            return rej(RejectCode.INVALID_TARGET, "Warten geht von 1 bis 60 Minuten.")
        return Accepted(duration=m)
