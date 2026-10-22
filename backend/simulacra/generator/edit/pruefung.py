"""Prüfung eines Entwurfs in drei Stufen (AP16a): ✓ in Ordnung, ! Hinweis, ✗ Fehler, jeweils mit Text und, wo es einen gibt, dem Ort (Kachel).

Die Regeln des Generators (`validate`): jede Haustür vom Startplatz aus erreichbar, Quellen und Dinge erreichbar, Orte überlappen sich nicht, Wohnhäuser haben ein Bett, die Küche einen Herd.
Dazu Kartengrenze, Grenze für Dinge, freie Kachel vor der Tür und Figuren auf begehbarem Boden. Ein Fehler, der schon vor dem Entwurf bestand (alte Welten), zählt nur als Hinweis,
damit Altlasten das Gestalten nicht sperren; neue Fehler sperren im Spiel das Übernehmen und in der Werkstatt „Damit spielen“.
"""

from ...world import object_kinds
from ..validate import OPEN, _every, _overlaps, reachable
from .patch import ANYWHERE

MAX_OBJEKTE, STANDARD_OBJEKTE = 500, 150


def _m(stufe: str, text: str, ort=None) -> dict:
    return {"stufe": stufe, "text": text, "ort": list(ort) if ort else None}


def startkachel(w: dict) -> tuple[int, int] | None:
    if w.get("startplatz"):
        return tuple(w["startplatz"])
    try:
        r = w["look"]["regions"][0]
        sq = r["shapes"]["squares"][0]
        return int((r["frame"][0] + sq["x"]) // 16), int((r["frame"][1] + sq["y"] + 10) // 16)
    except (KeyError, IndexError, TypeError):
        pass
    h = w.get("home")
    return (h[0], h[1]) if h else None


def befund(w: dict, belegt: dict) -> list[dict]:
    rows = w["tiles"]
    W, H = len(rows[0]), len(rows)
    out: list[dict] = []
    drin = lambda t: 0 <= t[0] < W and 0 <= t[1] < H                                         # noqa: E731
    objs, nodes, links = w["objects"], w["resource_nodes"], w.get("links", [])
    blocked = {tuple(o["tile"]) for o in objs if object_kinds.KINDS.get(o["kind"], object_kinds.UNKNOWN).blocks and o["kind"] != "door"}
    # Karte
    raus = [o["id"] for o in objs if not drin(o["tile"])] + [n["id"] for n in nodes if not drin(n["tile"])] + [l["id"] for l in w["locations"] if not l.get("props", {}).get("fallback")
                                                                                                                  and not (drin(l["rect"][:2]) and drin([l["rect"][0] + l["rect"][2] - 1, l["rect"][1] + l["rect"][3] - 1]))]
    out.append(_m("fehler", f"Außerhalb der Karte: {', '.join(raus[:4])}") if raus else _m("ok", "Alles liegt innerhalb der Karte"))
    if raus:
        return out
    # Start und Erreichbarkeit
    start = startkachel(w)
    if not w.get("startplatz") and "startplatz" in w:
        out.append(_m("hinweis", "Kein Startplatz gesetzt: Die Welt lässt sich speichern, aber noch nicht damit spielen"))
    if start is None or not drin(start) or rows[start[1]][start[0]] not in OPEN:
        out.append(_m("hinweis", "Der Startplatz ist nicht begehbar, darum lässt sich die Erreichbarkeit nicht prüfen", start))
        seen = None
    else:
        seen = reachable(rows, links, start, blocked)
    if seen is not None:
        reach = lambda t: tuple(t) in seen or any(n in seen for n in ((t[0] + 1, t[1]), (t[0] - 1, t[1]), (t[0], t[1] + 1), (t[0], t[1] - 1)))       # noqa: E731
        zu = [l[0] for l in links if not reach(l[0])]
        out += [_m("fehler", f"Die Haustür bei {t[0]},{t[1]} ist nicht erreichbar", t) for t in zu[:5]] or [_m("ok", "Jede Haustür ist vom Startplatz aus erreichbar")]
        qs = [n for n in nodes if not reach(n["tile"])]
        out += [_m("fehler", f"Die Quelle {n['id']} ist nicht erreichbar", n["tile"]) for n in qs[:5]] or [_m("ok", "Alle Quellen sind erreichbar")]
        dd = [o for o in objs if o["kind"] not in ANYWHERE and not reach(o["tile"])]
        out += [_m("fehler", f"{o['name']} ({o['id']}) ist nicht erreichbar", o["tile"]) for o in dd[:5]] or [_m("ok", "Alle Dinge sind erreichbar")]
    # Türen frei, Dinge auf begehbarem Boden
    vor = [l[0] for l in links if not (0 <= l[0][1] + 1 < H and rows[l[0][1] + 1][l[0][0]] in OPEN and (l[0][0], l[0][1] + 1) not in blocked)]
    out += [_m("fehler", f"Vor der Tür bei {t[0]},{t[1]} muss es frei bleiben", t) for t in vor[:5]] or [_m("ok", "Vor jeder Tür ist es frei")]
    steht = [o for o in objs if o["kind"] not in ANYWHERE and rows[o["tile"][1]][o["tile"][0]] not in OPEN and o["kind"] != "door"]
    out += [_m("fehler", f"{o['name']} steht auf unbegehbarer Kachel", o["tile"]) for o in steht[:5]]
    figuren = [(t, n) for t, n in belegt.items() if drin(t) and rows[t[1]][t[0]] not in OPEN]
    out += [_m("fehler", f"{n} stünde auf unbegehbarer Kachel", t) for t, n in figuren[:5]]
    # Orte und Räume
    ueber = _overlaps([l for l in w["locations"] if not l.get("props", {}).get("fallback")])
    out.append(_m("fehler", f"Orte überlappen sich: {ueber}") if ueber else _m("ok", "Orte überlappen sich nicht"))
    by_loc: dict[str, set[str]] = {}
    for o in objs:
        loc = next((l["id"] for l in w["locations"] if not l.get("props", {}).get("fallback") and _in(l, o["tile"])), "")
        by_loc.setdefault(loc, set()).add(o["kind"])
    d = {"locations": w["locations"]}
    out.append(_m("ok", "Schlafzimmer haben ein Bett, Küchen einen Herd") if _every(d, "bedroom", "bed", by_loc) and _every(d, "kitchen", "stove", by_loc)
               else _m("fehler", "Ein Schlafzimmer braucht ein Bett und eine Küche einen Herd"))
    n = len(objs)
    out.append(_m("fehler", f"Die Welt kann höchstens {MAX_OBJEKTE} Dinge aufnehmen (jetzt {n})") if n > MAX_OBJEKTE
               else _m("hinweis", f"Mit {n} Dingen wird die Obergrenze für Dinge auf {MAX_OBJEKTE} angehoben") if n > STANDARD_OBJEKTE else _m("ok", f"{n} Dinge, im Rahmen"))
    return out


def _in(loc: dict, t) -> bool:
    x, y, w, h = loc["rect"]
    return x <= t[0] < x + w and y <= t[1] < y + h


def pruefen(neu: dict, belegt: dict, spiel: bool, vorher: dict | None = None) -> list[dict]:
    """Befund der neuen Welt. Mit `vorher`: Fehler, die dort schon bestanden, werden zu Hinweisen („schon vorher“)."""
    jetzt = befund(neu, belegt)
    if vorher is None:
        return jetzt
    alt = {(m["stufe"], m["text"]) for m in befund(vorher, belegt)}
    return [{**m, "stufe": "hinweis", "text": m["text"] + " (schon vorher so)"} if m["stufe"] == "fehler" and ("fehler", m["text"]) in alt else m for m in jetzt]
