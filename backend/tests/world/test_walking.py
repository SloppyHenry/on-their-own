"""Verdichtete Bewegung: ein Fahrplan (`agent.walking`) je Weg muss in jeder Minute die echte Position ergeben."""

from on_their_own.api.state import agent_info
from on_their_own.world.actions.movement import schedule

from .conftest import put


def scheduled_pos(walk, minute):
    """Position laut Fahrplan: letzte Kachel, deren Ankunftsminute erreicht ist (sonst der Startpunkt)."""
    pos = walk.data["from"]
    for tile, at in zip(walk.data["path"], walk.data["arrive"]):
        if at <= minute:
            pos = tile
    return pos


def follow(eng, actor="alex", limit=600, each=None):
    """Tickt bis zum Ende der Aktion und prüft nach jeder Minute die Position gegen den gültigen Fahrplan."""
    walk, seen = None, []
    for _ in range(limit):
        if eng.state.agent(actor).action is None:
            break
        if each:
            each(eng.minute)
        for e in eng.tick():
            seen.append(e)
            if e.type == "agent.walking" and e.agents == [actor]:
                walk = e
        a = eng.state.agent(actor)
        if walk is not None and a.action is not None:
            assert scheduled_pos(walk, eng.minute) == [a.x, a.y], (eng.minute, walk.data)
    return seen


def test_schedule_mirrors_step_budget():
    assert schedule(10, 0.0, [1.0, 1.0, 1.0]) == [10, 11, 12]
    assert schedule(10, 0.0, [2.0, 1.0]) == [11, 12]                 # teure Kachel braucht zwei Minuten
    assert schedule(10, 0.5, [1.5, 1.25]) == [10, 12]                # Restbudget wird mitgenommen
    assert schedule(0, 0.0, []) == []


def test_schedule_matches_every_minute_on_a_long_walk(eng):
    res = eng.propose("alex", "move_to", {"target": "lake"})
    assert res.ok
    events = follow(eng)
    walks = [e for e in events if e.type == "agent.walking"]
    assert len(walks) == 1 and walks[0].data["reason"] == "start" and walks[0].data["label"]
    arrived = next(e for e in events if e.type == "agent.arrived")
    assert arrived.data["at"] == walks[0].data["path"][-1] and arrived.sim_minute == walks[0].data["arrive"][-1]
    a = eng.state.agent("alex")
    assert [a.x, a.y] == walks[0].data["path"][-1]


def test_weather_change_mid_walk_publishes_a_new_tempo(eng):
    put(eng, "alex", 20, 18)
    assert eng.propose("alex", "move_to", {"tile": [20, 30]}).ok
    events = [e for _ in range(3) for e in eng.tick()]
    eng.set_weather("storm", 600)
    events += follow(eng)
    reasons = [e.data["reason"] for e in events if e.type == "agent.walking"]
    assert reasons == ["start", "tempo"]


def test_blocked_path_publishes_a_replan(eng):
    put(eng, "alex", 20, 13)
    assert eng.propose("alex", "move_to", {"target": "square"}).ok
    first = [e for e in eng.tick() if e.type == "agent.walking"]
    with eng.db.transaction():
        o = eng.state.obj("door_front")
        o.state["locked"] = True
        eng.state.save_object(o)
    events = follow(eng)
    replans = [e for e in events if e.type == "agent.walking" and e.data["reason"] == "replan"]
    assert first and replans and eng.state.agent("alex").location_id == "square"


def test_interrupt_reports_the_exact_tile(eng):
    assert eng.propose("alex", "move_to", {"target": "lake"}).ok
    for _ in range(7):
        eng.tick()
    ev = next(e for e in eng.interrupt("alex", "Test") if e.type == "agent.action_interrupted")
    a = eng.state.agent("alex")
    assert ev.data["at"] == [a.x, a.y]


def test_snapshot_carries_the_rest_of_the_walk(eng):
    class Sim:                                                         # agent_info braucht nur Engine und Store
        engine = eng

        class store:
            @staticmethod
            def get(_):
                return None
    assert eng.propose("alex", "move_to", {"target": "lake"}).ok
    walk = next(e for e in eng.tick() if e.type == "agent.walking")
    for _ in range(5):
        eng.tick()
    info = agent_info(Sim, eng.state.agent("alex"))
    k = sum(1 for at in walk.data["arrive"] if at <= eng.minute)
    assert info.walk is not None and info.walk.path == walk.data["path"][k:] and info.walk.arrive == walk.data["arrive"][k:]
    assert [info.x, info.y] == walk.data["path"][k - 1]


def test_walks_need_far_fewer_events_than_tiles(eng):
    assert eng.propose("alex", "move_to", {"target": "lake"}).ok
    events = follow(eng)
    tiles = len(next(e for e in events if e.type == "agent.walking").data["path"])
    assert len(events) < tiles / 2, f"{len(events)} Ereignisse für {tiles} Kacheln"
