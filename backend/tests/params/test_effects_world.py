"""Wirkungstests: Die Weltregler verändern Regeln der Welt, die die Engine tatsächlich anwendet."""

import pytest
from world.conftest import ok, put, reject, stock

from simulacra.agents.needs import need_words

from .conftest import patch


def advance(sim, minutes):
    sim.engine.advance(minutes)


async def test_scarcity_shrinks_stock_and_regrowth_immediately(sim):
    eng = sim.engine
    before = eng.state.node("forest_wood").amount
    r = await patch(sim, "world.scarcity", 50)
    assert r["status"] == "applied"
    after = eng.state.node("forest_wood").amount
    assert after == pytest.approx(before * 0.55, rel=0.01)                              # Bestand schrumpft sofort (1 − 0,9 · 50 %)
    with eng.db.transaction():
        eng.state.set_node_amount("forest_wood", 0)
    eng.advance(60 * 4)
    scarce = eng.state.node("forest_wood").amount
    await patch(sim, "world.scarcity", 0)
    with eng.db.transaction():
        eng.state.set_node_amount("forest_wood", 0)
    eng.advance(60 * 4)
    assert scarce < eng.state.node("forest_wood").amount                                 # Nachwuchs ist bei Knappheit langsamer
    await patch(sim, "world.scarcity", 100)
    assert eng.state.node("forest_wood").amount <= before * 0.11


async def test_availability_scales_caps(sim):
    eng = sim.engine
    cap = eng.state.node("forest_wood").cap
    await patch(sim, "world.resource_availability", 50)
    assert eng.state.node("forest_wood").amount <= cap * 0.5
    with eng.db.transaction():
        eng.state.set_node_amount("forest_wood", 0)
    eng.advance(60 * 100)
    assert eng.state.node("forest_wood").amount == pytest.approx(cap * 0.5, rel=0.02)   # wächst nur bis zur halben Obergrenze
    await patch(sim, "world.resource_availability", 150)
    eng.advance(60 * 100)
    assert eng.state.node("forest_wood").amount > cap


def body(sim, aid="alex"):
    return dict(sim.engine.state.agent(aid).needs)


async def test_need_switches_and_rates(sim):
    eng = sim.engine
    h0 = body(sim)["hunger"]
    eng.advance(120)
    normal = body(sim)["hunger"] - h0
    assert normal == pytest.approx(6, abs=1)                                              # 3 je Stunde
    await patch(sim, "needs.hunger.rate", 200)
    h1 = body(sim)["hunger"]
    eng.advance(120)
    assert body(sim)["hunger"] - h1 == pytest.approx(2 * normal, abs=1.5)
    await patch(sim, "needs.hunger.enabled", False)
    h2 = body(sim)["hunger"]
    eng.advance(120)
    assert body(sim)["hunger"] == pytest.approx(h2, abs=0.01)                             # steht still
    assert not sim.autonomy.needs.on("hunger")
    await patch(sim, "needs.hunger.enabled", True)                                        # der eingestellte Satz gilt wieder
    h3 = body(sim)["hunger"]
    eng.advance(60)
    assert body(sim)["hunger"] - h3 == pytest.approx(6, abs=1)
    # weiche Bedürfnisse: ausgeschaltet verschwinden sie aus Prompt und Bewertung
    soft = {"social": 90.0, "calm": 90.0, "warmth": 90.0}
    assert len(need_words(soft, sim.autonomy.needs.params.enabled)) == 2                  # Wärme ist standardmäßig aus
    await patch(sim, "needs.warmth.enabled", True)
    assert len(need_words(soft, sim.autonomy.needs.params.enabled)) == 3
    await patch(sim, "needs.social.enabled", False)
    await patch(sim, "needs.calm.enabled", False)
    assert need_words(soft, sim.autonomy.needs.params.enabled) == ["dir ist kalt"]
    prep = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
    assert "Geselligkeit" not in prep.messages[1]["content"] and not prep.perception.ctx.on("social")


async def test_minutes_per_tick_advances_the_clock(sim):
    t0 = sim.engine.minute
    await sim.runner.step(3)
    assert sim.engine.minute - t0 == 3
    await patch(sim, "world.minutes_per_tick", 5)
    t1 = sim.engine.minute
    await sim.runner.step(3)
    assert sim.engine.minute - t1 == 15


async def test_build_cost_and_duration(sim):
    eng = sim.engine
    put(eng, "alex", 36, 13)
    await patch(sim, "world.build_cost", 200)
    await patch(sim, "world.build_duration", 50)
    stock(eng, "alex", wood=5)
    reject(eng, "alex", "build", "missing_resource", blueprint="bench")                    # kostet jetzt das Doppelte (6)
    stock(eng, "alex", wood=6)
    t0 = eng.minute
    ok(eng, "alex", "build", blueprint="bench")
    assert eng.minute - t0 == 30 and not eng.state.agent("alex").inventory


async def test_max_objects_limits_building(sim):
    eng = sim.engine
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=3)
    assert eng.state.object_count() >= 20                                                  # die Startwelt hat mehr Objekte als die kleinste erlaubte Grenze
    await patch(sim, "world.max_objects", 20)
    assert eng.state.rules.max_objects == 20
    reject(eng, "alex", "build", "forbidden_by_rules", blueprint="bench")
    assert eng.state.agent("alex").inventory == {"wood": 3}                                # nichts verbraucht
    await patch(sim, "world.max_objects", 500)
    ok(eng, "alex", "build", blueprint="bench")


async def test_movement_blocks_locations(sim):
    eng = sim.engine
    await patch(sim, "world.movement", "no_forest")
    reject(eng, "alex", "move_to", "forbidden_by_rules", target="forest")
    ok(eng, "alex", "move_to", target="lake")
    await patch(sim, "world.movement", "house_garden")
    reject(eng, "alex", "move_to", "forbidden_by_rules", target="lake")
    await patch(sim, "world.movement", "custom")
    await patch(sim, "world.movement_custom", "garden, nirgendwo")
    reject(eng, "mira", "move_to", "forbidden_by_rules", target="garden")                  # unbekannte Kennungen werden ignoriert
    assert eng.state.rules.movement_blocked_locations == ["garden"]
    await patch(sim, "world.movement", "free")
    ok(eng, "mira", "move_to", target="garden")


async def test_failure_consequence(sim):
    eng = sim.engine
    await patch(sim, "world.failure_consequence", "none")
    assert not eng.propose("alex", "teleport").ok and eng.state.agent("alex").action is None
    await patch(sim, "world.failure_consequence", "time")
    assert not eng.propose("alex", "teleport").ok and eng.state.agent("alex").action.type == "recover"
    eng.advance(5)
    await patch(sim, "world.failure_consequence", "energy")
    before = eng.state.agent("alex").needs["energy"]
    assert not eng.propose("alex", "teleport").ok
    assert eng.state.agent("alex").needs["energy"] < before
