"""Haus von innen einrichten (AP16c): Möbel setzen, Wandschmuck, Teppiche und die Farben von Tapete, Boden und Vorhang.

Möbel sind echte Objekte der Welt (mit ihren Handlungen aus der Objektart); Wandschmuck, Teppiche und Stile liegen in `look.houses[].interior` und werden mit der Operation `replace`
am Haus geändert (die Reihenfolge der Häuser bleibt). Die Kacheln des Innenbereichs liegen in der Tasche der Karte; Möbel, die den Weg versperren (`m`), dürfen keinen Raum abschneiden
und nicht vor einer Tür stehen.
"""

import copy
from collections import deque

from ...world import object_kinds as ok
from .modell import Abgelehnt, Welt

BLOCKIERT = {"armchair", "floor_lamp"}                                                 # stehen auf einer unbegehbaren Kachel, obwohl die Art nicht sperrt (wie im Generator)
MOEBEL = ["bed", "sofa", "armchair", "table", "chest", "wardrobe", "crate", "bookshelf", "desk", "workbench", "stove", "tap", "fireplace", "floor_lamp"]
WAND = {"fenster": (1.0, 6), "bild:see": (1.0, 12), "bild:portrait": (1.1, 12), "spiegel": (0.8, 9), "uhr": (0.7, 9), "wandregal:glaeser": (1.6, 11), "wandregal:deko": (1.6, 11),
        "toepfe": (1.7, 8), "werkzeugwand": (2.0, 9)}
TAPETEN = ["streifen", "blumen", "ranken", "kacheln", "bretter"]
BOEDEN = ["dielen", "dielenHell", "parkett", "fliesen", "werkstatt"]
VORHAENGE = ["#5d7fb0", "#d97a92", "#7fa878", "#b04a4a", "#e0a458", "#a9884e"]
TEPPICHE = {"blau": ["#5d7fb0", "#86a6d0", "#3f5f8c"], "rosa": ["#d97a92", "#f2b0c0", "#b05a72"], "gruen": ["#7fa878", "#a8c9a0", "#5a8056"]}


def katalog() -> dict:
    return {"moebel": [{"kind": k, "name": ok.KINDS[k].label, "modes": list(ok.KINDS[k].modes)} for k in MOEBEL], "wand": [{"kind": k, "breite": v[0]} for k, v in WAND.items()],
            "tapeten": TAPETEN, "boeden": BOEDEN, "vorhaenge": VORHAENGE, "teppiche": list(TEPPICHE)}


def _tile(a: dict) -> tuple[int, int]:
    t = a.get("tile")
    if not (isinstance(t, list) and len(t) == 2 and all(isinstance(v, int) and not isinstance(v, bool) for v in t)):
        raise Abgelehnt("Es fehlt die Kachel [x, y].")
    return t[0], t[1]


def haus_bei(m: Welt, x: int, y: int) -> tuple[dict, dict]:
    """(Gebiet, Haus), dessen Innenbereich die Kachel enthält."""
    for g in m.look["regions"]:
        for h in g["houses"]:
            r = h["interior"]["rect"]
            if r[0] <= x < r[0] + r[2] and r[1] <= y < r[1] + r[3]:
                return g, h
    raise Abgelehnt("Dort ist kein Haus von innen. Zum Einrichten ein Haus öffnen.", (x, y))


def raum_bei(m: Welt, x: int, y: int) -> dict:
    for l in m.w["locations"]:
        r = l["rect"]
        if not l.get("props", {}).get("fallback") and r[0] <= x < r[0] + r[2] and r[1] <= y < r[1] + r[3]:
            return l
    raise Abgelehnt("Dort ist kein Raum.", (x, y))


def _zusammenhang(m: Welt, rect: list[int]) -> int:
    """Anzahl getrennter Teile aus Boden und Türen im Innenbereich."""
    x0, y0, w, h = rect
    todo = {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w) if m.g[y][x] in "_+"}
    n = 0
    while todo:
        n += 1
        q = deque([todo.pop()])
        while q:
            x, y = q.popleft()
            for t in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if t in todo:
                    todo.remove(t)
                    q.append(t)
    return n


def _vor_tuer(m: Welt, x: int, y: int) -> bool:
    return any(0 <= j < m.hoehe and 0 <= i < m.breite and m.g[j][i] == "+" for i, j in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))


def moebel(m: Welt, a: dict) -> None:
    kind = a.get("kind")
    if kind not in MOEBEL:
        raise Abgelehnt(f"Unbekanntes Möbel '{kind}'.")
    x, y = _tile(a)
    _, haus = haus_bei(m, x, y)
    raum_bei(m, x, y)
    if m.art(x, y) != "_":
        raise Abgelehnt("Dort ist kein freier Boden." if m.art(x, y) != "m" else "Dort steht schon ein Möbel.", (x, y))
    b = m.belegung(x, y)
    if b:
        raise Abgelehnt(b, (x, y))
    if _vor_tuer(m, x, y):
        raise Abgelehnt("Vor der Tür bleibt es frei.", (x, y))
    sperrt = ok.KINDS[kind].blocks or kind in BLOCKIERT
    vorher = _zusammenhang(m, haus["interior"]["rect"])
    if sperrt:
        m.g[y][x] = "m"
        if _zusammenhang(m, haus["interior"]["rect"]) > vorher:
            m.g[y][x] = "_"
            raise Abgelehnt("Das würde einen Weg im Haus abschneiden.", (x, y))
    nr = m.neue_id()
    o = {"id": f"{nr}_{kind}", "kind": kind, "name": ok.KINDS[kind].label, "tile": [x, y]}
    st = ok.normalize_state(kind, {})
    if st:
        o["state"] = st
    m.w["objects"].append(o)


def _ersetze(m: Welt, g: dict, haus: dict, neu: dict) -> None:
    m.op({"op": "replace", "region": g["id"], "liste": "houses", "item": haus, "value": neu})


def wand(m: Welt, a: dict) -> None:
    kind = a.get("kind")
    if kind not in WAND:
        raise Abgelehnt(f"Unbekannter Wandschmuck '{kind}'.")
    x, y = _tile(a)
    g, haus = haus_bei(m, x, y)
    raum = raum_bei(m, x, y)
    rx, _, rw, _ = raum["rect"]
    wd, hoehe = WAND[kind]
    von = round(x + 0.5 - wd / 2, 1)
    if von < rx or von + wd > rx + rw:
        raise Abgelehnt("Das passt dort nicht an die Wand.", (x, y))
    for k, p, rid, _h in haus["interior"]["wall"]:
        if rid == raum["id"] and von < p + WAND.get(k, (1.0, 0))[0] + 0.1 and p < von + wd + 0.1:
            raise Abgelehnt("An der Wand ist dort schon etwas.", (x, y))
    neu = copy.deepcopy(haus)
    neu["interior"]["wall"].append([kind, von, raum["id"], hoehe])
    _ersetze(m, g, haus, neu)


def teppich(m: Welt, a: dict) -> None:
    x, y = _tile(a)
    farbe = a.get("farbe", "blau")
    if farbe not in TEPPICHE:
        raise Abgelehnt(f"Unbekannte Teppichfarbe '{farbe}'.")
    g, haus = haus_bei(m, x, y)
    raum_bei(m, x, y)
    if m.art(x, y) not in "_m":
        raise Abgelehnt("Dort liegt kein Boden.", (x, y))
    neu = copy.deepcopy(haus)
    neu["interior"]["rugs"].append(["oval", x + 0.5, y + 0.5, 26, 11, *TEPPICHE[farbe]])
    _ersetze(m, g, haus, neu)


def farbe(m: Welt, a: dict) -> None:
    x, y = _tile(a)
    g, haus = haus_bei(m, x, y)
    raum = raum_bei(m, x, y)
    wahl = {"paper": a.get("tapete"), "floor": a.get("boden"), "curtain": a.get("vorhang")}
    erlaubt = {"paper": TAPETEN, "floor": BOEDEN, "curtain": VORHAENGE}
    wahl = {k: v for k, v in wahl.items() if v is not None}
    if not wahl or any(v not in erlaubt[k] for k, v in wahl.items()):
        raise Abgelehnt("Tapete, Boden oder Vorhang aus der Liste wählen.", (x, y))
    neu = copy.deepcopy(haus)
    neu["interior"]["rooms"][raum["id"]] = {**neu["interior"]["rooms"].get(raum["id"], {}), **wahl}
    _ersetze(m, g, haus, neu)


def loesche(m: Welt, x: int, y: int) -> bool:
    """Löschen im Haus: Teppich unter dem Zeiger, sonst Wandschmuck, wenn die oberste Reihe des Raums angeklickt wird."""
    try:
        g, haus = haus_bei(m, x, y)
    except Abgelehnt:
        return False
    neu = copy.deepcopy(haus)
    rugs = neu["interior"]["rugs"]
    for r in rugs:
        if r[0] == "oval" and int(r[1]) == x and int(r[2]) == y:
            rugs.remove(r)
            _ersetze(m, g, haus, neu)
            return True
    raum = raum_bei(m, x, y)
    if y == raum["rect"][1]:
        for w in neu["interior"]["wall"]:
            if w[2] == raum["id"] and w[1] <= x + 0.5 <= w[1] + WAND.get(w[0], (1.0, 0))[0]:
                neu["interior"]["wall"].remove(w)
                _ersetze(m, g, haus, neu)
                return True
    return False
