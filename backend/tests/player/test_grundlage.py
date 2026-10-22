"""AP18h-a1: eigene Figur – Mengen `profile_ids`/`thinking_ids`, Runner entscheidet sie nie, passive Pflege bleibt."""

import json

from simulacra.simulation import mitleben
from simulacra.world import spielart

from agents.conftest import make_sim, put


def pick(sim, player="alex", mode="leben"):
    sim.store.ensure_all()
    spielart.set_mode(sim.engine.state, mode)
    mitleben.set_player(sim.engine.state, player)


def decided(sim) -> set[str]:
    return {r["agent_id"] for r in sim.store.conn.execute("SELECT agent_id FROM decisions")}


def test_old_save_without_meta_is_unchanged():
    sim = make_sim()
    sim.store.ensure_all()
    st = sim.engine.state
    assert mitleben.player_id(st) is None and not mitleben.autopilot_on(st)
    assert sim.store.thinking_ids() == sim.store.profile_ids() and len(sim.store.profile_ids()) >= 2


def test_sets_split_and_autopilot_returns_the_figure():
    sim = make_sim()
    pick(sim)
    st = sim.engine.state
    assert mitleben.player_id(st) == "alex"
    assert "alex" in sim.store.profile_ids() and "alex" not in sim.store.thinking_ids() and "mira" in sim.store.thinking_ids()
    mitleben.set_autopilot(st, True)
    assert "alex" in sim.store.thinking_ids()
    mitleben.set_autopilot(st, False)
    spielart.set_mode(st, "gott")                      # Wechsel auf Gott: normaler Bewohner, das Modell entscheidet wieder
    assert mitleben.player_id(st) is None and "alex" in sim.store.thinking_ids()


def test_unknown_figure_is_refused():
    sim = make_sim()
    try:
        mitleben.set_player(sim.engine.state, "niemand")
    except ValueError:
        return
    raise AssertionError("unbekannte Figur angenommen")


async def test_runner_never_decides_the_own_figure_without_autopilot():
    sim = make_sim()
    pick(sim)
    await sim.runner.step(5)
    assert decided(sim) == {"mira"}
    assert sim.engine.state.agent("alex").action is None
    assert not any("alex" in json.dumps(c["messages"]) and "option_id" in c["schema"]["properties"] and c["messages"][0]["content"].startswith("Du bist Alex")
                   for c in sim.client.provider.calls)


async def test_own_figure_keeps_getting_hungry():
    sim = make_sim()
    pick(sim)
    hunger0 = sim.engine.state.agent("alex").needs["hunger"]
    await sim.runner.step(180)
    assert sim.engine.state.agent("alex").needs["hunger"] > hunger0     # Bedürfnisse laufen weiter, obwohl niemand für Alex entscheidet
    assert sim.engine.state.agent("alex").action is None


async def test_own_figure_observes_and_learns_like_everyone():
    sim = make_sim()
    pick(sim)
    put(sim, "alex", 20, 13)
    put(sim, "mira", 21, 13)
    res = sim.engine.propose("mira", "speak", {"to": "alex", "text": "Schönes Wetter heute."})
    assert res.ok, res.rejected
    for _ in range(10):
        if sim.engine.state.agent("mira").action is None:
            break
        evs = sim.engine.tick()
        sim.collector.ingest(evs + sum((sim.convs.on_dialogue(e) for e in evs if e.type == "agent.dialogue"), []), sim.store.profile_ids())
    assert any("Schönes Wetter" in o["text"] for o in sim.store.recent_observations("alex", 50))     # Alex hört Mira zu
    assert decided(sim) == set()                                                                      # ohne dass für Alex entschieden wurde

    informed = [e for e in welt_event(sim) if e.type == "agent.informed"]                            # Wissensverteilung (AP18i) erreicht auch Alex
    assert {a for e in informed for a in e.agents} == set(sim.store.profile_ids()) and "alex" in sim.store.profile_ids()


def welt_event(sim):
    w = sim.inject.welt
    cat = next(e for e in w.catalog if e["id"] == "gewitter")
    w.due = lambda m: cat
    sim.engine.state.conn.execute("UPDATE clock SET minute=?", (12 * 60,))
    return w.tick(12 * 60)


async def test_autopilot_makes_the_figure_decide():
    sim = make_sim()
    pick(sim)
    mitleben.set_autopilot(sim.engine.state, True)
    await sim.runner.step(2)
    assert decided(sim) == {"alex", "mira"}
