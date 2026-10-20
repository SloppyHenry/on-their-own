"""Dorfformen (AP18f): zweite Häuserzeile südlich der Straße (beidseitig) und Haufendorf um den Platz.

Die Haustür zeigt immer nach Süden. Ein Haus südlich der Straße oder des Platzes bekommt deshalb einen Türweg um das Haus herum (Tür, kurz nach Süden, seitlich am Haus
vorbei, nach Norden zur Straße), der Lücken zwischen den Häusern nutzt. Jedes Haus wird nur gesetzt, wenn Fläche und Weg frei sind; sonst zählt es als „passte nicht“.
"""

import math

from .geometry import line_dist
from .layout_geo import blocked_pt, box_blocked, box_of, clear_trees, road_y
from .rng import Rng, jr

BASE_BOTTOM = 232                     # untere Grenze des Dorfs ohne zusätzliche Höhe
CAP = BASE_BOTTOM + 96                # so weit nach unten darf ein Haus samt Türweg höchstens reichen
GAP = 30                              # Abstand zwischen Häusern der zweiten Zeile (Platz für den Türweg)


def place_buildings(lay, rng: Rng, st) -> None:
    from .layout import Building                                       # spät, sonst kreisen die Einbindungen
    todo = sorted(lay.spare, key=lambda b: b.role not in ("house", "home"))                # Wohnhäuser zuerst: ohne sie fehlen Betten
    lay.spare = []
    first = len(lay.buildings)
    if lay.form == "beidseitig":
        _south_row(lay, rng, todo, Building)
    elif lay.form == "haufen":
        _ring(lay, rng, todo, Building)
    del first


def _footprint(b) -> tuple[float, float, float, float]:
    return b.cx - b.w / 2 - 2, b.base - 36, b.cx + b.w / 2 + 2, b.base + 2


def _path_ok(lay, path, own) -> bool:
    """Der Türweg führt nicht durch andere Häuser, Wasser oder Gärten und bleibt im Dorf."""
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 4))
        for k in range(n + 1):
            x, y = ax + (bx - ax) * k / n, ay + (by - ay) * k / n
            if not (-lay.ext_l - 30 < x < 296 and -4 < y < CAP):
                return False
            for o in lay.buildings:
                if o is not own and o is not None:
                    x0, y0, x1, y1 = _footprint(o)
                    if x0 - 3 < x < x1 + 3 and y0 - 3 < y < y1 + 3:
                        return False
            if blocked_pt(lay, x, y, 1, paths=False, houses=False, square=False):
                return False
    return True


def _emit(lay, rng: Rng, Building, role: str, kind: str, w: int, ww: int, cx: float, base: float, path, away: int) -> None:
    """Das Haus samt Weg, Platte und Schmuck eintragen; `away` (±1) ist die Seite ohne Türweg, dort steht der Briefkasten."""
    b = Building(role, kind, jr(cx), base, w, ww)
    lay.buildings.append(b)
    lay.decor.append([kind, cx, base, 0])
    x0, y0, x1, y1 = box_of(b)
    clear_trees(lay, (x0 - 4, y0 - 10, x1 + 4, y1 + 10))
    lay.paths.append([(round(x, 1), round(y, 1)) for x, y in path])
    lay.pads.append([round(cx - w / 2 + 3, 1), base - 26, round(cx + w / 2 - 3, 1), base])
    d = lay.decor
    if role in ("house", "home"):
        d.append([rng.pick(["bushP", "bushY", "bushW"]), jr(cx - 16), base + 8, 0]); d.append([rng.pick(["bushP", "bushY", "bushW"]), jr(cx + 17), base + 8, 0])
        d.append(["mailbox", jr(cx + away * (w / 2 - 4)), base + 6, 0])
    elif role == "stable":
        d.append(["bhay", jr(cx + away * (w / 2 - 4)), base + 6, 0]); d.append(["bhay", jr(cx - away * (w / 2 - 8)), base + 8, 1])
    elif role == "barn":
        d.append(["bhay", jr(cx + away * (w / 2 + 2)), base + 6, 0]); d.append(["bhay", jr(cx - away * (w / 2 - 10)), base + 8, 1])
    elif role == "workshop":
        d.append(["blog", jr(cx + away * (w / 2 + 6)), base + 4, 0]); d.append(["bcr", jr(cx - away * (w / 2 - 6)), base + 8, 0])
    else:
        d.append(["bcr", jr(cx + away * (w / 2 - 6)), base + 8, 0]); d.append(["bushY", jr(cx - away * (w / 2 - 6)), base + 8, 0])


def _fits(lay, b, inflate: float = 0) -> bool:
    x0, y0, x1, y1 = box_of(b)
    return not box_blocked(lay, (x0 - inflate, y0, x1 + inflate, y1), 4)


def _south_row(lay, rng: Rng, todo, Building) -> None:
    """Zweite Zeile südlich der Straße: von links nach rechts die erste Stelle, an der Fläche und ein Türweg frei sind."""
    x_min, x_max = -lay.ext_l + 8, 258
    for t in todo:
        done = False
        cursor = x_min + rng.rnd(0, 6)
        while cursor + t.w < x_max and not done:
            cx = cursor + t.w / 2
            base = jr(road_y(lay, cx) + 84 + rng.rnd(0, 8))
            if base > CAP - 26:
                break
            cand = Building(t.role, t.kind, jr(cx), base, t.w, t.ww)
            if _fits(lay, cand, 13):
                for side in (1, -1):
                    xo = cx + side * (t.w / 2 + 13)
                    path = [(cx, base + 3), (cx, base + 13), (xo, base + 13), (xo, road_y(lay, xo) + 1)]
                    if _path_ok(lay, path, cand):
                        _emit(lay, rng, Building, t.role, t.kind, t.w, t.ww, cx, base, path, -side)
                        done = True
                        break
            cursor += 6
        if not done:
            lay.skipped += 1


def _ring(lay, rng: Rng, todo, Building) -> None:
    sx, sy, r = lay.sq["x"], lay.sq["y"], lay.sq["r"]
    for t in todo:
        done = False
        for k in range(6):
            D = r + 26 + k * 50                                                # Abstand der Haustür von der Platzmitte
            for _ in range(24):
                a = rng.rnd(0, 2 * math.pi)
                cx, base = sx + math.cos(a) * D * 1.35, jr(sy + math.sin(a) * D * 0.9)
                if not (-lay.ext_l + t.w / 2 + 4 < cx < 262 - t.w / 2 and 34 < base < CAP - 26):
                    continue
                cand = Building(t.role, t.kind, jr(cx), base, t.w, t.ww)
                if not _fits(lay, cand, 8):
                    continue
                d = math.hypot(cx - sx, base - sy) or 1.0
                tx, ty = sx + (cx - sx) * (r - 3) / d, sy + (base - sy) * (r - 3) / d
                for side in (1, -1):
                    xo = cx + side * (t.w / 2 + 13)
                    if ty >= base + 8:
                        path = [(cx, base + 3), (cx, base + 12), (tx, ty)]
                    else:
                        path = [(cx, base + 3), (cx, base + 13), (xo, base + 13), (xo, ty), (tx, ty)]
                    if _path_ok(lay, path, cand):
                        _emit(lay, rng, Building, t.role, t.kind, t.w, t.ww, cx, base, path, -side)
                        done = True
                        break
                if done:
                    break
            if done:
                break
        if not done:
            lay.skipped += 1
