"""Dorf-Layout in Dorfkoordinaten (Weltpixel wie in Mockup A): Platz, Straßen, See, Bach, Garten, Häuserzeile, Deko und Bäume.

Port des abgenommenen Mockup-Generators (`docs/mockups/welt-optik/dorf.js`) mit Rollen für die Gebäude und einer Breite, die zur Zahl der
Gebäude passt. Das Ergebnis beschreibt nur Formen und Lagen; Kacheln, Orte und Objekte leiten `tiles.py`, `interiors.py` und `kits.py` daraus ab.
"""

import math
from dataclasses import dataclass, field

from .geometry import Pt, lerp_y, line_dist
from .rng import Rng, jr

ROOFS = ["rot", "blau", "stroh", "moos", "schiefer", "holz"]
WALLS = ["creme", "rosa", "gelb", "blau", "holz"]
SPECIALS = ["shop", "workshop", "barn", "stable"]
WIDTH = {"shop": 84, "workshop": 92, "barn": 100, "stable": 96}                 # Spritebreite der Sondergebäude
KIND = {"shop": "bs", "workshop": "bw", "barn": "bb", "stable": "bt"}
HOME_W = 78                                                                      # das Haus aus Bild A (Heimhaus der Startwelt)


@dataclass
class Params:
    seed: int
    lake: str = "auto"                              # "east" (wie A), "south" oder nach Seed
    mix: dict[str, int] | None = None               # Rollen → Anzahl (house, shop, workshop, barn, stable); sonst 3 Häuser + 2 Sondergebäude
    home: bool = False                              # neue Startwelt: das erste Haus ist das Heimhaus (Haus aus Bild A mit fünf Räumen)


@dataclass
class Building:
    role: str                                       # home, house, shop, workshop, barn, stable
    kind: str                                       # Sprite: house, bh:Breite:Dach:Wand, bs, bw, bb, bt
    cx: int
    base: int
    w: int
    ww: int = 0


@dataclass
class Layout:
    seed: int
    east: bool
    ext_l: int
    sq: dict
    lake: dict
    dock: dict
    paths: list[list[Pt]]
    stream: list[Pt]
    bridge: dict | None
    garden: dict
    beds: list[list[int]]
    pads: list[list[float]]
    buildings: list[Building]
    decor: list[list]                               # [Art, x, y, Zusatz]
    exits: dict[str, Pt]
    lamps: list[int] = field(default_factory=list)


def make_layout(p: Params) -> Layout:
    seed = p.seed
    R, R2 = Rng(seed * 7919 + 13), Rng(seed * 104729 + 11)
    rnd = R.rnd
    decor: list[list] = []

    def add(kind: str, x: float, y: float, e: int = 0) -> None:
        decor.append([kind, jr(x), jr(y), e])

    east = {"east": True, "south": False}.get(p.lake, seed % 2 == 1)
    sq = {"x": jr(rnd(110, 146)), "y": jr(rnd(104, 114)), "r": jr(rnd(22, 27))}
    y0 = sq["y"]

    # Gebäude der Häuserzeile festlegen (Rollen, Breiten), daraus die Breite des Dorfs
    roles = _roles(p, R)
    items: list[Building] = []
    for role in roles:
        if role == "home":
            items.append(Building("home", "house", 0, 0, HOME_W, 66))
        elif role == "house":
            ww = R.pick([58, 66, 66, 90])
            items.append(Building("house", f"bh:{ww}:{R.pick(ROOFS)}:{R.pick(WALLS)}", 0, 0, ww + 12, ww))
        else:
            items.append(Building(role, KIND[role], 0, 0, WIDTH[role]))
    total = sum(b.w for b in items) + 7 * len(items)
    # See: im Osten wie in A oder im Süden; bei See im Osten bleibt die Zeile vor dem See, sonst reicht sie bis zum Rand
    if east:
        lake = {"x": 226, "y": jr(rnd(86, 98)), "rx": jr(rnd(34, 40)), "ry": jr(rnd(30, 36))}
        xmax = lake["x"] - lake["rx"] - 14
    else:
        lake = {"x": jr(rnd(184, 214)), "y": 164, "rx": 40, "ry": 24}
        xmax = 258
    need = total + 12 - xmax                                                      # so weit muss das Dorf nach Westen reichen
    ext_l = 0 if need <= 0 else int(math.ceil(need / 16.0)) * 16

    # Wege: Hauptstraße West–Ost (bei See im Osten nur bis zum See), Südstraße
    west = [(-ext_l - 60, y0 + rnd(-6, 6)), (20, y0 + rnd(-5, 5)), (sq["x"] - sq["r"] + 4, y0)]
    east_road = ([(sq["x"] + sq["r"] - 4, y0), (sq["x"] + sq["r"] + 20, y0 + 4), (176, y0 + 8)] if east
                 else [(sq["x"] + sq["r"] - 4, y0), (215, y0 + rnd(-5, 5)), (300, y0 + rnd(-5, 5))])
    south = [(sq["x"], y0 + sq["r"] - 4), (sq["x"] + rnd(-8, 8), y0 + 50), (sq["x"] + rnd(-6, 6), 200), (sq["x"] + rnd(-6, 6), 236)]          # endet in der letzten Kachelreihe des Dorfs
    paths: list[list[Pt]] = [west, east_road, south]
    road = west + east_road[1:]

    def road_y(x: float) -> float:
        return lerp_y(road, x, y0)

    gdx, gdy = jr(rnd(-4, 6)), jr(rnd(-2, 6))
    garden = {"x0": 14 + gdx, "y0": 120 + gdy, "x1": 84 + gdx, "y1": 176 + gdy}
    dock = {"x0": lake["x"] - lake["rx"] - 4, "y0": lake["y"] - 2, "x1": lake["x"] - lake["rx"] + 18, "y1": lake["y"] + 7}
    if east:
        paths.append([(dock["x0"] - 6, lake["y"] + 2), (dock["x0"] - 6, y0 + 8)])

    # Bach aus dem Nordwald in den See; bei See im Süden kreuzt er die Hauptstraße unter einer Brücke
    sx = jr(lake["x"] + rnd(-0.25, 0.25) * lake["rx"])
    top = lake["y"] - lake["ry"] + 8
    stream: list[Pt] = [(sx + (math.sin(k * 1.3 + seed) * 6 if k < 5 else 0), -70 + k * (top + 70) / 5) for k in range(6)]
    bridge = None
    if not east:
        bxc = _stream_x(stream, y0 + 4, sx)
        by = road_y(bxc)
        bridge = {"x0": jr(bxc - 9), "x1": jr(bxc + 9), "y0": jr(by - 6), "y1": jr(by + 6)}

    # Garten wie in A: Zaun, drei Beete, Sonnenblumen, Tomaten, Vogelscheuche
    beds = [[b[0] + gdx, b[1] + gdy, b[2], b[3]] for b in ([22, 127, 54, 9], [22, 141, 54, 9], [22, 155, 54, 9])]
    x = garden["x0"]
    while x < garden["x1"] - 4:
        add("fence", x + 7, garden["y1"]); add("fence", x + 7, garden["y0"]); x += 12
    y = garden["y0"] + 8
    while y < garden["y1"]:
        add("post", garden["x0"], y)
        if y < 138 + gdy or y > 154 + gdy:
            add("post", garden["x1"], y)
        y += 8
    add("sun", 26 + gdx, 124 + gdy); add("sun", 34 + gdx, 123 + gdy); add("sun", 42 + gdx, 124 + gdy)
    add("tomato", 32 + gdx, 136 + gdy, 1); add("tomato", 48 + gdx, 136 + gdy, 2); add("tomato", 64 + gdx, 136 + gdy, 3); add("scare", 78 + gdx, 128 + gdy)
    add("barrel", garden["x0"] - 9, garden["y0"] + 6, 7); add("barrel", garden["x0"] - 3, garden["y0"] + 10, 7)        # Regentonnen (Zusatz 7)
    paths.append([(garden["x1"], 146 + gdy), (garden["x1"] + 10, 146 + gdy), (garden["x1"] + 14, y0 + 10), (garden["x1"] + 14, road_y(garden["x1"] + 14))])

    # Häuserzeile im Norden von links nach rechts; Bach und See bleiben frei
    pads: list[list[float]] = []
    buildings: list[Building] = []
    xc = jr(-ext_l + rnd(4, 12))

    def hit(x1: float, w1: float) -> bool:
        return (not east) and x1 < sx + 8 and x1 + w1 > sx - 8

    for b in items:
        w, ww, kind, role = b.w, b.ww, b.kind, b.role
        if xc + w > xmax and role not in ("house", "home"):
            role, ww, w, kind = "house", 58, 70, f"bh:58:{R.pick(ROOFS)}:{R.pick(WALLS)}"
        elif xc + w > xmax and w > 70 and role == "house":
            ww, w, kind = 58, 70, f"bh:58:{R.pick(ROOFS)}:{R.pick(WALLS)}"
        x1 = xc
        if hit(x1, w) and role == "house" and w > 70 and not hit(x1, 70):
            ww, w, kind = 58, 70, f"bh:58:{R.pick(ROOFS)}:{R.pick(WALLS)}"
        if hit(x1, w):
            x1 = jr(sx + 8)
        if x1 + w > xmax:
            if role == "house" and w > 70 and x1 + 70 <= xmax:
                ww, w, kind = 58, 70, f"bh:58:{R.pick(ROOFS)}:{R.pick(WALLS)}"
            else:
                continue
        xc = x1
        cx = xc + w / 2
        base = jr(y0 - 46 - rnd(0, 10))
        bd = Building(role, kind, jr(cx), base, w, ww)
        buildings.append(bd); add(kind, cx, base)
        paths.append([(cx, base + 3), (cx + rnd(-2, 2), base + 22), (cx + rnd(-4, 4), road_y(cx) - 4), (cx, road_y(cx))])
        pads.append([cx - w / 2 + 3, base - 26, cx + w / 2 - 3, base])
        if role in ("house", "home"):
            add(R.pick(["bushP", "bushY", "bushW"]), cx - 16, base + 8); add(R.pick(["bushP", "bushY", "bushW"]), cx + 17, base + 8); add("mailbox", cx + w / 2 - 4, base + 6)
        elif role == "stable":
            add("bhay", cx + w / 2 - 4, base + 6); add("bhay", cx - w / 2 + 8, base + 8, 1); add("barrel", cx - w / 2 - 4, base + 6)
        elif role == "barn":
            add("bhay", cx + w / 2 + 2, base + 6); add("bhay", cx - w / 2 + 10, base + 8, 1); add("bhay", cx + w / 2 - 10, base + 10, 2)
        elif role == "workshop":
            add("blog", cx + w / 2 + 6, base + 4); add("bcr", cx - w / 2 + 6, base + 8); add("barrel", cx + w / 2 - 8, base + 8)
        else:
            add("bcr", cx + w / 2 - 6, base + 8); add("bushY", cx - w / 2 + 6, base + 8)
        xc = jr(cx + w / 2 + rnd(3, 9))

    # Platz: Brunnen, Bank, Brett, zwei Marktstände, Laternen entlang der Straße, Wegweiser an den Ausfahrten
    add("well", sq["x"], sq["y"] + 3); add("bench", sq["x"] - sq["r"] - 10, sq["y"] + 6); add("board", sq["x"] + sq["r"] + 4, sq["y"] - 20)
    add(f"bm:{seed % 3}", sq["x"] - 17, sq["y"] - 11); add(f"bm:{(seed + 1) % 3}", sq["x"] + 18, sq["y"] - 11); add("bcr", sq["x"] - 4, sq["y"] - 8); add("barrel", sq["x"] + 29, sq["y"] - 6)
    lamps: list[int] = []
    for d in (-100, -50, 50, 100):
        lx = sq["x"] + d
        if ((lx < lake["x"] - lake["rx"] - 28) if east else abs(lx - sx) > 16) and lx > 6 - ext_l:
            add("lamp", lx, road_y(lx) - 8); lamps.append(lx)
    add("sign", -ext_l - 14, y0 + 18)
    if not east:
        add("sign", 262, y0 + 18)
    if bridge:
        for px, py in ((bridge["x0"] + 1, bridge["y0"] + 2), (bridge["x1"] - 1, bridge["y0"] + 2), (bridge["x0"] + 1, bridge["y1"] + 3), (bridge["x1"] - 1, bridge["y1"] + 3)):
            add("post", px, py, 9)                                                  # Zusatz 9: Brückenpfosten sperren keine Kachel

    # See: Schilf am Ufer, Boot
    for _ in range(5):
        an = rnd(-0.4, 2.6) + (0.3 if east else 3.14)
        add("reed", lake["x"] + math.cos(an) * lake["rx"] * 1.02, lake["y"] + math.sin(an) * lake["ry"] * 1.02 + 4)
    add("boat", lake["x"] + 8, lake["y"] + 14)

    blocks = [(b.cx - b.w / 2 - 6, b.cx + b.w / 2 + 6, b.base - 8, b.base + 30) for b in buildings]

    def free(px: float, py: float, pad: float) -> bool:
        if line_dist(paths, px, py) < pad or line_dist([stream], px, py) < pad - 2:
            return False
        if ((px - lake["x"]) / (lake["rx"] + pad)) ** 2 + ((py - lake["y"]) / (lake["ry"] + pad * 0.8)) ** 2 < 1:
            return False
        if garden["x0"] - pad < px < garden["x1"] + pad and garden["y0"] - pad < py < garden["y1"] + pad:
            return False
        if math.hypot(px - sq["x"], (py - sq["y"]) * 1.08) < sq["r"] + pad:
            return False
        return not any(b0 - pad * 0.3 < px < b1 + pad * 0.3 and c0 - 2 < py < c1 + pad * 0.4 for b0, b1, c0, c1 in blocks)

    def tree_kind() -> str:
        return "pine" if R2.random() < 0.45 else "tree"

    n = 0
    for _ in range(60):
        if n >= 4:
            break
        rx, ry = rnd(0, 250), rnd(60, 190)
        if free(rx, ry, 14):
            add("rock", rx, ry, n); n += 1
    n, tries = 0, 0
    while n < 2 and tries < 80:                                                   # Apfelbäume (Quelle „Apfelbäume“)
        tries += 1
        tx, ty = rnd(40, 240), rnd(70, 190)
        if free(tx, ty, 18):
            add("treeF", tx, ty, 10 + n); n += 1
    for i in range(95 + jr(ext_l * 0.25)):                                        # Wald im Norden
        fx, fy = -60 - ext_l + R2.random() * (380 + ext_l), -94 + R2.random() * 88
        if line_dist([stream], fx, fy) > 9 and line_dist(paths, fx, fy) > 12:
            add(tree_kind(), fx, fy, 100 + i)
    for i in range(26):                                                           # Streifen links und rechts
        lx2, ly2, rx2, ry2 = -58 - ext_l + R2.random() * 50, R2.random() * 196, 266 + R2.random() * 52, R2.random() * 196
        k1, k2 = tree_kind(), tree_kind()
        if line_dist(paths, lx2, ly2) > 14:
            add(k1, lx2, ly2, 300 + i)
        if line_dist(paths, rx2, ry2) > 14 and line_dist([stream], rx2, ry2) > 9:
            add(k2, rx2, ry2, 400 + i)
    n, tries = 0, 0
    while n < 10 and tries < 120:                                                 # einzelne Bäume im Dorf
        tries += 1
        tx, ty = rnd(0, 256), rnd(20, 196)
        if free(tx, ty, 16):
            add(tree_kind(), tx, ty, 40 + n); n += 1
    for i in range(14):                                                           # Rand im Süden
        bx, by = rnd(-40 - ext_l, 300), rnd(196, 215)
        if line_dist(paths, bx, by) > 14 and line_dist([stream], bx, by) > 10 and free(bx, by, 6):
            add(tree_kind(), bx, by, 500 + i)

    exits = {"west": (west[0][0], west[0][1]), "south": (south[-1][0], south[-1][1])}
    if not east:
        exits["east"] = (east_road[-1][0], east_road[-1][1])
    r1 = lambda pl: [(round(a, 1), round(b, 1)) for a, b in pl]
    return Layout(seed, east, ext_l, sq, lake, dock, [r1(pl) for pl in paths], r1(stream), bridge, garden, beds, [[round(v, 1) for v in q] for q in pads],
                  buildings, decor, {k: (round(v[0], 1), round(v[1], 1)) for k, v in exits.items()}, lamps)


def _roles(p: Params, R: Rng) -> list[str]:
    if p.mix is not None:
        roles = [r for r, n in p.mix.items() for _ in range(n)]
    else:
        roles = ["house", "house", "house"] + R.shuffle(SPECIALS)[:2]
    roles = R.shuffle(roles)
    if p.home:
        i = next((i for i, r in enumerate(roles) if r == "house"), None)
        if i is None:
            roles.insert(0, "home")
        else:
            roles[i] = "home"
    return roles


def _stream_x(stream: list[Pt], y: float, default: float) -> float:
    for i in range(len(stream) - 1):
        if stream[i][1] <= y <= stream[i + 1][1]:
            return stream[i][0] + (stream[i + 1][0] - stream[i][0]) * (y - stream[i][1]) / (stream[i + 1][1] - stream[i][1])
    return default
