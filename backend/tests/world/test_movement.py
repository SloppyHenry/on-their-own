from simulacra.world.models import RejectCode
from simulacra.world.rules import WorldRules

from .conftest import failed, ok, put, reject, run, types


def test_move_to_location_changes_position_and_emits_events(eng):
    events = ok(eng, "alex", "move_to", target="lake")
    a = eng.state.agent("alex")
    assert a.location_id == "lake" and a.action is None
    moved = [e for e in events if e.type == "agent.moved"]
    assert len(moved) > 30
    assert moved[-1].data["to"] == [a.x, a.y]
    assert "agent.arrived" in types(events) and "agent.action_completed" in types(events)
    assert ("agent.location_changed", "lake") in [(e.type, e.data.get("to_location")) for e in events]
    assert "alex" in eng.state.locations["lake"].discovered_by


def test_each_step_is_one_adjacent_tile(eng):
    events = ok(eng, "mira", "move_to", target="forest")
    pos = None
    for e in events:
        if e.type == "agent.moved":
            f, t = e.data["from"], e.data["to"]
            assert abs(f[0] - t[0]) + abs(f[1] - t[1]) == 1
            assert pos is None or pos == f
            pos = t


def test_move_to_object_node_agent_and_tile(eng):
    ok(eng, "alex", "move_to", target="bookshelf")
    a = eng.state.agent("alex")
    assert a.location_id == "house.living" and abs(a.x - 25) <= 1 and abs(a.y - 11) <= 1
    ok(eng, "alex", "move_to", target="forest_wood")
    assert eng.state.agent("alex").location_id == "forest"
    ok(eng, "alex", "move_to", target="mira")
    assert abs(eng.state.agent("alex").x - eng.state.agent("mira").x) + abs(eng.state.agent("alex").y - eng.state.agent("mira").y) <= 1
    ok(eng, "alex", "move_to", tile=[34, 25])
    assert eng.state.agent("alex").pos == (34, 25)


def test_rejection_codes(eng):
    reject(eng, "alex", "move_to", RejectCode.INVALID_TARGET.value, target="mond")
    reject(eng, "alex", "move_to", RejectCode.INVALID_TARGET.value)
    reject(eng, "alex", "move_to", RejectCode.INVALID_TARGET.value, target="paths")
    reject(eng, "alex", "move_to", RejectCode.NOT_REACHABLE.value, tile=[0, 0])       # Baum
    reject(eng, "alex", "move_to", RejectCode.NOT_REACHABLE.value, tile=[5000, 5000])
    reject(eng, "ghost", "move_to", RejectCode.INVALID_TARGET.value, target="lake")
    reject(eng, "alex", "teleport", RejectCode.INVALID_TARGET.value, target="lake")


def test_hidden_object_is_not_a_valid_target_until_found(eng):
    reject(eng, "alex", "move_to", "invalid_target", target="old_key")


def test_busy_agent_cannot_start_second_action(eng):
    assert eng.propose("alex", "move_to", {"target": "lake"}).ok
    reject(eng, "alex", "wait", "busy", minutes=5)
    assert eng.state.agent("alex").action.type == "move_to"  # laufende Aktion unberührt


def test_locked_doors_make_target_unreachable(eng):
    _lock(eng, "door_ba")
    reject(eng, "alex", "move_to", "not_reachable", target="lake")


def _lock(eng, *doors):
    with eng.db.transaction():
        for d in doors:
            o = eng.state.obj(d)
            o.state["locked"] = True
            eng.state.save_object(o)


def _walk(eng, limit=300):
    for _ in range(limit):
        if eng.state.agent("alex").action is None:
            return
        eng.tick()


def test_replan_takes_detour_when_one_door_gets_locked(eng):
    put(eng, "alex", 20, 13)
    assert eng.propose("alex", "move_to", {"target": "square"}).ok
    eng.tick()
    _lock(eng, "door_front")
    _walk(eng)
    assert eng.state.agent("alex").location_id == "square"   # über Werkstatt, Hintertür und Garten


def test_walk_fails_cleanly_when_all_exits_get_locked(eng):
    put(eng, "alex", 20, 13)
    assert eng.propose("alex", "move_to", {"target": "square"}).ok
    eng.tick()
    _lock(eng, "door_front", "door_back")
    _walk(eng)
    a = eng.state.agent("alex")
    assert a.location_id.startswith("house.")
    assert any(h["outcome"] == "failed" and h["code"] == "not_reachable" for h in eng.action_history("alex", 5))


def test_rules_forbid_locations_and_home_radius(eng):
    eng.set_rules(WorldRules(movement_blocked_locations=["lake"]))
    reject(eng, "alex", "move_to", "forbidden_by_rules", target="lake")
    ok(eng, "alex", "move_to", target="forest")  # andere Orte bleiben frei
    eng.set_rules(WorldRules(home_radius=8))
    reject(eng, "mira", "move_to", "forbidden_by_rules", target="forest")
    eng.set_rules(WorldRules())
    ok(eng, "mira", "move_to", target="forest")


def test_rain_slows_walking(eng):
    put(eng, "alex", 20, 18)
    t0 = eng.minute
    ok(eng, "alex", "move_to", tile=[20, 24])
    dry = eng.minute - t0
    put(eng, "alex", 20, 18)
    eng.set_weather("storm", 600)
    t0 = eng.minute
    ok(eng, "alex", "move_to", tile=[20, 24])
    assert eng.minute - t0 > dry


def test_move_to_current_position_completes(eng):
    res, events = run(eng, "alex", "move_to", tile=[7, 7])
    assert res.ok and "agent.action_completed" in types(events)


def test_wait_valid_and_invalid(eng):
    t0 = eng.minute
    ok(eng, "alex", "wait", minutes=10)
    assert eng.minute - t0 == 10
    reject(eng, "alex", "wait", "invalid_target", minutes=0)
    reject(eng, "alex", "wait", "invalid_target", minutes=61)
    reject(eng, "alex", "wait", "invalid_target", minutes="viel")
