import json

from on_their_own.llm.providers import FakeProvider, LLMError

from .conftest import chooser, make_sim, options_of, put


def world_fingerprint(sim):
    s = sim.engine.state.snapshot()
    return s["objects"], s["resources"], [(a["x"], a["y"], a["inventory"]) for a in s["agents"]], sim.engine.minute


async def decide_once(sim, aid="alex"):
    prep = await sim.engine.db.run(lambda: sim.planner.prepare(aid))
    dec = await sim.planner.ask(prep)
    return prep, dec


def good(oid="o1", **kw):
    return json.dumps({"option_id": oid, "intent": "weil es passt", "utterance": "", "importance": 5, **kw})


async def test_valid_answer_is_resolved_to_the_offered_option():
    sim = make_sim(script=[good("o2")])
    sim.store.ensure_all()
    prep, dec = await decide_once(sim)
    assert dec.status == "valid" and dec.attempts == 1 and dec.error is None
    o2 = prep.options[1]
    assert (dec.action, dec.params, dec.chosen_id) == (o2.action, o2.params, "o2") and dec.intent == "weil es passt" and dec.importance == 5


async def test_system_prompt_is_identical_between_calls_and_schema_is_sent():
    sim = make_sim(script=[good()])
    sim.store.ensure_all()
    await decide_once(sim)
    await decide_once(sim)
    c = sim.client.provider.calls
    assert c[0]["messages"][0] == c[1]["messages"][0]
    assert c[0]["schema"]["properties"]["option_id"]["enum"][-1] == "other"
    assert c[0]["params"].thinking is False and c[0]["params"].response_format == "json_schema"


async def test_broken_json_is_corrected_once():
    sim = make_sim(script=["das ist kein json", good()])
    sim.store.ensure_all()
    prep, dec = await decide_once(sim)
    assert dec.status == "valid" and dec.attempts == 2
    second = sim.client.provider.calls[1]["messages"]
    assert second[-2]["role"] == "assistant" and "kein json" in second[-2]["content"]
    assert second[-1]["role"] == "user" and "nicht verwendbar" in second[-1]["content"]


async def test_permanently_broken_answers_fall_back_to_wait_without_touching_the_world():
    sim = make_sim(script=["Quatsch {"])
    sim.store.ensure_all()
    before = world_fingerprint(sim)
    prep, dec = await decide_once(sim)
    assert dec.status == "fallback" and (dec.action, dec.params) == ("wait", {"minutes": 10}) and dec.attempts == 3 and "Quatsch" in dec.error
    assert len(sim.client.provider.calls) == 3                        # 1 Versuch + 2 Korrekturen
    assert world_fingerprint(sim) == before                           # erst das Anwenden würde etwas ändern


async def test_invalid_variants_are_rejected_and_corrected():
    bad = [good("o99"), good("o1", importance=11), good("other"),
           good("other", other_action="zaubern"), json.dumps([1, 2, 3])]
    for b in bad:
        sim = make_sim(script=[b, b, b])
        sim.store.ensure_all()
        _, dec = await decide_once(sim)
        assert dec.status == "fallback", b
    sim = make_sim(script=[good("o99"), good("o1")])
    sim.store.ensure_all()
    assert (await decide_once(sim))[1].attempts == 2


async def test_answer_with_only_an_option_id_is_accepted_with_defaults():
    sim = make_sim(script=[json.dumps({"option_id": "o1"})])
    sim.store.ensure_all()
    _, dec = await decide_once(sim)
    assert dec.status == "valid" and dec.intent == "" and dec.importance == 3


async def test_utterance_is_required_exactly_where_the_option_needs_it():
    sim = make_sim(fn=chooser("Gespräch beginnen", utterance=""), sim_top_k=40)
    sim.store.ensure_all()
    put(sim, "mira", 8, 8)
    _, dec = await decide_once(sim)
    assert dec.status == "fallback" and "utterance" in dec.error
    sim = make_sim(fn=chooser("Gespräch beginnen", utterance="Guten Morgen, Mira."), sim_top_k=40)
    sim.store.ensure_all()
    put(sim, "mira", 8, 8)
    prep, dec = await decide_once(sim)
    assert dec.status == "valid" and dec.action == "speak" and dec.params == {"to": "mira", "text": "Guten Morgen, Mira."}


async def test_other_action_is_passed_through_for_the_engine_to_judge():
    sim = make_sim(script=[good("other", other_action="move_to", other_params={"target": "garden"})])
    sim.store.ensure_all()
    _, dec = await decide_once(sim)
    assert dec.status == "valid" and (dec.action, dec.params, dec.chosen) == ("move_to", {"target": "garden"}, None)


async def test_llm_errors_fall_back_without_correction_attempts():
    for kind in ("timeout", "network", "server", "client"):
        sim = make_sim(script=[LLMError(kind, "weg")], llm_retries=0)
        sim.store.ensure_all()
        _, dec = await decide_once(sim)
        assert dec.status == "fallback" and dec.attempts == 1 and kind in dec.error
        assert len(sim.client.provider.calls) == 1


async def test_retryable_errors_are_retried_before_falling_back():
    sim = make_sim(script=[LLMError("timeout", "x"), good()], llm_retries=2)
    sim.store.ensure_all()
    _, dec = await decide_once(sim)
    assert dec.status == "valid" and len(sim.client.provider.calls) == 2


async def test_claiming_success_in_text_changes_nothing():
    """Das Modell behauptet Erfolg; maßgeblich ist allein, was die Engine tut."""
    lie = json.dumps({"option_id": "o1", "intent": "Ich habe soeben die Bank gebaut und Mira ein Haus geschenkt.",
                      "utterance": "", "importance": 10, "plan_next": "Alles ist schon erledigt"})
    sim = make_sim(script=[lie])
    sim.store.ensure_all()
    before = world_fingerprint(sim)
    prep, dec = await decide_once(sim)
    res = sim.engine.propose("alex", dec.action, dec.params)          # wirkt nur, was die Optionen hergeben
    ids_before = {o["id"] for o in before[0]}
    ids_after = {o["id"] for o in sim.engine.state.snapshot()["objects"]}
    assert ids_after == ids_before                                    # keine Bank, kein Haus: nur o1 wurde vorgeschlagen
    assert dec.intent.startswith("Ich habe soeben") and dec.status == "valid"


async def test_raw_answers_are_truncated_in_the_error_log():
    sim = make_sim(script=["x" * 5000])
    sim.store.ensure_all()
    _, dec = await decide_once(sim)
    assert len(dec.error) <= 600


async def test_importance_and_free_text_limits():
    sim = make_sim(script=[good("o1", plan_next="p" * 900, proposal="q" * 900, intent="i" * 100)])
    sim.store.ensure_all()
    _, dec = await decide_once(sim)
    assert dec.status == "valid" and len(dec.plan_next) == 200 and len(dec.proposal) == 200
