"""Neue Simulation aus einem Entwurf des Assistenten (AP17b): prüfen, Welt bauen, Bewohner, Beziehungen und Vorgeschichte anlegen.

Für die Bewohner ist das Dorf „schon immer da“ (Frage 36): nichts hier erzeugt ein Ereignis oder einen Prompt-Text über den Assistenten. Startwerte der
Beziehungen stehen einfach in der Tabelle; eine Vorgeschichte ist eine gewöhnliche Erinnerung der Art Fakt, so formuliert, wie der Mensch sie geschrieben hat
(die Wortprüfung warnt vor Hinweisen auf Spieler, Leitstelle oder Simulation). Es gibt keine Betten-Zuteilung: nur ein Vorwort „wohnt schon in Haus N“
setzt einen Besitzer, alle anderen suchen sich selbst eine Bleibe (`agents/options.py`, `world/actions/needs.py`).
"""

from dataclasses import dataclass, field
from typing import Any

from ..agents.model import AgentProfile, Personality
from ..agents.schema import (TEMPLATE_FORMAT, TEMPLATE_VERSION, check_profile, check_story, profile_warnings, story_warnings, template_errors, unique_id)
from ..api.models_newsim import NewSimRequest
from ..generator.generate import default_mix
from ..generator.service import ServiceError, Wish, make_world
from ..generator.validate import Report
from ..world import loader

START_IDS = ("alex", "mira")                      # die Startwelt hat feste Zimmer nur für diese beiden
RESERVED = {"paths", "square", "garden", "lake", "forest"}
ROOMS_START = ["house.living", "house.kitchen", "house.workshop", "house.bedroom_a", "house.bedroom_b"]


class SpecError(Exception):
    """Der Entwurf ist nicht ausführbar; `errors` nennt jeden Fehler einzeln (deutsch, mit Bewohner und Feld)."""

    def __init__(self, errors: list[str], status: int = 422):
        super().__init__("; ".join(errors))
        self.errors, self.status = errors, status


@dataclass
class Resident:
    id: str
    profile: AgentProfile
    personality: Personality
    home: int | None
    known: list[str]
    voice: dict | None = None


@dataclass
class Resolved:
    kind: str
    residents: list[Resident]
    relations: dict[tuple[int, int], dict[str, float]]
    stories: dict[tuple[int, int], str]
    warnings: list[str] = field(default_factory=list)


def resolve(req: NewSimRequest) -> Resolved:
    """Prüft den Entwurf und vergibt die Kennungen. Wirft `SpecError` mit allen Fehlern."""
    errors: list[str] = []
    warnings: list[str] = []
    residents: list[Resident] = []
    start = req.world.kind == "start"
    taken: set[str] = set(RESERVED)
    for i, r in enumerate(req.residents, 1):
        errs = template_errors({"format": TEMPLATE_FORMAT, "version": TEMPLATE_VERSION, "profile": r.profile, "personality": r.personality})
        label = f"Bewohner {i}" + (f" ({r.profile['name']})" if isinstance(r.profile.get("name"), str) and r.profile["name"].strip() else "")
        if errs:
            errors += [f"{label}: {e}" for e in errs]
            continue
        profile, personality = AgentProfile(**r.profile), Personality(**r.personality)
        errs = check_profile(profile, personality)
        errors += [f"{label}: {e}" for e in errs]
        warnings += [f"{label}: {w}" for w in profile_warnings(profile)]
        if start:
            if r.template not in START_IDS:
                errors.append(f"{label}: Die Startwelt hat Zimmer nur für Alex und Mira. Für andere Vorlagen bitte ein neues Dorf erzeugen.")
                continue
            rid = r.template
            if rid in taken:
                errors.append(f"{label}: {rid.capitalize()} kommt in der Startwelt nur einmal vor.")
                continue
            taken.add(rid)
        else:
            rid = unique_id(profile.name, taken)
            taken.add(rid)
        residents.append(Resident(rid, profile.model_copy(update={"name": profile.name.strip()}), personality, None if start else r.home, list(r.known), r.voice.model_dump() if r.voice else None))
    n = len(req.residents)
    if not start:
        per_house: dict[int, int] = {}
        for r in req.residents:
            if r.home:
                per_house[r.home] = per_house.get(r.home, 0) + 1
        errors += [f"Haus {h}: höchstens 2 Personen je Haus (angegeben: {c})." for h, c in sorted(per_house.items()) if c > 2]
    rel: dict[tuple[int, int], dict[str, float]] = {}
    for x in req.relations:
        if x.a >= n or x.b >= n or x.a == x.b:
            errors.append(f"Beziehung {x.a + 1} → {x.b + 1}: unbekannte oder gleiche Bewohner.")
        else:
            rel[(x.a, x.b)] = {"trust": x.trust, "sympathy": x.sympathy, "tension": x.tension, "familiarity": x.familiarity}
    stories: dict[tuple[int, int], str] = {}
    for x in req.stories:
        text = x.text.strip()
        if x.a >= n or x.b >= n or x.a == x.b:
            errors.append(f"Vorgeschichte {x.a + 1} und {x.b + 1}: unbekannte oder gleiche Bewohner.")
        elif text:
            errors += check_story(text)
            warnings += [f"Vorgeschichte {x.a + 1} und {x.b + 1}: {w}" for w in story_warnings(text)]
            stories[(min(x.a, x.b), max(x.a, x.b))] = text
    if errors:
        raise SpecError(errors)
    return Resolved(req.world.kind, residents, rel, stories, warnings)


def make_new_world(req: NewSimRequest, res: Resolved) -> tuple[dict, Any]:
    """Die Weltdatei zum Entwurf: die Startwelt (nur mit den gewählten Bewohnern) oder ein erzeugtes Dorf nach Maß. Wirft `SpecError`."""
    if res.kind == "start":
        world = loader.load_world_file(loader.DEFAULT_WORLD)
        chosen = {r.id: r for r in res.residents}
        world["agents"] = [{**a, "name": chosen[a["id"]].profile.name} for a in world["agents"] if a["id"] in chosen]
        return world, Report()
    w, n = req.world, len(res.residents)
    mix = dict(w.mix) if w.mix is not None else {k: v for k, v in default_mix(n).items() if k != "house"}
    mix["house"] = w.houses or default_mix(n)["house"]
    try:
        wish = Wish("new", w.seed, w.lake, tuple(sorted(mix.items())), tuple((r.id, r.profile.name, r.home) for r in res.residents))
        return make_world(wish)
    except ServiceError as e:
        raise SpecError([e.text], e.status) from e
    except Exception as e:                                                  # GenerationError (z. B. Haus ohne freies Bett)
        raise SpecError([str(e)]) from e


def houses_of(world: dict) -> list[dict]:
    return list((world.get("generator") or {}).get("houses", []))


def places_for(res: Resident, world: dict) -> list[str]:
    """Orte, die der Bewohner zu Beginn kennt: aus den angehakten Kategorien (Platz, Garten, Gemeinschaftsräume, See, Wald), dazu sein vorgegebenes Haus."""
    gen = world.get("generator") or {}
    ids = {l["id"] for l in world["locations"]}
    rooms = gen.get("known") if gen else None
    common = [x for x in (rooms or ROOMS_START) if x not in ("square", "garden")]
    out: list[str] = []
    for k in res.known:
        out += {"square": ["square"], "garden": ["garden"], "rooms": common, "lake": ["lake"], "forest": ["forest"]}[k]
    if res.home and gen:
        prefix = next((h.get("prefix") for h in gen.get("houses", []) if h["n"] == res.home), None)
        out += [i for i in ids if prefix and i.startswith(prefix + "_")]
    return [p for p in dict.fromkeys(out) if p in ids]


def setup(fresh: Any, res: Resolved, world: dict) -> None:
    """Legt in der frischen Simulation Profile, Beziehungen, Vorgeschichten und Stimmen an (läuft in `Simulation.reset`, vor dem Austausch)."""
    st = fresh.engine.state
    for r in res.residents:
        fresh.store.create_profile(r.id, r.profile.model_copy(update={"known_places": places_for(r, world)}), r.personality)
    ids = [r.id for r in res.residents]
    with fresh.db.transaction():
        for (a, b), vals in res.relations.items():
            fresh.autonomy.relations.set_start(ids[a], ids[b], vals)
        before = max(0, st.minute - 1440)                                   # „schon vorher“: ein Tag vor dem Start
        for (a, b), text in res.stories.items():
            for me, other in ((a, b), (b, a)):
                fresh.memory.store.add(ids[me], "fact", text, 5, before, keywords=[res.residents[other].profile.name.lower()], persons=[ids[other]])
        voices = {r.id: r.voice for r in res.residents if r.voice}
        if voices:
            st.set_meta("voices", voices)
