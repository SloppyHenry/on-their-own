"""Wahrnehmung eines Agenten: nur, was er an seinem Ort sieht, am eigenen Körper spürt oder erlebt hat.

Verborgene Objekte erscheinen erst nach ihrer Entdeckung (`visible_to`). Über die Steuerungsart anderer
Figuren verrät nichts etwas: Menschen und KI-Agenten erscheinen gleich.
"""

import math
from dataclasses import dataclass, field
from typing import Any

from ..world import clock
from ..world.engine import WorldEngine
from ..world.models import AgentBody, WorldObject
from .conversation import ConversationManager
from .model import AgentModel
from .phrases import PHASE_DE, RES_DE, WEATHER_DE, direction_word, loc_at, third_person
from .store import AgentStore

VIEW_RADIUS = 8.0
HEARING = 4.0


def _word(value: float, steps: list[tuple[float, str]], default: str) -> str:
    for limit, word in steps:
        if value < limit:
            return word
    return default


def needs_words(needs: dict[str, float]) -> dict[str, str]:
    e, h, t = needs["energy"], needs["hunger"], needs["thirst"]
    mood_val = 70 - 0.2 * h - 0.2 * t - 0.2 * (100 - e)
    return {"energy": _word(e, [(20, "völlig erschöpft"), (40, "müde"), (70, "einigermaßen wach")], "ausgeruht"),
            "hunger": _word(h, [(30, "satt"), (55, "ein wenig hungrig"), (80, "hungrig")], "sehr hungrig"),
            "thirst": _word(t, [(30, "kein Durst"), (55, "etwas durstig"), (80, "durstig")], "sehr durstig"),
            "mood": _word(mood_val, [(35, "gedrückt"), (50, "etwas matt"), (65, "ausgeglichen")], "gut gelaunt")}


@dataclass
class Person:
    id: str
    name: str
    where: str
    activity: str
    distance: float
    in_hearing: bool


@dataclass
class Perception:
    agent: AgentModel
    body: AgentBody
    minute: int
    time_text: str
    weather: str
    phase: str
    location_id: str
    location_name: str
    location_at: str
    words: dict[str, str]
    inventory: list[str]
    objects: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    people: list[Person]
    memory: list[str]
    conversation: dict[str, Any] | None
    known_places: list[dict[str, Any]]
    unknown_exists: bool
    last_seen: dict[str, dict] = field(default_factory=dict)
    plan_next: str = ""
    recalled: list[str] = field(default_factory=list)       # abgerufene Erinnerungen (Langzeitgedächtnis)
    extra: dict[str, Any] = field(default_factory=dict)


def _object_note(o: WorldObject) -> str:
    s = o.state
    if o.kind == "plant":
        return f"Stufe {s['stage']} von 4, " + ("gegossen" if s["watered_at"] is not None else "trocken")
    if o.kind == "construction_site":
        return f"{round(100 * s['progress'] / max(1, s['total']))} % fertig"
    if o.kind in ("door",):
        return "verschlossen" if s["locked"] else "offen"
    if o.kind in ("fireplace", "firepit"):
        return "brennt" if s["lit"] else "aus"
    if o.kind in ("board", "desk"):
        return f"{len(s['notes'])} Notizen"
    return ""


def build(engine: WorldEngine, store: AgentStore, convs: ConversationManager, agent_id: str, memory_lines: int = 10) -> Perception:
    st = engine.state
    agent, body = store.get(agent_id), st.agent(agent_id)
    minute = engine.minute
    plants = {(o.x, o.y): o for o in st.objects_at(body.location_id) if o.kind == "plant"}
    objects = []
    for o in st.objects_at(body.location_id):
        if not o.visible_to(agent_id):
            continue
        note = _object_note(o)
        if o.kind == "seedbed":
            note = f"bepflanzt: {plants[(o.x, o.y)].name} ({_object_note(plants[(o.x, o.y)])})" if (o.x, o.y) in plants else "frei"
        if o.kind == "plant" and any(b.kind == "seedbed" and (b.x, b.y) == (o.x, o.y) for b in st.objects_at(body.location_id)):
            continue                                   # steht schon beim Beet
        objects.append({"id": o.id, "name": o.name, "kind": o.kind, "note": note, "pos": (o.x, o.y)})
    sources = [{"id": n.id, "resource": RES_DE.get(n.resource, n.resource), "available": n.amount >= 1, "tool": n.requires_tool}
               for n in st.nodes_at(body.location_id)]
    people = []
    for other in st.agents():
        if other.id == agent_id:
            continue
        d = math.dist(body.pos, other.pos)
        outdoors = not body.location_id.startswith("house.") and not other.location_id.startswith("house.")
        if other.location_id == body.location_id or (outdoors and d <= VIEW_RADIUS):   # Wände verdecken die Sicht
            act = third_person(st, other.name, other.action.type, other.action.params)[len(other.name) + 1:] if other.action and other.action.type != "recover" else "steht da"
            store.note_seen(agent_id, other.id, other.location_id, minute)
            people.append(Person(other.id, other.name, loc_at(st, other.location_id), act, round(d, 1), d <= HEARING or other.location_id == body.location_id))
    known = [l for l in st.locations.values() if agent_id in l.discovered_by and not l.props.get("fallback") and l.id != body.location_id]
    known_places = [{"id": l.id, "name": l.name, "direction": direction_word(body.pos, (l.rect[0] + l.rect[2] // 2, l.rect[1] + l.rect[3] // 2))} for l in known]
    unknown = [l for l in st.locations.values() if agent_id not in l.discovered_by and not l.props.get("fallback")]
    items = [f"{q}× {RES_DE.get(r, r)}" for r, q in sorted(body.inventory.items())] + [o.name for o in st.objects_held(agent_id)]
    memory = [f"{clock.fmt(m['sim_minute']).split(', ')[1]} {m['text']}" for m in store.recent_observations(agent_id, memory_lines)]
    w = st.weather()["kind"]
    return Perception(agent=agent, body=body, minute=minute,
                      time_text=f"{clock.fmt(minute)} ({clock.weekday(minute)}, {PHASE_DE[clock.phase(minute)]})",
                      weather=WEATHER_DE[w], phase=clock.phase(minute), location_id=body.location_id,
                      location_name=st.locations[body.location_id].name, location_at=loc_at(st, body.location_id),
                      words=needs_words(body.needs), inventory=items, objects=objects, sources=sources, people=people,
                      memory=memory, conversation=convs.view_for(agent_id), known_places=known_places,
                      unknown_exists=bool(unknown), last_seen=store.last_seen(agent_id), plan_next=agent.plan_next)
