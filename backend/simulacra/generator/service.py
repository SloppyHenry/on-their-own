"""Bedienung des Weltgenerators aus der Leitstelle (AP12c): Trockenlauf mit Vorschau und Anwenden, für eine Erweiterung und für eine neue Simulation.

Jeder Schritt ist deterministisch: derselbe Wunsch (`Wish`) ergibt auf derselben Welt denselben Patch. Die Vorschau nennt dessen Prüfsumme (`digest`);
beim Anwenden wird neu erzeugt und die Prüfsumme verglichen, damit nur übernommen wird, was angeschaut wurde.

Der Trockenlauf wendet den Patch in der echten Datenbank an, baut daraus den Zustandsabzug (wie `GET /api/state`) und rollt alles zurück (`WorldEditor.dry_run`).
Das gilt für jeden Patch, nicht nur für erzeugte Dörfer: `preview_patch` ist die Stelle, an der später auch Einzeländerungen des Editors ihre Vorschau bekommen.
"""

import hashlib
import re
from dataclasses import dataclass

from ..api import state as api_state
from ..simulation.builder import Simulation
from ..world.extend import WorldEditError
from .generate import GenerationError, WorldInfo, dumps, extension_patch, new_world

KINDS = ("extend", "new")
LAKES = ("auto", "east", "south")
ROLES = ("house", "shop", "workshop", "barn", "stable")
MAX_EACH, MAX_TOTAL = 6, 10


class ServiceError(Exception):
    """Wunsch nicht ausführbar (Statuscode für die API)."""

    def __init__(self, status: int, text: str):
        super().__init__(text)
        self.status, self.text = status, text


@dataclass(frozen=True)
class Wish:
    kind: str = "extend"
    seed: int = 1
    lake: str = "auto"
    mix: tuple[tuple[str, int], ...] | None = None             # Gebäude je Rolle; None = Standard (3 Häuser, 2 Sondergebäude)

    def __post_init__(self):
        if self.kind not in KINDS or self.lake not in LAKES or not 0 <= self.seed <= 2_000_000_000:
            raise ServiceError(422, "Ungültiger Wunsch (Art, Seeufer oder Seed).")
        if self.mix is not None:
            n = [c for _, c in self.mix]
            if any(r not in ROLES for r, _ in self.mix) or any(not 0 <= c <= MAX_EACH for c in n) or not 1 <= sum(n) <= MAX_TOTAL:
                raise ServiceError(422, f"Der Gebäudemix braucht 1 bis {MAX_TOTAL} Gebäude (höchstens {MAX_EACH} je Art aus {', '.join(ROLES)}).")

    @classmethod
    def of(cls, kind: str, seed: int, lake: str, mix: dict[str, int] | None) -> "Wish":
        return cls(kind, seed, lake, None if mix is None else tuple(sorted(mix.items())))

    def mix_dict(self) -> dict[str, int] | None:
        return None if self.mix is None else dict(self.mix)


def digest(obj: dict) -> str:
    return hashlib.sha256(dumps(obj).encode()).hexdigest()[:16]


def _meta(patch: dict) -> tuple[str, int, list[int]]:
    """Dorfname, Seed und Dorfplatz (Kachel) eines Erweiterungs-Patches."""
    village, seed = re.fullmatch(r"Neues Dorf (.+) \(Seed (\d+)\)", patch["description"]).groups()
    region = patch["look"]["regions"][0]
    sq = region["shapes"]["squares"][0]
    return village, int(seed), [int((region["frame"][0] + sq["x"]) // 16), int((region["frame"][1] + sq["y"]) // 16)]


def _summary(counts: dict[str, int]) -> dict[str, int]:
    return {k: v for k, v in counts.items() if v}


def _report(rep) -> dict:
    return rep.as_dict() if rep is not None else {"ok": False, "errors": [], "checks": []}


# --- Erweiterung ----------------------------------------------------------------------------------------------------

def make_extension(sim: Simulation, w: Wish) -> tuple[dict, object]:
    """Patch für das Dorf (DB-Thread). Wirft `ServiceError` mit dem Prüfbericht, wenn kein gültiges Dorf entsteht."""
    try:
        return extension_patch(WorldInfo.from_state(sim.engine.state), w.seed, lake=w.lake, mix=w.mix_dict())
    except GenerationError as e:
        raise ServiceError(422, str(e)) from e


def preview_patch(sim: Simulation, patch: dict) -> dict:
    """Trockenlauf eines beliebigen Patches (DB-Thread): {"ok", "error", "counts", "snapshot"}. Die Welt bleibt unverändert."""
    try:
        res = sim.engine.edit.dry_run(patch, inspect=lambda: api_state.snapshot(sim).model_dump())
    except WorldEditError as e:
        return {"ok": False, "error": f"[{e.code}] {e.text}", "counts": {}, "snapshot": None}
    return {"ok": True, "error": None, "counts": _summary(res["counts"]), "snapshot": res["inspected"]}


def preview_extension(sim: Simulation, w: Wish) -> dict:
    """Vorschau einer Erweiterung (DB-Thread)."""
    try:
        patch, rep = make_extension(sim, w)
    except ServiceError as e:
        return {"kind": "extend", "ok": False, "error": e.text, "report": _report(None), "digest": None, "village": None, "seed": None, "focus": None, "region": None,
                "counts": {}, "snapshot": None}
    dry = preview_patch(sim, patch)
    village, seed, focus = _meta(patch)
    return {"kind": "extend", "ok": dry["ok"] and rep.ok, "error": dry["error"], "report": _report(rep), "digest": digest(patch), "village": village, "seed": seed,
            "focus": focus, "region": patch["look"]["regions"][0]["id"], "counts": dry["counts"], "snapshot": dry["snapshot"]}


def apply_extension(sim: Simulation, w: Wish, expect: str) -> dict:
    """Erzeugt neu, vergleicht die Prüfsumme, sichert und wendet an (DB-Thread)."""
    patch, rep = make_extension(sim, w)
    if digest(patch) != expect:
        raise ServiceError(409, "Die Welt hat sich seit der Vorschau geändert. Bitte die Vorschau neu erstellen.")
    backup = sim.saves.backup("Vor dem Erweitern")["name"] if sim.saves is not None else None
    village, seed, focus = _meta(patch)
    try:
        res = sim.engine.edit.apply_generated(patch, {"kind": "extend", "seed": seed, "requested_seed": w.seed, "village": village})
    except WorldEditError as e:
        raise ServiceError(409, f"Die Engine hat den Patch abgelehnt: [{e.code}] {e.text}") from e
    return {"kind": "extend", "village": village, "seed": seed, "patch": patch["id"], "backup": backup, "counts": _summary(res.value), "focus": focus}


# --- Neue Simulation ----------------------------------------------------------------------------------------------------

def make_world(w: Wish) -> tuple[dict, object]:
    try:
        return new_world(w.seed, lake=w.lake, mix=w.mix_dict())
    except GenerationError as e:
        raise ServiceError(422, str(e)) from e


def world_counts(world: dict) -> dict[str, int]:
    return {"locations": len(world["locations"]), "objects": len(world["objects"]), "resource_nodes": len(world["resource_nodes"]), "agents": len(world["agents"]),
            "width": world["size"][0], "height": world["size"][1]}


async def preview_new(sim: Simulation, w: Wish) -> dict:
    """Vorschau einer neuen Simulation: Weltdatei in einer Wegwerf-Simulation im Speicher, daraus der Zustandsabzug. Die laufende Welt bleibt unberührt."""
    try:
        world, rep = make_world(w)
    except ServiceError as e:
        return {"kind": "new", "ok": False, "error": e.text, "report": _report(None), "digest": None, "village": None, "seed": None, "focus": None, "region": None,
                "counts": {}, "snapshot": None}
    tmp = Simulation.create(sim.settings, ":memory:", sim.provider, world=world)
    try:
        snap = await tmp.engine.db.run(lambda: api_state.snapshot(tmp).model_dump())
    finally:
        tmp.close()
    return {"kind": "new", "ok": rep.ok, "error": None, "report": _report(rep), "digest": digest(world), "village": world["generator"]["village"],
            "seed": world["generator"]["seed"], "focus": None, "region": None, "counts": world_counts(world), "snapshot": snap}
