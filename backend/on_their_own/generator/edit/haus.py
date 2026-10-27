"""Haus setzen (AP16a): Sprite, Mauern, Tür, Innenbereich in der Tasche (ein ungenutzter Streifen der Karte), Orte, Möbel, Übergang und Bildstelle in einem Zug, dazu ein Weg zur nächsten Straße.

Die Kachel der Haustür bestimmt die Lage: das Haus steht zwei Kachelreihen hoch über der Tür und so breit wie sein Sprite, die Kachel unter der Tür muss frei sein.
"""

from collections import deque

from .. import interiors as I
from ..compose import SMOKE
from ..layout import HOME_W, WIDTH
from ..names import BARNS, HOUSES, SHOPS, STABLES, WORKSHOPS, Naming
from ..rng import Rng
from . import ableiten as ab
from . import katalog as kat
from .modell import BODEN, Abgelehnt, Welt, T

POOLS = {"house": HOUSES, "shop": SHOPS, "workshop": WORKSHOPS, "barn": BARNS, "stable": STABLES}
KIND = {"shop": "bs", "workshop": "bw", "barn": "bb", "stable": "bt"}


def sprite_und_breite(a: dict) -> tuple[str, int, int]:
    """(Sprite, Breite des Sprites, `ww` der Bauvorlage) einer Bestellung."""
    art = a.get("gebaeude")
    if art == "house":
        ww = a.get("breite", 66)
        dach, wand = a.get("dach", "rot"), a.get("wand", "creme")
        if ww not in (58, 66, 90) or dach not in kat.DAECHER or wand not in kat.WAENDE:
            raise Abgelehnt("Ein Wohnhaus gibt es in den Breiten 58, 66 und 90 mit Dach- und Wandfarben aus der Liste.")
        return f"bh:{ww}:{dach}:{wand}", ww + 12, ww
    if art not in KIND:
        raise Abgelehnt(f"Unbekannte Gebäudeart '{art}'.")
    return KIND[art], WIDTH[art], 0


def mauern(cx: float, w: int, dx: int, dy: int, fx: int) -> list[tuple[int, int]]:
    """Kacheln der Mauer (zwei Reihen über und mit der Tür), mit demselben Test wie das Ableiten."""
    bx0, bx1 = cx - w / 2 + 2, cx + w / 2 - 2
    return [(X, Y) for Y in (dy - 1, dy) for X in range(dx - w // T - 2, dx + w // T + 3) if bx0 <= X * T + 8 - fx <= bx1]


def titel(m: Welt, rolle: str) -> str:
    vorhanden = " ".join(l["name"] for l in m.w["locations"])
    pool = POOLS[rolle]
    for i, t in enumerate(pool * 3):
        name = t if i < len(pool) else f"{t} {'II' if i < 2 * len(pool) else 'III'}"
        if f"({name}" not in vorhanden:
            return name
    return f"{pool[0]} {len(m.w['locations'])}"


def tasche(m: Welt, w: int, h: int) -> tuple[int, int]:
    """Linke obere Ecke eines freien Streifens für den Innenbereich: nur Wald, außerhalb aller Gebiete und Orte; sonst wächst die Karte nach Süden."""
    orte = [l["rect"] for l in m.w["locations"] if not l.get("props", {}).get("fallback")]
    boxen = [(g["frame"][0] + g["bounds"]["left"], g["frame"][1] + g["bounds"]["top"], g["frame"][0] + g["bounds"]["right"], g["frame"][1] + (g["bounds"].get("bottom") or 10 ** 9)) for g in m.look["regions"]]
    busy = {tuple(o["tile"]) for o in m.w["objects"]}

    def passt(x: int, y: int) -> bool:
        if x + w + 1 > m.breite or y + h + 1 > m.hoehe:
            return False
        if any(x - 1 < r[0] + r[2] and r[0] < x + w + 1 and y - 1 < r[1] + r[3] and r[1] < y + h + 1 for r in orte):
            return False
        for j in range(y, y + h + 1):
            for i in range(x, x + w + 1):
                if m.g[j][i] != "T" or (i, j) in busy or any(b[0] <= i * T + 8 < b[2] and b[1] <= j * T + 8 < b[3] for b in boxen):
                    return False
        return True
    for y in range(m.hoehe):
        for x in range(m.breite):
            if passt(x, y):
                return x, y
    if w + 1 > m.breite or m.hoehe + h + 2 > 256:
        raise Abgelehnt("Für den Innenbereich ist auf der Karte kein Platz mehr (höchstens 256 × 256 Kacheln).")
    y0 = m.hoehe + 1
    m.g.extend(list("T" * m.breite) for _ in range(h + 2))
    return 0, y0


def weg_zur_strasse(m: Welt, start: tuple[int, int], gesperrt: set[tuple[int, int]]) -> list[tuple[int, int]] | None:
    """Kürzester Weg (Kachelmitten) von der Kachel vor der Tür zur nächsten Wegkachel, höchstens 24 Schritte lang; None, wenn keine in Reichweite liegt."""
    if m.art(*start) == ",":
        return None
    prev, q = {start: None}, deque([(start, 0)])
    while q:
        (x, y), d = q.popleft()
        if d > 24:
            break
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n in prev or n in gesperrt or not m.drin(*n) or m.g[n[1]][n[0]] not in (".", ",", "s") or m.belegung(*n):
                continue
            prev[n] = (x, y)
            if m.g[n[1]][n[0]] == ",":
                way = [n]
                while prev[way[-1]]:
                    way.append(prev[way[-1]])
                return way[::-1]
            q.append((n, d + 1))
    return None


def ausfuehren(m: Welt, a: dict) -> None:
    t = a.get("tuer")
    if not (isinstance(t, list) and len(t) == 2 and all(isinstance(v, int) and not isinstance(v, bool) for v in t)):
        raise Abgelehnt("Es fehlt die Kachel der Haustür [x, y].")
    dx, dy = t
    sprite, w, ww = sprite_und_breite(a)
    g = m.gebiet(dx, dy)
    fx, fy = g["frame"]
    cx, base = dx * T + 8 - fx, dy * T + 17 - fy
    wall = mauern(cx, w, dx, dy, fx)
    for (x, y) in wall:
        m.frei(x, y)
    m.frei(dx, dy + 1)
    rolle = a["gebaeude"]
    nr = m.neue_id()
    ort = titel(m, rolle)
    dorf = m.w.get("name", "").removeprefix("Dorf ") or "Eigenbau"
    nm = Naming(nr, dorf)
    f = I.build(I.blueprint_for(rolle, ww), nm.house_loc(1), nm.house_obj(1), f"{ort}, {dorf}", Rng(dx * 1000 + dy + 7))
    ox, oy = tasche(m, f.w, f.h)
    for j, r in enumerate(f.rows):
        m.setze_zeile(ox, oy + j, r)
    off = lambda p: [p[0] + ox, p[1] + oy]                                                     # noqa: E731
    for l in f.locations:
        m.w["locations"].insert(0, {**l, "rect": [l["rect"][0] + ox, l["rect"][1] + oy, l["rect"][2], l["rect"][3]], "entrances": [off(e) for e in l["entrances"]], "extra_tiles": [off(e) for e in l["extra_tiles"]]})
    m.w["objects"].extend({**o, "tile": off(o["tile"])} for o in f.objects)
    m.w["resource_nodes"].extend({**n, "tile": off(n["tile"])} for n in f.resource_nodes)
    aussen, innen = [dx, dy], off(f.front)
    m.w.setdefault("links", []).append([aussen, innen])
    haus = {"at": [cx, base], "sprite": sprite, "door": {"outside": aussen, "inside": innen},
            "interior": {"rect": [ox, oy, f.w, f.h], "rooms": f.interior["rooms"], "wall": [[k, x + ox, room, o] for k, x, room, o in f.interior["wall"]],
                         "decor": [[k, x + ox, y + oy] for k, x, y in f.interior["decor"]], "rugs": [[r[0], r[1] + ox, r[2] + oy, *r[3:]] for r in f.interior["rugs"]]},
            "smoke": SMOKE.get(sprite.split(":")[0])}
    pad = [round(cx - w / 2 + 3, 1), base - 26, round(cx + w / 2 - 3, 1), base]
    licht = [[cx - (ww * 0.26 if rolle == "house" else 16), base, 32, 1], [cx + (ww * 0.26 if rolle == "house" else 16), base, 32, 1]] if rolle in ("house", "workshop", "shop") else []
    ops = [{"op": "add", "region": g["id"], "liste": "houses", "item": haus}, {"op": "add", "region": g["id"], "liste": "pads", "item": pad},
           *({"op": "add", "region": g["id"], "liste": "lights", "item": li} for li in licht)]
    weg = weg_zur_strasse(m, (dx, dy + 1), set(wall))
    if weg:
        pts = [(dx, dy)] + weg
        ops.append({"op": "add", "region": g["id"], "liste": "paths", "item": [m.pixel(x * T + 8, y * T + 8, g) for x, y in pts]})
    alle = wall + [(dx, dy + 1)] + (weg or [])
    m.mit_kacheln(lambda: m.op(*ops), (min(x for x, _ in alle) * T - 8, min(y for _, y in alle) * T - T - 8, (max(x for x, _ in alle) + 1) * T + 8, (max(y for _, y in alle) + 1) * T + 8))
