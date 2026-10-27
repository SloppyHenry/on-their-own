"""Einzelne Änderungen an der Gestaltung (`look`) als kleine Operationen (AP16a): Form oder Deko eintragen, entfernen, Bildstelle setzen, Gebiet vergrößern.

Dieselben Operationen laufen im Backend (`apply`), im Browser (Reducer zu `world.look_edited`) und im Gestalten-Entwurf; so kommt dasselbe Ergebnis heraus, egal wo es entsteht.
Eine Operation ist ein Wörterbuch:
    {"op": "add", "region": id, "liste": "paths|squares|lakes|gardens|docks|streams|bridges|pads|decor|lights|houses", "item": …}
    {"op": "remove", "region": id, "liste": …, "item": …}          # der erste Eintrag mit gleichem Inhalt
    {"op": "replace", "region": id, "liste": …, "item": alt, "value": neu}  # der erste Eintrag mit gleichem Inhalt wird an derselben Stelle ersetzt (Haus einrichten)
    {"op": "place", "region": id, "id": objekt, "value": {…}}  /  {"op": "unplace", "region": id, "id": objekt}
    {"op": "bounds", "region": id, "right": px, "bottom": px}      # Gebiet nach Osten oder Süden vergrößern (nur größer)
Im Block `legacy` (Bild A, Zufall in fester Reihenfolge) wird nichts aus der Liste gestrichen: `remove` trägt den Eintrag in `look.mask` ein, die Bildschichten blenden ihn aus.
"""

from typing import Any

SHAPES = ("paths", "squares", "lakes", "gardens", "docks", "streams", "bridges", "pads")
LISTS = (*SHAPES, "decor", "lights", "houses")


class LookOpError(ValueError):
    pass


def region_of(look: dict[str, Any], rid: str) -> dict[str, Any]:
    for r in look["regions"]:
        if r["id"] == rid:
            return r
    raise LookOpError(f"Das Gebiet '{rid}' gibt es nicht.")


def _list(r: dict[str, Any], liste: str) -> list:
    if liste not in LISTS:
        raise LookOpError(f"Unbekannte Liste '{liste}'.")
    return r["shapes"][liste] if liste in SHAPES else r[liste]


def is_legacy(look: dict[str, Any], rid: str) -> bool:
    lg = look.get("legacy")
    return bool(lg) and lg.get("region") == rid


def apply(look: dict[str, Any], ops: list[dict[str, Any]]) -> None:
    """Wendet die Operationen der Reihe nach auf `look` an (verändert es). Fehler als `LookOpError`; der Aufrufer arbeitet auf einer Kopie."""
    for o in ops:
        kind = o.get("op")
        r = region_of(look, o["region"])
        if kind == "add":
            _list(r, o["liste"]).append(o["item"])
        elif kind == "remove":
            if is_legacy(look, r["id"]) and o["liste"] in (*SHAPES, "decor"):
                look.setdefault("mask", []).append({"region": r["id"], "liste": o["liste"], "item": o["item"]})
                continue
            lst = _list(r, o["liste"])
            if o["item"] not in lst:
                raise LookOpError("Das gibt es in der Gestaltung nicht (mehr).")
            lst.remove(o["item"])
        elif kind == "replace":
            lst = _list(r, o["liste"])
            if o["item"] not in lst:
                raise LookOpError("Das gibt es in der Gestaltung nicht (mehr).")
            lst[lst.index(o["item"])] = o["value"]
        elif kind == "place":
            r["place"][o["id"]] = o["value"]
        elif kind == "unplace":
            r["place"].pop(o["id"], None)
        elif kind == "bounds":
            b = r["bounds"]
            for k in ("right", "bottom"):
                if o.get(k) is not None and (b.get(k) is None or o[k] > b[k]):
                    b[k] = o[k]
        else:
            raise LookOpError(f"Unbekannte Operation '{kind}'.")


def visible(look: dict[str, Any], region: dict[str, Any]) -> dict[str, Any]:
    """Das Gebiet ohne die ausgeblendeten Einträge (`look.mask`); ohne Maske dasselbe Objekt."""
    mask = [m for m in look.get("mask") or [] if m["region"] == region["id"]]
    if not mask:
        return region
    shapes, decor = {k: list(region["shapes"][k]) for k in SHAPES}, list(region["decor"])
    for m in mask:
        lst = decor if m["liste"] == "decor" else shapes[m["liste"]]
        if m["item"] in lst:
            lst.remove(m["item"])
    return {**region, "shapes": {**region["shapes"], **shapes}, "decor": decor}
