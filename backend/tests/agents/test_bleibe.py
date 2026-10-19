"""Bleibe selbst suchen (AP17b): Wer in einem freien Bett schläft, dem gehört es; angeboten werden freie Betten mehrerer Häuser, sonst nur das eigene."""

import pytest

from simulacra.agents.model import AgentProfile, Personality
from simulacra.config import Settings
from simulacra.generator.generate import new_world
from simulacra.llm.providers import FakeProvider
from simulacra.simulation.builder import Simulation

from tests.agents.conftest import chooser, needs, put, with_goals
from tests.agents.test_perception_options import all_opts, percept

IDS = ["ida", "jo", "kai", "lea"]


def dorf(fn=None, n=4):
    w, _ = new_world(5, residents=[{"id": i, "name": i.capitalize(), "home": None} for i in IDS[:n]])
    sim = Simulation.create(Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0), ":memory:", FakeProvider(fn=with_goals(fn or chooser("Zum Schlafen", "Schlafen"))), world=w)
    for i in IDS[:n]:
        sim.store.create_profile(i, AgentProfile(name=i.capitalize(), known_places=["square", "garden"]), Personality())
    return sim


def beds(sim):
    return sorted(sim.engine.state.objects_of_kind("bed"), key=lambda b: b.id)


def night(sim):
    sim.engine.advance(15 * 60)                       # 22:00


def sleeper_at(sim, aid, bed):
    put(sim, aid, bed.x, bed.y)


def test_nachts_werden_freie_betten_mehrerer_haeuser_angeboten():
    sim = dorf()
    night(sim)
    for a in ("ida",):
        needs(sim, a, energy=40)
    offers = [o for o in all_opts(sim, "ida") if o.kind == "to_bed"]
    assert 2 <= len(offers) <= 3
    assert len({o.target_loc for o in offers}) == len(offers)                       # verschiedene Räume
    assert {o.params["target"] for o in offers} <= {b.id for b in beds(sim)}
    sim.close()


def test_wer_im_freien_bett_schlaeft_dem_gehoert_es():
    sim = dorf()
    st, eng = sim.engine.state, sim.engine
    b = beds(sim)[0]
    sleeper_at(sim, "ida", b)
    needs(sim, "ida", energy=30)
    assert eng.propose("ida", "sleep", {}).ok
    assert st.obj(b.id).owner == "ida" and st.obj(b.id).name == "Bett (Ida)"
    ev = st.conn.execute("SELECT data, agents FROM events WHERE type='world.object_changed'").fetchall()
    assert any('"claimed"' in r["data"] for r in ev)
    eng.advance(5)
    # ein anderer kann dieses Bett nicht mehr benutzen, wohl aber ein anderes freies
    sleeper_at(sim, "jo", b)
    assert not eng.propose("jo", "sleep", {}).ok
    other = next(x for x in beds(sim) if x.owner is None)
    sleeper_at(sim, "jo", other)
    assert eng.propose("jo", "sleep", {}).ok and st.obj(other.id).owner == "jo"
    sim.close()


def test_wer_ein_bett_hat_bekommt_kein_zweites_und_sieht_nur_sein_eigenes():
    sim = dorf()
    st, eng = sim.engine.state, sim.engine
    mine, spare = [b for b in beds(sim)][:2]
    sleeper_at(sim, "ida", mine); needs(sim, "ida", energy=30)
    assert eng.propose("ida", "sleep", {}).ok
    eng.advance(400)
    assert st.obj(mine.id).owner == "ida"
    sleeper_at(sim, "ida", spare); needs(sim, "ida", energy=30)
    assert eng.propose("ida", "sleep", {}).ok                                       # ein freies Bett darf sie benutzen …
    assert st.obj(spare.id).owner is None                                           # … es wird aber nicht ihres
    night(sim)
    put(sim, "ida", 20, 10); needs(sim, "ida", energy=40)
    offers = [o for o in all_opts(sim, "ida") if o.kind == "to_bed"]
    assert [o.params["target"] for o in offers] == [mine.id]
    put(sim, "jo", 20, 10); needs(sim, "jo", energy=40)
    assert mine.id not in {o.params["target"] for o in all_opts(sim, "jo") if o.kind == "to_bed"}
    sim.close()


@pytest.mark.parametrize("n", [4])
async def test_in_der_nacht_hat_jeder_hoechstens_ein_bett_und_keines_wird_geteilt(n):
    sim = dorf(n=n)
    sim.engine.advance(14 * 60 + 30)                                                # 21:30
    await sim.runner.step(9 * 60)                                                   # eine Nacht
    mine = {}
    for b in beds(sim):
        if b.owner:
            assert b.owner not in mine, "jeder höchstens ein Bett"
            mine[b.owner] = b.id
    assert len(mine) >= 3                                                           # die Bewohner haben sich Betten gesucht
    log = sim.engine.state.conn.execute("SELECT agents, data FROM events WHERE type='world.object_changed'").fetchall()
    assert all(len(__import__("json").loads(r["agents"])) == 1 for r in log if '"claimed"' in r["data"])      # jeder Vorgang betrifft nur den, der sich hinlegt
    sim.close()


def round_robin():
    import itertools
    import json as _json
    import re
    n = itertools.count()

    def fn(messages, schema, params):
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        keys = list(opts) or ["o1"]
        return _json.dumps({"option_id": keys[next(n) % len(keys)], "intent": "ausprobieren", "utterance": "Hallo!", "importance": 4})
    return fn


@pytest.mark.parametrize("n", [4, 8])
async def test_dorf_nach_mass_laeuft_mit_dem_fake_modell(n):
    """Abnahmeprobe (AP17b-e): 4 und 8 Bewohner im erzeugten Dorf, 300 Schritte ohne Absturz, alle entscheiden, niemand teilt ein Bett."""
    ids = [f"b{i}" for i in range(n)]
    w, _ = new_world(7, residents=[{"id": i, "name": f"Bewohner {k}", "home": None} for k, i in enumerate(ids)])
    sim = Simulation.create(Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0), ":memory:", FakeProvider(fn=with_goals(round_robin())), world=w)
    for i in ids:
        sim.store.create_profile(i, AgentProfile(name=i, known_places=["square", "garden"]), Personality())
    sim.engine.advance(13 * 60)                                                       # abends beginnen: die Nacht gehört dazu
    t0 = sim.engine.minute
    await sim.runner.step(300)
    assert sim.engine.minute == t0 + 300
    c = sim.engine.state.conn
    decided = {r["agent_id"] for r in c.execute("SELECT DISTINCT agent_id FROM decisions")}
    assert decided == set(ids)
    failed = c.execute("SELECT COUNT(*) c FROM events WHERE type='agent.decision_failed'").fetchone()["c"]
    assert failed < n * 20
    owners = [b.owner for b in sim.engine.state.objects_of_kind("bed") if b.owner]
    assert len(owners) == len(set(owners))
    sim.close()
