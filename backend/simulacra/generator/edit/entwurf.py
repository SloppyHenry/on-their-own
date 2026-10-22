"""Ein Entwurf (AP16a): eine Liste von Aktionen, der Reihe nach auf einer Kopie der Weltdatei ausgeführt.

`anwenden` liefert die neue Weltdatei, je Aktion „geht“ oder den Grund mit Ort (eine abgelehnte Aktion ändert nichts und die nächsten laufen weiter), den Prüfbericht in drei
Stufen und den einen Patch, mit dem die laufende Welt dasselbe Ergebnis bekommt. Dieselbe Funktion arbeitet in der Welt-Werkstatt (Weltdatei) und im Spiel (Zustand → Weltdatei).
"""

import copy
from dataclasses import dataclass, field
from typing import Any

from . import deko, garten, haus, karte, loeschen, pruefung, see, weg
from .modell import Abgelehnt, Welt
from .patch import patch_aus

AKTIONEN = {"weg": weg.ausfuehren, "see": see.ausfuehren, "garten": garten.ausfuehren, "haus": haus.ausfuehren, "deko": deko.ausfuehren, "loeschen": loeschen.ausfuehren,
            "karte": karte.ausfuehren, "startplatz": karte.startplatz}
MAX_AKTIONEN = 200


@dataclass
class Ergebnis:
    welt: dict[str, Any]
    stati: list[dict]
    ops: list[dict]
    patch: dict[str, Any]
    meldungen: list[dict] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(s["ok"] for s in self.stati) and not any(m["stufe"] == "fehler" for m in self.meldungen)

    @property
    def fehler(self) -> int:
        return sum(m["stufe"] == "fehler" for m in self.meldungen)


def anwenden(world: dict[str, Any], aktionen: list[dict], *, belegt: dict[tuple[int, int], str] | None = None, spiel: bool = False) -> Ergebnis:
    if len(aktionen) > MAX_AKTIONEN:
        raise ValueError(f"Ein Entwurf hat höchstens {MAX_AKTIONEN} Aktionen.")
    try:
        m = Welt(world, belegt, spiel)
    except Abgelehnt as e:
        return Ergebnis(world, [{"ok": False, "grund": e.grund, "ort": None} for _ in aktionen], [], {"id": "gestalten-leer"}, [{"stufe": "fehler", "text": e.grund, "ort": None}])
    stati = []
    for a in aktionen:
        stand = m.sichern()
        try:
            fn = AKTIONEN.get(a.get("art")) if isinstance(a, dict) else None
            if fn is None:
                raise Abgelehnt(f"Unbekannte Aktion '{a.get('art') if isinstance(a, dict) else a}'.")
            fn(m, a)
            stati.append({"ok": True, "grund": None, "ort": None})
        except Abgelehnt as e:
            m.zurueck(stand)
            stati.append({"ok": False, "grund": e.grund, "ort": list(e.kachel) if e.kachel else None})
        except (KeyError, TypeError, ValueError) as e:                                    # fehlerhafte Eingabe wird wie eine abgelehnte Aktion gemeldet
            m.zurueck(stand)
            stati.append({"ok": False, "grund": f"Die Aktion ist unvollständig oder fehlerhaft ({type(e).__name__}).", "ort": None})
    neu = m.fertig()
    neu.pop("_e", None)
    ok = [a for a, s in zip(aktionen, stati) if s["ok"]]
    patch = patch_aus(world, neu, m.ops, ok, f"Gestalten: {len(ok)} Aktion{'en' if len(ok) != 1 else ''}")
    return Ergebnis(neu, stati, m.ops, patch, pruefung.pruefen(neu, belegt or {}, spiel, world))
