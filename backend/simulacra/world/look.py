"""Gestaltung der Welt (`look`, Meta-Wert): Version 2 besteht aus Gebieten und Landstraßen (siehe docs/welt-erweitern.md).

Die alte Form (Version 1, ein Dorf mit Einzelstücken) wird hier in dieselbe Version 2 umgewandelt wie im Frontend
(`frontend/src/world/dorf/look.ts`, `normalizeLook`); ein Test hält beide gleich.
"""

import copy
from typing import Any

REGION_KEYS = {"id", "frame", "bounds", "shapes", "decor", "lights", "place", "houses"}
SHAPE_LISTS = ("paths", "squares", "lakes", "gardens", "docks", "streams", "bridges", "pads")


def is_v2(look: dict[str, Any] | None) -> bool:
    return bool(look) and look.get("version") == 2


def upgrade_v1(o: dict[str, Any]) -> dict[str, Any]:
    """Aus einem Dorf in der alten Form wird ein Gebiet „dorf“ mit einem Haus."""
    o = copy.deepcopy(o)
    s, h = o["shapes"], o["shapes"]["house"]
    region = {
        "id": "dorf", "frame": o["origin"], "bounds": {"left": 0, "right": 256, "top": 0, "bottom": 232},
        "shapes": {"paths": s["paths"], "squares": [s["square"]], "lakes": [s["lake"]], "gardens": [{**s["garden"], "beds": s["beds"]}],
                   "docks": [s["dock"]], "streams": [], "bridges": [], "pads": [[h["x"] - 36, h["y"] - 30, h["x"] + 36, h["y"]]]},
        "decor": [d for d in o["decor"] if not (d[0] == "house" and d[1] == h["x"] and d[2] == h["y"])],
        "lights": o["lights"], "place": o["place"],
        "houses": [{"at": [h["x"], h["y"]], "sprite": "house", "door": {"outside": o["door"]["outside"], "inside": o["door"]["inside"]},
                    "interior": o["interior"], "smoke": 19}],
    }
    (ox, oy), (fx, fy), (w, hh) = o["texture"]["offset"], o["origin"], o["texture"]["size"]
    return {"version": 2, "style": o["style"], "texShift": [fx - ox, fy - oy], "legacy": {"rect": [0, 0, w, hh], "region": "dorf", "plainOutside": True},
            "home": [w / 2 + fx - ox, hh + fy - oy], "regions": [region], "roads": []}


def merge(look: dict[str, Any], add: dict[str, Any]) -> dict[str, Any]:
    """Hängt Gebiete und Landstraßen an (Patch-Abschnitt `look`); liefert die neue Gestaltung. Fehler als ValueError."""
    if not is_v2(look):
        look = upgrade_v1(look)
    unknown = set(add) - {"regions", "roads"}
    if unknown:
        raise ValueError(f"Unbekannte Felder in look: {sorted(unknown)}")
    out = copy.deepcopy(look)
    ids = {r["id"] for r in out["regions"]}
    for r in add.get("regions", []):
        if not isinstance(r, dict) or REGION_KEYS - set(r):
            raise ValueError(f"Ein Gebiet braucht die Felder {sorted(REGION_KEYS)}.")
        if r["id"] in ids:
            raise ValueError(f"Das Gebiet '{r['id']}' gibt es schon.")
        if any(k not in r["shapes"] for k in SHAPE_LISTS):
            raise ValueError(f"shapes braucht die Listen {list(SHAPE_LISTS)}.")
        ids.add(r["id"])
        out["regions"].append(copy.deepcopy(r))
    for road in add.get("roads", []):
        if not (isinstance(road, list) and len(road) >= 2 and all(isinstance(p, list) and len(p) == 2 for p in road)):
            raise ValueError("Eine Landstraße ist ein Linienzug aus mindestens zwei Punkten [x, y].")
        out["roads"].append([list(p) for p in road])
    return out
