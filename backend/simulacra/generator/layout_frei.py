"""Freie Dorfformen (AP18f): Anger, Fluss quer und Streusiedlung.

Anders als beim Straßendorf steht hier kein festes Gerüst. Jede Form legt zuerst ihre Straßen fest (Ring um die Dorfwiese, Straße am Ufer, Gassen zu
Höfen), dann setzen sich die Häuser an die Stellen, an denen Fläche und ein Türweg frei sind; danach kommen See, Bach, Garten, Teiche, Felder und Wald. Alles
hängt vom Seed ab (Lage, Maße, Zahl der Ausfahrten, Wackeln der Wege), gleicher Seed und gleiche Stellgrößen ergeben dasselbe Dorf. Was nicht passt, bleibt weg
und steht im Prüfbericht.
"""

import math

from .geometry import Pt
from .layout import HOME_W, KIND, ROOFS, WALLS, WIDTH, Building, Layout, Params, _roles
from .layout_extra import apply_rest
from .layout_geo import blocked_pt, box_blocked, needed_height
from .layout_haeuser import _emit, _fits, _path_ok
from .layout_trees import add_trees
from .layout_wasser import add_lake, add_stream, connect_ponds, lane_points, line_clear
from .rng import Rng, jr


def make_items(p: Params, R: Rng) -> list[Building]:
    """Die Gebäude des Dorfs (Rollen, Breiten), Wohnhäuser zuerst: fehlt Platz, fehlen dann Sondergebäude und keine Betten."""
    items: list[Building] = []
    for role in _roles(p, R):
        if role == "home":
            items.append(Building("home", "house", 0, 0, HOME_W, 66))
        elif role == "house":
            ww = R.pick([58, 66, 66, 90])
            items.append(Building("house", f"bh:{ww}:{R.pick(ROOFS)}:{R.pick(WALLS)}", 0, 0, ww + 12, ww))
        else:
            items.append(Building(role, KIND[role], 0, 0, WIDTH[role]))
    return sorted(items, key=lambda b: b.role not in ("house", "home"))


def connect(lay, cand: Building, targets: list[Pt], tried: int = 8):
    """Türweg von der Tür (sie zeigt nach Süden) zum nächsten Punkt einer Straße: gerade hinunter, sonst seitlich ums Haus herum. Gibt (Weg, Seite ohne Weg) oder None."""
    cx, base = cand.cx, cand.base
    door = (cx, base + 3)
    near = sorted(targets, key=lambda t: math.hypot(t[0] - cx, t[1] - base))[:tried]
    for T in near:
        if math.hypot(T[0] - cx, T[1] - base) > 150:
            break
        if T[1] >= base + 8:
            way = [door, (cx, base + 12), T]
            if _path_ok(lay, way, cand):
                return way, 1
        for side in (1, -1):
            xo = cx + side * (cand.w / 2 + 13)
            way = [door, (cx, base + 13), (xo, base + 13), (xo, T[1]), T] if T[1] < base + 13 else [door, (cx, base + 13), (xo, base + 13), T]
            if _path_ok(lay, way, cand):
                return way, -side
    return None


def try_place(lay, rng: Rng, t: Building, cx: float, base: int, targets: list[Pt], infl: float = 8) -> bool:
    """Setzt das Gebäude, wenn Fläche und ein Türweg frei sind."""
    if not (-lay.ext_l + 4 + t.w / 2 < cx < 258 - t.w / 2 and 50 <= base < 232 + lay.extra_h - 26):
        return False
    cand = Building(t.role, t.kind, jr(cx), base, t.w, t.ww)
    if not _fits(lay, cand, infl):
        return False
    got = connect(lay, cand, targets)
    if got is None:
        return False
    way, away = got
    _emit(lay, rng, Building, t.role, t.kind, t.w, t.ww, cx, base, way, away)
    return True


def make_frei(p: Params, form: str) -> Layout:
    from .formen import PLANS
    seed, st = p.seed, p.stil
    R, rng, R2 = Rng(seed * 7919 + 13), Rng(seed * 1299709 + 7), Rng(seed * 104729 + 11)
    todo = make_items(p, R)
    lay = Layout(seed=seed, east=False, ext_l=0, sq={"x": 128, "y": 110, "r": 20}, lake=None, dock=None, paths=[], stream=[], bridge=None, garden=None, beds=[], pads=[],
                 buildings=[], decor=[], exits={}, form=form)
    plan = PLANS[form](lay, rng, todo, st, 0.0 if st.wege == "gerade" else 1.0)         # Straßen, Platz, Häuser (und beim Fluss das Wasser)
    n = plan["lanes"]
    if form != "fluss":
        if st.seen >= 1:
            add_lake(lay, rng, n)
        add_stream(lay, rng, st.wasser, n)
    _garden(lay, rng, n, st.gaerten)
    apply_rest(lay, rng, st)                                                             # Teiche, weitere Gärten, Felder; Höhe nach Süden
    if st.wasser != "keiner":
        connect_ponds(lay, rng, n)                                                       # manche Teiche hängen per Bach am großen See
    lay.extra_h = max(needed_height(lay), plan.get("min_h", 0))
    _finish(lay, rng, R2, st, plan)
    return lay


def _garden(lay, rng: Rng, n_lanes: int, want: int) -> None:
    """Der Gemeinschaftsgarten (Zaun, drei Beete, Sonnenblumen, Tomaten, Vogelscheuche) an einer freien Stelle nahe dem Platz, mit Pfad zur nächsten Straße."""
    if want < 1:
        return
    sq, targets = lay.sq, lane_points(lay, n_lanes)
    for t in range(400):
        far = 60 + t * 2
        if t < 200:                                                                      # an einer Straße nahe dem Platz: das Tor (Ostseite) zeigt zu ihr
            near = [q for q in targets if math.hypot(q[0] - sq["x"], q[1] - sq["y"]) < far] or targets
            px, py = near[int(rng.rnd(0, len(near)))]
            x0, y0 = jr(px - 82 - rng.rnd(0, 40)), jr(py - 26 + rng.rnd(-24, 24))
        else:
            x0, y0 = jr(rng.rnd(-lay.ext_l + 24, 170)), jr(rng.rnd(24, 158 + lay.extra_h))
        gdx, gdy = x0 - 14, y0 - 120
        if not (-lay.ext_l + 24 < x0 and x0 + 70 < 240 and 24 < y0 and y0 + 56 < 214 + lay.extra_h) or box_blocked(lay, (x0 - 8, y0 - 8, x0 + 86, y0 + 64), 6):
            continue
        gate = (x0 + 70, 146 + gdy)
        for T in sorted(targets, key=lambda q: math.hypot(q[0] - gate[0], q[1] - gate[1]))[:6]:
            way = [gate, (gate[0] + 10, gate[1]), T]
            if math.hypot(T[0] - gate[0], T[1] - gate[1]) < 140 and line_clear(lay, way[1:], 2):
                _draw_garden(lay, x0, y0, gdx, gdy, way)
                return
    lay.notes.append("der Gemeinschaftsgarten")


def _draw_garden(lay, x0: int, y0: int, gdx: int, gdy: int, way: list[Pt]) -> None:
    add = lambda k, x, y, e=0: lay.decor.append([k, jr(x), jr(y), e])             # noqa: E731
    lay.garden = {"x0": x0, "y0": y0, "x1": x0 + 70, "y1": y0 + 56}
    lay.beds = [[b[0] + gdx, b[1] + gdy, b[2], b[3]] for b in ([22, 127, 54, 9], [22, 141, 54, 9], [22, 155, 54, 9])]
    x = x0
    while x < lay.garden["x1"] - 4:
        add("fence", x + 7, lay.garden["y1"]); add("fence", x + 7, y0); x += 12
    y = y0 + 8
    while y < lay.garden["y1"]:
        add("post", x0, y)
        if y < 138 + gdy or y > 154 + gdy:
            add("post", lay.garden["x1"], y)
        y += 8
    add("sun", 26 + gdx, 124 + gdy); add("sun", 34 + gdx, 123 + gdy); add("sun", 42 + gdx, 124 + gdy)
    add("tomato", 32 + gdx, 136 + gdy, 1); add("tomato", 48 + gdx, 136 + gdy, 2); add("tomato", 64 + gdx, 136 + gdy, 3); add("scare", 78 + gdx, 128 + gdy)
    add("barrel", x0 - 9, y0 + 6, 7); add("barrel", x0 - 3, y0 + 10, 7)
    lay.paths.append([(round(a, 1), round(b, 1)) for a, b in way])


def _finish(lay, rng: Rng, R2: Rng, st, plan: dict) -> None:
    """Platz, Laternen, Wegweiser, dann Steine, Apfelbäume, Wald und einzelne Bäume (wie das Straßendorf), die Südstraße bis zum neuen Rand."""
    add = lambda k, x, y, e=0: lay.decor.append([k, jr(x), jr(y), e])             # noqa: E731
    sq, seed = lay.sq, lay.seed
    add("well", sq["x"], sq["y"] + 3); add("bench", sq["x"] - sq["r"] - 10, sq["y"] + 6); add("board", sq["x"] + sq["r"] + 4, sq["y"] - 20)
    add(f"bm:{seed % 3}", sq["x"] - 13, sq["y"] - 10); add(f"bm:{(seed + 1) % 3}", sq["x"] + 14, sq["y"] - 10); add("bcr", sq["x"] - 4, sq["y"] - 8); add("barrel", sq["x"] + 24, sq["y"] - 6)
    for x, y in plan.get("lamps", []):
        if not blocked_pt(lay, x, y, 3, paths=False, square=False):
            add("lamp", x, y); lay.lamps.append(jr(x))
    lay.clearing_x = (sq["x"] - 110, sq["x"] + 110)
    south = lay.paths[plan["south"]]
    south[-1] = (south[-1][0], 236 + lay.extra_h)
    for key, i in (("west", plan["west"]), ("south", plan["south"]), ("east", plan.get("east"))):
        if i is not None:
            pt = lay.paths[i][0] if key == "west" else lay.paths[i][-1]
            lay.exits[key] = (round(pt[0], 1), round(pt[1], 1))
    add("sign", lay.exits["west"][0] + 46, lay.exits["west"][1] + 18)
    if "east" in lay.exits:
        add("sign", lay.exits["east"][0] - 40, lay.exits["east"][1] + 18)
    lay.paths = [[(round(a, 1), round(b, 1)) for a, b in pl] for pl in lay.paths]
    add_trees(lay, rng, R2, st)
