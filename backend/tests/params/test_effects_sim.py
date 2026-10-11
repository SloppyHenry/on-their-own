"""Wirkungstests: Tempo, Last, Energiesparen und Beobachtungsmodus wirken auf Schleife, Begrenzer, Reflexion und Prompt."""

import asyncio

from simulacra.llm.providers import FakeProvider

from .conftest import patch, wait_one_minute
from .test_effects_memory import fill


async def ticks_in(sim, seconds):
    t0 = sim.runner.stats.ticks
    await sim.runner.start()
    await asyncio.sleep(seconds)
    await sim.runner.stop()
    return sim.runner.stats.ticks - t0


async def test_speed_sets_the_tick_pause(sim):
    await patch(sim, "sim.speed", "max")
    assert sim.runner.tick_delay_s == 0.0
    fast = await ticks_in(sim, 0.3)
    await patch(sim, "sim.speed", "0.5x")
    assert sim.runner.tick_delay_s == 2.0 and sim.params.current_value("sim.speed") == "0.5x"
    slow = await ticks_in(sim, 0.3)
    assert fast >= 10 and slow <= 1
    await patch(sim, "sim.tick_pause_ms", 150)
    assert sim.runner.tick_delay_s == 0.15 and sim.params.current_value("sim.speed") == "custom"
    middle = await ticks_in(sim, 0.5)
    assert 1 <= middle <= 5
    ev = [e for e in sim.engine.events_since(0, 10000) if e.type == "simulation.speed_changed"]
    assert [e.data["level"] for e in ev][:2] == ["max", "0.5x"]                                   # die Oberfläche erfährt davon


async def test_decision_limit_throttles_real_time(sim):
    lim = sim.runner.limiter
    await patch(sim, "sim.max_decisions_per_min", 2)
    await lim.acquire("alex")
    await lim.acquire("mira")
    assert lim.delay_for("alex") > 50                                                                # die dritte Entscheidung muss fast eine Minute warten
    await patch(sim, "sim.max_decisions_per_min", 0)
    assert lim.delay_for("alex") == 0


async def test_time_can_run_without_waiting_for_decisions(sim):
    sim.client.provider = FakeProvider(fn=wait_one_minute, delay_s=0.2)                              # ein langsames Modell
    waiting = await ticks_in(sim, 0.6)
    await patch(sim, "sim.time_waits_for_decisions", False)
    free = await ticks_in(sim, 0.6)
    assert waiting <= 6 and free > waiting * 3                                                       # die Zeit läuft, Entscheidungen kommen später


async def test_power_save(sim):
    await patch(sim, "sim.power_save", True)
    assert sim.runner.limiter.power_cap == 4 and sim.memory.params.quiet_reflection
    lim = sim.runner.limiter
    for i in range(4):
        await lim.acquire(f"a{i}")
    assert lim.delay_for("a9") > 50                                                                  # höchstens 4 Entscheidungen je Minute
    lim._window.clear()
    fill(sim, n=10, importance=9)
    assert sim.memory.reflector.due("alex", 600) is None                                             # tagsüber keine Reflexion
    await patch(sim, "sim.power_save", False)
    assert sim.memory.reflector.due("alex", 600) == "importance"
    # ohne verbundenen Browser ruht die Schleife
    await patch(sim, "sim.power_save", True)
    t0 = sim.engine.minute
    await sim.runner.start(ticks=1)
    await asyncio.sleep(0.3)
    assert sim.engine.minute == t0
    sub = sim.engine.bus.subscribe()
    await asyncio.wait_for(sim.runner.wait_finished(), 5)
    sub.close()
    assert sim.engine.minute > t0


async def test_modes_change_the_prompt_but_not_the_memories(sim):
    fill(sim, n=5)
    count = sim.memory.store.count("alex")
    system = lambda: sim.planner.prepare("alex").messages[0]["content"]                              # noqa: E731
    base = await sim.engine.db.run(system)
    assert "außerhalb" not in base and "geschaffen" not in base                                      # Standard: die Agenten erfahren nichts
    await patch(sim, "mode", "creator")
    creator = await sim.engine.db.run(system)
    assert creator.startswith(base[:300]) and "von jemandem außerhalb geschaffen" in creator and creator != base
    await patch(sim, "mode.creator_text", "Eine Stimme aus dem Himmel schaut dir zu.")
    assert "Eine Stimme aus dem Himmel" in await sim.engine.db.run(system)
    await patch(sim, "mode", "intervention")
    assert await sim.engine.db.run(system) == base                                                   # vorerst wie Beobachter
    await patch(sim, "mode", "observer")
    assert await sim.engine.db.run(system) == base
    assert sim.memory.store.count("alex") == count                                                   # kein Moduswechsel verändert Erinnerungen
