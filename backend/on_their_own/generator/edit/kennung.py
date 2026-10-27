"""Feste Kennungen für Formen der Gestaltung (AP16a): aus Art, Liste und Inhalt abgeleitet, so brauchen die Formen im Bestand kein neues Feld und bleiben Byte für Byte gleich.

Eine Form ist ein Eintrag in einer Liste von `shapes` (Wege, Plätze, Seen, Gärten, Stege, Bäche, Brücken, Plätze für Häuser) oder in `decor`. Gleicher Inhalt in demselben Gebiet ergibt dieselbe Kennung;
steht ein Inhalt zweimal da, trifft Löschen den ersten. Ausgeblendete Formen (`look.mask`, nur im Block `legacy`) bleiben in der Liste stehen, damit der Zufall dort unverändert bleibt.
"""

import hashlib
import json
from typing import Any

from ...world import look_ops as lo

LISTEN = lo.SHAPES
BUCHSTABE = {"paths": "w", "squares": "p", "lakes": "s", "gardens": "g", "docks": "d", "streams": "b", "bridges": "u", "pads": "v", "decor": "x"}


def kennung(gebiet: str, liste: str, item: Any) -> str:
    h = hashlib.sha1(json.dumps([gebiet, item], sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:7]
    return f"{BUCHSTABE[liste]}-{h}"


def formen(gebiet: dict) -> list[tuple[str, str, Any]]:
    """Alle Formen eines Gebiets als (Kennung, Liste, Eintrag)."""
    out = [(kennung(gebiet["id"], liste, it), liste, it) for liste in LISTEN for it in gebiet["shapes"][liste]]
    out += [(kennung(gebiet["id"], "decor", d), "decor", d) for d in gebiet["decor"]]
    return out


def sichtbar(look: dict, gebiet: dict) -> dict:
    """Das Gebiet ohne ausgeblendete Formen (`look.mask`)."""
    return lo.visible(look, gebiet)
