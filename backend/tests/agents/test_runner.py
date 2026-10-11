import asyncio
import json
import re

import pytest

from simulacra.llm.providers import FakeProvider
from simulacra.simulation.builder import Simulation
from simulacra.simulation.limits import DecisionLimiter
from simulacra.simulation.runner import SimState

from .conftest import chooser, make_sim, put


def waiter(minutes=1):
    """Fake-Modell: wählt immer 'Abwarten', damit beide Agenten jeden Tick neu entscheiden."""
    def fn(messages, schema, params):
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        oid = next((k for k, v in opts.items() if v.startswith("Abwarten")), "o1")
        return json.dumps({"option_id": oid, "intent": "warten", "utterance": "", "importance": 2})
    return fn


def wait_one_minute(messages, schema, params):
    """Wartet genau eine Minute (über `other`), damit beide Agenten in jedem Tick neu entscheiden."""
    return json.dumps({"option_id": "other", "intent": "kurz warten", "utterance": "", "importance": 1,
                       "other_action": "wait", "other_params": {"minutes": 1}})


def who(call):
    return re.match(r"Du bist (\w+)", call["messages"][0]["content"]).group(1)


async def test_step_runs_due_decisions_then_exactly_one_tick():
    sim = make_sim()
    t0 = sim.engine.minute
    assert await sim.runner.step() == 1
    assert sim.engine.minute == t0 + 1
    assert len(sim.client.provider.calls) == 2                         # beide Agenten waren frei
    assert all(sim.engine.state.agent(a).action is not None for a in ("alex", "mira"))
    assert await sim.runner.step(3) == 3 and sim.engine.minute == t0 + 4


async def test_decisions_are_logged_with_options_choice_and_outcome():
    sim = make_sim()
    await sim.runner.step()
    rows = sim.store.decisions("alex")
    d = rows[0]
    assert d["status"] == "valid" and d["chosen"] == "o1" and d["outcome"] == "accepted" and d["attempts"] == 1
    assert len(d["options"]) >= 3 and {"id", "label", "score", "factors", "action", "params"} <= set(d["options"][0])
    assert d["options"][0]["factors"][0][0] == "Grundneigung" and d["intent"] and d["action"] and d["event_seq"]


async def test_step_not_allowed_while_running_and_start_is_idempotent():
    sim = make_sim(fn=waiter())
    sim.client.provider.delay_s = 0.02
    await sim.runner.start()
    with pytest.raises(RuntimeError):
        await sim.runner.step()
    await sim.runner.start()
    await sim.runner.stop()
    assert sim.runner.state == SimState.STOPPED


async def test_pause_lets_inflight_request_finish_then_halts_and_resume_continues():
    sim = make_sim(fn=waiter())
    sim.client.provider.delay_s = 0.1
    seen = []
    sim.runner.event_listeners.append(lambda evs: seen.extend(e.type for e in evs))
    await sim.runner.start()
    await asyncio.sleep(0.03)                                           # erste Anfrage läuft gerade
    assert sim.client.provider.active == 1
    await sim.runner.pause()
    assert sim.runner.state == SimState.PAUSED and sim.client.provider.active == 0
    calls_at_pause, minute_at_pause = len(sim.client.provider.calls), sim.engine.minute
    assert sim.store.decisions("alex") or sim.store.decisions("mira")   # die laufende Entscheidung wurde zu Ende geführt und angewendet
    await asyncio.sleep(0.25)
    assert len(sim.client.provider.calls) == calls_at_pause and sim.engine.minute == minute_at_pause   # nichts läuft weiter
    await sim.runner.resume()
    await asyncio.sleep(0.4)
    await sim.runner.pause()
    assert sim.engine.minute > minute_at_pause and len(sim.client.provider.calls) > calls_at_pause
    await sim.runner.stop()
    for t in ("simulation.started", "simulation.paused", "simulation.resumed", "simulation.stopped"):
        assert t in seen


async def test_single_step_while_paused_is_exactly_one_tick():
    sim = make_sim(fn=waiter())
    await sim.runner.start()
    await asyncio.sleep(0.05)
    await sim.runner.pause()
    m = sim.engine.minute
    assert await sim.runner.step() == 1 and sim.engine.minute == m + 1
    assert sim.runner.state == SimState.PAUSED                          # nach dem Schritt wieder pausiert
    await sim.runner.stop()


async def test_run_for_a_fixed_number_of_ticks_then_stops():
    sim = make_sim(fn=waiter())
    t0 = sim.engine.minute
    await sim.runner.start(ticks=12)
    await sim.runner.wait_finished()
    assert sim.engine.minute == t0 + 12 and sim.runner.state == SimState.STOPPED and sim.runner.stats.ticks == 12


async def test_order_of_agents_alternates():
    sim = make_sim(fn=wait_one_minute)
    await sim.runner.step(6)
    order = [who(c) for c in sim.client.provider.calls]
    firsts = order[0::2]
    assert set(order) == {"Alex", "Mira"} and firsts[0] != firsts[1] and len(set(firsts)) == 2


async def test_never_more_than_one_concurrent_request():
    sim = make_sim(fn=wait_one_minute)
    sim.client.provider.delay_s = 0.01
    await sim.runner.step(5)
    assert sim.client.provider.max_active == 1


def test_limiter_min_gap_and_per_minute_cap():
    lim = DecisionLimiter(min_gap_s=5, max_per_minute=3)
    assert lim.delay_for("a", now=100) == 0
    lim._last["a"] = 100
    assert lim.delay_for("a", now=102) == 3 and lim.delay_for("b", now=102) == 0
    lim._window.extend([100, 110, 120])
    assert lim.delay_for("b", now=130) == 30                           # erstes Fenstereintrag läuft erst bei 160 ab
    assert lim.delay_for("b", now=161) == 0
    lim.configure(max_per_minute=0)
    assert lim.delay_for("b", now=130) == 0


async def test_limiter_is_applied_in_real_time():
    sim = make_sim(fn=wait_one_minute, sim_min_decision_gap_s=0.05)
    import time
    t = time.perf_counter()
    await sim.runner.step(3)                                           # 6 Entscheidungen, je Agent 3 mit 0,05 s Abstand
    assert time.perf_counter() - t >= 0.09


async def test_tick_delay_slows_the_loop():
    sim = make_sim(fn=waiter())
    sim.runner.set_speed(0.05)
    import time
    t = time.perf_counter()
    await sim.runner.start(ticks=4)
    await sim.runner.wait_finished()
    assert time.perf_counter() - t >= 0.15


async def test_garbage_answers_fall_back_to_wait_and_leave_the_world_alone():
    sim = make_sim(script=["kein json"])
    objs = sim.engine.state.snapshot()["objects"]
    await sim.runner.step(3)
    types = [e.type for e in sim.engine.events_since(0)]
    assert types.count("agent.decision_failed") >= 2
    assert sim.runner.stats.fallback >= 2 and sim.runner.stats.valid == 0
    assert sim.engine.state.snapshot()["objects"] == objs
    d = sim.store.decisions("alex")[0]
    assert d["status"] == "fallback" and d["action"] == "wait" and d["attempts"] == 3 and d["error"]


async def test_world_rejection_is_reported_back_as_observation():
    bad = json.dumps({"option_id": "other", "intent": "x", "utterance": "", "importance": 3, "other_action": "move_to", "other_params": {"target": "mond"}})
    sim = make_sim(script=[bad])
    await sim.runner.step()
    assert sim.runner.stats.rejected == 2
    mem = [o["text"] for o in sim.store.recent_observations("alex", 20)]
    assert any(t.startswith("Das ging nicht:") for t in mem)
    d = sim.store.decisions("alex")[0]
    assert d["outcome"] == "rejected" and "mond" in d["outcome_text"]


async def test_agents_talk_and_see_each_other_live():
    sim = make_sim(fn=chooser("Gespräch beginnen", "antworten", utterance="Schön, dich zu sehen."), sim_top_k=40)
    sim.store.ensure_all()
    put(sim, "alex", 20, 13)
    put(sim, "mira", 21, 13)
    lines = []
    sim.runner.event_listeners.append(lambda evs: lines.extend(e for e in evs if e.type == "agent.dialogue"))
    await sim.runner.step(12)
    assert {e.data["speaker"] for e in lines} == {"alex", "mira"}
    assert sim.convs.active_for("alex") is not None or any(e.type == "conversation.ended" for e in sim.engine.events_since(0))
    last_prompt = sim.client.provider.calls[-1]["messages"][1]["content"]
    assert "Gespräch mit" in last_prompt and "Schön, dich zu sehen." in last_prompt


async def test_status_values_follow_the_actions():
    sim = make_sim()
    await sim.runner.step()
    assert {sim.store.get("alex").status, sim.store.get("mira").status} <= {"acting", "talking", "idle", "sleeping", "resting_mode"}
    assert sim.store.get("alex").status == "acting"
    sim.engine.advance(200)
    await sim.engine.db.run(lambda: sim.runner._after_tick([]))
    assert sim.store.get("alex").status == "idle"


async def test_memory_decisions_and_profiles_survive_a_restart(tmp_path):
    path = tmp_path / "live.db"
    s1 = make_sim(fn=waiter())
    s1.close()
    sim = Simulation.create(s1.settings, path, FakeProvider(fn=waiter()))
    await sim.runner.step(5)
    n_obs, n_dec = len(sim.store.recent_observations("alex", 100)), len(sim.store.decisions("alex"))
    prof = sim.store.get("alex").profile.model_dump()
    minute = sim.engine.minute
    sim.close()
    again = Simulation.create(sim.settings, path, FakeProvider(fn=waiter()))
    assert again.engine.minute == minute and again.store.get("alex").profile.model_dump() == prof
    assert len(again.store.recent_observations("alex", 100)) == n_obs > 0 and len(again.store.decisions("alex")) == n_dec > 0
    await again.runner.step(2)
    assert again.engine.minute == minute + 2
    again.close()


async def test_reset_keeps_the_old_world_as_backup(tmp_path):
    path = tmp_path / "live.db"
    sim = Simulation.create(make_sim().settings, path, FakeProvider(fn=waiter()))
    await sim.runner.step(5)
    old_minute = sim.engine.minute
    saved = await sim.reset()
    assert saved is not None and saved.exists() and saved.parent.name == "backups"
    assert sim.engine.minute < old_minute and sim.runner.state == SimState.STOPPED
    from simulacra.db.connection import Database
    check = Database(saved)
    assert check.conn.execute("SELECT minute FROM clock").fetchone()[0] == old_minute        # alter Stand unverändert gesichert
    await sim.runner.step(1)                                                                  # die neue Welt läuft
    sim.close()
    check.close()
