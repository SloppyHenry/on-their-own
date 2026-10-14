"""Dorfbausteine im Freien: Aus der Deko des Layouts werden die Dinge (AP15) und Quellen des Dorfs, jeweils mit Bildstelle (`look.place`).

Wie `scripts/startwelt_a.mjs` für die Startwelt: Brunnen, Bank, Brett, Laternen, Briefkästen, Wegweiser, Vogelscheuche, Boot, Beete, Tomaten,
Sonnenblumen, Regentonnen, Schilf, Steine, Apfelbäume, Angelplatz, dazu die Quellen am See und im Wald. Was keine Handlung anbietet, bleibt Deko.
"""

import math
from dataclasses import dataclass, field

from .layout import Layout
from .names import Naming
from .tiles import FENCE, TREE, WALL, WATER, Outdoor

WALKABLE = {".", ",", "_", "+", "s"}
LANTERN_LIGHT = (24, 1)
PLACE_NONE = "none"


@dataclass
class Kit:
    objects: list[dict] = field(default_factory=list)
    nodes: list[dict] = field(default_factory=list)
    place: dict = field(default_factory=dict)
    lights: list[list[float]] = field(default_factory=list)
    decor: list[list] = field(default_factory=list)
    clearing: list[int] = field(default_factory=list)                # Tiefe Reihe im Wald, die man betreten kann [i, j, b, 1]
    spots: dict[str, tuple[int, int]] = field(default_factory=dict)  # Start von Alex und Mira


def _spot(out: Outdoor, x: float, y: float, blocked_ok: bool = False) -> tuple[int, int]:
    """Die Kachel zu einem Punkt im Bild; steht der Punkt auf Mauer, Zaun, Baum oder Wasser, die nächste begehbare davor."""
    i, j = out.tile_of(x, y - 1)
    if blocked_ok or out.rows[j][i] in WALKABLE:
        return i, j
    best, bd = (i, j), 1e9
    for dj in range(-3, 4):
        for di in range(-3, 4):
            a, b = i + di, j + dj
            if 0 <= a < out.w and 0 <= b < out.h and out.rows[b][a] in WALKABLE and abs(di) + abs(dj) + (0.5 if dj < 0 else 0) < bd:
                best, bd = (a, b), abs(di) + abs(dj) + (0.5 if dj < 0 else 0)
    return best


def make_kit(L: Layout, out: Outdoor, nm: Naming, loc_of) -> Kit:
    """`loc_of(i, j)` nennt den Ort einer Kachel (für die Quellen). Alle Kacheln relativ zum Raster des Dorfs im Freien."""
    k = Kit()
    decor = [list(d) for d in L.decor]
    sq, lake, dock, g = L.sq, L.lake, L.dock, L.garden

    def take(kind: str, pred=lambda d: True) -> list[list]:
        got = [d for d in decor if d[0] == kind and pred(d)]
        for d in got:
            decor.remove(d)
        return got

    def thing(oid: str, kind: str, name: str, tile: tuple[int, int], d: list | None, state: dict | None = None, sprite: str | None = None) -> None:
        o = {"id": nm.obj(oid), "kind": kind, "name": name, "tile": list(tile)}
        if state is not None:
            o["state"] = state
        k.objects.append(o)
        if d is not None:
            k.place[nm.obj(oid)] = {"at": [d[1], d[2]], "sprite": sprite or d[0], "e": d[3]}

    def source(rid: str, resource: str, label: str | None, tile: tuple[int, int], ds: list[list], amount, cap, regen, tool=None, minutes=3, weather=None) -> None:
        k.nodes.append({"id": nm.obj(rid), "location_id": loc_of(*tile), "tile": list(tile), "resource": resource, "label": label, "amount": amount, "cap": cap,
                        "regen_per_hour": regen, "requires_tool": tool, "gather_minutes": minutes, "regen_weather": weather})
        if ds:
            k.place[nm.obj(rid)] = {"at": [ds[0][1], ds[0][2]], "sprite": ds[0][0], "e": ds[0][3], "more": [[d[1], d[2], d[3]] for d in ds[1:]]}

    # Platz
    well = take("well")[0]
    wt = _spot(out, well[1], well[2] + 0, True)
    thing("well_square", "well", "Brunnen", wt, well, sprite=PLACE_NONE)
    k.place[nm.obj("well_square")] = {"at": [well[1], well[2]]}
    source("well_square_water", "water", None, _spot(out, well[1], well[2] + 4), [], 999, 999, 999, minutes=2)
    k.place[nm.obj("well_square_water")] = {"at": [well[1], well[2]], "sprite": PLACE_NONE}
    for kind, oid, name in (("bench", "bench_square", "Bank"), ("board", "board_square", "Anschlagtafel")):
        d = take(kind)[0]
        thing(oid, kind, name, _spot(out, d[1], d[2]), d, state={"notes": []} if kind == "board" else None)
        k.place[nm.obj(oid)] = {"at": [d[1], d[2]]}
    # Laternen und Fenster
    for n, d in enumerate(take("lamp"), 1):
        thing(f"lantern_{n}", "lantern", "Laterne", _spot(out, d[1], d[2]), d, state={"lit": False})
        k.lights.append([d[1], d[2], LANTERN_LIGHT[0], LANTERN_LIGHT[1]])
    for b in L.buildings:
        x, y, ww = b.cx, b.base, b.ww
        if b.role in ("house", "home"):
            k.lights += [[x - ww * 0.26 if b.role == "house" else x - 17, y, 32, 1], [x + ww * 0.26 if b.role == "house" else x + 17, y, 32, 1], [x, y, 59, 0.8]]
            if b.role == "home":
                k.lights.append([x + 9, y, 31, 0.7])
        elif b.role == "workshop":
            k.lights += [[x - 16, y, 28, 1], [x + 21, y, 28, 1]]
        elif b.role == "shop":
            k.lights += [[x - 14, y, 28, 1], [x + 3, y, 28, 0.6]]
    # Briefkästen (einer je Haus), Wegweiser, Vogelscheuche, Boot
    for n, d in enumerate(take("mailbox"), 1):
        thing("mailbox" if n == 1 else f"mailbox_{n}", "mailbox", "Briefkasten", _spot(out, d[1], d[2]), d, state={"letters": []})
    for n, d in enumerate(take("sign"), 1):
        thing("signpost" if n == 1 else f"signpost_{n}", "signpost", "Wegweiser", _spot(out, d[1], d[2]), d)
    for d in take("scare"):
        thing("scarecrow", "scarecrow", "Vogelscheuche", _spot(out, d[1], d[2]), d, state={"upright": True})
    for d in take("boat"):
        thing("boat", "boat", "Boot", out.tile_of(d[1], d[2]), d)
    # See: Angelplatz am Steg, Wasser, Schilf
    fish = _spot(out, dock["x1"] - 3, dock["y0"] + 4)
    thing("fishing_spot", "fishing_spot", "Angelplatz", fish, [0, dock["x1"] - 3, dock["y0"] + 4, 0], sprite=PLACE_NONE)
    source("lake_water", "water", None, _spot(out, dock["x0"] + 2, dock["y0"] + 4), [], 999, 999, 999, minutes=2)
    k.place[nm.obj("lake_water")] = {"at": [lake["x"], lake["y"]], "sprite": PLACE_NONE}
    reeds = take("reed")
    if reeds:
        source("reeds", "reed", "Schilf", _spot(out, reeds[0][1], reeds[0][2]), reeds, 6, 8, 0.1, minutes=4)
    # Garten: Beete, Tomaten, Sonnenblumen, Regentonnen
    for n, (bx, by) in enumerate([(b[0] + dx, b[1] + 4) for b in (g_beds(L)[0], g_beds(L)[2]) for dx in (20, 34, 48)], 1):
        thing(f"seedbed_{n}", "seedbed", "Beet", _spot(out, bx, by + 1), [None, bx, by, 0], sprite=PLACE_NONE)
    tom, sun, bar = take("tomato"), take("sun"), take("barrel", lambda d: d[3] == 7)
    if tom:
        source("tomatoes", "food", "Tomaten", _spot(out, tom[0][1], tom[0][2]), tom, 4, 6, 0.1)
    if sun:
        source("sunflowers", "seeds", "Sonnenblumen", _spot(out, sun[0][1], sun[0][2]), sun, 3, 4, 0.05)
    if bar:
        source("rain_barrels", "water", "Regentonnen", _spot(out, bar[0][1], bar[0][2]), bar, 6, 10, 2, minutes=2, weather="rain,storm")
    # Apfelbäume und Steine
    apples = take("treeF")
    if apples:
        source("apple_trees", "food", "Apfelbäume", _spot(out, apples[0][1], apples[0][2]), apples, 4, 6, 0.1, minutes=4)
    rocks = take("rock")
    if rocks:
        source("field_rocks", "stone", "Steine", _spot(out, rocks[0][1], rocks[0][2]), rocks, 6, 6, 0.05, tool="pickaxe", minutes=10)
    # Wald: eine betretbare Reihe nördlich der Wiese mit Holz, Pilzen und Samen
    cj = out.tile_of(0, -10)[1]
    ci0, ci1 = out.tile_of(0, 0)[0], out.tile_of(L.sq["x"] * 2, 0)[0]
    k.clearing = [ci0, cj, max(8, min(ci1, out.w - 2) - ci0), 1]
    for n, (rid, res, label, amount, cap, regen, tool, mins) in enumerate([("forest_wood", "wood", None, 40, 40, 1.5, "axe", 8), ("forest_mushrooms", "food", None, 8, 8, 0.3, None, 5),
                                                                          ("forest_seeds", "seeds", None, 6, 10, 0.1, None, 4)]):
        ti = ci0 + 3 + n * max(4, k.clearing[2] // 3)
        k.nodes.append({"id": nm.obj(rid), "location_id": nm.loc("forest"), "tile": [min(ti, out.w - 2), cj], "resource": res, "label": label, "amount": amount, "cap": cap, "regen_per_hour": regen,
                        "requires_tool": tool, "gather_minutes": mins, "regen_weather": None})
        k.place[nm.obj(rid)] = {"at": [0, 0], "sprite": PLACE_NONE}
    # Startplätze der Agenten
    k.spots = {"alex": out.tile_of(g["x0"] + 36, g["y0"] + 20), "mira": out.tile_of(sq["x"] - 18, sq["y"] + 15)}
    k.decor = [d for d in decor if d[0] not in ("bm:0", "bm:1", "bm:2") or True]
    return k


def g_beds(L: Layout) -> list[list[int]]:
    return L.beds


def rect_of(tiles: list[tuple[int, int]]) -> list[int]:
    xs, ys = [t[0] for t in tiles], [t[1] for t in tiles]
    return [min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1]


def outdoor_locations(L: Layout, out: Outdoor, nm: Naming, kit: Kit) -> list[dict]:
    """Platz, Garten, See und Wald als Orte (Rechtecke in Kacheln des Dorfs im Freien); Namen und Wendungen für die Agenten."""
    sq, lake, g = L.sq, L.lake, L.garden
    v = nm.village
    sq_t = [(i, j) for j in range(out.h) for i in range(out.w) if math.hypot(out.center(i, j)[0] - sq["x"], out.center(i, j)[1] - sq["y"]) <= sq["r"] * 0.8 and out.rows[j][i] in WALKABLE]
    ga_t = [(i, j) for j in range(out.h) for i in range(out.w) if g["x0"] <= out.center(i, j)[0] <= g["x1"] and g["y0"] <= out.center(i, j)[1] <= g["y1"] and out.rows[j][i] in WALKABLE]
    la_t = [(i, j) for j in range(out.h) for i in range(out.w) if ((out.center(i, j)[0] - lake["x"]) / (lake["rx"] * 1.3)) ** 2 + ((out.center(i, j)[1] - lake["y"]) / (lake["ry"] * 1.3)) ** 2 < 1
            and out.rows[j][i] in WALKABLE | {WATER}]
    names = (("Zentraler Platz", "zum zentralen Platz", "auf dem zentralen Platz"), ("Garten", "in den Garten", "im Garten"), ("See", "zum See", "am See"), ("Wald", "in den Wald", "im Wald")) if nm.canonical \
        else ((f"Platz von {v}", f"zum Platz von {v}", f"auf dem Platz von {v}"), (f"Garten in {v}", f"in den Garten in {v}", f"im Garten in {v}"),
              (f"See bei {v}", f"zum See bei {v}", f"am See bei {v}"), (f"Wald bei {v}", f"in den Wald bei {v}", f"im Wald bei {v}"))
    sq_r, ga_r, la_r = rect_of(sq_t), rect_of(ga_t), rect_of(la_t)
    forest = [0, 0, out.w, out.tile_of(0, 0)[1]]
    gate = list(out.gate) if out.gate else []
    return [
        {"id": nm.loc("square"), "name": names[0][0], "rect": sq_r, "entrances": [], "extra_tiles": [], "props": {"style": {"surface": "cobble"}, "market_area": sq_r, "to": names[0][1], "at": names[0][2], "themes": ["social"]}},
        {"id": nm.loc("garden"), "name": names[1][0], "rect": ga_r, "entrances": [gate] if gate else [], "extra_tiles": [], "props": {"style": {"fence": True}, "beds": 6, "to": names[1][1], "at": names[1][2], "themes": ["garden", "plants"]}},
        {"id": nm.loc("lake"), "name": names[2][0], "rect": la_r, "entrances": [], "extra_tiles": [], "props": {"fishing": True, "to": names[2][1], "at": names[2][2], "themes": ["water", "calm", "nature"]}},
        {"id": nm.loc("forest"), "name": names[3][0], "rect": forest, "entrances": [], "extra_tiles": [], "props": {"clearing": kit.clearing, "unexplored": True, "to": names[3][1], "at": names[3][2], "themes": ["nature", "wood"]}},
    ]
