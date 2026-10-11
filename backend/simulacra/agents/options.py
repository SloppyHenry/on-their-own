"""Optionsgenerator: alle jetzt gültigen Handlungen, bewertet und auf die besten K gekürzt.

Das Modell wählt nur aus dieser Liste (oder schlägt über `other` etwas vor, das die Engine prüft).
Jede Kandidatenhandlung wird per Trockenlauf (`engine.check`) auf Gültigkeit geprüft.
"""

import math
from typing import Any

from ..world import object_kinds
from ..world.engine import WorldEngine
from ..world.models import Accepted
from .perception import Perception
from .phrases import RES_DE, USE_OPTION, direction_word, loc_at, loc_to
from .scoring import Option, Tuning, score_option, select
from .store import AgentStore

PLACEHOLDER = "…"
USE_KIND = {"sleep": "sleep", "sit": "rest", "cook": "cook", "read": "read", "write": "write", "light": "light",
            "extinguish": "extinguish", "unlock": "unlock", "fish": "fish", "harvest": "harvest"}


def fmt_eta(minutes: int | None) -> str:
    if not minutes:
        return ""
    return f" (ca. {minutes} min)" if minutes < 90 else f" (ca. {round(minutes / 60)} Std.)"


def _cap(text: str) -> str:
    return text[:1].upper() + text[1:]


def generate(engine: WorldEngine, store: AgentStore, p: Perception) -> list[Option]:
    st, aid, body = engine.state, p.agent.id, p.body
    cands: list[Option] = []

    def add(kind: str, label: str, action: str, params: dict[str, Any], **kw: Any) -> None:
        cands.append(Option(kind, label, action, params, **kw))

    add("wait", "Abwarten und die Umgebung beobachten", "wait", {"minutes": 10})
    add("rest", "Sich ausruhen", "rest", {"minutes": 15})
    add("sleep", "Schlafen", "sleep", {})
    add("eat", "Etwas essen", "eat", {})
    add("drink", "Etwas trinken", "drink", {})
    # Wege: bekannte Orte, unbekannte Gebiete, Personen
    for k in p.known_places:
        dest = f"({'Richtung ' + k['direction'] if k['direction'] != 'ganz in der Nähe' else k['direction']})"
        add("move", f"{_cap(loc_to(st, k['id']))} gehen {dest}", "move_to", {"target": k["id"]}, target_loc=k["id"])
    unknown = sorted((l for l in st.locations.values() if aid not in l.discovered_by and not l.props.get("fallback")),
                     key=lambda l: math.dist(body.pos, (l.rect[0] + l.rect[2] / 2, l.rect[1] + l.rect[3] / 2)))
    for l in unknown[:2]:
        d = direction_word(body.pos, (l.rect[0] + l.rect[2] // 2, l.rect[1] + l.rect[3] // 2))
        add("explore", f"Ein noch unbekanntes Gebiet erkunden (Richtung {d})", "move_to", {"target": l.id}, target_loc=l.id)
    for person in p.people:
        if person.distance > 2.5:
            add("move", f"Zu {person.name} hinübergehen", "move_to", {"target": person.id})
    seen_ids = {x.id for x in p.people}
    social_spot = next((l.id for l in st.locations.values() if "social" in l.props.get("themes", []) and aid in l.discovered_by and l.id != p.location_id), None)
    for other in st.agents():
        if other.id != aid and other.id not in seen_ids:
            spot = p.last_seen.get(other.id, {}).get("loc") or social_spot
            if spot and spot != p.location_id:
                add("search", f"Nach {other.name} sehen ({'zuletzt gesehen ' + loc_at(st, spot) if other.id in p.last_seen else 'vielleicht ' + loc_at(st, spot)})",
                    "move_to", {"target": spot}, target_loc=spot, meta={"search": other.id})
    # Dinge am Ort
    done = {r["params"].get("object_id") for r in store.recent_actions(aid, 60) if r["action"] == "inspect"}
    held = st.objects_held(aid)
    objs = {o["id"]: st.obj(o["id"]) for o in p.objects}
    for o in objs.values():
        spec = object_kinds.spec(o.kind)
        if o.kind not in ("door", "seedbed", "plant", "construction_site") and o.id not in done:
            add("inspect", f"{o.name} genauer ansehen", "inspect", {"object_id": o.id}, meta={"object_kind": o.kind})
        if o.portable:
            add("take", f"{o.name} an sich nehmen", "take", {"object_id": o.id})
        for mode in spec.modes:
            kind = USE_KIND.get(mode)
            label = USE_OPTION.get((o.kind, mode))
            if kind and label and not (o.kind == "door" and mode != "unlock"):
                add(kind, label.format(obj=o.name), "use", {"object_id": o.id, "mode": mode},
                    utterance_key="text" if mode == "write" else None)
        if o.kind == "seedbed":
            add("plant", f"Samen in {o.name} pflanzen", "plant", {"seedbed_id": o.id})
        if o.kind == "plant":
            add("water", f"{o.name} gießen", "water", {"object_id": o.id})
        if o.kind == "construction_site":
            add("resume", f"Den Bau fortsetzen: {o.name}", "build", {"site_id": o.id}, meta={"bp_kind": engine.blueprints.get(o.state.get("blueprint", ""), {}).get("kind")})
    for n in st.nodes_at(p.location_id):
        if n.amount >= 1:
            add("gather", f"{RES_DE.get(n.resource, n.resource)} sammeln (2×)" + (f", braucht {n.requires_tool}" if n.requires_tool else ""),
                "gather", {"resource": n.resource, "amount": 2, "node": n.id})
    for bp_id, bp in engine.blueprints.items():
        cost = ", ".join(f"{max(1, math.ceil(q * st.rules.build_cost_mult))}× {RES_DE.get(r, r)}" for r, q in bp["cost"].items())
        add("build", f"{bp['name']} bauen (Kosten: {cost})", "build", {"blueprint": bp_id}, meta={"bp_kind": bp["kind"]})
    # Soziales
    conv = p.conversation
    for person in p.people:
        if not person.in_hearing:
            continue
        in_conv = conv is not None and conv["partner"] == person.id
        if in_conv:
            if conv["awaiting_reply"]:
                add("reply", f"{person.name} antworten", "speak", {"to": person.id}, utterance_key="text")
            if conv["turn_count"] > 0:
                add("end_talk", "Das Gespräch freundlich beenden (kurze Verabschiedung)", "speak", {"to": person.id}, utterance_key="text", meta={"end": True, "partner": person.id})
            if conv["open_proposal"] and conv["open_proposal"]["by"] == person.id:
                q = conv["open_proposal"]["text"]
                add("accept", f"Den Vorschlag annehmen: «{q}»", "speak", {"to": person.id}, utterance_key="text", meta={"respond": "accept", "partner": person.id})
                add("decline", f"Den Vorschlag ablehnen: «{q}»", "speak", {"to": person.id}, utterance_key="text", meta={"respond": "decline", "partner": person.id})
        elif conv is None:
            add("speak", f"Mit {person.name} ein Gespräch beginnen", "speak", {"to": person.id}, utterance_key="text", meta={"partner": person.id})
        for r, q in sorted(body.inventory.items()):
            add("give", f"{person.name} 1× {RES_DE.get(r, r)} geben", "give", {"to": person.id, "resource": r, "amount": 1})
        for h in held:
            add("give", f"{person.name} {h.name} geben", "give", {"to": person.id, "object_id": h.id})
    return cands


def build_options(engine: WorldEngine, store: AgentStore, p: Perception, tuning: Tuning) -> list[Option]:
    """Gültige, bewertete und gekürzte Optionen mit Kennungen o1..oK."""
    valid: dict[tuple[str, str], Option] = {}
    for o in generate(engine, store, p):
        probe = {**o.params, **({o.utterance_key: PLACEHOLDER} if o.utterance_key else {})}
        res = engine.check(p.agent.id, o.action, probe)
        if not isinstance(res, Accepted) or (o.key, o.kind) in valid:
            continue
        if o.action == "move_to":
            path = res.data.get("path", [])
            o.eta = sum(engine.state.grid.cost(*t) for t in path) or None
        else:
            o.eta = res.duration
        if o.eta and o.kind not in ("wait",):
            o.label += fmt_eta(o.eta)
        valid[(o.key, o.kind)] = o
    recent = store.recent_actions(p.agent.id, 8)
    st_locs = engine.state.locations
    locks = p.ctx.locks if p.ctx is not None else {}
    for key in [k for k, o in valid.items() if locks.get(o.key, 0) > p.minute and o.kind not in ("reply", "end_talk", "accept", "decline")]:
        if len(valid) > 3:
            del valid[key]                                       # gesperrte Aktion (Wiederholungsschutz) wird gar nicht erst angeboten
    for o in valid.values():
        indoors = (o.target_loc or p.location_id).startswith("house.")
        loc = st_locs.get(o.target_loc or p.location_id)
        score_option(o, p, p.agent.personality, recent, tuning, indoors, loc.props.get("themes", []) if loc else None)
    return select(list(valid.values()), p, tuning)
