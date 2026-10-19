"""Wirkungstests: Tempo, Last, Energiesparen und Beobachtungsmodus wirken auf Schleife, Begrenzer, Reflexion und Prompt."""

import asyncio

from simulacra.llm.providers import FakeProvider

from saves.conftest import file_sim

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
    fast = await ticks_in(sim, 0.6)
    await patch(sim, "sim.speed", "0.5x")
    assert sim.runner.tick_delay_s == 2.0 and sim.params.current_value("sim.speed") == "0.5x"
    slow = await ticks_in(sim, 0.6)
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


async def test_autosave_follows_the_interval_and_keeps_a_ring(tmp_path, monkeypatch):
    sim = file_sim(tmp_path / "live.db")
    sim.autosave.min_real_gap_s = 0                                                                                 # Echtzeit-Mindestabstand: eigener Test unten
    manual = await sim.engine.db.run(lambda: sim.saves.create("Handarbeit"))
    await sim.params.patch([{"key": "sim.autosave_sim_hours", "value": 1}, {"key": "sim.autosave_real_minutes", "value": 0}, {"key": "sim.autosave_keep", "value": 3}])
    await sim.runner.step(59)
    assert [e for e in sim.saves.list() if e["kind"] == "auto"] == []                                            # noch keine Stunde
    await sim.runner.step(1 + 60 * 5)
    autos = [e for e in sim.saves.list() if e["kind"] == "auto"]
    assert len(autos) == 3 and [a["sim_minute"] for a in autos] == sorted((a["sim_minute"] for a in autos), reverse=True)
    assert sim.saves.get(manual["id"])["name"] == "Handarbeit"                                                    # manuelle Stände bleiben unberührt
    assert len(list(sim.saves.dir.glob("sav_*.db"))) == 4                                                          # nur 3 Autosaves + 1 manueller liegen noch auf der Platte
    await sim.params.patch([{"key": "sim.autosave_sim_hours", "value": 0}, {"key": "sim.autosave_real_minutes", "value": 5}])
    n = len([e for e in sim.saves.list() if e["kind"] == "auto"])
    await sim.runner.step(130)
    assert len([e for e in sim.saves.list() if e["kind"] == "auto"]) == n                                          # beides aus bzw. Echtzeit nicht erreicht
    import simulacra.saves.service as svc
    real = svc.time.monotonic()
    monkeypatch.setattr(svc.time, "monotonic", lambda: real + 301)
    await sim.runner.step(1)
    assert sim.saves.list()[0]["kind"] == "auto" and sim.saves.list()[0]["name"].startswith("Autosave")
    await sim.params.patch([{"key": "sim.autosave_real_minutes", "value": 0}])
    assert sim.autosave.real_minutes == 0
    sim.close()


async def test_autosave_by_sim_hours_keeps_a_real_time_gap_at_full_speed(tmp_path, monkeypatch):
    """Langlauf-Befund (AP11): bei Höchsttempo entstand alle 3–4 s eine volle Kopie der Datenbank (≈ 100 MB/s Schreiblast)."""
    import simulacra.saves.service as svc
    sim = file_sim(tmp_path / "live.db")
    await sim.params.patch([{"key": "sim.autosave_sim_hours", "value": 1}, {"key": "sim.autosave_real_minutes", "value": 0}])
    now = [svc.time.monotonic()]
    monkeypatch.setattr(svc.time, "monotonic", lambda: now[0])
    await sim.runner.step(60 * 6)
    assert [e for e in sim.saves.list() if e["kind"] == "auto"] == []                                            # sechs Sim-Stunden in Sekunden: keine Kopie
    now[0] += sim.autosave.min_real_gap_s
    await sim.runner.step(60)
    assert len([e for e in sim.saves.list() if e["kind"] == "auto"]) == 1                                         # nach dem Mindestabstand wieder
    await sim.runner.step(60 * 3)
    assert len([e for e in sim.saves.list() if e["kind"] == "auto"]) == 1
    sim.close()


async def test_observation_mode_changes_only_while_time_stands_still(sim):
    """Frage 36: der Beobachtungsmodus ändert sich nur bei stehender Zeit (angehalten oder Editor-Modus), nie mitten im Lauf; er gilt dann ab der nächsten Entscheidung."""
    await sim.runner.start()
    try:
        [r] = await sim.params.patch([{"key": "mode", "value": "creator"}])
        assert r["status"] == "rejected" and "solange die Zeit steht" in r["reason"] and sim.planner.mode.mode == "observer"
        [r] = await sim.params.patch([{"key": "mode.creator_text", "value": "Jemand sieht zu."}])
        assert r["status"] == "rejected"
        await sim.runner.pause()
        [r] = await sim.params.patch([{"key": "mode", "value": "creator"}])
        assert r["status"] != "rejected" and sim.planner.mode.mode == "creator"
    finally:
        await sim.runner.stop()
