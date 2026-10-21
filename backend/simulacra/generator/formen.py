"""Die drei freien Dorfformen (AP18f): Straßen, Platz und Häuser von Anger, Fluss quer und Streusiedlung.

Jeder Plan setzt `lay.ext_l`, `lay.extra_h` (so weit darf das Dorf beim Setzen nach Süden wachsen; gekürzt wird später), den Platz, die Straßen (`lay.paths`, zuerst alle
Straßen und Gassen, danach kommen die Türwege der Häuser) und die Häuser. Rückgabe: welche Wege die Ausfahrten sind, die Laternen und die Mindesthöhe.
"""

import math

from .geometry import Pt, lerp_y
from .layout_frei import try_place
from .layout_wasser import add_bridges, lane_points, line_clear
from .rng import Rng, jr

GROESSE = {"klein": 0, "mittel": 96, "gross": 192}


def _road(a: Pt, b: Pt, rng: Rng, amp: float, n: int) -> list[Pt]:
    """Weg von a nach b mit n - 1 Zwischenpunkten, die um `amp` pendeln."""
    pts = [a]
    for k in range(1, n):
        t = k / n
        pts.append((a[0] + (b[0] - a[0]) * t + rng.rnd(-amp, amp) * 0.4, a[1] + (b[1] - a[1]) * t + rng.rnd(-amp, amp)))
    return [*pts, b]


def _ext(lay, st, need: float) -> None:
    lay.ext_l = max(16 * math.ceil(max(0.0, need) / 16), GROESSE[st.groesse])


def _extent(lay, st, area: float) -> None:
    """Breite (nach Westen) und Höhe (nach Süden) so wählen, dass die Fläche des Dorfs für `area` Pixel² reicht; die Höhe ist die Obergrenze beim Setzen, gekürzt wird später."""
    ext, ex = 0, 0
    while (256 + ext) * (190 + ex) < area and (ext < 480 or ex < 288):
        if ext <= ex * 1.4 and ext < 480:
            ext += 32
        else:
            ex = min(288, ex + 32)
    _ext(lay, st, ext)
    lay.extra_h = max(ex, 48)


def lane_spot(rng: Rng, polys: list[list[Pt]], t, att: int, center: Pt | None = None, u: tuple[float, float] = (0.0, 1.0)) -> tuple[float, float]:
    """Mitte eines Hauses an einem zufälligen Punkt einer der Straßen, seitlich versetzt (bei `center` nach außen); ein Versuch weiter gibt mehr Spielraum."""
    lens = [sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pl, pl[1:])) for pl in polys]
    r = rng.random() * sum(lens)
    for pl, ln in zip(polys, lens):
        if r <= ln:
            break
        r -= ln
    segs = [(a, b, math.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(pl, pl[1:])]
    r = rng.rnd(u[0], u[1]) * sum(sg[2] for sg in segs)
    for a, b, ln in segs:
        if r <= ln:
            break
        r -= ln
    f = r / (ln or 1.0)
    px, py = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
    dx, dy = (b[0] - a[0]) / (ln or 1.0), (b[1] - a[1]) / (ln or 1.0)
    nx, ny = -dy, dx
    side = rng.pick([1, -1]) if center is None else (1 if (px - center[0]) * nx + (py - center[1]) * ny > 0 else -1)
    off = 14 + abs(nx) * (t.w / 2 + 3) + abs(ny) * 34 + rng.rnd(0, 10 + att * 0.5)
    return px + nx * side * off, py + ny * side * off


def _fill(lay, rng: Rng, t, targets, spot, attempts: int = 90, count: bool = True) -> bool:
    """Setzt das Gebäude an die erste freie Stelle: `spot(att)` liefert die Mitte des Hauses für den Versuch `att`. Ohne Erfolg zählt es als „passte nicht“ (außer mit `count=False`)."""
    for att in range(attempts):
        x, y = spot(att)
        if try_place(lay, rng, t, x, jr(y + 28), targets):
            return True
    lay.skipped += count
    return False


def _rest(lay, rng: Rng, left: list, lanes: int, targets) -> None:
    """Letzte Möglichkeit für Gebäude, die an ihrem Platz nicht mehr unterkamen: irgendwo an einer der Straßen."""
    for t in left:
        _fill(lay, rng, t, targets, lambda att, t=t: lane_spot(rng, lay.paths[:lanes], t, att), 220)


# --- Anger -------------------------------------------------------------------------------------------------------------

def plan_anger(lay, rng: Rng, todo, st, wob: float) -> dict:
    """Eine Dorfwiese mit Platz in der Mitte; ein bis drei Ringstraßen um die Wiese (je nach Zahl der Gebäude), die Häuser stehen außen an jedem Ring, die Tür zeigt zur Straße
    (im Süden geht der Weg ums Haus). Ausfahrten nach West, Süd und meistens Ost führen quer durch die Ringe."""
    n = len(todo)
    rx, ry = jr(rng.rnd(44, 60)), jr(rng.rnd(30, 38))
    rings_n = 1 if n <= 3 else 2 if n <= 9 else 3
    gx, gy = rng.rnd(124, 142), rng.rnd(108, 120)
    rxr, ryr = rx + 12, ry + 10
    outer = (rxr + (rings_n - 1) * gx, ryr + (rings_n - 1) * gy)
    _ext(lay, st, 2 * (outer[0] + 115) + 30 - 256)
    cx, cy = jr((256 - lay.ext_l) / 2 + rng.rnd(-10, 10)), jr(76 + outer[1] + rng.rnd(0, 12))
    lay.extra_h = max(48, 16 * math.ceil((cy + outer[1] + 110 - 232) / 16))
    lay.sq = {"x": cx, "y": cy, "r": jr(rng.rnd(17, 21))}
    lay.keepout = [[cx, cy, rx, ry]]
    west = _road((cx - rxr, cy), (-lay.ext_l - 60, cy + rng.rnd(-14, 14)), rng, 9 * wob, 4 + rings_n)
    south = _road((cx, cy + ryr), (cx + rng.rnd(-14, 14), 236), rng, 8 * wob, 3 + rings_n)
    lay.paths = [west, south]
    east = None
    if rng.random() < 0.75:
        lay.paths.append(_road((cx + rxr, cy), (300, cy + rng.rnd(-14, 14)), rng, 9 * wob, 4 + rings_n))
        east = 2
    rings = []
    for k in range(rings_n):
        ph, a, b = rng.rnd(0, 6.28), rxr + k * gx, ryr + k * gy
        pts = [(cx + math.cos(t) * (a + wob * math.sin(3 * t + ph) * 5), cy + math.sin(t) * (b + wob * math.sin(3 * t + ph) * 4)) for t in (m * math.pi / 18 for m in range(36))]
        rings.append([*pts, pts[0]])
    lay.paths += rings
    lanes = len(lay.paths)
    if st.seen >= 2:                                                                  # ein Teich auf der Wiese
        for _ in range(30):
            a, d, prx, pry = rng.rnd(0, 6.28), rng.rnd(0.45, 0.62), jr(rng.rnd(11, 15)), jr(rng.rnd(7, 10))
            px, py = cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d
            if math.hypot(px - cx, (py - cy) * 1.08) > lay.sq["r"] + prx + 10 and ((px - cx) / (rx - prx - 6)) ** 2 + ((py - cy) / (ry - pry - 6)) ** 2 < 1:
                lay.ponds.append({"x": jr(px), "y": jr(py), "rx": prx, "ry": pry})
                for _r in range(3):
                    an = rng.rnd(0, 6.28)
                    lay.decor.append(["reed", jr(px + math.cos(an) * prx * 1.02), jr(py + math.sin(an) * pry * 1.02 + 4), 0])
                break
    targets = lane_points(lay, lanes)
    left = [t for t in todo if not _fill(lay, rng, t, targets, lambda att, t=t: lane_spot(rng, [rings[min(rings_n - 1, att // 40)]], t, att, (cx, cy)), 40 * rings_n + 20, False)]        # erst der innere Ring, wenn er voll ist der nächste
    _rest(lay, rng, left, lanes, targets)
    if lay.buildings:                                                                  # Dorf rechtsbündig nach oben schieben und die Westseite kürzen: keine leere Wiese
        right, left = max(max(b.cx + b.w / 2 for b in lay.buildings), cx + rxr + 14), min(min(b.cx - b.w / 2 for b in lay.buildings), cx - rxr - 14)          # der innere Ring gehört dazu
        dx, dy = jr(226 - right), 10 - min(min(b.base - 62 for b in lay.buildings), cy - ryr - 20)
        _shift(lay, dx, dy)
        cx, cy, left = cx + dx, cy + dy, left + dx
        _ext(lay, st, 36 - left)
        lay.paths[0] = _clip(lay.paths[0], lambda x: x >= left - 40, (-lay.ext_l - 60, None), rng)
        if east:
            lay.paths[2] = _clip(lay.paths[2], lambda x: x <= right + dx + 40, (300, None), rng)
    lay.extra_h = max(48, 16 * math.ceil((max((b.base for b in lay.buildings), default=0) + 40 - 232) / 16))
    a0 = rng.rnd(0, 6.28)
    lamps = [(cx + math.cos(a) * (rxr + 8), cy + math.sin(a) * (ryr + 8)) for a in (a0 + k * 2 * math.pi / 5 for k in range(5))]
    return {"lanes": lanes, "west": 0, "south": 1, "east": east, "lamps": lamps}


def _shift(lay, dx: int, dy: int) -> None:
    """Alles, was der Plan bisher gesetzt hat, um (dx, dy) Pixel verschieben."""
    if not dx and not dy:
        return
    lay.sq["x"] += dx; lay.sq["y"] += dy
    lay.keepout = [[x + dx, y + dy, a, b] for x, y, a, b in lay.keepout]
    lay.paths = [[(x + dx, y + dy) for x, y in pl] for pl in lay.paths]
    for b in lay.buildings:
        b.base += dy; b.cx += dx
    lay.decor = [[k, x + dx, y + dy, e] for k, x, y, e in lay.decor]
    lay.pads = [[a + dx, b + dy, c + dx, d + dy] for a, b, c, d in lay.pads]
    for pd in lay.ponds:
        pd["x"] += dx; pd["y"] += dy


def _clip(road: list[Pt], keep, end: tuple[float, float | None], rng: Rng) -> list[Pt]:
    """Eine Ausfahrt auf die Punkte kürzen, die `keep(x)` erfüllen (mindestens die ersten zwei), und am neuen Rand enden lassen."""
    kept = [road[0]]
    for pt in road[1:]:
        if len(kept) >= 2 and not keep(pt[0]):
            break
        kept.append(pt)
    return [*kept, (end[0], kept[-1][1] + rng.rnd(-10, 10))]


# --- Fluss quer --------------------------------------------------------------------------------------------------------

def plan_fluss(lay, rng: Rng, todo, st, wob: float) -> dict:
    """Die Straße folgt dem Fluss quer durch die Karte, auf der Nordseite zwei Zeilen (Häuser vor der Straße und zwischen Straße und Ufer), eine Brücke für die Südstraße."""
    n = len(todo)
    lay.extra_h = 192
    shuffled = rng.shuffle(todo)
    k = math.ceil(0.55 * n)
    row = lambda bs, gap, extra: sum(b.w + gap for b in bs) + extra                                # noqa: E731  (Länge einer Zeile samt Lücken)
    _ext(lay, st, max(row(shuffled[:k], 14, 60), row(shuffled[k:], 38, 190)) - 244)
    sx, y0 = jr(rng.rnd(60, 170)), rng.rnd(106, 118)
    m, ph, ph2 = rng.rnd(-0.06, 0.06) * wob, rng.rnd(0, 6.28), rng.rnd(0, 6.28)
    xs = list(range(-lay.ext_l - 60, 300, 40)) + [300]
    road = [(x, min(140.0, max(102.0, y0 + m * (x - sx) + wob * math.sin(x / 50 + ph) * 3))) for x in xs]
    road_y = lambda x: lerp_y(road, x, y0)                                                        # noqa: E731
    lay.sq = {"x": sx, "y": jr(road_y(sx)), "r": jr(rng.rnd(21, 26))}
    mode = st.wasser if st.wasser != "keiner" else "bach"
    if st.wasser == "keiner":
        lay.notes.append("(der Fluss braucht Wasser: Fluss quer hat immer einen Wasserlauf)")
    dr, amp = rng.rnd(136, 150), rng.rnd(4, 9) * wob
    river = [(x, road_y(x) + dr + (math.sin(x / 37 + ph2) + math.sin(x / 91 + ph)) * amp) for x in xs]
    offs = (-7, 7, -14, 14) if mode == "fluss" else (-6, 6)
    lay.stream = [(round(x, 1), round(y, 1)) for x, y in river]
    lay.strands = [[(x, y + o) for x, y in lay.stream] for o in offs]
    river_at = lambda x: lerp_y(lay.stream, x, y0 + dr)                                            # noqa: E731
    gap = rng.rnd(-6, 6)
    south = [(sx, lay.sq["y"] + lay.sq["r"] - 4), (sx + gap * 0.5, lay.sq["y"] + 60), (sx + gap, river_at(sx + gap) - 34), (sx + gap, river_at(sx + gap) + 36), (sx + gap, 236)]
    lay.paths = [road, south]
    add_bridges(lay, 2, max(abs(o) for o in offs), vertical=False)
    top = max(y for _, y in lay.stream) + max(abs(o) for o in offs) + 70
    targets = lane_points(lay, 2)
    xmin, xmax = -lay.ext_l + 8, 252
    xc = xmin + rng.rnd(0, 10)
    for t in shuffled[:k]:                                                                        # vordere Zeile: nördlich der Straße, die Tür zeigt zur Straße
        x = xc
        while x + t.w < xmax:
            cx = x + t.w / 2
            if try_place(lay, rng, t, cx, jr(road_y(cx) - 46 - rng.rnd(0, 10)), targets):
                xc = x + t.w + rng.rnd(3, 9)
                break
            x += 12
        else:
            lay.skipped += 1
    for t in shuffled[k:]:                                                                        # zweite Zeile: zwischen Straße und Ufer, der Weg geht ums Haus
        cursor = xmin + rng.rnd(0, 6)
        while cursor + t.w < xmax:
            cx = cursor + t.w / 2
            if try_place(lay, rng, t, cx, jr(road_y(cx) + 76 + rng.rnd(0, 6)), targets, 13):
                break
            cursor += 6
        else:
            lay.skipped += 1
    if st.seen >= 1:                                                                              # ein Mühlteich im Fluss mit Steg am Nordufer (nach den Häusern: der Weg dorthin sucht eine Lücke)
        _mill_pond(lay, rng, river_at, sx)
    lamps = [(sx + d, road_y(sx + d) - 8) for d in (-100, -50, 50, 100)]
    return {"lanes": 2, "west": 0, "south": 1, "east": 0, "lamps": lamps, "min_h": max(0, 16 * math.ceil((top - 232) / 16))}


def _mill_pond(lay, rng: Rng, river_at, sx: float) -> None:
    for _ in range(80):
        lx = jr(rng.rnd(-lay.ext_l + 70, 220))
        if abs(lx - sx) < 100:
            continue
        ly, rx, ry = jr(river_at(lx)), jr(rng.rnd(34, 40)), jr(rng.rnd(22, 28))
        dock = {"x0": lx - 12, "y0": ly - ry - 8, "x1": lx + 10, "y1": ly - ry + 1}
        mouth = (lx, dock["y0"] - 2)
        for T in sorted(lane_points(lay, 2), key=lambda q: math.hypot(q[0] - mouth[0], q[1] - mouth[1]))[:6]:
            way = [mouth, T] if abs(T[0] - mouth[0]) < 30 else [mouth, (mouth[0], T[1]), T]
            if line_clear(lay, way):
                lay.lake, lay.dock = {"x": lx, "y": ly, "rx": rx, "ry": ry}, dock
                lay.paths.append([(round(a, 1), round(b, 1)) for a, b in way])
                for _r in range(5):
                    an = rng.rnd(0.3, 2.8)
                    lay.decor.append(["reed", jr(lx + math.cos(an) * rx * 1.02), jr(ly + math.sin(an) * ry * 1.02 + 4), 0])
                lay.decor.append(["boat", jr(lx + 8), jr(ly + 10), 0])
                return
    lay.notes.append("der See")


# --- Streusiedlung -----------------------------------------------------------------------------------------------------

def plan_streu(lay, rng: Rng, todo, st, wob: float) -> dict:
    """Einzelhöfe, jeder mit ein, zwei Gebäuden an einer eigenen Gasse; ein kleiner Platz, wo sich die Hauptwege treffen. Die Karte wächst mit der Zahl der Höfe."""
    n = len(todo)
    c = max(2, math.ceil(n / 2.4))
    ext, ex = 0, 0
    while (256 + ext) * (170 + ex) * 0.42 < c * 30000 and (ext < 640 or ex < 448):
        if ext <= ex * 1.5 and ext < 640:
            ext += 32
        else:
            ex = min(448, ex + 32)
    _ext(lay, st, ext)
    lay.extra_h = max(ex, 64)
    cx, cy = jr((256 - lay.ext_l) / 2 + rng.rnd(-30, 30)), jr(rng.rnd(100, 112) + lay.extra_h * 0.35)
    lay.sq = {"x": cx, "y": cy, "r": jr(rng.rnd(17, 21))}
    west = _road((cx - lay.sq["r"] + 4, cy), (-lay.ext_l - 60, cy + rng.rnd(-30, 30)), rng, 14 * wob, 5)
    south = _road((cx, cy + lay.sq["r"] - 4), (cx + rng.rnd(-20, 20), 236), rng, 12 * wob, 4)
    east = _road((cx + lay.sq["r"] - 4, cy), (300, cy + rng.rnd(-30, 30)), rng, 14 * wob, 4)
    lay.paths = [west, south, east]
    top, bottom = 76, 214 + lay.extra_h
    anchors: list[Pt] = []
    for _ in range(c):
        for _t in range(100):
            x, y = jr(rng.rnd(-lay.ext_l + 70, 214)), jr(rng.rnd(top, bottom - 20))
            if math.hypot(x - cx, y - cy) > 70 and all(math.hypot(x - ax, y - ay) > 105 for ax, ay in anchors) and not _near_road(lay, x, y):
                anchors.append((x, y)); break
    for ax, ay in anchors:                                                                         # je Hof eine Gasse von der nächsten Straße
        p0 = min(lane_points(lay, len(lay.paths)), key=lambda q: math.hypot(q[0] - ax, q[1] - ay))
        mx, my = (p0[0] + ax) / 2, (p0[1] + ay) / 2
        dx, dy = ax - p0[0], ay - p0[1]
        ln = math.hypot(dx, dy) or 1.0
        o = rng.rnd(-22, 22) * wob
        lay.paths.append([p0, (mx - dy / ln * o, my + dx / ln * o), (ax, ay)])
    lanes = len(lay.paths)
    targets = lane_points(lay, lanes)
    groups: list[list] = [[] for _ in anchors]
    for i, t in enumerate(todo):
        groups[i % len(anchors)].append(t)
    def spot(ax: float, ay: float, lane: list[Pt], t, att: int) -> tuple[float, float]:
        if att % 2:                                                                       # an der Gasse des Hofs, eher am Ende
            return lane_spot(rng, [lane], t, att, u=(0.35, 1.0))
        a, r = rng.rnd(0, 6.28), 24 + att * 1.2 + rng.rnd(0, 10)
        return ax + math.cos(a) * r * 1.3, ay + math.sin(a) * r

    left = []
    for (ax, ay), lane, members in zip(anchors, lay.paths[3:lanes], groups):
        left += [t for t in members if not _fill(lay, rng, t, targets, lambda att, ax=ax, ay=ay, lane=lane, t=t: spot(ax, ay, lane, t, att), 160, False)]
    _rest(lay, rng, left, lanes, targets)
    lamps = [(cx + 30, cy + 8), (cx - 30, cy + 8)] + [(ax + 10, ay + 4) for ax, ay in anchors]
    return {"lanes": lanes, "west": 0, "south": 1, "east": 2, "lamps": lamps, "min_h": max(0, 16 * math.ceil((max((ay for _, ay in anchors), default=0) + 30 - 232) / 16))}


def _near_road(lay, x: float, y: float) -> bool:
    from .geometry import line_dist
    return line_dist(lay.paths, x, y) < 40


PLANS = {"anger": plan_anger, "fluss": plan_fluss, "streu": plan_streu}
