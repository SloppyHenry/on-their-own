"""Erweiterungen der laufenden Welt: Kachelarten, Kacheln, Kartengröße, Orte, Agenten, Objekte, Quellen.

Alles läuft über die Engine (eine Transaktion je Operation, ein Ereignis je Änderung). Fehler sind
`WorldEditError` mit Code und Text; die Welt bleibt dann unverändert.
"""

import json
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from . import object_kinds
from .actions.base import Ctx
from .models import Event, Location, WorldObject

if TYPE_CHECKING:
    from .engine import WorldEngine

MAX_MAP = 256
MAX_LISTED_TILES = 500
ID_TYPE = re.compile(r"^[a-z][a-z0-9_]{1,23}$")
ID_LOCATION = re.compile(r"^[a-z][a-z0-9_.]{1,39}$")
ID_ANY = re.compile(r"^[a-z][a-z0-9_]{1,39}$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class WorldEditError(ValueError):
    """Eine Änderung an der Welt wurde abgelehnt. Codes: exists, invalid, out_of_bounds, blocked, unknown, limit."""

    def __init__(self, code: str, text: str):
        super().__init__(text)
        self.code, self.text = code, text


@dataclass
class EditResult:
    events: list[Event]
    value: Any = None


def _int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def ensure_free_id(ctx: Ctx, id_: str) -> None:
    """IDs von Orten, Objekten, Quellen und Agenten teilen sich einen Namensraum (Ziele von move_to)."""
    c = ctx.state.conn
    for table in ("locations", "objects", "resources", "agents_body"):
        if c.execute(f"SELECT 1 FROM {table} WHERE id=?", (id_,)).fetchone():
            raise WorldEditError("exists", f"Die ID '{id_}' ist schon vergeben ({table}).")


def _in_map(ctx: Ctx, x: Any, y: Any) -> bool:
    return _int(x) and _int(y) and ctx.state.grid.in_bounds(x, y)


# --- Kachelarten und Kacheln -------------------------------------------------------------------

def add_tile_type(ctx: Ctx, id_: str, *, walkable: bool, cost: int = 1, char: str | None = None,
                  color: str | None = None, label: str | None = None) -> None:
    st = ctx.state
    if not isinstance(id_, str) or not ID_TYPE.match(id_):
        raise WorldEditError("invalid", f"Ungültige Kachelart-ID '{id_}' (a-z, Ziffern, _; 2–24 Zeichen).")
    if not isinstance(walkable, bool) or not _int(cost) or (walkable and not 1 <= cost <= 20):
        raise WorldEditError("invalid", "Begehbare Kachelarten brauchen Kosten von 1 bis 20 Minuten.")
    if char is not None and (not isinstance(char, str) or len(char) != 1 or char.isspace()):
        raise WorldEditError("invalid", "Das Kartenzeichen muss ein einzelnes sichtbares Zeichen sein.")
    if color is not None and not (isinstance(color, str) and COLOR.match(color)):
        raise WorldEditError("invalid", "Die Farbe muss als #rrggbb angegeben werden.")
    cost = cost if walkable else 0
    old = st.tile_types.get(id_)
    if old is not None:
        if (old.walkable, old.cost, old.char) == (walkable, cost, char if char is not None else old.char):
            return                                    # gleiche Definition noch einmal: nichts zu tun
        raise WorldEditError("exists", f"Die Kachelart '{id_}' gibt es schon mit anderen Werten.")
    if char is not None and any(t.char == char for t in st.tile_types.values()):
        raise WorldEditError("exists", f"Das Zeichen '{char}' gehört schon zu einer anderen Kachelart.")
    st.conn.execute("INSERT INTO tile_types(id,char,walkable,cost,color,label) VALUES(?,?,?,?,?,?)",
                    (id_, char, int(walkable), cost, color, label or id_))
    st.reload_caches()
    ctx.emit("world.tile_type_added", data={"id": id_, "walkable": walkable, "cost": cost, "char": char, "color": color, "label": label or id_})


def set_tiles(ctx: Ctx, changes: list[tuple[int, int, str]], cause: str = "edit") -> None:
    st, g = ctx.state, ctx.state.grid
    final: dict[tuple[int, int], str] = {}
    for ch in changes:
        if not (isinstance(ch, (list, tuple)) and len(ch) == 3):
            raise WorldEditError("invalid", "Eine Kachel-Änderung braucht (x, y, Art).")
        x, y, kind = ch
        if not _in_map(ctx, x, y):
            raise WorldEditError("out_of_bounds", f"Kachel {x},{y} liegt außerhalb der Karte.")
        if kind not in st.tile_types:
            raise WorldEditError("unknown", f"Unbekannte Kachelart '{kind}'.")
        final[(x, y)] = kind
    real = {p: k for p, k in final.items() if g.tile(*p) != k}
    closing = {p for p, k in real.items() if not st.tile_types[k].walkable}
    if closing:
        occupied = {(a.x, a.y): f"Agent {a.name}" for a in st.agents()}
        occupied |= {(o.x, o.y): f"Objekt {o.name}" for o in st.all_objects() if o.x is not None}
        occupied |= {(n.x, n.y): f"Quelle {n.id}" for n in st.all_nodes()}
        for p in sorted(closing & set(occupied)):
            raise WorldEditError("blocked", f"Kachel {p[0]},{p[1]} kann nicht unbegehbar werden: dort steht {occupied[p]}.")
    if not real:
        return
    listed = [{"x": x, "y": y, "type": k, "from": g.tile(x, y)} for (x, y), k in sorted(real.items())]
    st.conn.executemany("UPDATE tiles SET type=? WHERE x=? AND y=?", [(k, x, y) for (x, y), k in real.items()])
    for (x, y), k in real.items():
        g.set_tile(x, y, k)
    ctx.emit("world.tiles_changed", data={"count": len(listed), "changes": listed[:MAX_LISTED_TILES],
                                          "truncated": len(listed) > MAX_LISTED_TILES, "cause": cause})


def extend_map(ctx: Ctx, width: int, height: int, fill: str = "grass") -> None:
    st = ctx.state
    old_w, old_h = st.get_meta("size")
    if not (_int(width) and _int(height)) or width < old_w or height < old_h or (width, height) == (old_w, old_h):
        raise WorldEditError("invalid", f"Die Karte kann nur wachsen (jetzt {old_w}×{old_h}).")
    if width > MAX_MAP or height > MAX_MAP:
        raise WorldEditError("limit", f"Die Karte darf höchstens {MAX_MAP}×{MAX_MAP} Kacheln groß sein.")
    if fill not in st.tile_types:
        raise WorldEditError("unknown", f"Unbekannte Kachelart '{fill}'.")
    st.conn.executemany("INSERT INTO tiles(x,y,type) VALUES(?,?,?)",
                        [(x, y, fill) for y in range(height) for x in range(width) if x >= old_w or y >= old_h])
    st.set_meta("size", [width, height])
    st.reload_caches()
    ctx.emit("world.map_extended", data={"from": [old_w, old_h], "to": [width, height], "fill": fill})


# --- Orte ----------------------------------------------------------------------------------------

def _tile_list(ctx: Ctx, tiles: Any, what: str) -> list[tuple[int, int]]:
    out = []
    for t in tiles or []:
        if not (isinstance(t, (list, tuple)) and len(t) == 2 and _in_map(ctx, t[0], t[1])):
            raise WorldEditError("out_of_bounds", f"{what}: Kachel {t} liegt außerhalb der Karte.")
        out.append((t[0], t[1]))
    return out


def add_location(ctx: Ctx, id_: str, name: str, rect: list[int], entrances: Any = None, extra_tiles: Any = None,
                 props: dict | None = None, claim: bool = True) -> None:
    st = ctx.state
    if not isinstance(id_, str) or not ID_LOCATION.match(id_):
        raise WorldEditError("invalid", f"Ungültige Orts-ID '{id_}'.")
    if not isinstance(name, str) or not name.strip():
        raise WorldEditError("invalid", "Der Ort braucht einen Namen.")
    if not (isinstance(rect, (list, tuple)) and len(rect) == 4 and all(_int(v) for v in rect) and rect[2] >= 1 and rect[3] >= 1
            and _in_map(ctx, rect[0], rect[1]) and _in_map(ctx, rect[0] + rect[2] - 1, rect[1] + rect[3] - 1)):
        raise WorldEditError("out_of_bounds", "Das Rechteck [x, y, Breite, Höhe] muss in der Karte liegen.")
    ent, extra = _tile_list(ctx, entrances, "Eingang"), _tile_list(ctx, extra_tiles, "Zusatzkachel")
    if not isinstance(props or {}, dict):
        raise WorldEditError("invalid", "props muss ein Objekt sein.")
    ensure_free_id(ctx, id_)
    order = "MIN(sort)-1" if claim else "MAX(sort)+1"
    sort = st.conn.execute(f"SELECT COALESCE({order}, 0) s FROM locations").fetchone()["s"]
    st.conn.execute("INSERT INTO locations(id,name,rect,entrances,extra_tiles,props,sort) VALUES(?,?,?,?,?,?,?)",
                    (id_, name.strip(), json.dumps(list(rect)), json.dumps(ent), json.dumps(extra), json.dumps(props or {}, ensure_ascii=False), sort))
    st.reload_caches()
    moved = _reassign_locations(ctx)
    loc: Location = st.locations[id_]
    ctx.emit("world.location_added", data={"location": loc.model_dump(), "claim": claim, "reassigned": moved})


def _reassign_locations(ctx: Ctx) -> dict[str, int]:
    """Nach Änderung der Ortszuschnitte: Ortsbezug aller Objekte, Quellen und Agenten neu bestimmen."""
    st, moved = ctx.state, {"objects": 0, "resources": 0, "agents": 0}
    for table, key in (("objects", "objects"), ("resources", "resources"), ("agents_body", "agents")):
        for r in st.conn.execute(f"SELECT id, x, y, location_id FROM {table} WHERE x IS NOT NULL").fetchall():
            new = st.location_at(r["x"], r["y"])
            if new != r["location_id"]:
                st.conn.execute(f"UPDATE {table} SET location_id=? WHERE id=?", (new, r["id"]))
                moved[key] += 1
    return moved


def update_location(ctx: Ctx, id_: str, name: str | None = None, props: dict | None = None, entrances: Any = None) -> None:
    st = ctx.state
    loc = st.locations.get(id_)
    if loc is None:
        raise WorldEditError("unknown", f"Der Ort '{id_}' ist unbekannt.")
    merged = dict(loc.props)
    for k, v in (props or {}).items():
        if v is None:
            merged.pop(k, None)
        else:
            merged[k] = v
    ent = [list(t) for t in _tile_list(ctx, entrances, "Eingang")] if entrances is not None else [list(t) for t in loc.entrances]
    st.conn.execute("UPDATE locations SET name=?, props=?, entrances=? WHERE id=?",
                    ((name or loc.name).strip(), json.dumps(merged, ensure_ascii=False), json.dumps(ent), id_))
    st.reload_caches()
    ctx.emit("world.location_updated", data={"location": st.locations[id_].model_dump()})


# --- Agenten, Objekte, Quellen ---------------------------------------------------------------------

def add_agent(ctx: Ctx, id_: str, name: str, tile: Any, capacity: int = 10, needs: dict | None = None) -> None:
    st = ctx.state
    if not isinstance(id_, str) or not ID_TYPE.match(id_) or not isinstance(name, str) or not name.strip():
        raise WorldEditError("invalid", "Ein Agent braucht eine ID (a-z, _) und einen Namen.")
    if not _int(capacity) or not 1 <= capacity <= 30:
        raise WorldEditError("invalid", "Die Tragkraft muss zwischen 1 und 30 liegen.")
    if not (isinstance(tile, (list, tuple)) and len(tile) == 2 and _in_map(ctx, *tile)):
        raise WorldEditError("out_of_bounds", "Die Startkachel liegt außerhalb der Karte.")
    x, y = tile
    if not st.grid.walkable(x, y) or (x, y) in st.grid.blocked:
        raise WorldEditError("blocked", f"Auf Kachel {x},{y} kann kein Agent stehen.")
    ensure_free_id(ctx, id_)
    start = {"energy": 85, "hunger": 25, "thirst": 20} | (needs or {})
    st.conn.execute("INSERT INTO agents_body(id,name,x,y,location_id,capacity,needs) VALUES(?,?,?,?,?,?,?)",
                    (id_, name.strip(), x, y, st.location_at(x, y), capacity, json.dumps(start)))
    ctx.emit("world.agent_added", [id_], st.location_at(x, y), {"id": id_, "name": name.strip(), "tile": [x, y], "capacity": capacity})


def _free_tile_in(ctx: Ctx, location_id: str) -> tuple[int, int]:
    st = ctx.state
    loc = st.locations.get(location_id)
    if loc is None or loc.props.get("fallback"):
        raise WorldEditError("unknown", f"Der Ort '{location_id}' ist unbekannt oder zu unbestimmt für eine Platzierung.")
    taken = {(o.x, o.y) for o in st.objects_at(location_id)} | {(n.x, n.y) for n in st.nodes_at(location_id)}
    rx, ry, w, h = loc.rect
    cx, cy = rx + w / 2, ry + h / 2
    cands = [(x, y) for y in range(ry, ry + h) for x in range(rx, rx + w)
             if st.location_at(x, y) == location_id and st.grid.walkable(x, y) and (x, y) not in taken and (x, y) not in st.grid.blocked]
    if not cands:
        raise WorldEditError("blocked", f"Im Ort '{location_id}' ist kein freier Platz.")
    return min(cands, key=lambda t: abs(t[0] - cx) + abs(t[1] - cy))


def spawn_object(ctx: Ctx, kind: str, name: str, *, tile: Any = None, location_id: str | None = None, holder: str | None = None,
                 state: dict | None = None, portable: bool | None = None, owner: str | None = None, hidden: bool = False,
                 known_by: list[str] | None = None, id_: str | None = None, created_by: str | None = None, cause: str = "spawned") -> WorldObject:
    st = ctx.state
    try:
        spec = object_kinds.get(kind)
    except ValueError as e:
        raise WorldEditError("unknown", str(e)) from None
    if not isinstance(name, str) or not name.strip():
        raise WorldEditError("invalid", "Das Objekt braucht einen Namen.")
    if id_ is not None:
        if not isinstance(id_, str) or not ID_ANY.match(id_):
            raise WorldEditError("invalid", f"Ungültige Objekt-ID '{id_}'.")
        ensure_free_id(ctx, id_)
    for a in [owner, holder, *(known_by or [])]:
        if a is not None and st.agent(a) is None:
            raise WorldEditError("unknown", f"Der Agent '{a}' ist unbekannt.")
    if sum(v is not None for v in (tile, location_id, holder)) != 1:
        raise WorldEditError("invalid", "Genau eine Angabe aus tile, location_id oder holder ist nötig.")
    obj = WorldObject(id=id_ or st.next_object_id(kind), kind=kind, name=name.strip(), state=state or {}, owner=owner, hidden=hidden,
                      known_by=sorted(known_by or []), portable=spec.portable if portable is None else portable,
                      created_by=created_by, created_at=ctx.minute)
    if holder is not None:
        a = st.agent(holder)
        if ctx.free_slots(a) < 1:
            raise WorldEditError("limit", f"{a.name} kann nichts mehr tragen.")
        obj.holder = holder
    else:
        if st.object_count() >= ctx.rules.max_objects:
            raise WorldEditError("limit", f"Die Welt kann höchstens {ctx.rules.max_objects} Objekte aufnehmen.")
        x, y = _free_tile_in(ctx, location_id) if location_id else tile
        if not _in_map(ctx, x, y) or not st.grid.walkable(x, y):
            raise WorldEditError("blocked", f"Auf Kachel {x},{y} kann kein Objekt stehen.")
        obj.x, obj.y, obj.location_id = x, y, st.location_at(x, y)
    try:
        st.save_object(obj, new=True)
    except ValueError as e:
        raise WorldEditError("invalid", str(e)) from None
    ctx.emit("world.object_created", [created_by] if created_by else [], obj.location_id, {"object": ctx.object_data(obj), "cause": cause})
    return obj


def remove_object(ctx: Ctx, object_id: str, cause: str = "removed") -> None:
    o = ctx.state.obj(object_id)
    if o is None:
        raise WorldEditError("unknown", f"Das Objekt '{object_id}' gibt es nicht.")
    ctx.state.remove_object(object_id)
    ctx.emit("world.object_removed", [o.holder] if o.holder else [], o.location_id, {"object": ctx.object_data(o), "cause": cause})


def add_resource_node(ctx: Ctx, id_: str, tile: Any, resource: str, amount: float, cap: float, regen_per_hour: float = 0.0,
                      requires_tool: str | None = None, gather_minutes: int = 5, location_id: str | None = None,
                      label: str | None = None, regen_weather: str | None = None) -> None:
    st = ctx.state
    if not isinstance(id_, str) or not ID_ANY.match(id_) or not isinstance(resource, str) or not ID_TYPE.match(resource):
        raise WorldEditError("invalid", "Quelle: ungültige ID oder Ressource.")
    if not (isinstance(tile, (list, tuple)) and len(tile) == 2 and _in_map(ctx, *tile)) or not st.grid.walkable(*tile):
        raise WorldEditError("blocked", "Die Quelle braucht eine begehbare Kachel in der Karte.")
    if not (0 <= amount <= cap and cap > 0 and regen_per_hour >= 0 and _int(gather_minutes) and 1 <= gather_minutes <= 120):
        raise WorldEditError("invalid", "Quelle: Menge, Obergrenze, Nachwuchs oder Dauer sind ungültig.")
    loc = st.location_at(*tile)
    if location_id is not None and location_id != loc:
        raise WorldEditError("invalid", f"Die Kachel liegt im Ort '{loc}', nicht in '{location_id}'.")
    ensure_free_id(ctx, id_)
    st.conn.execute("INSERT INTO resources(id,location_id,x,y,resource,amount,cap,regen_per_hour,requires_tool,gather_minutes,regen_weather,label) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (id_, loc, tile[0], tile[1], resource, amount, cap, regen_per_hour, requires_tool, gather_minutes, regen_weather, label))
    ctx.emit("world.resource_added", [], loc, {"node": id_, "resource": resource, "amount": amount, "cap": cap, "tile": list(tile),
                                               "location_id": loc, "label": label, "requires_tool": requires_tool})


# --- Übergänge und Darstellung ----------------------------------------------------------------------

def add_links(ctx: Ctx, pairs: Any) -> None:
    """Übergänge (Haustüren) zwischen je zwei begehbaren Kacheln, in beide Richtungen."""
    st = ctx.state
    if not isinstance(pairs, list) or not pairs:
        raise WorldEditError("invalid", "links braucht eine Liste von Kachelpaaren [[x, y], [x, y]].")
    have = {tuple(map(tuple, p)) for p in (st.get_meta("links") or [])}
    new: list[list[list[int]]] = []
    for pair in pairs:
        if not (isinstance(pair, (list, tuple)) and len(pair) == 2):
            raise WorldEditError("invalid", "Ein Übergang ist ein Paar von Kacheln [[x, y], [x, y]].")
        a, b = _tile_list(ctx, pair, "Übergang")
        for x, y in (a, b):
            if not st.grid.walkable(x, y):
                raise WorldEditError("blocked", f"Der Übergang braucht begehbare Kacheln; {x},{y} ist es nicht.")
        if (a, b) in have or (b, a) in have:
            continue
        new.append([list(a), list(b)])
    if not new:
        return
    st.set_meta("links", (st.get_meta("links") or []) + new)
    st.reload_caches()
    ctx.emit("world.links_added", data={"links": new})


def add_look(ctx: Ctx, add: Any) -> None:
    """Hängt Gebiete (Dörfer) und Landstraßen an die Gestaltung der Welt (siehe world/look.py)."""
    from . import look as lk
    st = ctx.state
    cur = st.get_meta("look")
    if not cur:
        raise WorldEditError("invalid", "Die Welt hat keine Gestaltung (look); dort lässt sich kein Gebiet ergänzen.")
    if not isinstance(add, dict):
        raise WorldEditError("invalid", "look braucht ein Objekt mit 'regions' und/oder 'roads'.")
    try:
        merged = lk.merge(cur, add)
    except ValueError as e:
        raise WorldEditError("invalid", str(e)) from None
    st.set_meta("look", merged)
    ctx.emit("world.look_changed", data={"regions": add.get("regions", []), "roads": add.get("roads", []), "upgraded": not lk.is_v2(cur)})
