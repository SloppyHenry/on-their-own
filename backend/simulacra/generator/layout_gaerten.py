"""Stellgrößen für Teiche, weitere Gärten und Felder (AP18f). Jedes Stück sucht sich eine freie Stelle; was keine findet, bleibt weg."""

import math

from .layout_geo import blocked_pt, box_blocked, clear_trees
from .rng import Rng, jr

TRIES = 80


def _down(lay, t: int) -> int:
    """Tiefste Stelle, an der ein Stück noch gesucht wird: erst im Dorf, ab dem 40. Versuch auch in der zusätzlichen Höhe nach Süden."""
    return 192 if t < 40 else 192 + lay.extra_h


def add_ponds(lay, rng: Rng, n: int) -> None:
    """Weitere Seen (Teiche): kleine Ellipsen mit etwas Schilf. Der große See mit Steg und Boot bleibt der erste."""
    for _ in range(max(0, n)):
        for t in range(TRIES):
            rx, ry = jr(rng.rnd(14, 22)), jr(rng.rnd(10, 15))
            x, y = jr(rng.rnd(-lay.ext_l + 30, 236)), jr(rng.rnd(24, _down(lay, t) - 2))
            pts = [(x + math.cos(a) * rx, y + math.sin(a) * ry) for a in [i * math.pi / 6 for i in range(12)]] + [(x, y)]
            if any(blocked_pt(lay, px, py, 12) for px, py in pts):
                continue
            lay.ponds.append({"x": x, "y": y, "rx": rx, "ry": ry})
            clear_trees(lay, (x - rx - 6, y - ry - 6, x + rx + 6, y + ry + 6))
            for k in range(3):
                a = rng.rnd(0, 6.28)
                lay.decor.append(["reed", jr(x + math.cos(a) * rx * 1.02), jr(y + math.sin(a) * ry * 1.02 + 4), 0])
            break
        else:
            lay.notes.append("ein See")


def _beds(x0: int, y0: int, w: int, rows: int) -> list[list[int]]:
    return [[x0 + 8, y0 + 7 + 14 * r, w - 16, 9] for r in range(rows)]


def add_gardens(lay, rng: Rng, n: int) -> None:
    """Weitere Gärten mit Zaun an drei Seiten (die Südseite bleibt offen, dort geht man hinein) und Beeten."""
    for _ in range(max(0, n)):
        for t in range(TRIES):
            w, h = jr(rng.rnd(56, 72)), jr(rng.rnd(36, 50))
            x0, y0 = jr(rng.rnd(-lay.ext_l + 20, 240 - w)), jr(rng.rnd(24, _down(lay, t) - 4 - h))
            if box_blocked(lay, (x0 - 6, y0 - 6, x0 + w + 6, y0 + h + 10), 8):
                continue
            g = {"x0": x0, "y0": y0, "x1": x0 + w, "y1": y0 + h, "beds": _beds(x0, y0, w, (h - 8) // 14), "fenced": True}
            lay.gardens2.append(g)
            clear_trees(lay, (x0 - 6, y0 - 6, x0 + w + 6, y0 + h + 10))
            x = x0
            while x < x0 + w - 4:
                lay.decor.append(["fence", x + 7, y0, 0]); x += 12
            y = y0 + 8
            while y < y0 + h - 6:
                lay.decor.append(["post", x0, y, 0]); lay.decor.append(["post", x0 + w, y, 0]); y += 8
            break
        else:
            lay.notes.append("ein Garten")


def add_fields(lay, rng: Rng, n: int) -> None:
    """Felder: größere Beetflächen ohne Zaun."""
    for _ in range(max(0, n)):
        for t in range(TRIES):
            w, h = jr(rng.rnd(80, 100)), jr(rng.rnd(48, 62))
            x0, y0 = jr(rng.rnd(-lay.ext_l + 20, 250 - w)), jr(rng.rnd(24, _down(lay, t) - 2 - h))
            if box_blocked(lay, (x0 - 4, y0 - 4, x0 + w + 4, y0 + h + 4), 8):
                continue
            lay.gardens2.append({"x0": x0, "y0": y0, "x1": x0 + w, "y1": y0 + h, "beds": _beds(x0, y0, w, max(1, (h - 8) // 14)), "fenced": False})
            clear_trees(lay, (x0 - 4, y0 - 4, x0 + w + 4, y0 + h + 4))
            break
        else:
            lay.notes.append("ein Feld")
