"""Kacheln aus denselben Formen wie das Bild: Jede Kachel (16 × 16 Weltpixel) wird an 16 Stellen abgetastet und bekommt die Art, die dort überwiegt.

So steht man im Bild nie auf dem Wasser und läuft nie durch eine Wiese, die im Bild eine Mauer ist. Die Zeichen sind die der Kachelarten
der Startwelt (`.` Gras, `,` Weg, `_` Boden/Steg, `#` Wand, `~` Wasser, `T` Baum, `+` Tür, `s` Sand, `f` Zaun, `m` Möbel).
"""

import math
from dataclasses import dataclass, field

from .geometry import line_dist
from .layout import Layout

T = 16
GRASS, PATH, FLOOR, WALL, WATER, TREE, DOOR, SAND, FENCE = ".", ",", "_", "#", "~", "T", "+", "s", "f"
TREES = {"tree", "pine", "treeF", "treeB"}
BRIDGE_POST = 9                                                         # Zusatz an Pfosten der Brücke (sperren keine Kachel)


@dataclass
class Outdoor:
    """Kachelraster des Dorfs im Freien; Kachel (i, j) liegt bei Dorfkoordinaten (x0 + 16 i, y0 + 16 j)."""
    x0: int
    y0: int
    rows: list[list[str]]
    doors: list[tuple[int, int]] = field(default_factory=list)          # Haustür je Gebäude (Kachel im Raster), Reihenfolge wie `Layout.buildings`
    gate: tuple[int, int] | None = None                                 # Gartentor

    @property
    def w(self) -> int:
        return len(self.rows[0])

    @property
    def h(self) -> int:
        return len(self.rows)

    def tile_of(self, x: float, y: float) -> tuple[int, int]:
        return math.floor((x - self.x0) / T), math.floor((y - self.y0) / T)

    def center(self, i: int, j: int) -> tuple[float, float]:
        return self.x0 + T * i + 8, self.y0 + T * j + 8


def footprint(b) -> tuple[float, float, float, float]:
    """Mauerwerk eines Gebäudes (Dorfkoordinaten): wie das Haus aus A, Breite des Sprites, zwei Kachelreihen hoch."""
    return b.cx - b.w / 2 + 2, b.base - 34, b.cx + b.w / 2 - 2, b.base - 1


def bounds(L: Layout) -> tuple[int, int, int, int]:
    """Das Rechteck, das Wiese und Waldrand des Dorfs deckt (Dorfkoordinaten, auf ganze Kacheln ausgerichtet)."""
    return -L.ext_l - 64, -96, 320, 240


def rasterize(L: Layout) -> Outdoor:
    x0, y0, x1, y1 = bounds(L)
    w, h = (x1 - x0) // T, (y1 - y0) // T
    out = Outdoor(x0, y0, [[GRASS] * w for _ in range(h)])
    lake, sq = L.lake, L.sq
    decor_tiles: dict[tuple[int, int], str] = {}
    for kind, x, y, e in L.decor:
        i, j = out.tile_of(x, y - 2)
        if kind in TREES:
            decor_tiles[(i, j)] = TREE
        elif kind in ("fence", "post") and not (kind == "post" and e == BRIDGE_POST):
            decor_tiles.setdefault((i, j), FENCE)
    for j in range(h):
        for i in range(w):
            cnt: dict[str, int] = {}
            for a in range(4):
                for b in range(4):
                    px, py = x0 + T * i + 2 + 4 * a, y0 + T * j + 2 + 4 * b
                    k = _sample(L, px, py, lake, sq)
                    cnt[k] = cnt.get(k, 0) + 1
            out.rows[j][i] = _decide(cnt)
    for (i, j), k in decor_tiles.items():
        if 0 <= i < w and 0 <= j < h and out.rows[j][i] in (GRASS, PATH, SAND):
            out.rows[j][i] = k
    for b in L.buildings:                                                # Mauern und Haustür
        bx0, by0, bx1, by1 = footprint(b)
        for j in range(h):
            for i in range(w):
                cx, cy = out.center(i, j)
                if bx0 <= cx <= bx1 and by0 <= cy <= by1:
                    out.rows[j][i] = WALL
        di, dj = out.tile_of(b.cx, by1 - 1)
        out.rows[dj][di] = DOOR
        out.doors.append((di, dj))
        if out.rows[dj + 1][di] not in (GRASS, PATH, SAND, FLOOR):      # vor der Tür muss man stehen können
            out.rows[dj + 1][di] = PATH
    g = L.garden                                                         # Gartentor: Lücke im Zaun an der Ostseite
    out.gate = out.tile_of(g["x1"], 146 + (g["y0"] - 120))
    if out.rows[out.gate[1]][out.gate[0]] in (FENCE, TREE):
        out.rows[out.gate[1]][out.gate[0]] = GRASS
    return out


def _sample(L: Layout, px: float, py: float, lake: dict, sq: dict) -> str:
    for r in (L.dock, *([L.bridge] if L.bridge else [])):
        if r["x0"] <= px < r["x1"] and r["y0"] <= py < r["y1"]:
            return FLOOR
    a, b = (px - lake["x"]) / lake["rx"], (py - lake["y"]) / lake["ry"]
    q = a * a + b * b
    if q < 1 or line_dist([L.stream], px, py) < 3.6:
        return WATER
    if q < 1.13 or line_dist([L.stream], px, py) < 5.4:
        return SAND
    if math.hypot(px - sq["x"], (py - sq["y"]) * 1.08) < sq["r"] or line_dist(L.paths, px, py) < 5.2:
        return PATH
    return GRASS


def _decide(c: dict[str, int]) -> str:
    if c.get(FLOOR, 0) >= 6:
        return FLOOR
    if c.get(WATER, 0) >= 8:
        return WATER
    if c.get(SAND, 0) + c.get(WATER, 0) >= 8:
        return SAND
    if c.get(PATH, 0) >= 6:
        return PATH
    return GRASS
