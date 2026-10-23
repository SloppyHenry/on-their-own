"""Aufbau von Zustandsabzug und Detailansichten aus der Simulation. Läuft auf dem DB-Thread (`db.run`)."""

import json
from typing import Any

from ..agents.perception import needs_words
from ..events.schema import to_out
from ..events.store import EventStore
from ..simulation import mitleben
from ..simulation.builder import Simulation
from ..world import spielart
from ..world import clock
from ..world.voices import voices
from .models import (ActionInfo, AgentDetail, AgentInfo, ClockInfo, DecisionBrief, LocationDetail, LocationInfo, MapData, ObjectInfo,
                     ObservationBrief, ProfileBrief, ResourceInfo, SimStatus, StateSnapshot, TileTypeInfo, WalkInfo, WeatherInfo)

from ..params.specs_sim import SPEEDS as SPEED_LEVELS
SPARE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!$%&*"


def speed_level(delay: float) -> str:
    return next((k for k, v in SPEED_LEVELS.items() if abs(v - delay) < 1e-9), "custom")


def _map(sim: Simulation) -> tuple[MapData, dict[str, TileTypeInfo]]:
    """Karte als Zeichenzeilen; Kachelarten ohne eigenes Zeichen bekommen ein freies aus dem Vorrat."""
    st = sim.engine.state
    used = {t.char for t in st.tile_types.values() if t.char}
    spare = iter(c for c in SPARE_CHARS if c not in used)
    char_of = {t.id: (t.char or next(spare)) for t in st.tile_types.values()}
    g = st.grid
    rows = ["".join(char_of[g.tile(x, y)] for x in range(g.width)) for y in range(g.height)]
    types = {t.id: TileTypeInfo(char=char_of[t.id], walkable=t.walkable, cost=t.cost, color=t.color, label=t.label) for t in st.tile_types.values()}
    return MapData(width=g.width, height=g.height, rows=rows, legend={c: i for i, c in char_of.items()}), types


def agent_info(sim: Simulation, a) -> AgentInfo:
    st, store = sim.engine.state, sim.store
    model = store.get(a.id)
    held = [o.name for o in st.objects_held(a.id)]
    action = ActionInfo(type=a.action.type, params=a.action.params, started_at=a.action.started_at, ends_at=a.action.ends_at) if a.action else None
    d = a.action.data if a.action else {}
    walk = WalkInfo(path=d["path"], arrive=d["arrive"]) if d.get("path") and d.get("arrive") else None
    prof = ProfileBrief(name=model.profile.name, gender=model.profile.gender, age=model.profile.age, goals=model.profile.goals) if model else None
    return AgentInfo(id=a.id, name=a.name, x=a.x, y=a.y, location_id=a.location_id, facing=a.facing, capacity=a.capacity, action=action, walk=walk,
                     status=model.status if model else "idle", needs={k: round(v, 1) for k, v in a.needs.items()}, words=needs_words(a.needs),
                     inventory=a.inventory, held=held, profile=prof, plan_next=model.plan_next if model else "")


def sim_status(sim: Simulation) -> SimStatus:
    r = sim.runner
    return SimStatus(state=r.state.value, tick_delay_s=r.tick_delay_s, speed_level=speed_level(r.tick_delay_s),
                     stats=r.stats.summary(), llm=sim.client.metrics.summary())


def snapshot(sim: Simulation) -> StateSnapshot:
    st = sim.engine.state
    map_data, types = _map(sim)
    w = st.weather()
    return StateSnapshot(
        seq=EventStore(st.conn).last_seq(), world_name=st.get_meta("world_name", ""), map=map_data, tile_types=types,
        locations=[LocationInfo(id=l.id, name=l.name, rect=list(l.rect), entrances=[list(e) for e in l.entrances], props=l.props, discovered_by=l.discovered_by)
                   for l in st.locations.values()],
        objects=[ObjectInfo(**o.model_dump(exclude={"created_by", "created_at"})) for o in st.all_objects()],
        resources=[ResourceInfo(**n.model_dump(include={"id", "location_id", "x", "y", "resource", "amount", "cap", "requires_tool", "label"})) for n in st.all_nodes()],
        agents=[agent_info(sim, a) for a in st.agents()], clock=ClockInfo(**clock.snapshot(st.minute)),
        weather=WeatherInfo(**w), simulation=sim_status(sim), rules=st.rules.model_dump(),
        links=st.get_meta("links") or [], look=st.get_meta("look"), voices=voices(st), play_mode=spielart.get(st),
        player=mitleben.player_id(st), player_autopilot=mitleben.autopilot_on(st))


def agent_detail(sim: Simulation, agent_id: str) -> AgentDetail | None:
    st, store = sim.engine.state, sim.store
    body = st.agent(agent_id)
    if body is None:
        return None
    base = agent_info(sim, body)
    model = store.get(agent_id)
    decisions = [DecisionBrief(id=d["id"], sim_minute=d["sim_minute"], status=d["status"], chosen=d["chosen"], action=d["action"], intent=d["intent"],
                               outcome=d["outcome"], outcome_text=d["outcome_text"], options=d["options"]) for d in store.decisions(agent_id, 10)]
    obs = [ObservationBrief(sim_minute=o["sim_minute"], kind=o["kind"], text=o["text"], importance=o["importance"]) for o in store.recent_observations(agent_id, 15)]
    return AgentDetail(**base.model_dump(), profile_full=model.profile.model_dump() if model else None,
                       personality=model.personality.model_dump() if model else None, mood=base.words["mood"], decisions=decisions, observations=obs,
                       conversation=sim.convs.view_for(agent_id) if model else None, last_seen=store.last_seen(agent_id))


def location_detail(sim: Simulation, location_id: str) -> LocationDetail | None:
    st = sim.engine.state
    loc = st.locations.get(location_id)
    if loc is None:
        return None
    events = EventStore(st.conn).fetch(location=location_id, limit=20, order="desc")
    return LocationDetail(location=LocationInfo(id=loc.id, name=loc.name, rect=list(loc.rect), entrances=[list(e) for e in loc.entrances], props=loc.props,
                                                discovered_by=loc.discovered_by),
                          objects=[ObjectInfo(**o.model_dump(exclude={"created_by", "created_at"})) for o in st.objects_at(location_id)],
                          resources=[ResourceInfo(**n.model_dump(include={"id", "location_id", "x", "y", "resource", "amount", "cap", "requires_tool", "label"})) for n in st.nodes_at(location_id)],
                          agents=[a.id for a in st.agents() if a.location_id == location_id], recent_events=[to_out(e) for e in events])
