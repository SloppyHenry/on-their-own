"""Regelparser (§10.1): deterministische Muster für häufige Eingaben auf Deutsch. Trifft eine Regel sicher zu, wird das Sprachmodell nicht gefragt.

Jede Regel liefert Operationen als Wörterbücher (Kennungen schon aufgelöst) oder eine Rückfrage; geprüft wird erst danach in `validate.py`.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Callable

from ..world import clock
from . import times
from .lexicon import ANIMALS, KIND_WORDS, PLACE_WORDS, RESOURCES, WEATHER_WORDS, Lexicon, LocationHit, clean_phrase, kind_of, norm, pat

PREP = r"(?:in|im|ins|am|an|auf|bei|unter|hinter|neben|vor|zu|zum|zur)"


@dataclass
class Clarify:
    question: str
    options: list[dict[str, Any]]                 # [{label, value}]
    op: int = 0                                   # Index der Operation, deren Feld die Antwort setzt
    field: str = ""
    free_text: bool = False


@dataclass
class Parsed:
    rule: str
    ops: list[dict[str, Any]]
    clarify: Clarify | None = None
    note: str = ""


@dataclass
class Ctx:
    lex: Lexicon
    now: int
    where: dict[str, str] = field(default_factory=dict)       # Agent -> aktueller Ort
    rooms: list[str] = field(default_factory=list)


Rule = Callable[[str, Ctx], Parsed | None]


def _loc_clarify(hit: LocationHit, ctx: Ctx, op: int, field_: str = "location", who: str | None = None) -> tuple[str | None, Clarify | None]:
    """Ein eindeutiger Ort, oder eine Rückfrage („im Haus“: welcher Raum?). Steht der genannte Agent schon in einem passenden Raum, gilt dieser."""
    if len(hit.ids) == 1:
        return hit.ids[0], None
    if who and ctx.where.get(who) in hit.ids:
        return ctx.where[who], None
    return None, Clarify(f"{hit.label}: welcher Ort genau?", [{"label": ctx.lex.locations[i], "value": i} for i in hit.ids], op, field_)


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def _split_prep(rest: str) -> tuple[str, str]:
    m = re.match(rf"^(?P<what>.+?)\s+{PREP}\s+(?P<where>.+)$", rest, re.I)
    return (m.group("what"), m.group("where")) if m else (rest, "")


# --- Anweisungen (nur im Eingriffsmodus erlaubt, geprüft in validate.py) --------------------------------
def r_move(text: str, c: Ctx) -> Parsed | None:
    m = (re.match(r"^(?:bewege|bringe|schicke|setze|stelle)\s+(?P<who>\w+)\s+(?:zu|zum|zur|in|ins|an|nach|auf)\s+(?P<where>.+)$", text, re.I)
         or re.match(r"^(?P<who>\w+)\s+soll\s+(?:zu|zum|zur|in|ins|an|nach|auf)\s+(?P<where>.+?)\s+gehen$", text, re.I))
    who = c.lex.agent_ids(m.group("who")) if m else []
    hit = c.lex.location(m.group("where")) if m else None
    if not (m and len(who) == 1 and hit):
        return None
    loc, ask = _loc_clarify(hit, c, 0)
    return Parsed("move_agent", [{"op": "move_agent", "agent": who[0], "location": loc}], ask)


def r_suggest(text: str, c: Ctx) -> Parsed | None:
    m = (re.match(r"^(?:schlage|empfehle)\s+(?P<who>\w+)\s+vor,?\s+(?P<what>.+)$", text, re.I) or re.match(r"^(?P<who>\w+)\s+soll\s+(?P<what>.+)$", text, re.I))
    who = c.lex.agent_ids(m.group("who")) if m else []
    if not (m and len(who) == 1):
        return None
    return Parsed("suggest_goal", [{"op": "suggest_goal", "agent": who[0], "text": clean_phrase(m.group("what"))[:200]}])


def r_temp(text: str, c: Ctx) -> Parsed | None:
    m = re.search(r"\b(?:ist|läuft|vergeht)\s+(?:alles|die\s+zeit)\s+(doppelt|dreimal|dreifach|fünfmal)\s+so\s+schnell\b", text, re.I)
    if not m:
        return None
    factor = {"doppelt": 2, "dreimal": 3, "dreifach": 3, "fünfmal": 5}[norm(m.group(1))]
    return Parsed("temp_param", [{"op": "temp_param", "key": "world.minutes_per_tick", "value": factor, "duration_minutes": times.duration(text) or 60}])


# --- Zeit und Veranstaltungen --------------------------------------------------------------------------
EVENT_STUFF = {"markt": [("table", "Marktstand"), ("table", "Marktstand")], "fest": [("table", "Festtafel")], "feier": [("table", "Festtafel")], "party": [("table", "Festtafel")]}


def r_event(text: str, c: Ctx) -> Parsed | None:
    m = re.search(r"\bfindet\s+(?:\w+\s+)?(?:(?:ein|eine)\s+)?(?P<what>\w+)\s+statt\b", text, re.I) or re.search(r"\bfindet\s+.*?(?:ein|eine)\s+(?P<what>\w+)\s+statt\b", text, re.I)
    if not m:
        return None
    what = m.group("what")
    hit = c.lex.location(text)
    at = times.moment(text, c.now, (10, 0))
    loc, ask = (None, Clarify("Wo findet das statt?", [{"label": n, "value": i} for i, n in c.lex.locations.items()], 0, "location")) if hit is None else _loc_clarify(hit, c, 0)
    ops = [{"op": "spawn_object", "kind": k, "name": n, "location": loc} for k, n in EVENT_STUFF.get(norm(what), [])]
    ops = ops or [{"op": "spawn_object", "kind": "board", "name": f"Aushang: {what.title()}", "location": loc}]
    label = f"{what.title()} ({hit.label})" if hit else what.title()
    p = Parsed("event", [{"op": "schedule", "at": at or 0, "ops": ops, "label": label, "duration_minutes": 480 if norm(what) == "markt" else 360}], ask)
    if at is None:
        p.clarify = Clarify(f"{what.title()}: wann?", _when_options(c.now), 0, "at", free_text=True)
    return p


def _when_options(now: int) -> list[dict[str, Any]]:
    d = clock.day_of(now)
    out = [("Heute Abend (18:00)", clock.at(d, 18)), ("Morgen Vormittag (10:00)", clock.at(d + 1, 10)), ("Morgen Abend (18:00)", clock.at(d + 1, 18)), ("Übermorgen (12:00)", clock.at(d + 2, 12))]
    return [{"label": l, "value": v} for l, v in out if v > now]


# --- Nachrichten und Wissen ------------------------------------------------------------------------------
def r_message(text: str, c: Ctx) -> Parsed | None:
    m = re.match(r"^(?P<who>.+?)\s+(?:erhält|bekommt|kriegt|erhalten|bekommen)\s+(?P<what>(?:eine|einen|ein)\s+(?:einladung|nachricht|brief|botschaft|post)\b.*)$", text, re.I)
    who = c.lex.agent_ids(m.group("who")) if m else []
    if not (m and who):
        return None
    what = m.group("what").rstrip(" .!")
    invite = bool(re.search(r"einladung|fest|feier|party|treffen", what, re.I))
    at = times.moment(text, c.now, None)
    hit = c.lex.location(what)
    op = {"op": "message", "recipients": who, "content": _cap(re.sub(r"^(?:eine|einen|ein)\s+", "", what, flags=re.I)), "sender": "Brief", "invite": invite, "when": at, "location": hit.ids[0] if hit and len(hit.ids) == 1 else None}
    ask = Clarify("Die Einladung braucht einen Termin: wann?", _when_options(c.now), 0, "when", free_text=True) if invite and at is None else None
    return Parsed("message", [op], ask)


def r_inform(text: str, c: Ctx) -> Parsed | None:
    m = (re.match(r"^(?P<who>.+?)\s+(?:erfährt|erfahren|hört|hören)(?:\s+(?:von|durch)\s+(?P<src>\w+))?,?\s+dass\s+(?P<what>.+)$", text, re.I)
         or re.match(r"^(?:sage|sag|erzähle|teile)\s+(?P<who>\w+)\s*(?:mit)?,?\s+dass\s+(?P<what>.+)$", text, re.I))
    who = c.lex.agent_ids(m.group("who")) if m else []
    if not (m and who):
        return None
    what = m.group("what").strip(" .!")
    src = c.lex.agent_ids(m.groupdict().get("src") or "")
    truth = "rumor" if re.search(r"gerücht|angeblich", text, re.I) else "true"
    return Parsed("inform", [{"op": "inform", "recipients": who, "content": what[:300], "source": c.lex.name_of(src[0]) if src else "", "truth": truth}])


# --- Welt ------------------------------------------------------------------------------------------------
def r_situation(text: str, c: Ctx) -> Parsed | None:
    m = re.match(r"^(?P<who>.+?)\s+(?:entdecken|finden|sehen|bemerken|stoßen auf)\s+(?P<what>.+?)\.?$", text, re.I)
    who = c.lex.agent_ids(m.group("who")) if m else []
    if not (m and len(who) >= 2):
        return None
    what = m.group("what")
    kind = kind_of(what)
    where = {c.where.get(a) for a in who}
    if len(where) > 1 and all((w or "").startswith("house.") for w in where):
        where = {"house.living"}                                    # beide im Haus: sie finden es im Wohnzimmer
    ops = [{"op": "situation", "agents": who, "description": f"{' und '.join(c.lex.name_of(a) for a in who)} entdecken {what.strip()}",
            "object_kind": kind if kind != "item" else None, "object_state": {"locked": True} if "verschlossen" in norm(what) and kind == "door" else {},
            "object_name": clean_phrase(what) if kind != "item" else None, "location": next(iter(where)) if len(where) == 1 else None}]
    ask = None
    if len(where) > 1:
        ask = Clarify("Die beiden sind an verschiedenen Orten: wo entdecken sie das?", [{"label": c.lex.locations.get(i, i), "value": i} for i in c.lex.locations if not i.startswith("house.") or i in where], 0, "location")
    return Parsed("situation", ops, ask)


def r_find(text: str, c: Ctx) -> Parsed | None:
    m = re.match(r"^(?P<who>\w+)\s+(?P<verb>findet|entdeckt|bemerkt|erhält|bekommt|stößt auf)\s+(?P<rest>.+?)\.?$", text, re.I)
    who = c.lex.agent_ids(m.group("who")) if m else []
    if not (m and len(who) == 1):
        return None
    what, where = _split_prep(m.group("rest"))
    name = clean_phrase(what)
    kind = kind_of(name)
    agent = who[0]
    if norm(m.group("verb")) in ("erhält", "bekommt"):
        return Parsed("give", [{"op": "give_object", "kind": kind, "name": name, "agent": agent}])
    hit = c.lex.location(where) if where else None
    loc, ask = (_loc_clarify(hit, c, 0, "location", agent) if hit else (c.where.get(agent), None))
    return Parsed("find", [{"op": "spawn_object", "kind": kind, "name": name, "location": loc, "hidden": True, "known_by": [agent]}], ask)


def r_appear(text: str, c: Ctx) -> Parsed | None:
    m = re.match(rf"^(?P<where>{PREP}\s+.+?)\s+(?:taucht|erscheint|liegt|steht)\s+(?P<what>.+?)(?:\s+(?:auf|da|dort|herum))?$", text.rstrip(". "), re.I) or re.match(
        rf"^(?P<where>{PREP}\s+.+?)\s+wird\s+(?P<what>.+?)\s+(?:entdeckt|gefunden|sichtbar|aufgestellt)$", text.rstrip(". "), re.I)
    hit = c.lex.location(m.group("where")) if m else None
    if not (m and hit) or any(pat(w).search(norm(m.group("what"))) for w in PLACE_WORDS):
        return None                                           # ein neuer Ort ist kein Gegenstand (siehe r_location)
    what = m.group("what")
    loc, ask = _loc_clarify(hit, c, 0)
    name = clean_phrase(what)
    if any(pat(a).search(norm(what)) for a in ANIMALS):
        return Parsed("animal", [{"op": "spawn_npc", "name": name, "description": f"{name}, aufgetaucht {('im ' + hit.label) if loc else ''}".strip(), "location": loc, "stay_minutes": 240}], ask)
    return Parsed("appear", [{"op": "spawn_object", "kind": kind_of(name), "name": name, "location": loc}], ask)


def r_npc(text: str, c: Ctx) -> Parsed | None:
    m = re.match(r"^(?P<what>(?:ein|eine)\s+\w+(?:\s+\w+)?)\s+(?:zieht|kommt|erscheint)\s+(?:in|ins|zu|nach|im)\s+(?P<where>.+?)(?:\s+(?:an|ein|auf))?\.?$", text, re.I)
    if not m or any(re.search(rf"(?<![\wäöüß]){w}", norm(m.group("what"))) for ws in WEATHER_WORDS.values() for w in ws):
        return None
    name = clean_phrase(m.group("what"))
    hit = c.lex.location(m.group("where") or "")
    loc, ask = (_loc_clarify(hit, c, 0) if hit else ("square", None))
    return Parsed("npc", [{"op": "spawn_npc", "name": name, "description": f"{name}, neu im Dorf", "location": loc, "stay_minutes": 3 * 1440}], ask)


def r_power(text: str, c: Ctx) -> Parsed | None:
    t = norm(text)
    if "strom" not in t:
        return None
    off = bool(re.search(r"fällt\s+(?:\w+\s+)?aus|ausfall|weg|ausgefallen|abgeschaltet|aus$", t))
    back = bool(re.search(r"wieder\s+(?:da|an|verfügbar)|kehrt\s+zurück|ist\s+zurück", t))
    if not (off or back):
        return None
    hit = c.lex.location(text)
    houses = [i for i in c.lex.locations if i.startswith("house.")]
    loc = hit.ids[0] if hit and len(hit.ids) == 1 else None
    return Parsed("power", [{"op": "change_object", "kind": "stove", "location": loc or "house", "changes": {"powered": bool(back)}, "duration_minutes": times.duration(text)}],
                  None, note="" if houses else "kein Haus")


def r_resources(text: str, c: Ctx) -> Parsed | None:
    t = norm(text)
    low = re.search(r"\b(knapp|rar|selten|wenig)\b", t)
    high = re.search(r"\b(reichlich|überfluss|ergiebig|üppig)\b", t)
    word = re.search(r"\b(ressourcen|holz|nahrung|essen|steine?|samen|saatgut|lebensmittel)\b", t)
    if not (word and (low or high)):
        return None
    res = next((k for k, ws in RESOURCES.items() if any(w in t for w in ws)), None)
    hit = c.lex.location(text)
    return Parsed("resources", [{"op": "change_resource", "resource": res, "location": hit.ids[0] if hit and len(hit.ids) == 1 else None,
                                 "factor": 0.3 if low else 1.6, "duration_minutes": times.duration(text)}])


def r_weather(text: str, c: Ctx) -> Parsed | None:
    t = norm(text)
    kind = next((k for k, ws in WEATHER_WORDS.items() if any(re.search(rf"(?<![\wäöüß]){w}", t) for w in ws)), None)
    if not kind or re.search(r"\b(findet|entdeckt|taucht)\b", t):
        return None
    dur = times.duration(text) or 240
    at = times.moment(text, c.now, (8, 0))
    op = {"op": "set_weather", "weather": kind, "duration_minutes": dur}
    if at is not None:
        return Parsed("weather", [{"op": "schedule", "at": at, "ops": [op], "label": f"Wetter: {kind}"}])
    return Parsed("weather", [op])


def r_location(text: str, c: Ctx) -> Parsed | None:
    m = re.match(r"^(?P<prep>hinter|vor|neben|nördlich von|südlich von|östlich von|westlich von|nördlich|südlich|östlich|westlich)\s+(?:dem|der|den|das)?\s*(?P<anchor>.+?)\s+liegt\s+(?P<what>.+?)\.?$", text, re.I)
    hit = c.lex.location(m.group("anchor")) if m else None
    if not (m and hit and len(hit.ids) == 1) or not any(pat(w).search(norm(m.group("what"))) for w in PLACE_WORDS):
        return None
    prep = norm(m.group("prep"))
    direction = next((d for w, d in (("nördlich", "north"), ("südlich", "south"), ("östlich", "east"), ("westlich", "west")) if prep.startswith(w)), None)
    op = {"op": "add_location", "name": clean_phrase(m.group("what")), "near": hit.ids[0], "direction": direction or "north"}
    ask = None if direction else Clarify(f"„{text[:text.lower().index(' liegt')]}“: in welcher Himmelsrichtung?", [{"label": l, "value": v} for l, v in (("Norden", "north"), ("Süden", "south"), ("Osten", "east"), ("Westen", "west"))], 0, "direction")
    return Parsed("location", [op], ask)


RULES: list[Rule] = [r_move, r_suggest, r_temp, r_event, r_message, r_inform, r_situation, r_find, r_appear, r_npc, r_power, r_resources, r_location, r_weather]


def parse(text: str, ctx: Ctx) -> Parsed | None:
    """Die erste Regel, die sicher zutrifft."""
    t = re.sub(r"\s+", " ", text.strip())
    for rule in RULES:
        got = rule(t, ctx)
        if got is not None:
            return got
    return None


__all__ = ["Clarify", "Ctx", "Parsed", "parse", "KIND_WORDS"]
