"""Bedienung des Gestaltens aus der API (AP16a): Entwurf in der Welt-Werkstatt (zustandslos auf einer Weltdatei) und im Spiel (Zustand → Weltdatei, Trockenlauf, Übernehmen).

Beide Wege rufen `entwurf.anwenden`; so kommt für dieselbe Welt und dieselben Aktionen dieselbe Welt heraus. Die Vorschau des Spiels ist der Trockenlauf des Patches in der echten Datenbank
(wie bei `service.preview_patch`); die Vorschau der Werkstatt ist eine Wegwerf-Simulation im Speicher, deren Zustandsabzug nach der Prüfsumme der Weltdatei zwischengespeichert wird.
"""

import hashlib
import json
from collections import OrderedDict
from typing import Any

from ...world.export import world_file
from ..service import ServiceError, preview_patch
from . import entwurf
from .entwurf import Ergebnis

_ABZUG: OrderedDict[str, dict] = OrderedDict()                              # Zustandsabzüge der Werkstatt-Vorschau, die letzten acht
MAX_ABZUG = 8


def summe(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def kopf(erg: Ergebnis) -> dict:
    return {"stati": erg.stati, "meldungen": erg.meldungen, "fehler": erg.fehler, "hinweise": sum(m["stufe"] == "hinweis" for m in erg.meldungen)}


def abzug_merken(schluessel: str) -> dict | None:
    hit = _ABZUG.get(schluessel)
    if hit is not None:
        _ABZUG.move_to_end(schluessel)
    return hit


def abzug_ablegen(schluessel: str, snap: dict) -> None:
    _ABZUG[schluessel] = snap
    while len(_ABZUG) > MAX_ABZUG:
        _ABZUG.popitem(last=False)


# --- Werkstatt -----------------------------------------------------------------------------------------------------

def datei_entwurf(world: dict, aktionen: list[dict]) -> tuple[Ergebnis, str]:
    erg = entwurf.anwenden(world, aktionen)
    return erg, summe(erg.welt)


# --- Spiel ---------------------------------------------------------------------------------------------------------

def spiel_welt(sim) -> tuple[dict, dict]:
    """(Weltdatei des Zustands, belegte Kacheln) im DB-Thread. Belegt: Figuren und alles, was nicht in der Weltdatei steht (Baustellen)."""
    st = sim.engine.state
    w = world_file(st)
    belegt = {(a.x, a.y): f"{a.name}" for a in st.agents()}
    for o in st.all_objects():
        if o.holder is None and o.x is not None and o.kind == "construction_site":
            belegt[(o.x, o.y)] = o.name
    return w, belegt


def spiel_entwurf(sim, aktionen: list[dict]) -> tuple[Ergebnis, dict]:
    """Vorschau im Spiel (DB-Thread): Entwurf auf dem Zustand rechnen und den Patch im Trockenlauf anwenden."""
    w, belegt = spiel_welt(sim)
    erg = entwurf.anwenden(w, aktionen, belegt=belegt, spiel=True)
    dry = preview_patch(sim, erg.patch) if any(s["ok"] for s in erg.stati) else {"ok": True, "error": None, "counts": {}, "snapshot": None}
    return erg, dry


def uebernehmen(sim, aktionen: list[dict], erwartet: str) -> dict:
    """Rechnet neu, vergleicht die Prüfsumme, sichert und wendet an (DB-Thread). Nur ein Entwurf ohne abgelehnte Aktion und ohne ✗ wird übernommen."""
    erg, dry = spiel_entwurf(sim, aktionen)
    if summe(erg.patch) != erwartet:
        raise ServiceError(409, "Die Welt hat sich seit der Vorschau geändert. Bitte die Vorschau neu erstellen.")
    if not all(s["ok"] for s in erg.stati):
        raise ServiceError(422, "Der Entwurf enthält Aktionen, die nicht gehen.")
    if erg.fehler or not dry["ok"]:
        raise ServiceError(422, dry["error"] or "Die Prüfung zeigt Fehler (✗); so lässt sich der Entwurf nicht übernehmen.")
    backup = sim.saves.backup("Vor dem Gestalten")["name"] if sim.saves is not None else None
    from ...world.extend import WorldEditError
    try:
        res = sim.engine.edit.apply_edit(erg.patch, len(aktionen))
    except WorldEditError as e:
        raise ServiceError(409, f"Die Engine hat den Entwurf abgelehnt: [{e.code}] {e.text}") from e
    return {"patch": erg.patch["id"], "backup": backup, "counts": {k: v for k, v in res.value.items() if v}, "actions": len(aktionen)}
