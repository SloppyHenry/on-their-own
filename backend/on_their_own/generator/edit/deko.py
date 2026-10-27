"""Baum, Busch, Stein und Dinge des Dorfs setzen (AP16a): Bäume, Büsche und Steine sind Deko der Gestaltung; Bank, Laterne, Brunnen, Briefkasten und Wegweiser sind Dinge mit Bildstelle
(wie die Bauvorlagen der Bewohner in `world/build_look.py`)."""

from ...world.build_look import piece
from . import katalog as kat
from .modell import Abgelehnt, Welt, T


def ausfuehren(m: Welt, a: dict) -> None:
    sorte, t = a.get("sorte"), a.get("tile")
    d = kat.DEKO_NACH_SORTE.get(sorte)
    if d is None:
        raise Abgelehnt(f"Unbekannte Sorte '{sorte}'.")
    if not (isinstance(t, list) and len(t) == 2 and all(isinstance(v, int) for v in t)):
        raise Abgelehnt("Es fehlt die Kachel [x, y].")
    x, y = t
    m.frei(x, y, {".", ","} if not d["blockiert"] else {"."})
    g = m.gebiet(x, y)
    left, top = x * T - g["frame"][0], y * T - g["frame"][1]
    cx, foot = left + 8, top + T - 2
    box = (x * T, y * T, x * T + T, y * T + T)
    if "decor" in d:
        art = d["decor"][(x * 7 + y * 3) % len(d["decor"])]
        item = [art, cx, foot, (x * 7 + y * 3) % 7]
        m.mit_kacheln(lambda: m.op({"op": "add", "region": g["id"], "liste": "decor", "item": item}), box)
        return
    nr = m.neue_id()
    oid = f"{nr}_{d['ding']}"
    obj = {"id": oid, "kind": d["ding"], "name": d["name"], "tile": [x, y]}
    if d["ding"] == "lantern":
        obj["state"] = {"lit": False}
    elif d["ding"] == "mailbox":
        obj["state"] = {"letters": []}
    if d["ding"] == "well":
        obj["anywhere"] = True
    m.w["objects"].append(obj)
    plan = piece(d["ding"], oid, x, y, g["frame"]) if d["ding"] in ("lantern", "well") else {"place": {oid: {"at": [cx, foot], "sprite": d["sprite"], "e": 0}}, "lights": []}
    ops = [{"op": "place", "region": g["id"], "id": oid, "value": plan["place"][oid]}, *({"op": "add", "region": g["id"], "liste": "lights", "item": li} for li in plan["lights"])]
    m.mit_kacheln(lambda: m.op(*ops), box)
