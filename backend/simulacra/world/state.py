"""Zugriff auf den persistenten Weltzustand. Verändert wird er nur über die Engine (world/engine.py)."""

import json
import sqlite3
from typing import Any

from ..db.connection import Database
from . import object_kinds
from .grid import Grid, TileType
from .models import AgentBody, ActiveAction, Location, ResourceNode, WorldObject
from .pathfinding import Pathfinder
from .rules import WorldRules


def _j(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False)


class WorldState:
    def __init__(self, db: Database):
        self.db = db
        self.grid: Grid
        self.pathfinder: Pathfinder
        self.locations: dict[str, Location] = {}
        self.tile_types: dict[str, TileType] = {}
        self._loc_index: dict[tuple[int, int], str] = {}
        self.rules = WorldRules()
        if self.is_seeded():
            self.reload_caches()

    @property
    def conn(self) -> sqlite3.Connection:
        return self.db.conn

    # --- Meta, Zeit, Wetter ------------------------------------------------------------
    def is_seeded(self) -> bool:
        return self.conn.execute("SELECT 1 FROM meta WHERE key='seeded'").fetchone() is not None

    def get_meta(self, key: str, default: Any = None) -> Any:
        r = self.conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return json.loads(r["value"]) if r else default

    def set_meta(self, key: str, value: Any) -> None:
        self.conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, _j(value)))

    @property
    def minute(self) -> int:
        return self.conn.execute("SELECT minute FROM clock").fetchone()["minute"]

    def set_minute(self, minute: int) -> None:
        self.conn.execute("UPDATE clock SET minute=?", (minute,))

    def weather(self) -> dict[str, Any]:
        return dict(self.conn.execute("SELECT kind, since, until FROM weather").fetchone())

    def set_weather(self, kind: str, since: int, until: int) -> None:
        self.conn.execute("UPDATE weather SET kind=?, since=?, until=?", (kind, since, until))

    def save_rules(self, rules: WorldRules) -> None:
        self.rules = rules
        self.set_meta("rules", rules.model_dump())

    # --- Caches (Raster, Orte, Sperren) -------------------------------------------------
    def reload_caches(self) -> None:
        """Baut Raster, Ortsindex und Sperren aus der Datenbank neu auf (auch nach Rollback)."""
        w, h = self.get_meta("size")
        self.tile_types = self.load_tile_types()
        fill = next(iter(self.tile_types))
        cells = [[fill] * w for _ in range(h)]
        for r in self.conn.execute("SELECT x, y, type FROM tiles"):
            cells[r["y"]][r["x"]] = r["type"]
        self.grid = Grid(w, h, cells, self.tile_types)
        self.grid.set_links(self.get_meta("links") or [])
        self.pathfinder = Pathfinder(self.grid)
        self.locations = {}
        for r in self.conn.execute("SELECT * FROM locations ORDER BY sort"):
            self.locations[r["id"]] = Location(
                id=r["id"], name=r["name"], rect=tuple(json.loads(r["rect"])), entrances=json.loads(r["entrances"]),
                extra_tiles=[tuple(t) for t in json.loads(r["extra_tiles"])], props=json.loads(r["props"]),
                discovered_by=json.loads(r["discovered_by"]))
        self._build_loc_index()
        self.rules = WorldRules(**(self.get_meta("rules") or {}))
        self.refresh_blocked()
        self.refresh_forbidden()

    def load_tile_types(self) -> dict[str, TileType]:
        return {r["id"]: TileType(r["id"], bool(r["walkable"]), r["cost"], r["char"], r["color"], r["label"])
                for r in self.conn.execute("SELECT * FROM tile_types ORDER BY rowid")}

    def _build_loc_index(self) -> None:
        self._loc_index = {}
        fallback = next((l.id for l in self.locations.values() if l.props.get("fallback")), None)
        for y in range(self.grid.height):
            for x in range(self.grid.width):
                loc = next((l.id for l in self.locations.values() if not l.props.get("fallback") and l.contains(x, y)), fallback)
                if loc:
                    self._loc_index[(x, y)] = loc

    def location_at(self, x: int, y: int) -> str:
        return self._loc_index[(x, y)]

    def refresh_blocked(self) -> None:
        blocked = set()
        for r in self.conn.execute("SELECT kind, x, y, state FROM objects WHERE holder IS NULL AND x IS NOT NULL"):
            if object_kinds.spec(r["kind"]).blocks or (r["kind"] == "door" and json.loads(r["state"]).get("locked")):
                blocked.add((r["x"], r["y"]))
        self.grid.set_blocked(blocked)

    def refresh_forbidden(self) -> None:
        rules, forbidden = self.rules, set()
        home = self.get_meta("home")
        for (x, y), loc in self._loc_index.items():
            if loc in rules.movement_blocked_locations:
                forbidden.add((x, y))
            elif rules.home_radius is not None and home and max(abs(x - home[0]), abs(y - home[1])) > rules.home_radius:
                forbidden.add((x, y))
        self.grid.set_forbidden(forbidden)

    # --- Agenten -------------------------------------------------------------------------
    def _agent(self, r: sqlite3.Row) -> AgentBody:
        inv = {i["resource"]: i["qty"] for i in self.conn.execute("SELECT resource, qty FROM inventory WHERE agent_id=? AND qty>0", (r["id"],))}
        action = ActiveAction(**json.loads(r["action"])) if r["action"] else None
        return AgentBody(id=r["id"], name=r["name"], x=r["x"], y=r["y"], location_id=r["location_id"], capacity=r["capacity"],
                         needs=json.loads(r["needs"]), action=action, move_budget=r["move_budget"], facing=r["facing"], inventory=inv)

    def agent(self, agent_id: str) -> AgentBody | None:
        r = self.conn.execute("SELECT * FROM agents_body WHERE id=?", (agent_id,)).fetchone()
        return self._agent(r) if r else None

    def agents(self) -> list[AgentBody]:
        return [self._agent(r) for r in self.conn.execute("SELECT * FROM agents_body ORDER BY id")]

    def save_agent(self, a: AgentBody) -> None:
        self.conn.execute(
            "UPDATE agents_body SET x=?, y=?, location_id=?, needs=?, action=?, move_budget=?, facing=? WHERE id=?",
            (a.x, a.y, a.location_id, _j(a.needs), _j(a.action.model_dump()) if a.action else None, a.move_budget, a.facing, a.id))

    def inv_set(self, agent_id: str, resource: str, qty: int) -> None:
        self.conn.execute("INSERT INTO inventory(agent_id,resource,qty) VALUES(?,?,?) "
                          "ON CONFLICT(agent_id,resource) DO UPDATE SET qty=excluded.qty", (agent_id, resource, max(0, qty)))

    def inv_load(self, a: AgentBody) -> int:
        """Belegte Plätze: Ressourceneinheiten plus getragene Gegenstände."""
        held = self.conn.execute("SELECT COUNT(*) c FROM objects WHERE holder=?", (a.id,)).fetchone()["c"]
        return sum(a.inventory.values()) + held

    # --- Objekte -------------------------------------------------------------------------
    @staticmethod
    def _obj(r: sqlite3.Row) -> WorldObject:
        return WorldObject(id=r["id"], kind=r["kind"], name=r["name"], location_id=r["location_id"], x=r["x"], y=r["y"],
                           holder=r["holder"], state=json.loads(r["state"]), portable=bool(r["portable"]), owner=r["owner"],
                           created_by=r["created_by"], created_at=r["created_at"], hidden=bool(r["hidden"]),
                           known_by=json.loads(r["known_by"]))

    def obj(self, object_id: str) -> WorldObject | None:
        r = self.conn.execute("SELECT * FROM objects WHERE id=?", (object_id,)).fetchone()
        return self._obj(r) if r else None

    def objects_at(self, location_id: str) -> list[WorldObject]:
        return [self._obj(r) for r in self.conn.execute("SELECT * FROM objects WHERE location_id=? AND holder IS NULL ORDER BY id", (location_id,))]

    def objects_held(self, agent_id: str) -> list[WorldObject]:
        return [self._obj(r) for r in self.conn.execute("SELECT * FROM objects WHERE holder=? ORDER BY id", (agent_id,))]

    def all_objects(self) -> list[WorldObject]:
        return [self._obj(r) for r in self.conn.execute("SELECT * FROM objects ORDER BY id")]

    def object_count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) c FROM objects WHERE holder IS NULL").fetchone()["c"]

    def next_object_id(self, prefix: str) -> str:
        n = self.get_meta("obj_counter", 0) + 1
        self.set_meta("obj_counter", n)
        return f"{prefix}_{n}"

    def save_object(self, o: WorldObject, new: bool = False) -> None:
        o.state = object_kinds.normalize_state(o.kind, o.state)
        values = (o.kind, o.name, o.location_id, o.x, o.y, o.holder, _j(o.state), int(o.portable), o.owner, o.created_by,
                  o.created_at, int(o.hidden), _j(o.known_by), o.id)
        if new:
            self.conn.execute("INSERT INTO objects(kind,name,location_id,x,y,holder,state,portable,owner,created_by,created_at,hidden,known_by,id) "
                              "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
        else:
            self.conn.execute("UPDATE objects SET kind=?,name=?,location_id=?,x=?,y=?,holder=?,state=?,portable=?,owner=?,created_by=?,"
                              "created_at=?,hidden=?,known_by=? WHERE id=?", values)
        if o.kind == "door" or object_kinds.spec(o.kind).blocks:
            self.refresh_blocked()

    def remove_object(self, object_id: str) -> None:
        o = self.obj(object_id)
        self.conn.execute("DELETE FROM objects WHERE id=?", (object_id,))
        if o and (o.kind == "door" or object_kinds.spec(o.kind).blocks):
            self.refresh_blocked()

    # --- Ressourcen ----------------------------------------------------------------------
    @staticmethod
    def _node(r: sqlite3.Row) -> ResourceNode:
        return ResourceNode(**{k: r[k] for k in r.keys()})

    def nodes_at(self, location_id: str) -> list[ResourceNode]:
        return [self._node(r) for r in self.conn.execute("SELECT * FROM resources WHERE location_id=? ORDER BY id", (location_id,))]

    def all_nodes(self) -> list[ResourceNode]:
        return [self._node(r) for r in self.conn.execute("SELECT * FROM resources ORDER BY id")]

    def node(self, node_id: str) -> ResourceNode | None:
        r = self.conn.execute("SELECT * FROM resources WHERE id=?", (node_id,)).fetchone()
        return self._node(r) if r else None

    def set_node_amount(self, node_id: str, amount: float) -> None:
        self.conn.execute("UPDATE resources SET amount=? WHERE id=?", (amount, node_id))

    # --- Orte ------------------------------------------------------------------------------
    def mark_discovered(self, location_id: str, agent_id: str) -> bool:
        loc = self.locations[location_id]
        if agent_id in loc.discovered_by:
            return False
        loc.discovered_by = sorted({*loc.discovered_by, agent_id})
        self.conn.execute("UPDATE locations SET discovered_by=? WHERE id=?", (_j(loc.discovered_by), location_id))
        return True

    def snapshot(self) -> dict[str, Any]:
        w, h = self.get_meta("size")
        return {"clock": self.minute, "weather": self.weather(), "rules": self.rules.model_dump(), "size": [w, h],
                "tile_types": {t.id: {"char": t.char, "walkable": t.walkable, "cost": t.cost, "color": t.color, "label": t.label}
                               for t in self.tile_types.values()},
                "agents": [a.model_dump() for a in self.agents()], "objects": [o.model_dump() for o in self.all_objects()],
                "resources": [n.model_dump() for n in self.all_nodes()],
                "locations": [l.model_dump() for l in self.locations.values()]}
