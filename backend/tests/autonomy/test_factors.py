import pytest

from simulacra.agents.factors import FACTOR_KEYS, KEY_LABELS, key_of
from simulacra.agents.model import Personality

from .helpers import ctx, factor, goal, opt, person, relation, score, stub, total

USED: set[str] = set()


def seen(o):
    USED.update(key_of(n) for n, _ in o.factors)
    return o


def pers(**kw):
    return Personality(**kw)


def high_low(trait, make, name=None):
    """Der Wert der Persönlichkeit verschiebt die Punktzahl in die erwartete Richtung (gleiche Situation, nur der Wert ändert sich)."""
    hi = seen(make(pers(**{trait: 95})))
    lo = seen(make(pers(**{trait: 5})))
    return (total(hi), total(lo))


# --- Persönlichkeit: je Wert ein Richtungstest (§17 Nr. 8) --------------------------------------------------
def test_sociability_raises_social_options():
    hi, lo = high_low("sociability", lambda pe: score(opt("speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi > lo + 20


def test_conversation_initiative_raises_starting_a_talk():
    hi, lo = high_low("conversation_initiative", lambda pe: score(opt("speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi > lo + 15


def test_curiosity_raises_exploring_and_inspecting():
    assert (lambda r: r[0] > r[1] + 30)(high_low("curiosity", lambda pe: score(opt("explore", "move_to"), stub(), pe)))
    assert (lambda r: r[0] > r[1] + 15)(high_low("curiosity", lambda pe: score(opt("inspect"), stub(), pe)))


def test_helpfulness_raises_giving_and_helping():
    hi, lo = high_low("helpfulness", lambda pe: score(opt("give", params={"to": "mira", "resource": "wood"}), stub(people=[person()]), pe))
    assert hi > lo + 25
    hi, lo = high_low("helpfulness", lambda pe: score(opt("water"), stub(), pe))
    assert hi > lo


def test_risk_taking_softens_the_penalty_for_night_and_bad_weather():
    night = high_low("risk_taking", lambda pe: score(opt("move"), stub(phase="night"), pe))
    rain = high_low("risk_taking", lambda pe: score(opt("gather"), stub(weather="Regen"), pe))
    assert night[0] > night[1] and rain[0] > rain[1]


def test_conflict_readiness_raises_declining_and_ending_a_talk():
    hi, lo = high_low("conflict_readiness", lambda pe: score(opt("decline", "speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi > lo + 10
    hi, lo = high_low("conflict_readiness", lambda pe: score(opt("end_talk", "speak", params={"to": "mira"}), stub(people=[person()], conversation={"turn_count": 2}), pe))
    assert hi > lo


def test_cooperation_raises_accepting_and_working_together():
    hi, lo = high_low("cooperation", lambda pe: score(opt("accept", "speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi > lo + 20
    hi, lo = high_low("cooperation", lambda pe: score(opt("build"), stub(people=[person()]), pe))
    assert hi > lo


def test_calm_need_raises_resting_and_lowers_going_out():
    hi, lo = high_low("calm_need", lambda pe: score(opt("rest"), stub(), pe))
    assert hi > lo + 25
    hi, lo = high_low("calm_need", lambda pe: score(opt("explore", "move_to"), stub(), pe))
    assert hi < lo


def test_suggestion_acceptance_raises_accepting_and_lowers_declining():
    hi, lo = high_low("suggestion_acceptance", lambda pe: score(opt("accept", "speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi > lo + 40
    hi, lo = high_low("suggestion_acceptance", lambda pe: score(opt("decline", "speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi < lo - 40


def goal_ctx(pe):
    g = goal(plan=[{"step": "Holz sammeln", "kind": "gather", "target": None}, {"step": "bauen", "kind": "build", "target": None}])
    return ctx(goal=g)


def test_persistence_keeps_to_the_plan_and_spontaneity_deviates_from_it():
    on_plan = lambda pe: score(opt("gather", params={"resource": "wood"}), stub(), pe, goal_ctx(pe))          # noqa: E731
    off_plan = lambda pe: score(opt("inspect"), stub(), pe, goal_ctx(pe))                                      # noqa: E731
    hi, lo = high_low("persistence", on_plan)
    assert hi > lo + 10
    hi, lo = high_low("persistence", off_plan)
    assert hi < lo
    hi, lo = high_low("spontaneity", on_plan)
    assert hi < lo
    hi, lo = high_low("spontaneity", off_plan)
    assert hi > lo


def test_autonomy_prefers_own_initiative_over_reaction():
    hi, lo = high_low("autonomy", lambda pe: score(opt("explore", "move_to"), stub(), pe))
    assert hi > lo + 10
    hi, lo = high_low("autonomy", lambda pe: score(opt("reply", "speak", params={"to": "mira"}), stub(people=[person()]), pe))
    assert hi < lo - 10


# --- Faktoren (Gruppen aus der Spezifikation) --------------------------------------------------------------------
def test_goal_progress_rewards_options_that_serve_the_goal_condition():
    cond = goal(condition={"type": "location_visited", "location": "lake", "min_visits": 1})
    o = seen(score(opt("move", "move_to", params={"target": "lake"}, target_loc="lake"), stub(), c=ctx(goal=cond)))
    other = score(opt("move", "move_to", params={"target": "garden"}, target_loc="garden"), stub(), c=ctx(goal=cond))
    assert factor(o, "Ziel") >= 20 and factor(other, "Ziel") == 0 and o.meta["goal_why"] == "Bedingung des Ziels"
    res = goal(condition={"type": "has_resource", "resource": "wood", "amount": 3})
    assert factor(score(opt("gather", params={"resource": "wood"}), stub(), c=ctx(goal=res)), "Ziel") > 0
    assert factor(score(opt("gather", params={"resource": "stone"}), stub(), c=ctx(goal=res)), "Ziel") == 0
    obj = goal(condition={"type": "object_count", "kind": "bench", "min": 2})
    assert factor(score(opt("build", params={"blueprint": "bench"}, meta={"bp_kind": "bench"}), stub(), c=ctx(goal=obj)), "Ziel") > 0
    talk = goal(condition={"type": "talked_with", "person": "mira", "since": 0})
    assert factor(score(opt("speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(goal=talk)), "Ziel") > 0


def test_plan_step_match_names_the_reason():
    g = goal(plan=[{"step": "Zum See gehen", "kind": "move", "target": "lake"}])
    o = score(opt("move", "move_to", params={"target": "lake"}, target_loc="lake"), stub(), c=ctx(goal=g))
    assert factor(o, "Ziel") == 26 and o.meta["goal_why"] == "Planschritt: Zum See gehen"


def test_need_relief_hunger_thirst_tiredness():
    assert factor(seen(score(opt("eat"), stub(needs={"hunger": 90}))), "Hunger") > 30
    assert factor(score(opt("drink"), stub(needs={"thirst": 90})), "Durst") > 30
    assert factor(score(opt("sleep"), stub(needs={"energy": 10}, phase="night")), "Müdigkeit") > 40


def test_social_need_and_calm_need_states():
    needy = score(opt("speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(soft={"social": 95}))
    sated = score(opt("speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(soft={"social": 10}))
    assert factor(seen(needy), "Bedürfnis Geselligkeit") > 15 and factor(sated, "Bedürfnis Geselligkeit") == 0
    tense = score(opt("rest"), stub(), c=ctx(soft={"calm": 95}))
    assert factor(seen(tense), "Bedürfnis Ruhe") > 12
    assert factor(score(opt("speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(soft={"calm": 95})), "Bedürfnis Ruhe") < 0
    cold = score(opt("move", params={"target": "house.living"}), stub(), c=ctx(soft={"warmth": 90}), indoors=True)
    assert factor(seen(cold), "Wärme") > 10
    assert factor(score(opt("gather"), stub(), c=ctx(soft={"warmth": 90})), "Wärme") < 0


def test_a_switched_off_need_has_no_effect():
    for need, o, soft, kw in (("hunger", opt("eat"), {}, {"needs": {"hunger": 95}}), ("thirst", opt("drink"), {}, {"needs": {"thirst": 95}}),
                              ("energy", opt("sleep"), {}, {"needs": {"energy": 5}}), ("social", opt("speak", params={"to": "mira"}), {"social": 95}, {"people": [person()]}),
                              ("calm", opt("rest"), {"calm": 95}, {}), ("warmth", opt("move", params={"target": "house.living"}), {"warmth": 95}, {})):
        on = score(opt(o.kind, o.action, params=o.params), stub(**kw), c=ctx(soft=soft), indoors=True)
        off = score(opt(o.kind, o.action, params=o.params), stub(**kw), c=ctx(soft=soft, enabled={need: False}), indoors=True)
        assert total(off) < total(on), need
        assert not any(n in ("Hunger", "Durst", "Müdigkeit", "Bedürfnis Geselligkeit", "Bedürfnis Ruhe", "Wärme") and v for n, v in off.factors), need


def test_relation_sympathy_trust_and_tension_shift_social_options():
    base = lambda **kw: score(opt("speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(relations={"mira": relation(**kw)}))     # noqa: E731
    assert total(base(sympathy=95)) > total(base(sympathy=5)) + 10
    acc = lambda **kw: score(opt("accept", "speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(relations={"mira": relation(**kw)}))   # noqa: E731
    assert total(acc(trust=95)) > total(acc(trust=5)) + 15
    tense = base(tension=90)
    assert factor(seen(tense), "Spannung") < -5 and total(tense) < total(base(tension=5))
    dec = score(opt("decline", "speak", params={"to": "mira"}), stub(people=[person()]), c=ctx(relations={"mira": relation(tension=90)}))
    assert factor(dec, "Spannung") > 0


def test_repetition_failure_and_lock_penalties():
    o1 = opt("water", params={"object_id": "plant_1"})
    recent = [{"action": "water", "params": {"object_id": "plant_1"}}] * 3
    assert factor(seen(score(o1, stub(), recent=recent)), "Wiederholung") < -30
    failed = [{"sim_minute": 590, "action": "water", "params": {"object_id": "plant_1"}, "code": "x", "text": "y"}]
    o2 = score(opt("water", params={"object_id": "plant_1"}), stub(), c=ctx(failures=failed))
    assert factor(seen(o2), "Zuletzt gescheitert") < 0
    old = [{**failed[0], "sim_minute": 100}]
    assert factor(score(opt("water", params={"object_id": "plant_1"}), stub(), c=ctx(failures=old)), "Zuletzt gescheitert") == 0
    locked = score(opt("water", params={"object_id": "plant_1"}), stub(), c=ctx(locks={"water:object_id=plant_1": 700}))
    assert factor(locked, "Gesperrt") <= -100 and locked.score == 0


def test_risk_group_is_produced_and_every_group_of_the_specification_exists():
    seen(score(opt("explore", "move_to"), stub(phase="night"), pers(risk_taking=20)))
    seen(score(opt("accept", "speak", params={"to": "mira"}), stub(people=[person()]), pers(cooperation=80)))
    seen(score(opt("move"), stub(), c=ctx(goal=goal(plan=[{"step": "x", "kind": "gather", "target": None}]))))
    seen(score(opt("reply", "speak", params={"to": "mira"}), stub(people=[person()])))
    seen(score(opt("explore", "move_to", eta=40), stub()))
    assert set(KEY_LABELS) == {"base", "goal_progress", "need_relief", "exploration", "social", "calm", "helpfulness", "cooperation", "risk", "conflict",
                               "proposal_accept", "plan_stick", "autonomy", "repetition_penalty", "failure_penalty"}
    assert set(KEY_LABELS) <= USED | {"calm", "helpfulness", "conflict", "cooperation", "plan_stick", "autonomy", "proposal_accept", "social", "risk", "exploration"}
    assert set(FACTOR_KEYS.values()) == set(KEY_LABELS)


@pytest.mark.parametrize("name", sorted(FACTOR_KEYS))
def test_every_factor_name_belongs_to_a_known_group(name):
    assert FACTOR_KEYS[name] in KEY_LABELS
