"""Bauen: Baustelle mit Fortschritt, nach Ablauf entsteht das Objekt (ggf. mit Kachelwechsel)."""

import math

from .. import object_kinds, weather
from ..models import Accepted, ActiveAction, AgentBody, RejectCode, Rejected, WorldObject
from .base import Action, Ctx, find_object, local_objects, rej

Pos = tuple[int, int]
SEARCH_RADIUS = 2
PIER_RADIUS = 4


class Build(Action):
    name = "build"

    def validate(self, ctx: Ctx, actor: AgentBody, params: dict) -> Accepted | Rejected:
        if params.get("site_id") is not None:
            site = find_object(ctx, actor, params["site_id"], kinds=("construction_site",))
            if isinstance(site, Rejected):
                return site
            left = max(1, site.state["total"] - site.state["progress"])
            return Accepted(duration=left, data={"site": site.id, "blueprint": site.state["blueprint"], "resume": True})
        bp_id = params.get("blueprint")
        bp = ctx.blueprints.get(bp_id) if isinstance(bp_id, str) else None
        if bp is None:
            return rej(RejectCode.INVALID_TARGET, f"Unbekannte Bauvorlage '{bp_id}' (möglich: {', '.join(sorted(ctx.blueprints))}).")
        cost = {r: max(1, math.ceil(q * ctx.rules.build_cost_mult)) for r, q in bp["cost"].items()}
        missing = {r: q - actor.inventory.get(r, 0) for r, q in cost.items() if actor.inventory.get(r, 0) < q}
        if missing:
            return rej(RejectCode.MISSING_RESOURCE, "Es fehlt: " + ", ".join(f"{q}× {r}" for r, q in missing.items()) + ".")
        where = bp.get("where", "outdoor")
        if where == "outdoor" and actor.location_id.startswith("house."):
            return rej(RejectCode.FORBIDDEN_BY_RULES, f"{bp['name']} wird draußen gebaut, nicht im Haus.")
        if where == "lake" and actor.location_id != "lake":
            return rej(RejectCode.NOT_HERE, f"{bp['name']} wird am See gebaut.")
        if where != "indoor" and ctx.state.weather()["kind"] in weather.BLOCKS_OUTDOOR_BUILD and not actor.location_id.startswith("house."):
            return rej(RejectCode.FORBIDDEN_BY_RULES, "Bei Sturm wird draußen nicht gebaut.")
        if bp.get("workbench") and not local_objects(ctx, actor, "workbench"):
            return rej(RejectCode.NOT_HERE, f"{bp['name']} braucht eine Werkbank an diesem Ort.")
        if ctx.state.object_count() >= ctx.rules.max_objects:
            return rej(RejectCode.FORBIDDEN_BY_RULES, "Die Welt kann keine weiteren Objekte aufnehmen.")
        tile = self._choose_tile(ctx, actor, bp, params.get("at"))
        if isinstance(tile, Rejected):
            return tile
        minutes = max(1, math.ceil(bp["minutes"] * ctx.rules.build_duration_mult))
        return Accepted(duration=minutes, data={"blueprint": bp_id, "tile": list(tile), "cost": cost, "total": minutes})

    def _choose_tile(self, ctx: Ctx, actor: AgentBody, bp: dict, at) -> Pos | Rejected:
        st, grid = ctx.state, ctx.state.grid
        taken = {(o.x, o.y) for o in st.objects_at(actor.location_id)}
        pier = bp.get("tile_effect") == "floor"

        def ok(x: int, y: int) -> bool:
            if not grid.in_bounds(x, y) or st.location_at(x, y) != actor.location_id or (x, y) in taken:
                return False
            if pier:
                return grid.tile(x, y) == "water" and any(grid.in_bounds(x + dx, y + dy) and grid.tile(x + dx, y + dy) == "floor"
                                                          for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            return grid.walkable(x, y) and (x, y) not in grid.blocked

        radius = PIER_RADIUS if pier else SEARCH_RADIUS
        if at is not None:
            if not (isinstance(at, (list, tuple)) and len(at) == 2 and all(isinstance(v, int) for v in at)):
                return rej(RejectCode.INVALID_TARGET, "Der Bauplatz muss als [x, y] angegeben werden.")
            if max(abs(at[0] - actor.x), abs(at[1] - actor.y)) > radius:
                return rej(RejectCode.NOT_HERE, "Der Bauplatz ist zu weit entfernt.")
            return (at[0], at[1]) if ok(*at) else rej(RejectCode.INVALID_TARGET, "Dort kann nicht gebaut werden (belegt, nicht passend oder anderer Ort).")
        cands = [(actor.x + dx, actor.y + dy) for dx in range(-radius, radius + 1) for dy in range(-radius, radius + 1)]
        cands = sorted((c for c in cands if ok(*c)), key=lambda c: (c == actor.pos, abs(c[0] - actor.x) + abs(c[1] - actor.y)))
        return cands[0] if cands else rej(RejectCode.NOT_HERE, "In der Nähe ist kein passender Bauplatz frei.")

    def start(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        if act.data.get("resume"):
            return
        for r, q in act.data["cost"].items():
            ctx.inv_add(actor, r, -q)
        bp = ctx.blueprints[act.data["blueprint"]]
        x, y = act.data["tile"]
        site = WorldObject(id=ctx.state.next_object_id("site"), kind="construction_site", name=f"Baustelle: {bp['name']}",
                           location_id=actor.location_id, x=x, y=y, created_by=actor.id, created_at=ctx.minute,
                           state={"blueprint": act.data["blueprint"], "progress": 0, "total": act.data["total"], "builder": actor.id})
        ctx.state.save_object(site, new=True)
        act.data["site"] = site.id
        ctx.emit("world.object_created", [actor.id], actor.location_id, {"object": ctx.object_data(site), "cause": "build_started"})

    def step(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> None:
        site = ctx.state.obj(act.data["site"])
        if site is None:
            act.data["failed"] = (RejectCode.INVALID_TARGET.value, "Die Baustelle gibt es nicht mehr.")
            return
        site.state["progress"] += 1
        ctx.state.save_object(site)

    def finish(self, ctx: Ctx, actor: AgentBody, act: ActiveAction) -> Rejected | None:
        site = ctx.state.obj(act.data["site"])
        if site is None:
            return rej(RejectCode.INVALID_TARGET, "Die Baustelle gibt es nicht mehr.")
        bp = ctx.blueprints[site.state["blueprint"]]
        ctx.state.remove_object(site.id)
        ctx.emit("world.object_removed", [actor.id], site.location_id, {"object": ctx.object_data(site), "cause": "build_done"})
        obj = WorldObject(id=ctx.state.next_object_id(bp["kind"]), kind=bp["kind"], name=bp["name"], location_id=site.location_id,
                          x=site.x, y=site.y, created_by=actor.id, created_at=ctx.minute, portable=object_kinds.spec(bp["kind"]).portable,
                          state=object_kinds.normalize_state(bp["kind"], {}))
        ctx.state.save_object(obj, new=True)
        if bp.get("tile_effect"):
            ctx.state.conn.execute("UPDATE tiles SET type=? WHERE x=? AND y=?", (bp["tile_effect"], site.x, site.y))
            ctx.state.grid.set_tile(site.x, site.y, bp["tile_effect"])
            ctx.emit("world.tile_changed", [actor.id], site.location_id, {"x": site.x, "y": site.y, "type": bp["tile_effect"]})
        ctx.emit("world.object_created", [actor.id], obj.location_id, {"object": ctx.object_data(obj), "cause": "build_done"})
        return None
