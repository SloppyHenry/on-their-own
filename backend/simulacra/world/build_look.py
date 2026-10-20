"""Was Bewohner bauen, muss man auch sehen (AP18g): Wege, Beete, Bäume, Laternen und Brunnen ändern nicht nur Kacheln und Objekte, sondern auch die Gestaltung der Welt (`look`).

Die Darstellung (Mockup A) zeichnet den Boden und die Deko aus `look`, nicht aus den Kacheln. Darum hängt jede dieser Bauvorlagen ihr Stück an das Gebiet, in dem die Kachel liegt, und
meldet es mit `world.look_added` (klein, ohne die ganze Gestaltung zu schicken). Kacheln und Bild bleiben so gleich: ein Test prüft beides nach jedem Bau. Koordinaten: Dorfkoordinaten
des Gebiets (Weltpixel − `frame`), eine Kachel hat 16 Weltpixel.
"""

import copy
from typing import Any

from . import look as lk

T = 16


def _region(look: dict[str, Any], x: int, y: int) -> dict[str, Any]:
    wx, wy = x * T + 8, y * T + 8
    for r in look["regions"]:
        b, (fx, fy) = r["bounds"], r["frame"]
        if b["left"] <= wx - fx < b["right"] and b["top"] <= wy - fy and (b.get("bottom") is None or wy - fy < b["bottom"]):
            return r
    return look["regions"][0]


def piece(kind: str, obj_id: str | None, x: int, y: int, frame: list[int]) -> dict[str, Any]:
    """Das Stück der Gestaltung für diese Bauvorlage an der Kachel (x, y), in Dorfkoordinaten des Gebiets."""
    fx, fy = frame
    left, top = x * T - fx, y * T - fy                           # linke obere Ecke der Kachel
    cx, foot = left + 8, top + T - 2                               # Mitte und Fuß, wie `spot` im Frontend
    out: dict[str, Any] = {"paths": [], "gardens": [], "decor": [], "lights": [], "place": {}}
    if kind == "path":
        out["paths"] = [[[left, top + 8], [left + T, top + 8]]]
    elif kind == "bed":
        out["gardens"] = [{"x0": left, "y0": top, "x1": left + T, "y1": top + T, "beds": [[left + 1, top + 2, T - 2, T - 4]]}]
    elif kind == "tree":
        out["decor"] = [["tree", cx, foot, (x * 7 + y * 3) % 7]]
    elif kind == "lantern" and obj_id:
        out["place"] = {obj_id: {"at": [cx, foot], "sprite": "lamp"}}
        out["lights"] = [[cx, foot - 20, 30, 1]]
    elif kind == "well" and obj_id:
        out["place"] = {obj_id: {"at": [cx, foot], "sprite": "well"}}
    return out


def add(ctx, look_kind: str, obj_id: str | None, x: int, y: int) -> None:
    """Hängt das Stück an die Gestaltung der Welt und meldet es. Eine Welt ohne Gestaltung bleibt, wie sie ist (dort zeichnet die Ansicht aus den Kacheln)."""
    st = ctx.state
    cur = st.get_meta("look")
    if not cur:
        return
    look = copy.deepcopy(cur if lk.is_v2(cur) else lk.upgrade_v1(cur))
    region = _region(look, x, y)
    p = piece(look_kind, obj_id, x, y, region["frame"])
    S = region["shapes"]
    S["paths"].extend(p["paths"])
    S["gardens"].extend(p["gardens"])
    region["decor"].extend(p["decor"])
    region["lights"].extend(p["lights"])
    region["place"].update(p["place"])
    st.set_meta("look", look)
    ctx.emit("world.look_added", data={"region": region["id"], "upgraded": not lk.is_v2(cur), **p})
