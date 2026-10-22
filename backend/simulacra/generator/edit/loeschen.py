"""Löschen (AP16a): ein Ding, Deko, ein ganzes Haus oder eine Form (Weg, Garten, See, Steg, Brücke, Platz) unter dem Zeiger.

Reihenfolge, wenn mehreres an der Kachel liegt: Ding, Deko, Haus, Form (die kleinste zuerst). Nicht gelöscht werden Türen, Betten mit Besitzer, Quellen und Häuser, in denen jemand wohnt
oder steht. Bei Bild A (`look.legacy`) bleibt der Eintrag in der Liste und wird ausgeblendet (`look.mask`).
"""

import math

from ...world import look_ops as lo
from ..geometry import line_dist
from . import ableiten as ab
from .modell import Abgelehnt, Welt, T

GEBAUT = ("house", "bs", "bw", "bb", "bt")


def tile_von(a: dict) -> tuple[int, int]:
    t = a.get("tile")
    if not (isinstance(t, list) and len(t) == 2 and all(isinstance(v, int) and not isinstance(v, bool) for v in t)):
        raise Abgelehnt("Es fehlt die Kachel [x, y].")
    return t[0], t[1]


def ausfuehren(m: Welt, a: dict) -> None:
    x, y = tile_von(a)
    m.art(x, y)
    for fn in (ding, deko, haus, form):
        if fn(m, x, y):
            return
    raise Abgelehnt("Dort ist nichts, was sich löschen lässt.", (x, y))


def ding(m: Welt, x: int, y: int) -> bool:
    o = next((o for o in m.w["objects"] if o["tile"] == [x, y] and o["kind"] != "door"), None)
    if o is None:
        if any(o["kind"] == "door" for o in m.objekte_bei(x, y)):
            raise Abgelehnt("Türen gehören zum Haus; lösche das Haus.", (x, y))
        return False
    if o["kind"] == "bed" and o.get("owner"):
        raise Abgelehnt("Das Bett gehört jemandem.", (x, y))
    if o["kind"] == "seedbed":
        if any(p["kind"] == "plant" and p["tile"] == [x, y] for p in m.w["objects"]):
            raise Abgelehnt("Dort wächst etwas.", (x, y))
        return False                                                                  # Beete gehören zum Garten: der Garten wird gelöscht
    ops, box = [], (x * T, y * T, x * T + T, y * T + T)
    for g in m.look["regions"]:
        v = g["place"].get(o["id"])
        if v is None:
            continue
        ops.append({"op": "unplace", "region": g["id"], "id": o["id"]})
        for li in g["lights"]:
            if v.get("at") and li[0] == v["at"][0] and li[1] in (v["at"][1], v["at"][1] - 20) and o["kind"] == "lantern":
                ops.append({"op": "remove", "region": g["id"], "liste": "lights", "item": li})
                break
    m.w["objects"].remove(o)
    m.mit_kacheln(lambda: m.op(*ops), box)
    return True


def deko(m: Welt, x: int, y: int) -> bool:
    for g in m.look["regions"]:
        for d in reversed(lo.visible(m.look, g)["decor"]):
            if d[0] in ("fence", "post", "reed") or d[0] in GEBAUT or d[0].startswith(("bh:", "bm:")):
                continue
            if (math.floor((d[1] + g["frame"][0]) / T), math.floor((d[2] - 2 + g["frame"][1]) / T)) == (x, y):
                m.mit_kacheln(lambda g=g, d=d: m.op({"op": "remove", "region": g["id"], "liste": "decor", "item": d}), (x * T, y * T, x * T + T, y * T + T))
                return True
    return False


def haus(m: Welt, x: int, y: int) -> bool:
    for g in m.look["regions"]:
        for hs in g["houses"]:
            bx0, by0, bx1, by1 = ab.haus_mauer(hs)
            cx, cy = x * T + 8 - g["frame"][0], y * T + 8 - g["frame"][1]
            if not (bx0 <= cx <= bx1 and by0 <= cy <= by1) and [x, y] != hs["door"]["outside"]:
                continue
            rx, ry, rw, rh = hs["interior"]["rect"]
            drin = lambda t: rx <= t[0] < rx + rw and ry <= t[1] < ry + rh                       # noqa: E731
            for o in m.w["objects"]:
                if drin(o["tile"]) and o["kind"] == "bed" and o.get("owner"):
                    raise Abgelehnt("In dem Haus wohnt jemand.", (x, y))
            for tt, wer in m.belegt.items():
                if drin(tt):
                    raise Abgelehnt(f"In dem Haus steht {wer}.", (x, y))
            cxp, base = hs["at"]
            w = ab.haus_breite(hs["sprite"])
            ops = [{"op": "remove", "region": g["id"], "liste": "houses", "item": hs}]
            ops += [{"op": "remove", "region": g["id"], "liste": "pads", "item": p} for p in g["shapes"]["pads"] if abs(p[0] - (cxp - w / 2 + 3)) < 1 and p[3] == base][:1]
            ops += [{"op": "remove", "region": g["id"], "liste": "lights", "item": li} for li in g["lights"] if li[1] == base and abs(li[0] - cxp) <= w / 2]
            m.w["locations"] = [l for l in m.w["locations"] if not drin(l["rect"][:2])]
            gone = {o["id"] for o in m.w["objects"] if drin(o["tile"])}
            m.w["objects"] = [o for o in m.w["objects"] if o["id"] not in gone]
            m.w["resource_nodes"] = [n for n in m.w["resource_nodes"] if not drin(n["tile"])]
            m.w["links"] = [l for l in m.w.get("links", []) if not drin(l[1]) and not drin(l[0])]
            for j in range(ry, ry + rh):
                for i in range(rx, rx + rw):
                    m.g[j][i] = "T"
            m.mit_kacheln(lambda: m.op(*ops), (bx0 + g["frame"][0] - 8, by0 + g["frame"][1] - 8, bx1 + g["frame"][0] + 8, by1 + g["frame"][1] + 24))
            return True
    return False


def _trifft(liste: str, it, px: float, py: float) -> float | None:
    """Abstand (kleiner = näher), wenn der Punkt die Form trifft, sonst None."""
    if liste == "gardens" or liste in ("docks", "bridges"):
        return (it["x1"] - it["x0"]) * (it["y1"] - it["y0"]) if it["x0"] <= px < it["x1"] and it["y0"] <= py < it["y1"] else None
    if liste == "lakes":
        q = ((px - it["x"]) / it["rx"]) ** 2 + ((py - it["y"]) / it["ry"]) ** 2
        return it["rx"] * it["ry"] * 3 if q < 1.2 else None
    if liste == "squares":
        return it["r"] ** 2 * 4 if math.hypot(px - it["x"], (py - it["y"]) * 1.08) < it["r"] else None
    if liste == "paths":
        return 1.0 if line_dist([it], px, py) < 8 else None
    return None


def _umriss(liste: str, it, frame) -> tuple[float, float, float, float]:
    """Rechteck in Weltpixeln, in dem die Form (samt Ufer, Zaun und Wegbreite) Kacheln beeinflusst."""
    fx, fy = frame
    if liste == "paths":
        xs, ys, pad = [p[0] for p in it], [p[1] for p in it], 12
    elif liste == "lakes":
        xs, ys, pad = [it["x"] - it["rx"] * 1.3, it["x"] + it["rx"] * 1.3], [it["y"] - it["ry"] * 1.3, it["y"] + it["ry"] * 1.3], 8
    elif liste == "squares":
        xs, ys, pad = [it["x"] - it["r"], it["x"] + it["r"]], [it["y"] - it["r"], it["y"] + it["r"]], 8
    else:
        xs, ys, pad = [it["x0"], it["x1"]], [it["y0"], it["y1"]], 24
    return min(xs) + fx - pad, min(ys) + fy - pad, max(xs) + fx + pad, max(ys) + fy + pad


def form(m: Welt, x: int, y: int) -> bool:
    best = None
    for g in m.look["regions"]:
        v = lo.visible(m.look, g)
        px, py = x * T + 8 - g["frame"][0], y * T + 8 - g["frame"][1]
        for liste in ("paths", "gardens", "docks", "bridges", "lakes", "squares"):
            for it in v["shapes"][liste]:
                d = _trifft(liste, it, px, py)
                if d is not None and (best is None or d < best[0]):
                    best = (d, g, liste, it)
    if best is None:
        return False
    _, g, liste, it = best
    ops = [{"op": "remove", "region": g["id"], "liste": liste, "item": it}]
    box = _umriss(liste, it, g["frame"])
    if liste == "gardens":
        fx, fy = g["frame"]
        for d in lo.visible(m.look, g)["decor"]:
            if d[0] in ("fence", "post") and it["x0"] - 1 <= d[1] <= it["x1"] + 1 and it["y0"] - 3 <= d[2] <= it["y1"] + 1:
                ops.append({"op": "remove", "region": g["id"], "liste": "decor", "item": d})
        beete = [o for o in m.w["objects"] if o["kind"] == "seedbed" and it["x0"] <= o["tile"][0] * T + 8 - fx < it["x1"] and it["y0"] <= o["tile"][1] * T + 8 - fy < it["y1"]]
        for o in beete:
            if any(p["kind"] == "plant" and p["tile"] == o["tile"] for p in m.w["objects"]):
                raise Abgelehnt("Im Garten wächst etwas.", tuple(o["tile"]))
            ops.append({"op": "unplace", "region": g["id"], "id": o["id"]})
        gone = {o["id"] for o in beete}
        m.w["objects"] = [o for o in m.w["objects"] if o["id"] not in gone]
    m.mit_kacheln(lambda: m.op(*ops), box)
    return True
