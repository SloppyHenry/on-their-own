"""Aus Layout, Kacheln, Innenräumen und Dingen wird ein Dorf (Fragment) und daraus entweder eine neue Weltdatei oder ein Erweiterungs-Patch.

Kachelraster eines Dorfs: links das Dorf im Freien, rechts daneben die Innenbereiche seiner Gebäude, übereinander mit einer Reihe Abstand
(wie die Startwelt). Alle Kacheln eines Fragments sind relativ zu dessen linker oberer Ecke; `place(tx0, ty0)` setzt es in eine Welt.
"""

from dataclasses import dataclass, field

from . import interiors as I
from .kits import Kit, make_kit, outdoor_locations
from .layout import Layout, Params, make_layout
from .names import Naming, building_names
from .rng import Rng
from .tiles import DOOR, GRASS, TREE, Outdoor, rasterize

T = 16
TEX_SHIFT = [2, 8]
SMOKE = {"house": 19, "bh": 20, "bw": 24}


@dataclass
class Village:
    layout: Layout
    out: Outdoor
    kit: Kit
    nm: Naming
    houses: list[tuple[I.Furnished, str]]                          # Innenbereich und Name je Gebäude (Reihenfolge wie layout.buildings)
    rows: list[str]                                                # Kachelraster des Fragments
    block: list[tuple[int, int]]                                   # linke obere Ecke jedes Innenbereichs im Fragment
    locations: list[dict] = field(default_factory=list)            # Orte mit Kacheln im Fragment
    w: int = 0
    h: int = 0


def build_village(p: Params, nm: Naming, village: str | None = None) -> Village:
    lay = make_layout(p)
    out = rasterize(lay)
    rng = Rng(p.seed * 31 + 7)
    names = building_names([b.role for b in lay.buildings], rng)
    nm = Naming(nm.prefix, village or nm.village)
    houses: list[tuple[I.Furnished, str]] = []
    for n, (b, title) in enumerate(zip(lay.buildings, names), 1):
        if b.role == "home":
            houses.append((I.heim(), title))
        else:
            full = title if nm.canonical else f"{title}, {nm.village}"                  # Namen sind in der ganzen Welt eindeutig
            houses.append((I.build(I.blueprint_for(b.role, b.ww), nm.house_loc(n), nm.house_obj(n), full, rng, two_beds=p.residents > 0), title))
    # Innenbereiche rechts neben dem Dorf, übereinander
    bx, by, block = out.w + 1, 0, []
    for f, _ in houses:
        block.append((bx, by)); by += f.h + 1
    W, H = out.w + 1 + max((f.w for f, _ in houses), default=0), max(out.h, by - 1)
    g = [["T"] * W for _ in range(H)]
    for j in range(out.h, H):                                       # unter dem Dorf offene Wildnis (dort geht die Landstraße weiter)
        for i in range(out.w):
            g[j][i] = GRASS
    for j, row in enumerate(out.rows):
        for i, c in enumerate(row):
            g[j][i] = c
    for (x, y), (f, _) in zip(block, houses):
        for j, r in enumerate(f.rows):
            for i, c in enumerate(r):
                g[y + j][x + i] = c
    kit0 = make_kit(lay, out, nm, lambda i, j: "paths", p.residents)             # Orte kennen wir erst danach; die Quellen bekommen sie unten
    locs = outdoor_locations(lay, out, nm, kit0)
    kit = make_kit(lay, out, nm, lambda i, j: _loc_at(locs, i, j), p.residents)
    locs = outdoor_locations(lay, out, nm, kit)
    for i in range(kit.clearing[0], kit.clearing[0] + kit.clearing[2]):    # betretbare Reihe im Wald
        if g[kit.clearing[1]][i] in (TREE, "~", "f"):                      # Bäume weichen, ein Bach wird zur Furt
            g[kit.clearing[1]][i] = GRASS
    return Village(lay, out, kit, nm, houses, ["".join(r) for r in g], block, locs, W, H)


def _loc_at(locs: list[dict], i: int, j: int) -> str:
    for l in locs:
        x, y, w, h = l["rect"]
        if x <= i < x + w and y <= j < y + h:
            return l["id"]
    return "paths"


def place(v: Village, tx0: int, ty0: int) -> dict:
    """Das Dorf in Weltkoordinaten: Kacheln (Zeilen), Orte, Objekte, Quellen, Übergänge, Gebiet der Darstellung, Startplätze."""
    lay, out, nm = v.layout, v.out, v.nm
    sh = lambda t: [t[0] + tx0, t[1] + ty0]                                                    # noqa: E731
    rect = lambda r: [r[0] + tx0, r[1] + ty0, r[2], r[3]]                                      # noqa: E731
    locations = [{**l, "rect": rect(l["rect"]), "entrances": [sh(e) for e in l["entrances"]], "extra_tiles": [sh(e) for e in l["extra_tiles"]]} for l in v.locations]
    objects = [{**o, "tile": sh(o["tile"])} for o in v.kit.objects]
    nodes = [{**n, "tile": sh(n["tile"])} for n in v.kit.nodes]
    links, houses_look = [], []
    for (bx, by), (f, title), b in zip(v.block, v.houses, lay.buildings):
        ox, oy = bx + tx0, by + ty0
        for l in f.locations:
            locations.append({**l, "rect": [l["rect"][0] + ox, l["rect"][1] + oy, l["rect"][2], l["rect"][3]], "entrances": [[e[0] + ox, e[1] + oy] for e in l["entrances"]],
                              "extra_tiles": [[e[0] + ox, e[1] + oy] for e in l["extra_tiles"]]})
        objects += [{**o, "tile": [o["tile"][0] + ox, o["tile"][1] + oy]} for o in f.objects]
        nodes += [{**n, "tile": [n["tile"][0] + ox, n["tile"][1] + oy]} for n in f.resource_nodes]
    # Haustüren: Übergang zwischen der Tür draußen und der Tür im Innenbereich; die Haustür selbst ist ein Objekt
    for n, ((bx, by), (f, title), b, dt) in enumerate(zip(v.block, v.houses, lay.buildings, out.doors), 1):
        ox, oy = bx + tx0, by + ty0
        outside, inside = sh(dt), [f.front[0] + ox, f.front[1] + oy]
        links.append([outside, inside])
        smoke = SMOKE.get(b.kind.split(":")[0])
        houses_look.append({"at": [b.cx, b.base], "sprite": b.kind, "door": {"outside": outside, "inside": inside},
                            "interior": {"rect": [ox, oy, f.w, f.h], "rooms": f.interior["rooms"], "wall": [[k, x + ox, room, off] for k, x, room, off in f.interior["wall"]],
                                         "decor": [[k, x + ox, y + oy] for k, x, y in f.interior["decor"]], "rugs": [[r[0], r[1] + ox, r[2] + oy, *r[3:]] for r in f.interior["rugs"]]},
                            "smoke": smoke})
    # Möbel, die das Raster sperrt, stehen schon in `rows`; die Haustür draußen ist begehbar
    frame = [tx0 * T - out.x0, ty0 * T - out.y0]
    S = lay
    region = {
        "id": nm.region(), "frame": frame, "bounds": {"left": -lay.ext_l, "right": 256, "top": 0, "bottom": 232},
        "shapes": {"paths": [[list(p) for p in pl] for pl in S.paths], "squares": [S.sq], "lakes": [S.lake], "gardens": [{**S.garden, "beds": S.beds}], "docks": [S.dock],
                   "streams": [[list(p) for p in S.stream]], "bridges": [S.bridge] if S.bridge else [], "pads": S.pads},
        "decor": [d for d in v.kit.decor if not _is_building(d[0])], "lights": v.kit.lights, "place": v.kit.place, "houses": houses_look,
    }
    return {"rows": v.rows, "size": [v.w, v.h], "locations": locations, "objects": objects, "resource_nodes": nodes, "links": links, "region": region,
            "spots": {k: sh(t) for k, t in v.kit.spots.items()}, "outdoor": [tx0, ty0, out.w, out.h],
            "home": sh(out.doors[next((i for i, b in enumerate(lay.buildings) if b.role == "home"), 0)]) if out.doors else sh((out.w // 2, out.h // 2)),
            "cam": [frame[0] + S.sq["x"], frame[1] + S.sq["y"] + 86]}


def _is_building(kind: str) -> bool:
    return kind == "house" or kind in ("bs", "bw", "bb", "bt") or kind.startswith("bh:")
