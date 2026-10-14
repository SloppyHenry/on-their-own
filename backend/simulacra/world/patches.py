"""Welt-Patches: Änderungen an einer bestehenden Welt als Datei, einmalig und atomar anzuwenden.

Ein Patch ist ein JSON-Dokument mit denselben Abschnitten wie die Weltdatei (nur die benötigten):
    {"id": "...", "description": "...", "tile_types": {...}, "extend_map": {"width": 80, "height": 50, "fill": "grass"},
     "tiles": [{"rect": [x, y, b, h], "type": "sand"}, {"at": [x, y], "rows": ["..s.", ".ss."]}],
     "locations": [{...}], "objects": [{...}], "resource_nodes": [{...}], "links": [[[x, y], [x, y]]], "agents": [{...}],
     "look": {"regions": [{...}], "roads": [[[x, y], ...]]}, "max_objects": 300}
`max_objects` hebt die Obergrenze für Objekte an (höchstens 500), damit ein erzeugtes Dorf hineinpasst.
Reihenfolge der Anwendung: tile_types, extend_map, tiles, locations, objects, resource_nodes, links, agents, look.
Jede Patch-ID wird nur einmal angewendet; scheitert ein Teil, bleibt die Welt unverändert.
"""

from typing import Any

from . import extend
from .actions.base import Ctx
from .extend import WorldEditError

SECTIONS = ("tile_types", "extend_map", "tiles", "locations", "objects", "resource_nodes", "links", "agents", "look")
KNOWN_KEYS = {"id", "description", "max_objects", *SECTIONS}


def applied(ctx: Ctx) -> list[dict[str, Any]]:
    return ctx.state.get_meta("patches", [])


def _tile_changes(ctx: Ctx, entries: list[dict]) -> list[tuple[int, int, str]]:
    types = ctx.state.tile_types
    by_char = {t.char: t.id for t in types.values() if t.char}
    out: list[tuple[int, int, str]] = []
    for e in entries:
        if "rect" in e:
            x, y, w, h = e["rect"]
            out += [(x + i, y + j, e["type"]) for j in range(h) for i in range(w)]
        elif "rows" in e:
            ox, oy = e["at"]
            for j, row in enumerate(e["rows"]):
                for i, ch in enumerate(row):
                    if ch == " ":
                        continue                       # Leerzeichen = unverändert lassen
                    if ch not in by_char:
                        raise WorldEditError("unknown", f"Zeichen '{ch}' in 'rows' gehört zu keiner Kachelart.")
                    out.append((ox + i, oy + j, by_char[ch]))
        else:
            raise WorldEditError("invalid", "Ein tiles-Eintrag braucht 'rect'+'type' oder 'at'+'rows'.")
    return out


def apply_patch(ctx: Ctx, patch: dict[str, Any]) -> dict[str, int]:
    if not isinstance(patch, dict) or not isinstance(patch.get("id"), str) or not patch["id"].strip():
        raise WorldEditError("invalid", "Ein Patch braucht eine 'id'.")
    unknown = set(patch) - KNOWN_KEYS
    if unknown:
        raise WorldEditError("invalid", f"Unbekannte Abschnitte im Patch: {sorted(unknown)}")
    if any(p["id"] == patch["id"] for p in applied(ctx)):
        raise WorldEditError("exists", f"Der Patch '{patch['id']}' wurde schon angewendet.")
    counts = {s: 0 for s in SECTIONS if s not in ("links", "look")}                # links und look zählen nur, wenn der Patch sie nutzt
    try:
        for name, t in (patch.get("tile_types") or {}).items():
            extend.add_tile_type(ctx, name, walkable=t["walkable"], cost=t.get("cost", 1), char=t.get("char"),
                                 color=t.get("color"), label=t.get("label"))
            counts["tile_types"] += 1
        if "extend_map" in patch:
            m = patch["extend_map"]
            extend.extend_map(ctx, m["width"], m["height"], m.get("fill", "grass"))
            counts["extend_map"] = 1
        if patch.get("tiles"):
            changes = _tile_changes(ctx, patch["tiles"])
            extend.set_tiles(ctx, changes, cause=f"patch:{patch['id']}")
            counts["tiles"] = len(changes)
        if "max_objects" in patch:
            n = patch["max_objects"]
            if not isinstance(n, int) or isinstance(n, bool) or not 20 <= n <= 500:
                raise WorldEditError("invalid", "max_objects muss eine Zahl von 20 bis 500 sein.")
            if n > ctx.state.rules.max_objects:
                ctx.state.rules = ctx.state.rules.model_copy(update={"max_objects": n})
                ctx.state.set_meta("rules", ctx.state.rules.model_dump())
        for l in patch.get("locations", []):
            extend.add_location(ctx, l["id"], l["name"], l["rect"], l.get("entrances"), l.get("extra_tiles"), l.get("props"), l.get("claim", True))
            counts["locations"] += 1
        for o in patch.get("objects", []):
            extend.spawn_object(ctx, o["kind"], o["name"], tile=o.get("tile"), location_id=o.get("location_id"), holder=o.get("holder"),
                                state=o.get("state"), portable=o.get("portable"), owner=o.get("owner"), hidden=o.get("hidden", False),
                                known_by=o.get("known_by"), id_=o.get("id"), cause=f"patch:{patch['id']}", anywhere=bool(o.get("anywhere", False)))
            counts["objects"] += 1
        for n in patch.get("resource_nodes", []):
            extend.add_resource_node(ctx, n["id"], n["tile"], n["resource"], n["amount"], n["cap"], n.get("regen_per_hour", 0.0),
                                     n.get("requires_tool"), n.get("gather_minutes", 5), n.get("location_id"), n.get("label"), n.get("regen_weather"))
            counts["resource_nodes"] += 1
        if patch.get("links"):
            extend.add_links(ctx, patch["links"])
            counts["links"] = len(patch["links"])
        for a in patch.get("agents", []):
            extend.add_agent(ctx, a["id"], a["name"], a["tile"], a.get("capacity", 10), a.get("needs"))
            counts["agents"] += 1
        if patch.get("look"):
            extend.add_look(ctx, patch["look"])
            counts["look"] = len(patch["look"].get("regions", [])) + len(patch["look"].get("roads", []))
    except KeyError as e:
        raise WorldEditError("invalid", f"Im Patch fehlt das Feld {e}.") from None
    except (TypeError, ValueError) as e:
        if isinstance(e, WorldEditError):
            raise
        raise WorldEditError("invalid", f"Patch fehlerhaft: {e}") from None
    ctx.state.set_meta("patches", applied(ctx) + [{"id": patch["id"], "description": patch.get("description", ""),
                                                   "applied_at": ctx.minute, "counts": counts}])
    ctx.emit("world.patch_applied", data={"id": patch["id"], "description": patch.get("description", ""), "counts": counts})
    return counts
