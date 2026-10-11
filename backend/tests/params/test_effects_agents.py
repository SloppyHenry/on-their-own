"""Wirkungstests: Die Regler für Autonomie, Persönlichkeit und Charakter verändern wirklich das Verhalten (nicht nur einen gespeicherten Wert)."""

import json

from agents.conftest import make_sim
from autonomy.helpers import ctx, goal, opt, person, score, stub, total

from simulacra.agents.model import PERSONALITY_LABELS, Personality

from .conftest import patch


def pts(sim, make):
    return total(make(sim.autonomy.effective(Personality())))


async def test_global_shifts_move_scores(sim):
    for key, lo_hi in (("exploration", lambda pe: score(opt("explore", "move_to"), stub(), pe)),
                       ("autonomy", lambda pe: score(opt("explore", "move_to"), stub(), pe)),
                       ("initiative", lambda pe: score(opt("speak", params={"to": "mira"}), stub(people=[person()]), pe))):
        await patch(sim, key, 50)
        mid = pts(sim, lo_hi)
        await patch(sim, key, 100)
        high = pts(sim, lo_hi)
        await patch(sim, key, 0)
        low = pts(sim, lo_hi)
        assert high > mid + 5 > low + 10, key
        await patch(sim, key, 50)

    g = goal(plan=[{"step": "Holz sammeln", "kind": "gather", "target": None}, {"step": "bauen", "kind": "build", "target": None}])
    on_plan = lambda pe: score(opt("gather", params={"resource": "wood"}), stub(), pe, ctx(goal=g))        # noqa: E731
    await patch(sim, "goal_persistence", 100)
    stay = pts(sim, on_plan)
    await patch(sim, "goal_persistence", 0)
    assert stay > pts(sim, on_plan) + 10
    await patch(sim, "goal_persistence", 50)

    off_plan = lambda pe: score(opt("inspect"), stub(), pe, ctx(goal=g))                                    # noqa: E731
    await patch(sim, "spontaneity", 100)
    wander = pts(sim, off_plan)
    await patch(sim, "spontaneity", 0)
    assert wander > pts(sim, off_plan)


async def test_shifts_reach_the_real_decision_and_are_limited_to_0_100(sim):
    base = {o.label: o.score for o in (await sim.engine.db.run(lambda: sim.planner.prepare("alex"))).options}
    await patch(sim, "exploration", 100)
    prep = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
    assert prep.perception.agent.personality.curiosity == 100                  # Alex hat 70, plus 50, begrenzt auf 100
    assert any(o.score > base[o.label] + 5 for o in prep.options if o.label in base)


async def test_planning_horizon_limits_plan_length():
    steps = [{"step": f"Schritt {i}", "kind": "rest", "target": None} for i in range(6)]
    answer = json.dumps({"text": "Etwas Langes vorhaben", "condition": {"type": "location_visited", "location": "garden"}, "plan": steps})
    sim = make_sim(script=[answer, answer])
    sim.store.ensure_all()
    sim.autonomy.planner.params.enabled = True
    long_plan = await sim.autonomy.planner.run("alex", "test")
    assert long_plan is not None and len(long_plan.plan) == 5                   # Standardhorizont
    await patch(sim, "planning_horizon", 2)
    assert sim.autonomy.planner.params.horizon == 2
    short = await sim.autonomy.planner.run("mira", "test")
    assert short is not None and len(short.plan) <= 2
    assert sim.client.provider.calls[-1]["schema"]["properties"]["plan"]["maxItems"] == 2
    sim.close()


async def test_decision_interval_spaces_decisions(sim):
    await sim.runner.step(8)
    often = sim.runner.stats.decisions
    await patch(sim, "decision_interval", 4)
    before = sim.runner.stats.decisions
    await sim.runner.step(8)
    spaced = sim.runner.stats.decisions - before
    assert often >= 8 and spaced <= 6 and spaced < often


async def test_top_k_limits_the_offered_options(sim):
    await patch(sim, "top_k_options", 3)
    prep = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
    assert len(prep.options) == 3
    await patch(sim, "top_k_options", 10)
    prep = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
    assert 3 < len(prep.options) <= 10


async def test_personality_value_moves_the_scores(sim):
    points = {}
    for value in (95, 5):
        await patch(sim, "personality.curiosity", value, "alex")
        prep = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
        assert prep.perception.agent.personality.curiosity == value                          # die Entscheidung liest den gespeicherten Wert
        assert f"Neugier {value}" in prep.messages[0]["content"]
        points[value] = total(score(opt("explore", "move_to"), stub(), prep.perception.agent.personality))
    assert points[95] > points[5] + 25
    for trait, label in PERSONALITY_LABELS.items():                                          # jeder der zwölf Regler erreicht Entscheidung und Prompt
        await patch(sim, f"personality.{trait}", 83, "mira")
        prep = await sim.engine.db.run(lambda: sim.planner.prepare("mira"))
        assert getattr(prep.perception.agent.personality, trait) == 83 and f"{label} 83" in prep.messages[0]["content"], trait
    await patch(sim, "personality.curiosity", 40, "mira")                                    # nur der gewählte Agent ändert sich
    assert sim.store.get("alex").personality.curiosity == 5 and sim.store.get("mira").personality.curiosity == 40


async def test_profile_text_reaches_the_prompt(sim):
    await patch(sim, "profile.interests", "Schach, Drachen; Töpfern", "mira")
    await patch(sim, "profile.description", "ein sehr geduldiger Mensch", "mira")
    await patch(sim, "profile.goals", "Eine Bibliothek bauen", "alex")
    mira = (await sim.engine.db.run(lambda: sim.planner.prepare("mira"))).messages[0]["content"]
    assert "Schach, Drachen, Töpfern" in mira and "ein sehr geduldiger Mensch" in mira
    assert "Schach" not in (await sim.engine.db.run(lambda: sim.planner.prepare("alex"))).messages[0]["content"]
    texts = [g.text for g in sim.autonomy.goals.long_goals("alex")]
    assert texts == ["Eine Bibliothek bauen"]                                  # die alten persönlichen Ziele sind aufgegeben


async def test_interests_and_goals_text_also_move_the_scores(sim):
    await patch(sim, "top_k_options", 10)
    await patch(sim, "profile.interests", "Pflanzen", "alex")
    base = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
    word = next(w for o in base.options for w in o.label.replace("(", " ").split() if len(w) > 5 and w[0].isupper() and w not in ("Richtung", "Ein", "Sich"))
    await patch(sim, "profile.interests", word, "alex")                                   # ein Wort, das in einer Option vorkommt
    prep = await sim.engine.db.run(lambda: sim.planner.prepare("alex"))
    hit = [o for o in prep.options if word.lower() in o.label.lower()]
    assert hit and all(sum(v for n, v in o.factors if n == "Interessen") >= 5 for o in hit)
    before = {o.label: sum(v for n, v in o.factors if n == "Interessen") for o in base.options}
    assert all(before[o.label] < 5 for o in hit if o.label in before)                      # vorher hat dasselbe Wort nichts bewirkt


async def test_rank_hint_reaches_the_prompt(sim):
    user = lambda: sim.engine.db.run(lambda: sim.planner.prepare("alex").messages[1]["content"])          # noqa: E731
    hinted = await user()                                                                                  # Standard: an
    assert "o1 passt am besten" in hinted and "\nOptionen:\n" not in hinted
    await patch(sim, "rank_hint", False)
    plain = await user()
    assert "\nOptionen:\n" in plain and "o1 passt am besten" not in plain
    await patch(sim, "rank_hint", True)
    assert await user() == hinted
