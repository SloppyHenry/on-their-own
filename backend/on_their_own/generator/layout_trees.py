"""Steine, Apfelbäume, Wald, Randbäume und einzelne Bäume der freien Dorfformen (AP18f): wie beim Straßendorf, aber über die ganze Breite und Höhe des Dorfs."""

from .geometry import line_dist
from .layout_geo import blocked_pt, water_lines
from .layout_welt import adjust_forest, adjust_trees
from .rng import Rng, jr


def add_trees(lay, rng: Rng, R2: Rng, st) -> None:
    add = lambda k, x, y, e=0: lay.decor.append([k, jr(x), jr(y), e])             # noqa: E731
    kind = lambda: "pine" if R2.random() < 0.45 else "tree"                        # noqa: E731
    xl, h = -lay.ext_l, lay.extra_h
    water = water_lines(lay)
    n = 0
    for _ in range(80):
        if n >= 4:
            break
        x, y = rng.rnd(xl + 10, 250), rng.rnd(60, 190 + h)
        if not blocked_pt(lay, x, y, 14):
            add("rock", x, y, n); n += 1
    n = tries = 0
    while n < 2 and tries < 100:                                                   # Apfelbäume (Quelle „Apfelbäume“)
        tries += 1
        x, y = rng.rnd(xl + 20, 240), rng.rnd(70, 190 + h)
        if not blocked_pt(lay, x, y, 18):
            add("treeF", x, y, 10 + n); n += 1
    for i in range(95 + jr(lay.ext_l * 0.25)):                                     # Wald im Norden
        x, y = -60 - lay.ext_l + R2.random() * (380 + lay.ext_l), -94 + R2.random() * 88
        if (not water or line_dist(water, x, y) > 9) and line_dist(lay.paths, x, y) > 12:
            add(kind(), x, y, 100 + i)
    for i in range(26 + h // 8):                                                   # Streifen links und rechts
        lx, ly, rx, ry = -58 - lay.ext_l + R2.random() * 50, R2.random() * (196 + h), 266 + R2.random() * 52, R2.random() * (196 + h)
        k1, k2 = kind(), kind()
        if line_dist(lay.paths, lx, ly) > 14 and (not water or line_dist(water, lx, ly) > 9):
            add(k1, lx, ly, 300 + i)
        if line_dist(lay.paths, rx, ry) > 14 and (not water or line_dist(water, rx, ry) > 9):
            add(k2, rx, ry, 400 + i)
    n = tries = 0
    while n < 10 and tries < 160:                                                  # einzelne Bäume im Dorf
        tries += 1
        x, y = rng.rnd(xl + 10, 256), rng.rnd(20, 196 + h)
        if not blocked_pt(lay, x, y, 16):
            add(kind(), x, y, 40 + n); n += 1
    for i in range(14 + lay.ext_l // 48):                                          # Rand im Süden (rückt in `adjust_forest` mit der Höhe nach unten)
        x, y = rng.rnd(-40 - lay.ext_l, 300), rng.rnd(196, 215)
        if line_dist(lay.paths, x, y) > 14 and (not water or line_dist(water, x, y) > 10):
            add(kind(), x, y, 500 + i)
    adjust_trees(lay, rng, st.baeume)
    adjust_forest(lay, rng, st.wald)
