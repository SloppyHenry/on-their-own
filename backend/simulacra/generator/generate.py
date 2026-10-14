"""Öffentliche Schnittstelle des Weltgenerators: eine neue Startwelt (`new_world`) und die Erweiterung einer laufenden Welt (`extension_patch`).

Beides kommt aus demselben Dorf (`compose.build_village`); die Erweiterung ist ein Patch für `engine.edit.apply_patch`. Ergebnis ist immer
(Daten, Prüfbericht); angeboten wird nur, was die Prüfung besteht (`validate.check_world`), sonst wird mit einem abgeleiteten Seed neu gewürfelt.
"""

import copy
import json
import math
from dataclasses import dataclass, field

from ..world import loader
from ..world import look as lk
from .compose import TEX_SHIFT, T, Village, build_village, place
from .layout import Params, make_layout
from .names import Naming, village_name
from .rng import Rng
from .validate import Report, check_world

TRIES = 8                                                          # so oft wird mit abgeleitetem Seed neu gewürfelt, bevor aufgegeben wird
TILE_TYPES = {"fence": {"char": "f", "walkable": False, "cost": 0, "color": "#a96f42", "label": "Zaun"},
              "furniture": {"char": "m", "walkable": False, "cost": 0, "color": "#a96f42", "label": "Möbel"}}
MAX_MAP = 256


class GenerationError(ValueError):
    """Kein gültiges Dorf nach allen Versuchen (oder Eingabe nicht möglich); `report` nennt die Prüfungen."""

    def __init__(self, text: str, report: Report | None = None):
        super().__init__(text)
        self.report = report


@dataclass
class WorldInfo:
    """Was der Generator von einer bestehenden Welt wissen muss (aus Weltdatei oder Engine)."""
    size: tuple[int, int]
    rows: list[str]                                                # Kachelzeichen je Zeile
    links: list
    look: dict                                                     # Version 2
    ids: set[str] = field(default_factory=set)                     # Orts-, Objekt-, Quellen- und Agenten-IDs
    names: set[str] = field(default_factory=set)                   # Ortsnamen
    char_of: dict[str, str] = field(default_factory=dict)          # Kachelart → Zeichen

    @classmethod
    def from_world_file(cls, w: dict) -> "WorldInfo":
        look = w["look"] if lk.is_v2(w["look"]) else lk.upgrade_v1(w["look"])
        ids = {l["id"] for l in w["locations"]} | {o["id"] for o in w["objects"]} | {n["id"] for n in w["resource_nodes"]} | {a["id"] for a in w["agents"]}
        return cls((len(w["tiles"][0]), len(w["tiles"])), list(w["tiles"]), list(w.get("links", [])), look, ids, {l["name"] for l in w["locations"]},
                   {k: t["char"] for k, t in w["tile_types"].items() if t.get("char")})

    @classmethod
    def from_state(cls, st) -> "WorldInfo":
        char = {k: t.char for k, t in st.tile_types.items() if t.char}
        look = st.get_meta("look")
        look = look if lk.is_v2(look) else lk.upgrade_v1(look)
        rows = ["".join(char[c] for c in row) for row in st.grid.cells]
        ids = {l.id for l in st.locations.values()} | {o.id for o in st.all_objects()} | {n.id for n in st.all_nodes()} | {a.id for a in st.agents()}
        return cls((st.grid.width, st.grid.height), rows, st.get_meta("links") or [], look, ids, {l.name for l in st.locations.values()}, char)


# --- neue Startwelt -------------------------------------------------------------------------------------------------

def new_world(seed: int, *, lake: str = "auto", mix: dict[str, int] | None = None, name: str | None = None) -> tuple[dict, Report]:
    """Eine komplette Weltdatei (wie `world_default.json`) mit einem Dorf: Heimhaus für Alex und Mira, Platz, Garten, See, Wald."""
    tpl = loader.load_world_file(loader.DATA_DIR / "world_default.json")                  # Vorlage: Kachelarten, Agenten, Startzeit der Startwelt
    last = None
    for attempt in range(TRIES):
        s = seed + attempt * 1000003
        vn = name or village_name(Rng(s), set())
        v = build_village(Params(s, lake, mix, home=True), Naming("", vn), vn)
        d = place(v, 0, 0)
        sq = d["region"]["shapes"]["squares"][0]
        start = _tile(d, v, sq["x"], sq["y"] + 10)
        rep = check_world(d, start)
        last = rep
        if not rep.ok:
            continue
        W, H = d["size"]
        locations = d["locations"] + [{"id": "paths", "name": "Wege und Wiesen", "rect": [0, 0, W, H], "entrances": [], "extra_tiles": [],
                                       "props": {"fallback": True, "to": "auf die Wege", "at": "auf den Wegen", "themes": []}}]
        agents = [{**a, "tile": d["spots"][a["id"]]} for a in tpl["agents"]]
        look = {"version": 2, "style": "mockup-a", "texShift": TEX_SHIFT, "legacy": None, "home": d["cam"], "regions": [d["region"]], "roads": []}
        world = {"schema": tpl["schema"], "home": d["home"], "tile_types": {**tpl["tile_types"], **{k: v_ for k, v_ in TILE_TYPES.items() if k not in tpl["tile_types"]}},
                 "name": f"Dorf {vn}", "size": [W, H], "tiles": d["rows"], "locations": locations, "objects": d["objects"], "resource_nodes": d["resource_nodes"],
                 "agents": agents, "start": tpl["start"], "links": d["links"], "look": look, "generator": {"seed": s, "requested_seed": seed, "village": vn}}
        return world, rep
    raise GenerationError(f"Kein gültiges Dorf nach {TRIES} Versuchen (Seed {seed}).", last)


def _tile(d: dict, v: Village, lx: float, ly: float) -> tuple[int, int]:
    i, j = v.out.tile_of(lx, ly)
    return i + d["outdoor"][0], j + d["outdoor"][1]


# --- Erweiterung ----------------------------------------------------------------------------------------------------

def extension_patch(info: WorldInfo, seed: int, *, lake: str = "auto", mix: dict[str, int] | None = None, direction: str = "south") -> tuple[dict, Report]:
    """Patch, der ein neues Dorf südlich des letzten Gebiets anlegt, mit Landstraße zum Bestand; die Karte wächst (Bestand wird nie überschrieben)."""
    if direction != "south":
        raise GenerationError("Zurzeit wächst die Welt nur nach Süden.")
    regions = info.look["regions"]
    prev = regions[-1]
    n = 2
    while f"v{n}" in {r["id"] for r in regions} or any(i.startswith(f"v{n}_") or i.startswith(f"v{n}.") for i in info.ids):
        n += 1
    prefix = f"v{n}"
    taken_names = set(info.names)
    last = None
    for attempt in range(TRIES):
        s = seed + attempt * 1000003
        vn = village_name(Rng(s), {nm.split(" bei ")[-1].split(" in ")[-1].replace("Platz von ", "") for nm in taken_names})
        p = Params(s, lake, mix, home=False)
        lay0 = make_layout(p)
        sx_local, sy_local = max((pl[-1] for pl in prev["shapes"]["paths"]), key=lambda q: q[1])
        ax, ay = prev["frame"][0] + sx_local, prev["frame"][1] + sy_local                       # Ausfahrt nach Süden (Weltpixel)
        tx0 = max(0, math.ceil((ax + 28) / T))
        ty0 = max(info.size[1], math.ceil(ay / T)) + 3
        v = build_village(p, Naming(prefix, vn), vn)
        d = place(v, tx0, ty0)
        W, H = d["size"]
        newW, newH = max(info.size[0], tx0 + W), max(info.size[1], ty0 + H)
        if newW > MAX_MAP or newH > MAX_MAP:
            raise GenerationError(f"Die Karte würde {newW}×{newH} Kacheln groß; erlaubt sind {MAX_MAP}×{MAX_MAP}.")
        frame = d["region"]["frame"]
        wx, wy = frame[0] + lay0.exits["west"][0], frame[1] + lay0.exits["west"][1]               # Ausfahrt des neuen Dorfs nach Westen
        road = [[ax, ay], [ax, ay + 16], [ax, wy], [wx, wy]]
        road_tiles = _road_tiles(road, (tx0, ty0, W, H), (newW, newH), info)
        rows = [r.ljust(newW, ".") for r in info.rows] + ["." * newW for _ in range(newH - info.size[1])]
        rows = [r + "." * (newW - len(r)) for r in rows]
        for (x, y) in road_tiles:
            rows[y] = rows[y][:x] + "," + rows[y][x + 1:]
        for j, r in enumerate(d["rows"]):
            rows[ty0 + j] = rows[ty0 + j][:tx0] + r + rows[ty0 + j][tx0 + W:]
        sq = prev["shapes"]["squares"][0]
        start = (math.floor((prev["frame"][0] + sq["x"]) / T), math.floor((prev["frame"][1] + sq["y"] + sq["r"] + 4) / T))
        rep = check_world(d, start, taken_ids=info.ids, taken_names=info.names, full_rows=rows)
        last = rep
        if not rep.ok:
            continue
        patch = {"id": f"dorf-{prefix}-{seed}", "description": f"Neues Dorf {vn} (Seed {s})", "max_objects": 500,
                 "tile_types": {k: t for k, t in TILE_TYPES.items() if k not in info.char_of},
                 "tiles": [{"at": [tx0, ty0], "rows": d["rows"]}] + _runs(road_tiles),
                 "locations": d["locations"], "objects": [_obj(o) for o in d["objects"]], "resource_nodes": d["resource_nodes"], "links": d["links"],
                 "look": {"regions": [d["region"]], "roads": [road]}}
        if (newW, newH) != tuple(info.size):
            patch["extend_map"] = {"width": newW, "height": newH, "fill": "grass"}
        patch = {k: v_ for k, v_ in patch.items() if v_ not in ({}, [])}
        return patch, rep
    raise GenerationError(f"Kein gültiges Dorf nach {TRIES} Versuchen (Seed {seed}).", last)


def _obj(o: dict) -> dict:
    """Dinge auf Wasser (Boot) und Möbelkacheln stehen auf unbegehbaren Kacheln: wie in der Startwelt erlaubt (`anywhere`)."""
    return {**o, "anywhere": True} if o["kind"] in ("boat", "well", "fishing_spot", "floor_lamp", "armchair", "wardrobe", "crate", "board") else o


def _road_tiles(road: list, frag: tuple[int, int, int, int], size: tuple[int, int], info: WorldInfo) -> list[tuple[int, int]]:
    """Kacheln der Landstraße außerhalb des neuen Dorfs: in neuem Land und durch Wildnis oder Wald des Bestands (Mauern, Wasser, Orte bleiben)."""
    fx, fy, fw, fh = frag
    out: set[tuple[int, int]] = set()
    inside_ok = road[0][1] < info.size[1] * T - 8                  # Ausfahrt mitten im Bestand (erzeugtes Dorf): Wildnis und Wald dürfen einem Weg weichen; liegt sie am Rand (Startwelt), bleibt der Bestand unberührt
    for a, b in zip(road, road[1:]):
        steps = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 4))
        for k in range(steps + 1):
            x, y = a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps
            for dy in (-6, 0, 6):
                for dx in (-6, 0, 6):
                    t = (math.floor((x + dx) / T), math.floor((y + dy) / T))
                    if not (0 <= t[0] < size[0] and 0 <= t[1] < size[1]) or (fx <= t[0] < fx + fw and fy <= t[1] < fy + fh):
                        continue
                    if t[1] >= info.size[1] or (inside_ok and t[0] < info.size[0] and info.rows[t[1]][t[0]] in ".T"):          # nur neues Land oder Wildnis und Wald des Bestands
                        out.add(t)
    return sorted(out)


def _runs(tiles: list[tuple[int, int]]) -> list[dict]:
    """Waagerechte Streifen aus einzelnen Kacheln (kürzere Patches)."""
    out, by_row = [], {}
    for x, y in tiles:
        by_row.setdefault(y, []).append(x)
    for y, xs in sorted(by_row.items()):
        xs.sort(); s = e = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == e + 1:
                e = x; continue
            out.append({"rect": [s, y, e - s + 1, 1], "type": "path"})
            if x is not None:
                s = e = x
    return out


def dumps(obj: dict) -> str:
    """Byte-gleiche Ausgabe für gleiche Eingaben (Tests und Dateien)."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
