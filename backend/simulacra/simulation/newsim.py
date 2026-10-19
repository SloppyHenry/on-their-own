"""Neue Simulation aus einem Entwurf des Assistenten (AP17b): prüfen, Welt bauen, Bewohner, Beziehungen und Vorgeschichte anlegen.

Für die Bewohner ist das Dorf „schon immer da“ (Frage 36): nichts hier erzeugt ein Ereignis oder einen Prompt-Text über den Assistenten. Startwerte der
Beziehungen stehen einfach in der Tabelle; eine Vorgeschichte ist eine gewöhnliche Erinnerung der Art Fakt, so formuliert, wie der Mensch sie geschrieben hat
(die Wortprüfung warnt vor Hinweisen auf Spieler, Leitstelle oder Simulation). Es gibt keine Betten-Zuteilung: nur ein Vorwort „wohnt schon in Haus N“
setzt einen Besitzer, alle anderen suchen sich selbst eine Bleibe (`agents/options.py`, `world/actions/needs.py`).
"""

from dataclasses import dataclass, field
from typing import Any

from ..agents.model import AgentProfile, Personality
from ..agents.schema import (MAX_RESIDENTS, TEMPLATE_FORMAT, TEMPLATE_VERSION, check_profile, check_story, profile_warnings, story_warnings, template_errors, unique_id)
from ..api.models_newsim import NewSimRequest
from ..generator.generate import default_mix
from ..generator.service import ServiceError, Wish, make_world
from ..generator.validate import Report
from ..params.presets import PresetError
from ..params.registry import REGISTRY
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


GLOBAL_PRESET_SCOPE = "global"                    # aus einem Preset gelten nur allgemeine Werte: Persönlichkeit und Profil je Bewohner kommen aus dem Entwurf


@dataclass
class Resolved:
    kind: str
    residents: list[Resident]
    relations: dict[tuple[int, int], dict[str, float]]
    stories: dict[tuple[int, int], str]
    warnings: list[str] = field(default_factory=list)
    params: list[tuple[str, None, Any]] = field(default_factory=list)      # Parameter, die beim Anlegen gesetzt werden (Preset, Autonomie, Knappheit, Modus)


def resolve(req: NewSimRequest, presets: Any = None) -> Resolved:
    """Prüft den Entwurf und vergibt die Kennungen. Wirft `SpecError` mit allen Fehlern. `presets`: der `PresetManager` der laufenden Simulation (für die Preset-Wahl)."""
    errors: list[str] = []
    if not 1 <= len(req.residents) <= MAX_RESIDENTS:
        raise SpecError([f"Eine Simulation braucht 1 bis {MAX_RESIDENTS} Bewohner (angegeben: {len(req.residents)})."])
    if len(req.rules.events) > 5 or any(not 1 <= len(e.ops) <= 5 for e in req.rules.events):
        raise SpecError(["Höchstens 5 Startereignisse mit je 1 bis 5 Operationen."])
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
    params: list[tuple[str, None, Any]] = []
    rules = req.rules
    if rules.preset:
        try:
            for key, value in (presets.get(rules.preset)["data"] if presets is not None else {}).items():
                spec = REGISTRY.get(key)
                if spec is not None and not spec.locked and spec.scope == GLOBAL_PRESET_SCOPE:
                    params.append((key, None, value))
        except PresetError as e:
            errors.append(f"Preset: {e}")
    for key, value in (("autonomy", rules.autonomy), ("world.scarcity", rules.scarcity)):
        if value is not None:
            params.append((key, None, value))
    params.append(("mode", None, rules.mode))
    if rules.creator_text is not None and rules.creator_text.strip():
        params.append(("mode.creator_text", None, rules.creator_text.strip()))
    if errors:
        raise SpecError(errors)
    return Resolved(req.world.kind, residents, rel, stories, warnings, params)


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
    fresh.params.restore(res.params, persist=True)                          # Preset, Autonomie, Knappheit, Beobachtungsmodus: wie gespeicherte Einstellungen, ohne Ereignis
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


# --- Weltregeln als Startereignisse ---------------------------------------------------------------------------------------------------

def preview_sim(sim: Any, res: Resolved, world: dict) -> Any:
    """Wegwerf-Simulation im Speicher mit der Welt, den Bewohnern und den Regeln des Entwurfs: darauf werden Weltregeln geprüft (Vorschau, Rückfragen), ohne die laufende Welt anzufassen."""
    from ..simulation.builder import Simulation
    tmp = Simulation.create(sim.settings, ":memory:", sim.provider, world=world)
    tmp.store.ensure_all()
    setup(tmp, res, world)
    return tmp


def run_start_event(sim: Any, ev: dict) -> None:
    """Führt ein bestätigtes Startereignis aus (DB-Thread): wie jede Eingabe wird es noch einmal gegen die Welt geprüft. Wirft `SpecError` mit dem Grund."""
    service = sim.inject
    pid = service._record(ev["text"], "ready", ev.get("source", "rule"), ev["ops"])["id"]
    out = service.confirm(pid)
    if out["status"] != "executed":
        raise SpecError([f"Startereignis „{ev['text'][:60]}“: {out['reason'] or 'nicht möglich'}"])


def check_start_events(tmp: Any, events: list[dict]) -> None:
    """Probelauf aller Startereignisse in der Wegwerf-Simulation (DB-Thread), bevor die laufende Welt ersetzt wird."""
    errors: list[str] = []
    for ev in events:
        try:
            run_start_event(tmp, ev)
        except SpecError as e:
            errors += e.errors
    if errors:
        raise SpecError(errors)
