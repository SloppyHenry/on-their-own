"""Kacheln aus den gespeicherten Formen einer Welt (`look.regions[*].shapes`, `decor`, `houses`) ableiten (AP16a, Spike).

Dieselbe Abtastung wie `generator/tiles.rasterize`: jede Kachel an 16 Stellen, dazu Bäume, Zäune, Wege durch Zaun und Baum, Mauern, Haustür und Gartentor. Die Formen eines Gebiets liegen
in Dorfkoordinaten (Weltpixel − `frame`), `frame` ist ein Vielfaches von 16, darum treffen die Abtastpunkte die gleichen Stellen wie im Generator. Formen dürfen über Gebietsgrenzen reichen:
an jedem Punkt gilt die stärkste Art aller Gebiete (Holz vor Wasser vor Sand vor Weg vor Gras).

`ableiten` rechnet nur ein Rechteck (Kacheln der Welt). Was im Bestand nicht aus Formen entsteht (der Waldpfad der Dörfer, handgemachter Boden in Dorf A), behandelt der Aufrufer
mit `unterschied`: Kacheln ändern sich nur dort, wo sich das Ableiten vor und nach der Aktion unterscheidet.
"""

import math

from ..tiles import BRIDGE_POST, DOOR, FENCE, FLOOR, GRASS, PATH, SAND, T, TREE, TREES, WALL, WATER, Formen, _decide, sample
from ..layout import HOME_W, WIDTH
from . import kennung as kn

RANG = {FLOOR: 4, WATER: 3, SAND: 2, PATH: 1, GRASS: 0}
PAD = 2                                                               # Rand um das Rechteck, damit „Kachel unter der Tür“ und Wegspuren richtig ankommen
DORF_GARTEN = (70, 56)                                                # der Gemeinschaftsgarten des Generators (Größe) hat ein Gartentor in der Ostseite


def haus_breite(sprite: str) -> int:
    """Breite des Sprites eines Gebäudes (`Building.w` des Generators)."""
    if sprite == "house":
        return HOME_W
    if sprite.startswith("bh:"):
        return int(sprite.split(":")[1]) + 12
    return WIDTH[{"bs": "shop", "bw": "workshop", "bb": "barn", "bt": "stable"}[sprite]]


def haus_mauer(h: dict) -> tuple[float, float, float, float]:
    """Mauerwerk eines Hauses (Dorfkoordinaten), wie `tiles.footprint`."""
    cx, base = h["at"]
    w = haus_breite(h["sprite"])
    return cx - w / 2 + 2, base - 34, cx + w / 2 - 2, base - 1


def _kacheln_an(x: float, y: float, fx: int, fy: int) -> tuple[int, int]:
    return math.floor((x + fx) / T), math.floor((y + fy) / T)


class _Gebiet:
    def __init__(self, look: dict, r: dict):
        r = kn.sichtbar(look, r)
        S = r["shapes"]
        self.r, self.fx, self.fy = r, r["frame"][0], r["frame"][1]
        self.formen = Formen(S["squares"], S["lakes"], S["streams"], S["paths"], [*S["docks"], *S["bridges"]])
        self.idx_paths, self.idx_water = self.formen.indexes()
        pts = [p for pl in [*S["paths"], *S["streams"]] for p in pl]
        xs = [p[0] for p in pts] + [k["x"] + s * k["rx"] * 1.2 for k in S["lakes"] for s in (-1, 1)] + [q["x"] + s * q["r"] for q in S["squares"] for s in (-1, 1)] + [b[i] for b in [*S["docks"], *S["bridges"]] for i in ("x0", "x1")]
        ys = [p[1] for p in pts] + [k["y"] + s * k["ry"] * 1.2 for k in S["lakes"] for s in (-1, 1)] + [q["y"] + s * q["r"] for q in S["squares"] for s in (-1, 1)] + [b[i] for b in [*S["docks"], *S["bridges"]] for i in ("y0", "y1")]
        self.box = (min(xs) - 8, min(ys) - 8, max(xs) + 8, max(ys) + 8) if xs else None

    def art(self, wx: float, wy: float) -> str:
        if self.box is None:
            return GRASS
        px, py = wx - self.fx, wy - self.fy
        if not (self.box[0] <= px <= self.box[2] and self.box[1] <= py <= self.box[3]):
            return GRASS
        return sample(self.formen, px, py, self.idx_paths, self.idx_water)


def ableiten(look: dict, rect: tuple[int, int, int, int]) -> dict[tuple[int, int], str]:
    """Kachelzeichen der Kacheln im Rechteck (x, y, Breite, Höhe; Kacheln der Welt), aus den Formen abgeleitet."""
    x0, y0, w, h = rect
    gx0, gy0, gw, gh = x0 - PAD, y0 - PAD, w + 2 * PAD, h + 2 * PAD
    regs = [_Gebiet(look, r) for r in look["regions"]]
    grid: dict[tuple[int, int], str] = {}
    for Y in range(gy0, gy0 + gh):
        for X in range(gx0, gx0 + gw):
            cnt: dict[str, int] = {}
            for a in range(4):
                for b in range(4):
                    px, py = X * T + 2 + 4 * a, Y * T + 2 + 4 * b
                    k = GRASS
                    for g in regs:
                        c = g.art(px, py)
                        if RANG[c] > RANG[k]:
                            k = c
                    cnt[k] = cnt.get(k, 0) + 1
            grid[(X, Y)] = _decide(cnt)
    deko: dict[tuple[int, int], str] = {}
    for g in regs:
        stuecke = [(d[0], d[1], d[2], d[3]) for d in g.r["decor"]]
        for p in g.r["place"].values():                                   # Bäume, die zu Quellen wurden (Apfelbäume), stehen nur noch in `place`
            if p.get("sprite") in TREES:
                stuecke += [(p["sprite"], p["at"][0], p["at"][1], p.get("e", 0))] + [(p["sprite"], m[0], m[1], m[2]) for m in p.get("more", [])]
        for kind, x, y, e in stuecke:
            t = _kacheln_an(x, y - 2, g.fx, g.fy)
            if kind in TREES:
                deko[t] = TREE
            elif kind in ("fence", "post") and not (kind == "post" and e == BRIDGE_POST):
                deko.setdefault(t, FENCE)
    for t, k in deko.items():
        if t in grid and grid[t] in (GRASS, PATH, SAND):
            grid[t] = k
    for g in regs:
        for pl in g.r["shapes"]["paths"]:                                  # Wege bleiben begehbar: dort weichen Zaun und Baum
            for a, b in zip(pl, pl[1:]):
                n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 5))
                for k in range(n + 1):
                    t = _kacheln_an(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, g.fx, g.fy)
                    if grid.get(t) in (TREE, FENCE):
                        grid[t] = PATH
    for g in regs:
        for hs in g.r["houses"]:
            bx0, by0, bx1, by1 = haus_mauer(hs)
            for (X, Y) in grid:
                cx, cy = X * T + 8 - g.fx, Y * T + 8 - g.fy
                if bx0 <= cx <= bx1 and by0 <= cy <= by1:
                    grid[(X, Y)] = WALL
            d = _kacheln_an(hs["at"][0], by1 - 1, g.fx, g.fy)
            if d in grid:
                grid[d] = DOOR
            f = (d[0], d[1] + 1)
            if f in grid and grid[f] not in (GRASS, PATH, SAND, FLOOR):
                grid[f] = PATH
        for gs in g.r["shapes"]["gardens"]:                                # Gartentor des Dorfgartens: die Lücke im Zaun an der Ostseite bleibt offen
            if (gs["x1"] - gs["x0"], gs["y1"] - gs["y0"]) == DORF_GARTEN and "id" not in gs:
                gy = 146 + (gs["y0"] - 120)
                for yy in (gy - 5, gy, gy + 5):
                    t = _kacheln_an(gs["x1"], yy, g.fx, g.fy)
                    if grid.get(t) in (FENCE, TREE):
                        grid[t] = GRASS
    return {(X, Y): grid[(X, Y)] for Y in range(y0, y0 + h) for X in range(x0, x0 + w)}


def unterschied(vorher: dict, nachher: dict, rect: tuple[int, int, int, int]) -> dict[tuple[int, int], str]:
    """Kacheln, die sich beim Ableiten aus `nachher` gegenüber `vorher` ändern (Zeichen aus `nachher`). Alles andere im Bestand bleibt, wie es ist."""
    a, b = ableiten(vorher, rect), ableiten(nachher, rect)
    return {t: c for t, c in b.items() if a[t] != c}
