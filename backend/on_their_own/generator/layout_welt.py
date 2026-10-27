"""Stellgrößen für Wege, Wasserlauf, einzelne Bäume und Wald (AP18f): arbeitet auf einem fertigen Layout (`layout_extra.apply_stil`)."""

from .geometry import line_dist
from .layout_geo import blocked_pt, road_y, water_lines
from .rng import Rng, jr


def flatten_paths(lay) -> None:
    """Gerade Wege: Hauptstraße und Südstraße als Gerade, Türwege der Häuser senkrecht zur Straße."""
    y0, sx = lay.sq["y"], lay.sq["x"]
    west, east, south = lay.paths[0], lay.paths[1], lay.paths[2]
    lay.paths[0] = [(west[0][0], y0), (west[-1][0], y0)]
    lay.paths[1] = [(east[0][0], y0), (east[-1][0], y0)]
    lay.paths[2] = [(sx, south[0][1]), (sx, south[-1][1])]
    doors = {(round(b.cx, 1), round(b.base + 3, 1)): b for b in lay.buildings}
    for i, pl in enumerate(lay.paths):
        b = doors.get((round(pl[0][0], 1), round(pl[0][1], 1)))
        if b is not None and len(pl) == 4:
            lay.paths[i] = [(b.cx, b.base + 3), (b.cx, y0)]
    if lay.bridge:
        b = lay.bridge
        h = (b["y1"] - b["y0"]) // 2
        lay.bridge = {**b, "y0": jr(y0 - h), "y1": jr(y0 + h)}


def set_stream(lay, mode: str) -> None:
    if mode == "keiner":
        lay.stream, lay.strands, lay.bridge = [], [], None
        lay.decor = [d for d in lay.decor if not (d[0] == "post" and d[3] == 9)]                  # Brückenpfosten
    elif mode == "fluss" and len(lay.stream) > 1:
        lay.strands = [[(x + dx, y) for x, y in lay.stream] for dx in (-7, 7)]
        if lay.bridge:
            b = lay.bridge
            lay.bridge = {**b, "x0": b["x0"] - 13, "x1": b["x1"] + 13}
            lay.decor = [d for d in lay.decor if not (d[0] == "post" and d[3] == 9)]
            for px, py in ((lay.bridge["x0"] + 1, lay.bridge["y0"] + 2), (lay.bridge["x1"] - 1, lay.bridge["y0"] + 2), (lay.bridge["x0"] + 1, lay.bridge["y1"] + 3), (lay.bridge["x1"] - 1, lay.bridge["y1"] + 3)):
                lay.decor.append(["post", px, py, 9])


def _trees(lay, lo: int, hi: int) -> list[list]:
    return [d for d in lay.decor if d[0] in ("tree", "pine") and lo <= d[3] < hi]


def adjust_trees(lay, rng: Rng, target: int) -> None:
    """Einzelne Bäume im Dorf (Vorgabe 10): zu viele fallen weg, fehlende kommen an freien Stellen dazu."""
    cur = _trees(lay, 40, 50)
    if target < len(cur):
        for d in cur[target:]:
            lay.decor.remove(d)
    n, tries = len(cur), 0
    while n < target and tries < 400:
        tries += 1
        x, y = rng.rnd(0, 256), rng.rnd(20, 196 + lay.extra_h)
        if not blocked_pt(lay, x, y, 16):
            lay.decor.append(["pine" if rng.random() < 0.45 else "tree", jr(x), jr(y), 50 + n])
            n += 1


def adjust_forest(lay, rng: Rng, wald: str) -> None:
    """Wald licht, mittel (Vorgabe) oder dicht; der Waldrand im Süden rückt mit der Höhe des Dorfs nach unten."""
    if lay.extra_h:
        for d in lay.decor:
            if d[0] in ("tree", "pine") and 500 <= d[3] < 600:
                d[2] += lay.extra_h
    zone = [d for d in _trees(lay, 100, 600)]
    if wald == "licht":
        for d in zone:
            if rng.random() < 0.45:
                lay.decor.remove(d)
    elif wald == "dicht":
        water, paths = water_lines(lay), lay.paths
        n, tries, want = 0, 0, round(len(zone) * 0.6)
        while n < want and tries < want * 12:
            tries += 1
            z = rng.random()
            if z < 0.7:
                x, y = rng.rnd(-60 - lay.ext_l, 320), rng.rnd(-94, -6)
            elif z < 0.85:
                x, y = rng.rnd(-58 - lay.ext_l, -8 - lay.ext_l), rng.rnd(0, 196 + lay.extra_h)
            else:
                x, y = rng.rnd(266, 318), rng.rnd(0, 196 + lay.extra_h)
            if line_dist(paths, x, y) > 12 and (not water or line_dist(water, x, y) > 9) and not blocked_pt(lay, x, y, 8, paths=False):
                lay.decor.append(["pine" if rng.random() < 0.45 else "tree", jr(x), jr(y), 600 + n])
                n += 1
