"""Innenbereiche der Gebäude aus Bauplänen (`data/gebaeude/*.json`): Räume in Reihen, Türen, Möbel als Objekte und Quellen, Gestaltung der Innenansicht.

Ein Bauplan beschreibt Reihen („bands“) von Räumen mit Art, Breite und Höhe. Daraus werden Kachelraster, Orte, Objekte, Quellen und `look.interior`
abgeleitet; Möbel stehen an den Wänden, die Kachel hinter jeder Tür bleibt frei. Das Heimhaus (`heim.json`) ist die Startwelt-Einrichtung wörtlich
(Zimmer von Alex und Mira, Werkstatt, Küche, Wohnzimmer mit festen IDs), damit neue Startwelten für die Agenten dieselben Rollen haben.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from .rng import Rng

DIR = Path(__file__).parent.parent / "data" / "gebaeude"
WALL, FLOOR, DOOR, FURN = "#", "_", "+", "m"


@dataclass
class Furnished:
    w: int
    h: int
    rows: list[str]
    front: tuple[int, int]                                         # Haustür in der Außenwand (relativ)
    locations: list[dict] = field(default_factory=list)            # id, name, rect, entrances, extra_tiles, props (relativ)
    objects: list[dict] = field(default_factory=list)              # id, kind, name, tile, state, owner (relativ)
    resource_nodes: list[dict] = field(default_factory=list)
    interior: dict = field(default_factory=dict)                   # rooms, wall, decor, rugs (relativ, ohne Rechteck)


def load(name: str) -> dict:
    return json.loads((DIR / f"{name}.json").read_text())


def blueprint_for(role: str, ww: int, home: bool = False) -> str:
    if home:
        return "heim"
    if role == "house":
        return "haus_klein" if ww <= 58 else "langhaus" if ww >= 90 else "haus"
    return {"shop": "laden", "workshop": "werkstatt", "barn": "scheune", "stable": "stall"}[role]


# --- Heimhaus (Startwelt) -------------------------------------------------------------------------------------------

def heim() -> Furnished:
    d = load("heim")
    return Furnished(d["size"][0], d["size"][1], list(d["rows"]), tuple(d["front"]), d["locations"], d["objects"], d["resource_nodes"], d["interior"])


# --- Räume und Türen -------------------------------------------------------------------------------------------------

STYLE = {                                                           # Tapete, Boden, Vorhang je Raumart (Auswahl nach Zufall, wo mehrere)
    "bedroom": (["streifen", "blumen"], ["dielen", "dielenHell"], ["#5d7fb0", "#d97a92", "#7fa878"], ["rest"], "planks"),
    "living": (["ranken"], ["parkett"], ["#b04a4a"], ["social", "rest"], "planks"),
    "kitchen": (["kacheln"], ["fliesen"], ["#e0a458"], ["food"], "tile"),
    "workshop": (["bretter"], ["werkstatt"], ["#a9884e"], ["craft", "wood"], "workshop"),
    "store": (["bretter"], ["dielen"], ["#a9884e"], ["storage"], "planks"),
    "shop": (["kacheln"], ["dielenHell"], ["#e0a458"], ["social"], "planks"),
    "barn": (["bretter"], ["werkstatt"], ["#a9884e"], ["craft"], "workshop"),
    "stable": (["bretter"], ["werkstatt"], ["#a9884e"], ["nature"], "workshop"),
}
ARTICLE = {"bedroom": "im", "living": "im", "kitchen": "in der", "workshop": "in der", "store": "im", "shop": "im", "barn": "in der", "stable": "im"}
ARTICLE_TO = {"bedroom": "ins", "living": "ins", "kitchen": "in die", "workshop": "in die", "store": "ins", "shop": "in den", "barn": "in die", "stable": "in den"}


def build(name: str, house_loc: str, obj: str, title: str, rng: Rng, two_beds: bool = False) -> Furnished:
    """Innenbereich nach Bauplan `name`; `house_loc` (z. B. „house.v2h1“) und `obj` (z. B. „v2h1“) machen Orts- und Objekt-IDs eindeutig.
    `two_beds`: ein Wohnhaus mit nur einem Schlafraum bekommt ein zweites Bett (höchstens 2 Personen je Haus, AP17b); sonst bleibt alles wie bisher."""
    bp = load(name)
    bands = bp["bands"]
    W = max(sum(r["w"] for r in b["rooms"]) + len(b["rooms"]) + 1 for b in bands)
    H = 1 + sum(b["h"] + 1 for b in bands)
    g = [[WALL] * W for _ in range(H)]
    rooms: list[dict] = []
    y = 1
    for bi, b in enumerate(bands):
        x, n = 1, len(b["rooms"])
        for ri, r in enumerate(b["rooms"]):
            w = r["w"] + (W - (sum(q["w"] for q in b["rooms"]) + n + 1) if ri == n - 1 else 0)          # letzter Raum füllt die Reihe
            rooms.append({**r, "w": w, "x": x, "y": y, "h": b["h"], "band": bi})
            for j in range(b["h"]):
                for i in range(w):
                    g[y + j][x + i] = FLOOR
            x += w + 1
        y += b["h"] + 1
    doors: list[tuple[int, int]] = []

    def door(x: int, y: int) -> None:
        g[y][x] = DOOR; doors.append((x, y))

    for bi, b in enumerate(bands):
        rs = [r for r in rooms if r["band"] == bi]
        for a, c in zip(rs, rs[1:]):                                                               # Tür zwischen zwei Nachbarräumen
            door(a["x"] + a["w"], a["y"] + a["h"] // 2)
        if bi + 1 < len(bands):
            below = [r for r in rooms if r["band"] == bi + 1]
            for r in rs:                                                                           # Tür nach unten, wo darunter ein Raum liegt
                lo, hi = r["x"], r["x"] + r["w"]
                over = [(max(lo, q["x"]), min(hi, q["x"] + q["w"])) for q in below if min(hi, q["x"] + q["w"]) - max(lo, q["x"]) >= 1]
                if over:
                    a0, a1 = max(over, key=lambda t: t[1] - t[0])
                    door((a0 + a1 - 1) // 2, r["y"] + r["h"])
    last = [r for r in rooms if r["band"] == len(bands) - 1]
    fr = next((r for r in last if r["id"] == bp["front"]), last[0])
    front = (fr["x"] + fr["w"] // 2, H - 1)
    g[front[1]][front[0]] = DOOR
    doors.append(front)
    out = Furnished(W, H, [], front)
    reserved = {(x + dx, y + dy) for x, y in doors for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}
    used: set[tuple[int, int]] = set()
    ctr = {"n": 0}

    def free(r: dict, cands: list[tuple[int, int]]) -> tuple[int, int] | None:
        for dx, dy in cands:
            p = (r["x"] + dx % r["w"] if dx >= 0 else r["x"] + r["w"] + dx, r["y"] + dy if dy >= 0 else r["y"] + r["h"] + dy)
            if g[p[1]][p[0]] == FLOOR and p not in reserved and p not in used:
                used.add(p)
                return p
        return None

    def add(r, kind, label, cands, state=None, furniture=False, owner=None):
        p = free(r, cands)
        if p is None:
            return None
        ctr["n"] += 1
        if furniture:
            g[p[1]][p[0]] = FURN
        o = {"id": f"{obj}_{kind}{ctr['n']}", "kind": kind, "name": label, "tile": [p[0], p[1]]}
        if state is not None:
            o["state"] = state
        if owner:
            o["owner"] = owner
        out.objects.append(o)
        return p

    def source(r, rid, resource, label, cands, amount, cap, regen, minutes):
        p = free(r, cands)
        if p:
            out.resource_nodes.append({"id": f"{obj}_{rid}", "location_id": f"{house_loc}_{r['id']}", "tile": [p[0], p[1]], "resource": resource, "amount": amount, "cap": cap,
                                       "regen_per_hour": regen, "requires_tool": None, "gather_minutes": minutes, "regen_weather": None, "label": label})

    def decor(r, kind, cands):
        p = free(r, cands)
        if p:
            g[p[1]][p[0]] = FURN
            out.interior.setdefault("decor", []).append([kind, p[0], p[1]])

    TL, TR, BL = [(0, 0), (1, 0), (2, 0), (3, 0)], [(-1, 0), (-2, 0), (-3, 0), (-4, 0)], [(0, -1), (1, -1)]
    walls: list = []
    rugs: list = []
    styles: dict = {}
    for r in rooms:
        k = r["kind"]
        papers, floors, curtains, themes, floor_style = STYLE[k]
        styles[f"{house_loc}_{r['id']}"] = {"paper": rng.pick(papers), "floor": rng.pick(floors), "curtain": rng.pick(curtains)}
        if k == "bedroom":
            add(r, "bed", "Bett", TL); add(r, "chest", "Truhe", TR, {"contents": [], "goods": {}})
            if two_beds and r is next(q for q in rooms if q["kind"] == "bedroom") and sum(q["kind"] == "bedroom" for q in rooms) == 1:
                add(r, "bed", "Bett", [(0, -1), (1, -1), (2, -1), (-1, -1), (-2, -1)])
            decor(r, "nachttisch", [(1, 0), (2, 0)])
            if r["w"] >= 5:
                rugs.append(["oval", r["x"] + r["w"] // 2, r["y"] + r["h"] - 1.7, 26, 11, *rng.pick([["#5d7fb0", "#86a6d0", "#3f5f8c"], ["#d97a92", "#f2b0c0", "#b05a72"]])])
        elif k == "living":
            add(r, "sofa", "Sofa", [(1, 1), (2, 1)]); add(r, "table", "Tisch", [(r["w"] // 2 + 1, 1), (r["w"] // 2 + 2, 1)])
            add(r, "fireplace", "Kamin", TR, {"lit": False}); add(r, "bookshelf", "Bücherregal", [(-3, 0), (-4, 0)], {"books": ["Dorfchronik", "Gartenjahr"]})
            add(r, "floor_lamp", "Stehlampe", TL, furniture=True); add(r, "armchair", "Sessel", [(-2, -1), (-3, -1)], furniture=True)
            decor(r, "pflanze:gross", [(0, -1), (1, -1)])
            rugs.append(["teppich", r["x"] + 3, r["y"] + 1, 46, 14])
        elif k == "kitchen":
            add(r, "stove", "Herd", TL); add(r, "tap", "Wasserhahn", TR)
            source(r, "speisekammer", "food", None, [(2, 0), (3, 0)], 10, 16, 0.4, 3)
            source(r, "hahn", "water", None, [(-2, 0), (-3, 0)], 999, 999, 999, 2)
            add(r, "table", "Küchentisch", [(r["w"] // 2, -2), (r["w"] // 2 + 1, -2)])
        elif k == "workshop":
            add(r, "workbench", "Werkbank", TL); add(r, "axe", "Axt", [(2, 0), (3, 0)]); add(r, "crate", "Kiste", TR, furniture=True)
            source(r, "holzstapel", "wood", None, [(4, 0), (5, 0)], 6, 12, 0, 3)
            source(r, "samenkiste", "seeds", None, [(-2, -1), (-3, -1)], 6, 6, 0, 2)
            decor(r, "saegebock", [(-2, 1), (-3, 1)])
        elif k == "store":
            add(r, "crate", "Kiste", TL, furniture=True); add(r, "crate", "Kiste", [(1, 0), (2, 0)], furniture=True); add(r, "chest", "Truhe", [(0, 1), (1, 1)], {"contents": [], "goods": {}})
        elif k == "shop":
            add(r, "table", "Ladentisch", [(2, 1), (3, 1)]); add(r, "table", "Ladentisch", [(4, 1), (5, 1)]); add(r, "crate", "Kiste", TR, furniture=True)
            source(r, "waren", "food", "Waren", [(1, 0), (2, 0)], 6, 12, 0.2, 3)
        elif k in ("barn", "stable"):
            add(r, "crate", "Kiste", TL, furniture=True); add(r, "crate", "Kiste", [(1, 0), (2, 0)], furniture=True)
            add(r, "chest", "Truhe", TR, {"contents": [], "goods": {}})
            decor(r, "korb", [(-2, 1), (-3, 1)])
        # Wandschmuck links nach rechts, solange Platz ist
        deco = {"bedroom": [("fenster", 1), ("bild:see", 1)], "living": [("bild:portrait", 1.1), ("fenster", 1), ("spiegel", 0.8)], "kitchen": [("toepfe", 1.7), ("wandregal:glaeser", 1.6), ("uhr", 0.7)],
                "workshop": [("werkzeugwand", 2.0), ("fenster", 1)], "store": [("wandregal:deko", 1.6)], "shop": [("wandregal:glaeser", 1.6), ("fenster", 1), ("uhr", 0.7)],
                "barn": [("fenster", 1)], "stable": [("fenster", 1)]}[k]
        cur = r["x"] + 0.3
        for kind, wd in deco:
            if cur + wd > r["x"] + r["w"]:
                break
            walls.append([kind, round(cur + (0.0 if kind != "fenster" else 0.1), 1), f"{house_loc}_{r['id']}", {"fenster": 6, "bild": 12, "wandregal": 11, "uhr": 9, "spiegel": 9, "toepfe": 8, "werkzeugwand": 9}[kind.split(":")[0]]])
            cur += wd + 0.5
        article, article_to = ARTICLE[k], ARTICLE_TO[k]
        nm = f"{r['name']} ({title})"
        out.locations.append({"id": f"{house_loc}_{r['id']}", "name": nm, "rect": [r["x"], r["y"], r["w"], r["h"]], "entrances": [], "extra_tiles": [],
                              "props": {"style": {"floor": floor_style}, "to": f"{article_to} {r['name']} ({title})", "at": f"{article} {r['name']} ({title})", "themes": themes}})
    for x, y in doors:                                                     # Türen als Objekte (abschließbar), die Haustür auch
        ctr["n"] += 1
        out.objects.append({"id": f"{obj}_tuer{ctr['n']}", "kind": "door", "name": "Tür", "tile": [x, y], "state": {"locked": False}})
    out.rows = ["".join(r) for r in g]
    out.interior = {"rooms": styles, "wall": walls, "decor": out.interior.get("decor", []), "rugs": rugs}
    owner: dict[tuple[int, int], dict] = {}
    for d in doors:                                                          # jede Tür gehört genau einem Raum (dem ersten, der an sie grenzt; die Haustür dem vorderen Raum)
        own = next((loc for loc in out.locations if (d != front or loc["id"] == f"{house_loc}_{fr['id']}") and _touches(loc["rect"], *d)), out.locations[0])
        owner[d] = own
    for loc in out.locations:
        mine = [[x, y] for (x, y), o in owner.items() if o is loc]
        loc["extra_tiles"], loc["entrances"] = mine, [list(t) for t in mine]
    return out


def _touches(rect: list[int], x: int, y: int) -> bool:
    rx, ry, w, h = rect
    return (rx <= x < rx + w and ry - 1 <= y <= ry + h) or (rx - 1 <= x <= rx + w and ry <= y < ry + h)
