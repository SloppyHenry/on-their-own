import pytest

from on_their_own.world.rules import WorldRules

from .conftest import failed, ok, put, reject, stock, types


def test_gather_reduces_node_and_fills_inventory(eng):
    put(eng, "alex", 24, 6)
    events = ok(eng, "alex", "gather", resource="wood", amount=2)
    assert eng.state.agent("alex").inventory == {"wood": 2}
    assert eng.state.node("woodpile").amount == 4
    assert "world.resource_changed" in types(events) and "agent.inventory_changed" in types(events)


def test_gather_takes_minutes_scaled_by_rules(eng):
    put(eng, "alex", 24, 6)
    t0 = eng.minute
    ok(eng, "alex", "gather", resource="wood", amount=2)
    base = eng.minute - t0
    assert base == 6
    eng.set_rules(WorldRules(gather_time_mult=2.0))
    t0 = eng.minute
    ok(eng, "alex", "gather", resource="wood", amount=2)
    assert eng.minute - t0 == 2 * base


def test_gather_rejections(eng):
    put(eng, "alex", 24, 6)
    reject(eng, "alex", "gather", "not_here", resource="stone")
    reject(eng, "alex", "gather", "invalid_target", resource="wood", amount=9)
    put(eng, "alex", 10, 23)
    reject(eng, "alex", "gather", "missing_resource", resource="wood")                # Axt fehlt
    put(eng, "alex", 24, 6)
    stock(eng, "alex", seeds=10)
    reject(eng, "alex", "gather", "capacity", resource="wood")


def test_gather_needs_tool_in_hand(eng):
    put(eng, "alex", 21, 7)
    ok(eng, "alex", "take", object_id="axe")
    put(eng, "alex", 10, 23)
    ok(eng, "alex", "gather", resource="wood", amount=3)
    assert eng.state.agent("alex").inventory["wood"] == 3
    assert eng.state.node("forest_wood").amount == 37


def test_exhausted_node_is_rejected_and_partial_yield_is_possible(eng):
    put(eng, "alex", 24, 6)
    with eng.db.transaction():
        eng.state.set_node_amount("woodpile", 1.5)
    ok(eng, "alex", "gather", resource="wood", amount=3)       # nur 1 Einheit vorhanden
    assert eng.state.agent("alex").inventory["wood"] == 1
    with eng.db.transaction():
        eng.state.set_node_amount("woodpile", 0.4)
    reject(eng, "alex", "gather", "missing_resource", resource="wood")


def test_other_agent_empties_node_during_gathering(eng):
    put(eng, "alex", 24, 6)
    put(eng, "mira", 24, 7)
    assert eng.propose("alex", "gather", {"resource": "wood", "amount": 5}).ok
    with eng.db.transaction():
        eng.state.set_node_amount("woodpile", 0)
    ev = []
    for _ in range(30):
        ev += eng.tick()
    f = [e for e in ev if e.type == "agent.action_failed"]
    assert f and f[0].data["code"] == "missing_resource"
    assert not eng.state.agent("alex").inventory


def test_regrowth_hourly_and_scarcity(eng):
    with eng.db.transaction():
        eng.state.set_node_amount("forest_mushrooms", 0)
    eng.advance(60 * 10)
    assert 2.5 < eng.state.node("forest_mushrooms").amount < 3.5      # 0.3/h × 10 h
    eng.set_rules(WorldRules(resource_scarcity=0.5))
    assert eng.state.node("forest_wood").amount == 20                   # Obergrenze 40 × 0.5
    n = eng.state.node("forest_wood").amount
    with eng.db.transaction():
        eng.state.set_node_amount("forest_wood", 0)
    eng.advance(60 * 4)
    assert eng.state.node("forest_wood").amount == 4 * 1.5 * 0.5 and n == 20


def test_water_sources_are_unlimited(eng):
    put(eng, "alex", 39, 9)
    for _ in range(3):
        ok(eng, "alex", "gather", resource="water", amount=1)
    assert eng.state.agent("alex").inventory["water"] == 3 and eng.state.node("well_garden_water").amount == 999


def test_plant_and_growth_requires_water(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=2)
    reject(eng, "alex", "plant", "invalid_target", seedbed_id="nicht_da")
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    plant = next(o for o in eng.state.all_objects() if o.kind == "plant")
    assert (plant.x, plant.y) == (32, 7) and plant.state["stage"] == 0
    assert eng.state.agent("alex").inventory["seeds"] == 1
    reject(eng, "alex", "plant", "invalid_target", seedbed_id="seedbed_1")      # belegt
    eng.advance(60 * 24)
    assert eng.state.obj(plant.id).state["stage"] == 0                          # ohne Wasser kein Wachstum


def test_plant_rejections(eng):
    put(eng, "alex", 32, 8)
    reject(eng, "alex", "plant", "missing_resource", seedbed_id="seedbed_1")
    stock(eng, "alex", seeds=1)
    eng.set_weather("storm", 300)
    reject(eng, "alex", "plant", "forbidden_by_rules", seedbed_id="seedbed_1")
    eng.set_weather("clear", 300)
    put(eng, "alex", 20, 13)
    reject(eng, "alex", "plant", "not_here", seedbed_id="seedbed_1")


def test_watered_plant_grows_over_several_days_and_can_be_harvested(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=1)
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    plant = next(o for o in eng.state.all_objects() if o.kind == "plant")
    stages = []
    for hour in range(0, 24 * 3):
        if hour % 10 == 0:                   # alle 10 Stunden gießen (Gießen gilt 12 Stunden)
            put(eng, "alex", 32, 8)
            ok(eng, "alex", "water", object_id=plant.id)       # am Brunnen im Garten
        eng.advance(60)
        stages.append(eng.state.obj(plant.id).state["stage"])
    assert stages == sorted(stages) and stages[-1] == 4 and 0 in stages[:10]
    put(eng, "alex", 32, 8)
    ok(eng, "alex", "use", object_id=plant.id, mode="harvest")
    a = eng.state.agent("alex")
    assert a.inventory == {"food": 3, "seeds": 1} and eng.state.obj(plant.id) is None


def test_harvest_unripe_rejected(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=1)
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    pid = next(o.id for o in eng.state.all_objects() if o.kind == "plant")
    reject(eng, "alex", "use", "invalid_target", object_id=pid, mode="harvest")


def test_rain_waters_plants(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=1)
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    pid = next(o.id for o in eng.state.all_objects() if o.kind == "plant")
    eng.set_weather("rain", 600)
    eng.advance(500)
    s = eng.state.obj(pid).state
    assert s["stage"] == 1 and s["watered_at"] is not None


def _planted(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=1)
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    return next(o.id for o in eng.state.all_objects() if o.kind == "plant")


def test_water_from_well_needs_no_inventory(eng):
    pid = _planted(eng)                       # der Garten hat einen Brunnen
    ok(eng, "alex", "water", object_id=pid)
    assert eng.state.obj(pid).state["watered_at"] is not None and not eng.state.agent("alex").inventory


def test_water_prefers_carried_water_and_accepts_seedbed(eng):
    pid = _planted(eng)
    stock(eng, "alex", water=2)
    ok(eng, "alex", "water", object_id="seedbed_1")                         # Beet mit Pflanze genügt
    assert eng.state.agent("alex").inventory["water"] == 1


def test_water_rejections(eng):
    pid = _planted(eng)
    reject(eng, "alex", "water", "invalid_target", object_id="seedbed_2")   # leeres Beet
    put(eng, "alex", 20, 13)
    reject(eng, "alex", "water", "not_here", object_id=pid)
    put(eng, "alex", 32, 8)
    with eng.db.transaction():
        eng.state.conn.execute("DELETE FROM resources WHERE id='well_garden_water'")
    reject(eng, "alex", "water", "missing_resource", object_id=pid)         # weder Brunnen noch Wasser dabei


def test_eat_and_drink_from_inventory_and_nodes(eng):
    with eng.db.transaction():
        a = eng.state.agent("alex")
        a.needs.update(hunger=80, thirst=80)
        eng.state.save_agent(a)
    put(eng, "alex", 20, 13)
    reject(eng, "alex", "eat", "missing_resource")
    reject(eng, "alex", "drink", "missing_resource")
    stock(eng, "alex", food=1, water=1)
    ok(eng, "alex", "eat")
    ok(eng, "alex", "drink")
    n = eng.state.agent("alex").needs
    assert n["hunger"] == pytest.approx(55, abs=1) and n["thirst"] == pytest.approx(40, abs=1) and not eng.state.agent("alex").inventory
    put(eng, "alex", 11, 12)                                                  # Speisekammer
    ok(eng, "alex", "eat")
    assert eng.state.node("pantry").amount == 9
    put(eng, "alex", 10, 14)                                                  # Wasserhahn
    ok(eng, "alex", "drink")
    assert eng.state.node("tap_kitchen").amount == 999


def test_needs_decay_and_can_be_disabled(eng):
    n0 = dict(eng.state.agent("mira").needs)
    eng.advance(120)
    n = eng.state.agent("mira").needs
    assert n["hunger"] > n0["hunger"] and n["thirst"] > n0["thirst"] and n["energy"] < n0["energy"]
    eng.set_rules(WorldRules(needs_enabled=False))
    n1 = dict(eng.state.agent("mira").needs)
    eng.advance(120)
    assert eng.state.agent("mira").needs == n1


def test_sleep_restores_energy_and_respects_ownership(eng):
    put(eng, "alex", 7, 7)
    with eng.db.transaction():
        a = eng.state.agent("alex")
        a.needs["energy"] = 20
        eng.state.save_agent(a)
    put(eng, "alex", 14, 7)
    reject(eng, "alex", "sleep", "forbidden_by_rules", object_id="bed_mira")
    put(eng, "alex", 7, 7)
    reject(eng, "alex", "sleep", "invalid_target", minutes=5)
    events = ok(eng, "alex", "sleep")
    assert eng.state.agent("alex").needs["energy"] == 100 and "agent.slept" in types(events)
    put(eng, "alex", 20, 13)
    reject(eng, "alex", "sleep", "not_here")


def test_use_bed_sleep_matches_sleep_action(eng):
    with eng.db.transaction():
        a = eng.state.agent("alex")
        a.needs["energy"] = 50
        eng.state.save_agent(a)
    put(eng, "alex", 7, 7)
    ok(eng, "alex", "use", object_id="bed_alex", mode="sleep")
    assert eng.state.agent("alex").needs["energy"] == 100


def test_rest_is_faster_on_seat(eng):
    with eng.db.transaction():
        for i in ("alex", "mira"):
            a = eng.state.agent(i)
            a.needs["energy"] = 50
            eng.state.save_agent(a)
    put(eng, "alex", 8, 25)       # Wald: keine Sitzgelegenheit
    put(eng, "mira", 31, 23)      # Platz: Bank vorhanden
    ok(eng, "alex", "rest", minutes=20)
    ok(eng, "mira", "rest", minutes=20, object_id="bench_square")
    alex, mira = (eng.state.agent(i).needs["energy"] for i in ("alex", "mira"))
    assert mira - alex == pytest.approx(4.0, abs=0.2)       # 20 min × (0,30 − 0,10)
