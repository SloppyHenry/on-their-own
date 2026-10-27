"""Wasser der freien Dorfformen (AP18f): See mit Steg, Bach aus dem Nordwald und Brücken dort, wo ein Weg das Wasser kreuzt.

Alles sucht sich seine Stelle nach den Häusern und Wegen, die schon stehen; was keine freie Stelle findet, bleibt weg und steht im Prüfbericht.
"""

import math

from .geometry import Pt, line_dist
from .layout_geo import blocked_pt
from .rng import Rng, jr


def cross(a: Pt, b: Pt, c: Pt, d: Pt) -> Pt | None:
    """Schnittpunkt der Strecken a–b und c–d, sonst None."""
    r, s = (b[0] - a[0], b[1] - a[1]), (d[0] - c[0], d[1] - c[1])
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-9:
        return None
    t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den
    u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
    return (a[0] + t * r[0], a[1] + t * r[1]) if 0 <= t <= 1 and 0 <= u <= 1 else None


def line_clear(lay, pts: list[Pt], pad: float = 3) -> bool:
    """Ein Weg liegt auf keinem Haus, Garten, Wasser und bleibt im Dorf."""
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 4))
        for k in range(n + 1):
            x, y = ax + (bx - ax) * k / n, ay + (by - ay) * k / n
            if not (-lay.ext_l - 20 < x < 290 and 0 < y < 232 + lay.extra_h) or blocked_pt(lay, x, y, pad, paths=False, square=False):
                return False
    return True


def lane_points(lay, n_lanes: int) -> list[Pt]:
    """Wegpunkte aller Straßen und Gassen (nicht der Türwege), alle 10 Pixel."""
    out: list[Pt] = []
    for pl in lay.paths[:n_lanes]:
        for (ax, ay), (bx, by) in zip(pl, pl[1:]):
            n = max(1, int(math.hypot(bx - ax, by - ay) / 10))
            out += [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n) for k in range(n)]
        out.append(tuple(pl[-1]))
    return out


def add_lake(lay, rng: Rng, n_lanes: int, tries: int = 300) -> bool:
    """Der große See mit Steg und Boot: eine freie Stelle mit Weg vom Steg zur nächsten Straße. Gelingt es nicht, bleibt der See weg."""
    targets = lane_points(lay, n_lanes)
    for _ in range(tries):
        rx, ry = jr(rng.rnd(34, 40)), jr(rng.rnd(24, 34))
        x, y = jr(rng.rnd(-lay.ext_l + rx + 40, 246 - rx)), jr(rng.rnd(60 + ry, 214 + lay.extra_h - ry))
        ring = [(x + math.cos(a * math.pi / 12) * (rx + 12) * 1.15, y + math.sin(a * math.pi / 12) * (ry + 10) * 1.15) for a in range(24)]
        inner = [(x + dx * rx * 0.6, y + dy * ry * 0.6) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        dock = {"x0": x - rx - 4, "y0": y - 2, "x1": x - rx + 18, "y1": y + 7}
        if any(blocked_pt(lay, px, py, 4) for px, py in ring + inner) or any(blocked_pt(lay, px, py, 3) for px, py in ((dock["x0"] - 6, y + 2), (dock["x0"], y + 2))):
            continue
        mouth = (dock["x0"] - 6, y + 2)
        for t in sorted(targets, key=lambda q: math.hypot(q[0] - mouth[0], q[1] - mouth[1]))[:8]:
            for way in ([mouth, t], [mouth, (mouth[0], t[1]), t], [mouth, (t[0], mouth[1]), t]):
                if line_clear(lay, way):
                    lay.lake, lay.dock = {"x": x, "y": y, "rx": rx, "ry": ry}, dock
                    lay.paths.append([(round(a, 1), round(b, 1)) for a, b in way])
                    for _r in range(5):
                        an = rng.rnd(-0.4, 2.6)
                        lay.decor.append(["reed", jr(x + math.cos(an) * rx * 1.02), jr(y + math.sin(an) * ry * 1.02 + 4), 0])
                    lay.decor.append(["boat", jr(x + 8), jr(y + 14), 0])
                    return True
    lay.notes.append("der See")
    return False


def add_stream(lay, rng: Rng, mode: str, n_lanes: int) -> bool:
    """Bach (oder breiter Fluss) aus dem Nordwald: in den See, ohne See bis zum Südrand. Der Lauf sucht sich einen Weg um Häuser, Gärten und Türwege herum; Straßen kreuzt er unter einer Brücke."""
    if mode == "keiner":
        return False
    doors = lay.paths[n_lanes:]
    bottom = 232 + lay.extra_h
    xs = [jr(lay.lake["x"] + rng.rnd(-0.25, 0.25) * lay.lake["rx"])] if lay.lake else []
    xs += [jr(rng.rnd(-lay.ext_l + 40, 230)) for _ in range(5)]
    for sx in xs:
        route = _route(lay, rng, (sx, 6), doors, bottom)
        if route:
            pts = [(sx, -70), *route]
            lay.stream = [(round(a, 1), round(b, 1)) for a, b in pts]
            if mode == "fluss":
                lay.strands = [[(x + dx, y) for x, y in lay.stream] for dx in (-7, 7)]
            add_bridges(lay, n_lanes, 7 if mode == "fluss" else 0, vertical=True)
            return True
    lay.notes.append("der Bach")
    return False


CELL = 12


def _route(lay, rng: Rng, start: Pt, doors, bottom: float, goal_ellipse: dict | None = None, from_pond: dict | None = None) -> list[Pt] | None:
    """Kürzester Weg (A*, acht Nachbarn) für den Bach über ein Raster; Hindernisse sind Häuser, Gärten, Seen, Platz, Dorfwiese und Türwege. Ziel: der See, sonst der Südrand."""
    import heapq
    x0, x1 = -lay.ext_l - 20, 280
    nx, ny = int((x1 - x0) / CELL) + 1, int((bottom + 20) / CELL) + 1
    ph = rng.rnd(0, 6.28)

    def pos(c): return (x0 + c[0] * CELL, c[1] * CELL)

    seen: dict[tuple[int, int], bool] = {}

    def free(c) -> bool:
        if c not in seen:
            seen[c] = _free(c)
        return seen[c]

    def _free(c) -> bool:
        x, y = pos(c)
        if y < 4:
            return True
        for k in (goal_ellipse or lay.lake, from_pond):
            if k and ((x - k["x"]) / (k["rx"] + 2)) ** 2 + ((y - k["y"]) / (k["ry"] + 2)) ** 2 < 1:
                return True
        return not blocked_pt(lay, x, y, 9, paths=False) and not (doors and line_dist(doors, x, y) < 10)

    def goal(c) -> bool:
        x, y = pos(c)
        k = goal_ellipse or lay.lake
        if k:
            return ((x - k["x"]) / k["rx"]) ** 2 + ((y - k["y"]) / k["ry"]) ** 2 < 0.8
        return y >= bottom - 6

    s = (int(round((start[0] - x0) / CELL)), int(round(start[1] / CELL)))
    if not free(s):
        return None
    best, prev, heap = {s: 0.0}, {}, [(0.0, s)]
    done = None
    while heap:
        _, c = heapq.heappop(heap)
        if goal(c):
            done = c
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1), (0, -1), (1, -1), (-1, -1)):
            n = (c[0] + dx, c[1] + dy)
            if not (0 <= n[0] < nx and 0 <= n[1] < ny) or not free(n):
                continue
            cost = best[c] + (1.41 if dx and dy else 1.0) * (1 + 0.25 * math.sin(n[0] * 0.9 + n[1] * 0.7 + ph)) + (0.35 if dy <= 0 else 0)
            if cost < best.get(n, 1e9):
                best[n], prev[n] = cost, c
                heapq.heappush(heap, (cost, n))
    if done is None:
        return None
    cells = [done]
    while cells[-1] in prev:
        cells.append(prev[cells[-1]])
    pts = [pos(c) for c in reversed(cells)]
    for _ in range(3):                                                                       # glätten: Mittel mit den Nachbarn
        pts = [pts[0]] + [((a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4) for a, b, c in zip(pts, pts[1:], pts[2:])] + [pts[-1]]
    return pts[::2] + ([pts[-1]] if len(pts) % 2 == 0 else [])


def add_bridges(lay, n_lanes: int, off: int, vertical: bool, water: list[list[Pt]] | None = None) -> None:
    """Eine Brücke an jeder Stelle, an der eine Straße oder Gasse das Wasser kreuzt. `off`: Abstand der äußeren Stränge; `vertical`: das Wasser fließt von oben nach unten."""
    water = water or [pl for pl in [lay.stream, *lay.strands] if len(pl) > 1]
    found: list[Pt] = []
    for lane in lay.paths[:n_lanes]:
        for c, d in zip(lane, lane[1:]):
            for pl in water:
                for a, b in zip(pl, pl[1:]):
                    x = cross(a, b, c, d)
                    if x and all(math.hypot(x[0] - q[0], x[1] - q[1]) > 26 for q in found):
                        found.append(x)
    for ix, iy in found:
        hx, hy = (9 + off + 4, 6) if vertical else (9, 6 + off + 4)
        box = {"x0": jr(ix - hx), "x1": jr(ix + hx), "y0": jr(iy - hy), "y1": jr(iy + hy)}
        if lay.bridge is None:
            lay.bridge = box
        else:
            lay.bridges2.append(box)
        for px, py in ((box["x0"] + 1, box["y0"] + 2), (box["x1"] - 1, box["y0"] + 2), (box["x0"] + 1, box["y1"] + 3), (box["x1"] - 1, box["y1"] + 3)):
            lay.decor.append(["post", px, py, 9])                                   # Zusatz 9: Brückenpfosten sperren keine Kachel


def connect_ponds(lay, rng: Rng, n_lanes: int) -> None:
    """Manche Teiche hängen über einen Bach am großen See (der Bach kommt vom Teich und fließt in den See); Straßen kreuzt er unter einer Brücke."""
    if not lay.lake:
        return
    doors = lay.paths[n_lanes:]
    for pond in lay.ponds:
        if rng.random() > 0.55:
            continue
        route = _route(lay, rng, (pond["x"], pond["y"]), doors, 232 + lay.extra_h, goal_ellipse=lay.lake, from_pond=pond)
        if route and len(route) > 2:
            line = [(round(a, 1), round(b, 1)) for a, b in route]
            lay.strands.append(line)
            add_bridges(lay, n_lanes, 0, vertical=True, water=[line])
