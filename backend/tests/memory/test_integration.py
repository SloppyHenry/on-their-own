import json
import re

from agents.conftest import chooser, make_sim, put


def intent_chooser(importance=5):
    """Wählt Gespräche, sonst reihum eine Option, mit Absicht und Plan, damit Entscheidungs-Erinnerungen entstehen."""
    state = {"n": 0}

    def fn(messages, schema, params):
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        keys = list(opts)
        talk = next((k for k, v in opts.items() if "antworten" in v or "Gespräch beginnen" in v), None)
        state["n"] += 1
        oid = talk or keys[state["n"] % len(keys)]
        return json.dumps({"option_id": oid, "intent": f"Etwas Sinnvolles tun Nr. {state['n'] % 7}", "utterance": "Schön, dich zu sehen.", "importance": importance,
                           "plan_next": "Später den Garten pflegen"}, ensure_ascii=False)
    return fn


async def run(sim, steps):
    put(sim, "alex", 7, 7)
    put(sim, "mira", 8, 7)
    await sim.runner.step(steps)


async def test_both_agents_build_separate_memories_and_decisions_link_to_retrievals():
    sim = make_sim(fn=intent_chooser())
    await run(sim, 90)
    st = sim.memory.store
    a, m = st.list("alex", limit=500)[0], st.list("mira", limit=500)[0]
    assert len(a) >= 5 and len(m) >= 5
    assert {x.agent_id for x in a} == {"alex"} and {x.agent_id for x in m} == {"mira"}
    assert {x.kind for x in a + m} >= {"episode", "intention"}
    ev = sim.engine.events_since(0, 100000)
    created = [e for e in ev if e.type == "agent.memory_created"]
    assert created and all(e.visibility == "system" and len(e.agents) == 1 for e in created)
    got = [e for e in ev if e.type == "agent.memory_retrieved"]
    assert got and got[0].data["items"] and {"id", "kind", "score", "text"} <= set(got[0].data["items"][0])
    linked = [r for r in sim.memory.know.retrievals("alex", 200) if r["decision_id"]]
    assert linked
    sim.close()


async def test_retrieved_memories_appear_in_the_prompt():
    sim = make_sim(fn=intent_chooser())
    await run(sim, 60)
    prompts = [c["messages"][1]["content"] for c in sim.client.provider.calls]
    assert any("Woran du dich erinnerst:" in p for p in prompts)
    assert not any("Mensch" in p or "Schöpfer" in p for p in prompts)
    sim.close()


async def test_conversation_becomes_one_relation_memory_per_participant():
    sim = make_sim(fn=chooser("antworten", "Gespräch beginnen", utterance="Ich habe Holz für uns."))
    await run(sim, 40)
    rel = [x for who in ("alex", "mira") for x in sim.memory.store.list(who, kind="relation")[0]]
    assert rel, "es hätte ein Gespräch zusammengefasst werden müssen"
    one = sim.memory.store.list("alex", kind="relation")[0][0]
    assert one.shared and one.persons == ["mira"] and "gesprochen" in one.text and one.source_event_id
    for m in sim.memory.store.list("alex", kind="relation")[0]:
        assert "Mira" in m.text and "Alex" not in m.text.split("Ich sagte")[0].replace("Alex sagte", "")
    sim.close()


async def test_intentions_are_tracked_and_replaced():
    sim = make_sim(fn=intent_chooser())
    await run(sim, 40)
    intents = sim.memory.store.list("alex", kind="intention")[0]
    assert len([i for i in intents if i.intention_state == "open"]) <= 1          # nur das aktuelle Vorhaben ist offen
    sim.close()


async def test_knowledge_is_filled_from_perception():
    sim = make_sim(fn=intent_chooser())
    await run(sim, 30)
    objs = sim.memory.know.objects("alex")
    assert any(o["name"] == "Bett (Alex)" for o in objs)
    assert any(o["kind"] == "door" and o["note"] == "offen" for o in objs)        # zuletzt gesehener Zustand
    assert sim.memory.know.locations("alex") == [] or all(r["location_id"] for r in sim.memory.know.locations("alex"))
    sim.close()


async def test_visibility_boundary_event_only_for_mira():
    sim = make_sim(fn=intent_chooser())
    put(sim, "alex", 7, 7)
    put(sim, "mira", 50, 30)                       # weit weg: Alex hört und sieht nichts von dem, was Mira im Verborgenen tut
    from simulacra.memory.models import Observed
    sim.memory.writer.process([Observed(agent_id="mira", kind="discovery", text="Du entdeckst etwas: Karte.", importance=7, minute=500, location_id="lake")])
    assert sim.memory.store.count("mira") == 1 and sim.memory.store.count("alex") == 0
    sim.close()
