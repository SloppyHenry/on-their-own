"""Eine Weltdatei aus dem Zustand (AP18e): Karte, Orte, Objekte, Quellen und Gestaltung, ohne Bewohner, Gedächtnis und Verlauf.

Dasselbe Format wie `data/world_default.json`; `seed_world` liest es wieder ein. Gebraucht für „die laufende Welt als Welt sichern“ und für die Welt-Werkstatt, die in einer
Wegwerf-Simulation im Speicher arbeitet und das Ergebnis als Datei zurückschreibt. Was jemand gerade trägt (`holder`), gehört der Figur und bleibt weg.
"""

from typing import Any

from .state import WorldState


def world_file(st: WorldState, name: str | None = None) -> dict[str, Any]:
    g = st.grid
    types = {n: {"char": t.char, "walkable": t.walkable, "cost": t.cost, "color": t.color, "label": t.label} for n, t in g.types.items()}
    rows = ["".join(g.types[g.cells[y][x]].char or "." for x in range(g.width)) for y in range(g.height)]
    locs = [{"id": l.id, "name": l.name, "rect": list(l.rect), "entrances": [list(e) for e in l.entrances], "extra_tiles": [list(e) for e in l.extra_tiles], "props": l.props}
            for l in st.locations.values()]
    objects = [{"id": o.id, "kind": o.kind, "name": o.name, "tile": [o.x, o.y], "state": o.state, **({"owner": o.owner} if o.owner else {}), **({"hidden": True} if o.hidden else {}),
                **({"portable": o.portable} if o.portable else {})}
               for o in st.all_objects() if not o.holder and o.x is not None and o.y is not None and o.kind != "construction_site"]
    nodes = [{"id": n.id, "location_id": n.location_id, "tile": [n.x, n.y], "resource": n.resource, "amount": n.amount, "cap": n.cap, "regen_per_hour": n.regen_per_hour,
              "requires_tool": n.requires_tool, "gather_minutes": n.gather_minutes, **({"regen_weather": n.regen_weather} if n.regen_weather else {}), **({"label": n.label} if n.label else {})}
             for n in st.all_nodes()]
    out: dict[str, Any] = {"schema": 1, "home": st.get_meta("home") or [g.width // 2, g.height // 4], "tile_types": types, "name": name or st.get_meta("world_name") or "Welt",
                           "size": [g.width, g.height], "tiles": rows, "locations": locs, "objects": objects, "resource_nodes": nodes, "agents": [],
                           "start": {"day": 1, "minute_of_day": 420, "weather": "clear"}, "links": st.get_meta("links") or [], "look": st.get_meta("look")}
    return out
