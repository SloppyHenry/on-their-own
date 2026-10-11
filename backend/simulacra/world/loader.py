"""Startwelt aus JSON in die Datenbank schreiben (nur in eine leere Datenbank)."""

import json
from pathlib import Path
from typing import Any

from ..db.connection import Database
from . import object_kinds
from .grid import LEGEND
from .models import WorldObject
from .rules import WorldRules
from .state import WorldState, _j

DATA_DIR = Path(__file__).parent.parent / "data"
DEFAULT_WORLD = DATA_DIR / "world_default.json"
BLUEPRINTS = DATA_DIR / "blueprints.json"


def load_world_file(path: Path = DEFAULT_WORLD) -> dict[str, Any]:
    return json.loads(Path(path).read_text())


def load_blueprints() -> dict[str, dict[str, Any]]:
    return json.loads(BLUEPRINTS.read_text())


def seed_world(db: Database, world: dict[str, Any] | None = None, seed: int = 1) -> WorldState:
    """Legt Karte, Orte, Objekte, Ressourcen, Agenten, Uhr und Wetter an. Verweigert, wenn schon befüllt."""
    world = world or load_world_file()
    state = WorldState(db)
    if state.is_seeded():
        raise RuntimeError("Datenbank enthält bereits eine Welt")
    rows = world["tiles"]
    w, h = len(rows[0]), len(rows)
    if [w, h] != world["size"] or any(len(r) != w for r in rows):
        raise ValueError("Kartengröße passt nicht zu 'size'")
    with db.transaction() as c:
        state.set_meta("size", [w, h])
        state.set_meta("seed", seed)
        state.set_meta("world_name", world["name"])
        state.set_meta("home", world.get("home", [w // 2, h // 4]))
        state.set_meta("obj_counter", 0)
        state.set_meta("rules", WorldRules().model_dump())
        c.executemany("INSERT INTO tiles(x,y,type) VALUES(?,?,?)",
                      [(x, y, LEGEND[ch]) for y, row in enumerate(rows) for x, ch in enumerate(row)])
        for i, l in enumerate(world["locations"]):
            c.execute("INSERT INTO locations(id,name,rect,entrances,extra_tiles,props,sort) VALUES(?,?,?,?,?,?,?)",
                      (l["id"], l["name"], _j(l["rect"]), _j(l["entrances"]), _j(l["extra_tiles"]), _j(l["props"]), i))
        state.set_meta("seeded", True)
        state.reload_caches()
        for o in world["objects"]:
            x, y = o["tile"]
            spec = object_kinds.get(o["kind"])
            state.save_object(WorldObject(
                id=o["id"], kind=o["kind"], name=o["name"], location_id=state.location_at(x, y), x=x, y=y, state=o.get("state", {}),
                portable=o.get("portable", spec.portable), owner=o.get("owner"), hidden=o.get("hidden", False)), new=True)
        for n in world["resource_nodes"]:
            x, y = n["tile"]
            c.execute("INSERT INTO resources(id,location_id,x,y,resource,amount,cap,regen_per_hour,requires_tool,gather_minutes) "
                      "VALUES(?,?,?,?,?,?,?,?,?,?)", (n["id"], n["location_id"], x, y, n["resource"], n["amount"], n["cap"],
                                                       n["regen_per_hour"], n["requires_tool"], n["gather_minutes"]))
        for a in world["agents"]:
            x, y = a["tile"]
            c.execute("INSERT INTO agents_body(id,name,x,y,location_id,capacity,needs) VALUES(?,?,?,?,?,?,?)",
                      (a["id"], a["name"], x, y, state.location_at(x, y), a["capacity"], _j(a["needs"])))
        start = world["start"]
        minute = (start["day"] - 1) * 1440 + start["minute_of_day"]
        c.execute("INSERT INTO clock(id, minute) VALUES(1, ?)", (minute,))
        c.execute("INSERT INTO weather(id, kind, since, until) VALUES(1, ?, ?, ?)", (start["weather"], minute, minute + 360))
    return state
