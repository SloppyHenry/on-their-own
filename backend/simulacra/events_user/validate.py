"""Prüfung gegen den Weltzustand (§10.1 Schritt 4): Namen werden Kennungen, Grenzen werden erzwungen, jede Operation bekommt einen Klartext für die Vorschau.

Ergebnis ist entweder eine Fehlermeldung (abgelehnt), eine Rückfrage oder geprüfte Operationen. Das Modell kann hier nichts erfinden: was nicht im Katalog
steht oder nicht zur Welt passt, wird abgelehnt.
"""

import re
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from ..params.registry import REGISTRY as PARAMS
from ..world import clock, object_kinds
from ..world.state import WorldState
from . import times
from .lexicon import Lexicon, kind_of, norm
from .rules import Clarify, _when_options
from .schema import MAX_OPS, OP_NAMES, Op, parse_ops

MAX_NPCS = 3
MAX_SCHEDULED = 50
MAX_AHEAD = 14 * clock.MINUTES_PER_DAY


class Reject(Exception):
    def __init__(self, text: str):
        super().__init__(text)
        self.text = text


class NeedsAnswer(Exception):
    def __init__(self, clarify: Clarify):
        super().__init__(clarify.question)
        self.clarify = clarify


@dataclass
class Env:
    st: WorldState
    lex: Lexicon
    now: int
    mode: str
    pending_scheduled: int = 0
    npcs_active: int = 0
    extra_objects: int = 0                                      # in diesem Ereignis schon geplante neue Objekte


@dataclass
class Checked:
    ops: list[Op] = field(default_factory=list)
    preview: list[str] = field(default_factory=list)
    needs_confirmation: bool = False
    directive: bool = False


# --- Auflösung --------------------------------------------------------------------------------------------
def agent(env: Env, ref: str, ai_only: bool = False) -> str:
    key = norm(str(ref))
    aid = env.lex.agents.get(key) or (key if env.st.agent(key) else None)
    if aid is None or env.st.agent(aid) is None:
        raise Reject(f"Die Figur „{ref}“ gibt es nicht.")
    if ai_only and aid not in env.lex.ai:
        raise Reject(f"{env.lex.name_of(aid)} ist eine Nebenfigur und kann das nicht.")
    return aid


def location(env: Env, ref: str | None, op: int = 0, field_: str = "location", allow_group: bool = False) -> str | None:
    """Kennung eines Ortes (oder, mit `allow_group`, die Vorsilbe einer Gruppe wie „house“)."""
    if ref is None:
        return None
    key = str(ref)
    if key in env.lex.locations:
        return key
    if allow_group and any(i.startswith(key + ".") for i in env.lex.locations):
        return key
    hit = env.lex.location(key)
    if hit is None:
        raise Reject(f"Den Ort „{ref}“ gibt es nicht.")
    if len(hit.ids) > 1:
        raise NeedsAnswer(Clarify(f"{hit.label}: welcher Ort genau?", [{"label": env.lex.locations[i], "value": i} for i in hit.ids], op, field_))
    return hit.ids[0]


def locations_of(env: Env, ref: str) -> list[str]:
    return [i for i in env.lex.locations if i == ref or i.startswith(ref + ".")]


def kind(raw: str) -> str:
    k = str(raw)
    return k if k in object_kinds.KINDS else kind_of(k)


def _state(k: str, state: dict[str, Any]) -> dict[str, Any]:
    try:
        return object_kinds.normalize_state(k, state)
    except ValueError as e:
        raise Reject(str(e)) from None


def _names(env: Env, ids: list[str]) -> str:
    return " und ".join(env.lex.name_of(i) for i in ids)


def _loc_name(env: Env, lid: str | None) -> str:
    return env.lex.locations.get(lid, "dem Dorf") if lid else "dem Dorf"


def _mins(m: int) -> str:
    return f"{m // 1440} Tage" if m % 1440 == 0 and m >= 1440 else f"{m // 60} Std." if m % 60 == 0 and m >= 60 else f"{m} Min."


# --- je Operation ----------------------------------------------------------------------------------------------
def check_op(env: Env, raw: dict[str, Any], i: int, nested: bool = False) -> tuple[Op, list[str]]:
    name = raw.get("op")
    if name not in OP_NAMES:
        raise Reject(f"Die Operation „{name}“ gibt es nicht. Möglich sind: {', '.join(OP_NAMES)}.")
    if nested and name == "schedule":
        raise Reject("Ein geplantes Ereignis kann kein weiteres planen.")
    raw = dict(raw)
    fn = globals()[f"_c_{name}"]
    raw = fn(env, raw, i)
    try:
        op = parse_ops([raw])[0]
    except ValidationError as e:
        err = e.errors()[0]
        raise Reject(f"{name}: {'.'.join(str(x) for x in err['loc'][1:])} – {err['msg']}") from None
    return op, _preview(env, op)


def _c_set_weather(env, r, i):
    return r


def _c_spawn_object(env, r, i):
    r["kind"] = kind(r.get("kind", "item"))
    r["state"] = _state(r["kind"], dict(r.get("state") or {}))
    loc = location(env, r.get("location"), i)
    r["location"] = loc
    if loc is None and not r.get("tile"):
        raise Reject("Wo soll das Objekt entstehen? Ein Ort fehlt.")
    r["known_by"] = [agent(env, a) for a in r.get("known_by") or []]
    env.extra_objects += 1
    if env.st.object_count() + env.extra_objects > env.st.rules.max_objects:
        raise Reject(f"Die Welt kann höchstens {env.st.rules.max_objects} Objekte aufnehmen.")
    return r


def _c_give_object(env, r, i):
    r["kind"] = kind(r.get("kind", "item"))
    r["agent"] = agent(env, r["agent"], ai_only=True)
    if not object_kinds.KINDS[r["kind"]].portable:
        raise Reject(f"„{r.get('name')}“ lässt sich nicht tragen. Lass es stattdessen an einem Ort erscheinen.")
    return r


def _c_change_object(env, r, i):
    if r.get("object_id") and env.st.obj(r["object_id"]) is None:
        raise Reject(f"Das Objekt „{r['object_id']}“ gibt es nicht.")
    if r.get("kind"):
        r["kind"] = kind(r["kind"])
    if not r.get("kind") and not r.get("object_id"):
        raise Reject("Welches Objekt soll sich ändern? Eine Art oder Kennung fehlt.")
    r["location"] = location(env, r.get("location"), i, allow_group=True)
    target = [r["object_id"]] if r.get("object_id") else [o.id for o in env.st.all_objects() if o.kind == r["kind"] and _in(env, o, r.get("location"))]
    if not target:
        raise Reject("Dafür gibt es in der Welt kein passendes Objekt.")
    for oid in target:
        o = env.st.obj(oid)
        _state(o.kind, {**o.state, **r["changes"]})
    return r


def _in(env: Env, o, loc: str | None) -> bool:
    return loc is None or (o.location_id is not None and (o.location_id == loc or o.location_id.startswith(loc + ".")))


def _c_add_location(env, r, i):
    r["near"] = location(env, r["near"], i, "near") or ""
    if not re.match(r"^[\wäöüÄÖÜß '.-]{1,40}$", r["name"]):
        raise Reject("Der Name des Ortes enthält ungültige Zeichen.")
    if any(norm(r["name"]) == norm(n) for n in env.lex.locations.values()):
        raise Reject(f"Einen Ort „{r['name']}“ gibt es schon.")
    return r


def _c_change_resource(env, r, i):
    nodes = env.st.all_nodes()
    if r.get("resource") and not any(n.resource == r["resource"] for n in nodes):
        raise Reject(f"Die Ressource „{r['resource']}“ gibt es in dieser Welt nicht.")
    r["location"] = location(env, r.get("location"), i, allow_group=True)
    if not any((not r.get("resource") or n.resource == r["resource"]) and (not r.get("location") or (n.location_id or "").startswith(r["location"])) and n.cap < 900 for n in nodes):
        raise Reject("Dort gibt es keine Quelle, die sich ändern ließe (Wasserquellen sind unbegrenzt).")
    return r


def _c_inform(env, r, i):
    r["recipients"] = [agent(env, a, ai_only=True) for a in r.get("recipients") or []]
    if r.get("source"):
        key = norm(r["source"])
        r["source"] = env.lex.name_of(env.lex.agents[key]) if key in env.lex.agents else r["source"]
    return r


def _c_message(env, r, i):
    r["recipients"] = [agent(env, a, ai_only=True) for a in r.get("recipients") or []]
    s = r.get("sender") or ""
    if s and norm(s) in env.lex.agents:
        r["sender"] = env.lex.agents[norm(s)]
    r["location"] = location(env, r.get("location"), i)
    if r.get("invite") and r.get("when") is None:
        raise NeedsAnswer(Clarify("Die Einladung braucht einen Termin: wann?", _when_options(env.now), i, "when", free_text=True))
    if r.get("when") is not None and not env.now < int(r["when"]) <= env.now + MAX_AHEAD:
        raise Reject("Der Termin muss in der Zukunft liegen (höchstens 14 Tage).")
    return r


def _c_schedule(env, r, i):
    at = r.get("at")
    if not isinstance(at, int) or at <= env.now:
        raise NeedsAnswer(Clarify("Wann soll das stattfinden?", _when_options(env.now), i, "at", free_text=True))
    if at > env.now + MAX_AHEAD:
        raise Reject("Geplante Ereignisse dürfen höchstens 14 Tage in der Zukunft liegen.")
    if env.pending_scheduled >= MAX_SCHEDULED:
        raise Reject(f"Es sind schon {MAX_SCHEDULED} Ereignisse geplant. Sage zuerst welche ab.")
    inner = r.get("ops") or []
    if not inner or len(inner) > MAX_OPS:
        raise Reject(f"Ein geplantes Ereignis braucht 1 bis {MAX_OPS} Operationen.")
    r["ops"] = [check_op(env, o, i, nested=True)[0].model_dump(exclude_none=True) for o in inner]
    return r


def _c_spawn_npc(env, r, i):
    if env.npcs_active >= MAX_NPCS:
        raise Reject(f"Es sind schon {MAX_NPCS} Nebenfiguren im Dorf. Warte, bis eine geht.")
    env.npcs_active += 1
    if norm(r["name"]) in env.lex.agents:
        raise Reject(f"Eine Figur namens „{r['name']}“ gibt es schon.")
    r["location"] = location(env, r.get("location") or "square", i) if "square" in env.lex.locations or r.get("location") else None
    return r


def _c_situation(env, r, i):
    r["agents"] = [agent(env, a, ai_only=True) for a in r.get("agents") or []]
    loc = location(env, r.get("location"), i)
    if loc is None:
        where = {env.st.agent(a).location_id for a in r["agents"]}
        if len(where) != 1:
            raise NeedsAnswer(Clarify("Die Figuren sind an verschiedenen Orten: wo geschieht das?", [{"label": n, "value": k} for k, n in env.lex.locations.items()], i, "location"))
        loc = next(iter(where))
    r["location"] = loc
    if r.get("object_kind"):
        r["object_kind"] = kind(r["object_kind"])
        r["object_state"] = _state(r["object_kind"], dict(r.get("object_state") or {}))
        env.extra_objects += 1
    return r


def _directive(env: Env, name: str) -> None:
    if env.mode != "intervention":
        raise Reject("Direkte Anweisungen (Bewegen, Ziele vorschlagen, Parameter befristet ändern) sind nur im Eingriffsmodus erlaubt. Wechsle ihn unter Einstellungen → Modus.")


def _c_move_agent(env, r, i):
    _directive(env, "move_agent")
    r["agent"] = agent(env, r["agent"])
    r["location"] = location(env, r["location"], i)
    return r


def _c_suggest_goal(env, r, i):
    _directive(env, "suggest_goal")
    r["agent"] = agent(env, r["agent"], ai_only=True)
    return r


def _c_temp_param(env, r, i):
    _directive(env, "temp_param")
    spec = PARAMS.get(str(r["key"]))
    if spec is None or spec.scope != "global" or spec.locked:
        raise Reject(f"Der Parameter „{r['key']}“ lässt sich nicht befristet ändern.")
    from ..params.spec import validate as validate_param
    ok, val = validate_param(spec, r["value"])
    if not ok:
        raise Reject(f"{spec.label}: {val}")
    r["value"] = val
    return r


# --- Vorschau --------------------------------------------------------------------------------------------------
def _preview(env: Env, op: Op) -> list[str]:
    n = op.op
    if n == "set_weather":
        w = {"clear": "klar", "cloudy": "bewölkt", "rain": "Regen", "storm": "Sturm", "fog": "Nebel", "snow": "Schnee"}[op.weather]
        return [f"Das Wetter wechselt zu {w} für {_mins(op.duration_minutes)}; alle Figuren nehmen es wahr."]
    if n == "spawn_object":
        who = f"; {_names(env, op.known_by)} nimmt{'' if len(op.known_by) == 1 else 'en'} es wahr" if op.known_by else ""
        until = f" (verschwindet nach {_mins(op.duration_minutes)})" if op.duration_minutes else ""
        return [f"Objekt „{op.name}“ wird in {_loc_name(env, op.location)} erzeugt{until}{who}."]
    if n == "give_object":
        return [f"{env.lex.name_of(op.agent)} bekommt „{op.name}“ in den Besitz."]
    if n == "change_object":
        what = ", ".join(f"{k} → {v}" for k, v in op.changes.items())
        where = f" in {_loc_name(env, op.location)}" if op.location and op.location in env.lex.locations else " im Haus" if op.location == "house" else ""
        if "powered" in op.changes:
            word = "Der Strom kommt zurück" if op.changes["powered"] else "Der Strom fällt aus"
            return [f"{word}{where}; alle dort nehmen es wahr, der Herd funktioniert " + ("wieder." if op.changes["powered"] else "nicht mehr.") + (f" Nach {_mins(op.duration_minutes)} ist es vorbei." if op.duration_minutes else "")]
        return [f"{object_kinds.KINDS[op.kind].label if op.kind else op.object_id}{where}: {what}" + (f" für {_mins(op.duration_minutes)}" if op.duration_minutes else "") + "."]
    if n == "add_location":
        d = {"north": "nördlich", "south": "südlich", "east": "östlich", "west": "westlich"}[op.direction]
        return [f"Neuer Ort „{op.name}“ entsteht {d} von {_loc_name(env, op.near)}."]
    if n == "change_resource":
        res = op.resource or "alle Ressourcen"
        return [f"Vorräte ({res}{', ' + _loc_name(env, op.location) if op.location else ''}) werden mit Faktor {op.factor:g} verändert" + (f" für {_mins(op.duration_minutes)}" if op.duration_minutes else "") + "."]
    if n == "inform":
        return [f"{_names(env, op.recipients)} erfährt, dass {op.content.rstrip('.')} – nur sie/er (Quelle: {op.source or 'unbekannt'}, {'wahr' if op.truth == 'true' else 'Gerücht' if op.truth == 'rumor' else 'falsch'})."]
    if n == "message":
        extra = f" Termin: {clock.fmt(op.when)}." if op.when else ""
        return [f"{_names(env, op.recipients)} erhält {'eine Einladung' if op.invite else 'eine Nachricht'}: „{op.content}“.{extra}"]
    if n == "schedule":
        raw = [line for o in op.ops for line in _preview(env, parse_ops([o])[0])]
        inner = [f"{line} ({raw.count(line)}×)" if raw.count(line) > 1 else line for line in dict.fromkeys(raw)]
        return [f"Am {clock.fmt(op.at)}: " + " ".join(inner)] + ([f"Danach, nach {_mins(op.duration_minutes)}, ist es vorbei."] if op.duration_minutes else [])
    if n == "spawn_npc":
        return [f"Nebenfigur „{op.name}“ erscheint in {_loc_name(env, op.location)} (bleibt {_mins(op.stay_minutes)}; ohne eigenes Gedächtnis, antwortet kurz)."]
    if n == "situation":
        extra = f"; es gibt dort „{op.object_name or op.object_kind}“" if op.object_kind else ""
        return [f"Situation für {_names(env, op.agents)}: {op.description.rstrip('.')}{extra}."]
    if n == "move_agent":
        return [f"Eingriff: {env.lex.name_of(op.agent)} wird nach {_loc_name(env, op.location)} versetzt."]
    if n == "suggest_goal":
        return [f"Eingriff: {env.lex.name_of(op.agent)} bekommt das Ziel vorgeschlagen: „{op.text}“."]
    return [f"Eingriff: für {_mins(op.duration_minutes)} gilt {PARAMS[op.key].label} = {op.value}."]


def check(env: Env, raw_ops: list[dict[str, Any]]) -> Checked:
    """Alle Operationen prüfen. Wirft `Reject` (abgelehnt) oder `NeedsAnswer` (Rückfrage mit Auswahl)."""
    if not raw_ops:
        raise Reject("Daraus konnte ich kein Ereignis machen.")
    if len(raw_ops) > MAX_OPS:
        raise Reject(f"Ein Ereignis darf höchstens {MAX_OPS} Operationen enthalten (es sind {len(raw_ops)}).")
    out = Checked()
    for i, raw in enumerate(raw_ops):
        op, lines = check_op(env, raw, i)
        out.ops.append(op)
        out.preview += lines
        out.directive |= op.scope == "directive"
    out.needs_confirmation = (len(out.ops) > 1 or out.directive or any(o.op in ("add_location", "spawn_npc", "schedule") for o in out.ops)
                              or any(o.op == "schedule" and len(o.ops) > 1 for o in out.ops))
    return out


__all__ = ["Checked", "Env", "NeedsAnswer", "Reject", "check", "times"]
