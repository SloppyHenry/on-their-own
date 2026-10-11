import json

import pytest

from agents.conftest import make_sim
from simulacra.agents.relations import DAILY_CAP, describe

AI = ["alex", "mira"]


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    yield s
    s.close()


def ev(sim, type_, agents, data, minute=500):
    return sim.engine.emit_event(type_, agents, "house.living", data)


def rel(sim, a="alex", b="mira"):
    return sim.autonomy.relations.get(a, b)


def test_directions_are_separate_and_start_neutral(sim):
    r = rel(sim)
    assert r.values() == {"trust": 50.0, "sympathy": 50.0, "tension": 10.0, "familiarity": 30.0}
    sim.autonomy.relations.adjust("alex", "mira", {"trust": 5}, "Test", 500)
    assert rel(sim).trust == 55 and rel(sim, "mira", "alex").trust == 50


def test_accepted_proposal_builds_trust_for_both_with_their_own_reason(sim):
    e = ev(sim, "agent.proposal_accepted", AI, {"conversation": 1, "proposal": "Zusammen im Garten arbeiten", "by": "alex", "answered_by": "mira"})
    sim.autonomy.relations.on_events([e], AI)
    a, m = rel(sim), rel(sim, "mira", "alex")
    assert a.trust == 53 and a.sympathy == 53 and "Zusammen im Garten" in a.shared[0]
    assert m.trust == 52 and m.sympathy == 52
    log = sim.autonomy.relations.log("alex", "mira")
    assert log[0]["reason"] == "Mira hat meinen Vorschlag angenommen" and log[0]["source"] == "rule" and log[0]["event_seq"] == e.seq
    assert sim.autonomy.relations.log("mira", "alex")[0]["reason"] == "Ich habe den Vorschlag von Alex angenommen"


def test_declined_proposal_creates_tension_and_an_open_conflict_that_later_resolves(sim):
    e = ev(sim, "agent.proposal_declined", AI, {"conversation": 1, "proposal": "Holz sammeln", "by": "alex", "answered_by": "mira"})
    sim.autonomy.relations.on_events([e], AI)
    r = rel(sim)
    assert r.tension == 13 and r.sympathy == 48 and r.conflicts == ["Vorschlag abgelehnt: Holz sammeln"]
    assert "offen ist noch" in describe(r, "Mira")
    ok = ev(sim, "agent.proposal_accepted", AI, {"conversation": 2, "proposal": "Beete gießen", "by": "alex", "answered_by": "mira"})
    sim.autonomy.relations.on_events([ok], AI)
    assert rel(sim).conflicts == [] and rel(sim).tension < 13


def test_gifts_help_the_receiver_most(sim):
    e = ev(sim, "agent.item_given", AI, {"from": "mira", "to": "alex", "resource": "wood", "amount": 1})
    sim.autonomy.relations.on_events([e], AI)
    assert rel(sim, "alex", "mira").trust == 53 and rel(sim, "mira", "alex").trust == 50 and rel(sim, "mira", "alex").sympathy == 51


def test_conversations_add_familiarity_and_loops_cost_sympathy(sim):
    good = ev(sim, "agent.conversation_ended", AI, {"conversation": 1, "reason": "farewell", "reason_text": "x", "turns": 4, "participants": AI})
    loop = ev(sim, "agent.conversation_ended", AI, {"conversation": 2, "reason": "repetition", "reason_text": "x", "turns": 6, "participants": AI})
    short = ev(sim, "agent.conversation_ended", AI, {"conversation": 3, "reason": "timeout", "reason_text": "x", "turns": 1, "participants": AI})
    sim.autonomy.relations.on_events([good], AI)
    assert rel(sim).familiarity == 32
    sim.autonomy.relations.on_events([loop, short], AI)
    r = rel(sim)
    assert r.sympathy == 50 and r.tension == 11                         # +1 Sympathie (Gespräch), −1 (Schleife); Spannung +1
    assert [l["reason"] for l in sim.autonomy.relations.log("alex", "mira")][0].endswith("drehte sich im Kreis")


def test_rule_gains_are_capped_per_day(sim):
    for i in range(20):
        e = ev(sim, "agent.proposal_accepted", AI, {"conversation": i, "proposal": f"V{i}", "by": "alex", "answered_by": "mira"})
        sim.autonomy.relations.on_events([e], AI)
    assert rel(sim).trust == 50 + DAILY_CAP and rel(sim).sympathy == 50 + DAILY_CAP        # nicht „hochzüchtbar“
    sim.autonomy.relations.adjust("alex", "mira", {"trust": 3}, "Tag später", 500 + 1500)
    assert rel(sim).trust == 50 + DAILY_CAP + 3                                              # am nächsten Tag geht es wieder


def test_values_stay_within_zero_and_hundred(sim):
    sim.autonomy.relations.adjust("alex", "mira", {"tension": 500, "trust": -500}, "Test", 500, source="reflection")
    assert rel(sim).tension <= 100 and rel(sim).trust >= 0
    for _ in range(80):
        sim.autonomy.relations.adjust("alex", "mira", {"trust": -5}, "Test", 500)
    assert rel(sim).trust == 0


def test_reflection_can_only_nudge_in_small_steps_and_needs_sources(sim):
    r = sim.autonomy.relations.adjust("alex", "mira", {"trust": 9, "sympathy": -9}, "Einsicht", 500, source="reflection")
    assert r.trust == 52 and r.sympathy == 48                                              # höchstens ±2 je Kennzahl


async def test_reflection_with_relation_field_updates_the_relation_with_a_reason():
    from simulacra.memory.reflection import Reflector                                      # noqa: F401
    answer = {"reflections": [{"text": "Mira hilft mir oft, ich vertraue ihr mehr.", "importance": 6, "sources": [1, 2],
                               "relation": {"person": "mira", "trust": 3, "sympathy": 1}}]}
    s = make_sim(fn=lambda m, sch, p: json.dumps(answer))
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    for i in range(8):
        s.memory.writer.remember("alex", "episode", f"Ich habe mit Mira Aufgabe {i} erledigt.", 6, 100 + i * 20, location_id="garden", persons=["mira"], shared=True)
    out = await s.memory.reflector.run("alex", "test")
    assert out
    r = rel(s)
    assert r.trust == 52 and r.sympathy == 51
    entry = s.autonomy.relations.log("alex", "mira")[0]
    assert entry["source"] == "reflection" and entry["reason"].startswith("Einsicht: Mira hilft")
    s.close()


async def test_reflection_about_a_person_not_in_the_sources_is_ignored():
    answer = {"reflections": [{"text": "Jonas ist nett.", "importance": 5, "sources": [1], "relation": {"person": "jonas", "trust": 2}}]}
    s = make_sim(fn=lambda m, sch, p: json.dumps(answer))
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    for i in range(8):
        s.memory.writer.remember("alex", "episode", f"Ich habe Aufgabe {i} erledigt.", 6, 100 + i * 20, location_id="garden")
    await s.memory.reflector.run("alex", "test")
    assert s.autonomy.relations.log("alex", "mira") == [] and s.autonomy.relations.all_of("alex") == []
    s.close()


def test_relation_events_are_private_and_describe_is_short(sim):
    for _ in range(12):
        sim.autonomy.relations.adjust("alex", "mira", {"trust": 2, "sympathy": 2}, "Test", 500, source="reflection")
    events = [e for e in sim.engine.events_since(0, 1000) if e.type == "agent.relation_changed"]
    assert events and all(e.visibility == "system" and e.agents == ["alex"] and e.data["other"] == "mira" for e in events)
    text = describe(rel(sim), "Mira")
    assert text.startswith("Verhältnis zu Mira:") and "du magst Mira" in text and len(text) < 160
    assert describe(rel(sim, "mira", "alex"), "Alex") == ""                           # nichts Auffälliges: nichts im Prompt


def test_tension_relaxes_over_time_but_not_below_baseline(sim):
    sim.autonomy.relations.adjust("alex", "mira", {"tension": 20}, "Test", 500, source="reflection")
    for h in range(40):
        sim.autonomy.relations.relax("alex", 600 + h * 60)
    assert rel(sim).tension == 10


def test_relation_in_the_prompt_and_in_the_scoring(sim):
    from agents.conftest import put
    put(sim, "alex", 7, 7)
    put(sim, "mira", 8, 7)
    for _ in range(12):
        sim.autonomy.relations.adjust("alex", "mira", {"trust": 2, "sympathy": 2}, "Test", 500, source="reflection")
    prep = sim.planner.prepare("alex")
    assert "Verhältnis zu Mira" in prep.messages[1]["content"]
    speak = next(o for o in prep.options if o.kind == "speak")
    assert any(n == "Beziehung" and v > 0 for n, v in speak.factors)
