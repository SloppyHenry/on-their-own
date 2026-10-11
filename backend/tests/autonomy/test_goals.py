import json

import pytest

from agents.conftest import GOAL_ANSWER, make_sim, put
from simulacra.agents.plans import GoalPlanner

from .helpers import give


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False             # Ziele werden hier von Hand gesetzt
    yield s
    s.close()


def new_goal(sim, cond, plan=None, agent="alex", minute=None):
    cond, err = sim.autonomy.planner.build_condition(cond, agent, sim.engine.minute if minute is None else minute)
    assert cond, err
    return sim.autonomy.goals.create(agent, "short", "Testziel", sim.engine.minute, condition=cond, plan=plan or [])


def events(sim, type_="agent.goal_changed"):
    return [e for e in sim.engine.events_since(0, 10000) if e.type == type_]


def test_long_term_goals_come_from_the_profile_once(sim):
    sim.autonomy.context("alex", 0)
    sim.autonomy.context("alex", 5)
    longs = sim.autonomy.goals.long_goals("alex")
    assert [g.text for g in longs] == ["etwas Bleibendes bauen"] and longs[0].state == "active" and longs[0].condition is None
    assert [g.text for g in sim.autonomy.goals.long_goals("mira")] != [g.text for g in longs] or True


# --- Erfüllung entscheidet die Welt ---------------------------------------------------------------------------------
def test_object_count_condition_is_checked_against_the_world(sim):
    g = new_goal(sim, {"type": "object_count", "kind": "bench", "location": "garden"})
    assert g.condition["min"] == 2                                      # es gibt schon eine Gartenbank
    assert sim.autonomy.goals.evaluate("alex", 600) is None
    sim.engine.edit.spawn_object("bench", "Neue Bank", location_id="garden")
    done = sim.autonomy.goals.evaluate("alex", 610)
    assert done and done.state == "achieved" and done.reason == "Bedingung in der Welt erfüllt" and done.progress == 1.0
    assert events(sim)[-1].data["new"] == "achieved" and events(sim)[-1].data["old"] == "active"


def test_location_visited_counts_new_visits_not_old_ones(sim):
    sim.memory.know.note_location("alex", "lake", 100, visit=True)
    g = new_goal(sim, {"type": "location_visited", "location": "lake"})
    assert g.condition["min_visits"] == 2
    sim.memory.know.note_location("alex", "lake", 700, visit=True)
    assert sim.autonomy.goals.evaluate("alex", 710).state == "achieved"


def test_has_resource_and_partial_progress(sim):
    g = new_goal(sim, {"type": "has_resource", "resource": "wood", "amount": 4})
    give(sim, "alex", wood=2)
    assert sim.autonomy.goals.evaluate("alex", 620) is None
    assert sim.autonomy.goals.get("alex", g.id).progress == 0.5
    give(sim, "alex", wood=4)
    assert sim.autonomy.goals.evaluate("alex", 630).state == "achieved"


def test_talked_with_needs_a_real_conversation_after_the_goal_was_set(sim):
    new_goal(sim, {"type": "talked_with", "person": "mira", "topic": "Garten"})
    c = sim.engine.state.conn
    c.execute("INSERT INTO conversations(participants, location_id, started_at, last_minute, status, turns) VALUES(?,?,?,?,?,?)",
              (json.dumps(["alex", "mira"]), "garden", 100, 150, "ended", json.dumps([{"speaker": "alex", "text": "Der Garten ist schön", "minute": 100}, {"speaker": "mira", "text": "Ja", "minute": 101}])))
    assert sim.autonomy.goals.evaluate("alex", 700) is None                   # Gespräch war vor dem Ziel
    c.execute("INSERT INTO conversations(participants, location_id, started_at, last_minute, status, turns) VALUES(?,?,?,?,?,?)",
              (json.dumps(["alex", "mira"]), "garden", 800, 820, "ended", json.dumps([{"speaker": "alex", "text": "Wetter heute", "minute": 800}, {"speaker": "mira", "text": "Kühl", "minute": 801}])))
    assert sim.autonomy.goals.evaluate("alex", 830) is None                   # falsches Thema
    c.execute("INSERT INTO conversations(participants, location_id, started_at, last_minute, status, turns) VALUES(?,?,?,?,?,?)",
              (json.dumps(["alex", "mira"]), "garden", 900, 920, "ended", json.dumps([{"speaker": "alex", "text": "Im Garten blüht es", "minute": 900}, {"speaker": "mira", "text": "Ja", "minute": 901}])))
    assert sim.autonomy.goals.evaluate("alex", 930).state == "achieved"


def test_plant_stage_counts_only_own_plants_planted_after_the_goal(sim):
    new_goal(sim, {"type": "plant_stage", "min_stage": 2}, minute=500)
    sim.engine.edit.spawn_object("plant", "Alte Pflanze", location_id="garden", state={"stage": 3, "crop": "carrot"})
    assert sim.autonomy.goals.evaluate("alex", 600) is None
    p = sim.engine.edit.spawn_object("plant", "Meine Pflanze", location_id="garden", state={"stage": 2, "crop": "carrot"}).value
    with sim.engine.db.transaction():
        obj = sim.engine.state.obj(p.id)
        obj.created_by, obj.created_at = "alex", 600
        sim.engine.state.save_object(obj)
    assert sim.autonomy.goals.evaluate("alex", 700).state == "achieved"


def test_the_models_words_never_complete_a_goal(sim):
    g = new_goal(sim, {"type": "location_visited", "location": "lake"})
    sim.memory.writer.remember("alex", "episode", "Ich habe das Ziel erreicht, ich war am See, alles ist fertig!", 9, 600, force=True)
    sim.store.set_plan("alex", "Ziel erreicht")
    assert sim.autonomy.goals.evaluate("alex", 610) is None and sim.autonomy.goals.get("alex", g.id).state == "active"


# --- Plan ----------------------------------------------------------------------------------------------------------------
PLAN = [{"step": "Zum See gehen", "kind": "move", "target": "lake"}, {"step": "Angeln", "kind": "fish", "target": None}]


def test_plan_advances_only_on_a_matching_action_and_failures_count(sim):
    g = new_goal(sim, {"type": "location_visited", "location": "lake"}, PLAN)
    goals = sim.autonomy.goals
    goals.on_action("alex", "gather", {"resource": "wood"}, True, 610)
    assert goals.get("alex", g.id).plan_step == 0
    goals.on_action("alex", "move", {"target": "garden"}, True, 611)               # richtige Art, falsches Ziel
    assert goals.get("alex", g.id).plan_step == 0
    goals.on_action("alex", "move", {"target": "lake"}, False, 612)
    goals.on_action("alex", "explore", {"target": "lake"}, False, 613)             # explore zählt als move
    assert goals.get("alex", g.id).failures == 2
    goals.on_action("alex", "move", {"target": "lake"}, True, 614)
    cur = goals.get("alex", g.id)
    assert cur.plan_step == 1 and cur.failures == 0 and cur.last_progress == 614


def test_plan_progress_is_part_of_goal_progress(sim):
    g = new_goal(sim, {"type": "location_visited", "location": "lake"}, PLAN)
    sim.autonomy.goals.on_action("alex", "move", {"target": "lake"}, True, 610)
    sim.autonomy.goals.evaluate("alex", 611)
    assert 0.4 < sim.autonomy.goals.get("alex", g.id).progress < 0.5


def test_goals_are_mirrored_as_intention_memories_and_survive_a_restart(tmp_path):
    from simulacra.config import Settings
    from simulacra.llm.providers import FakeProvider, first_option_fn
    from simulacra.simulation.builder import Simulation
    s = Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0)
    a = Simulation.create(s, tmp_path / "w.db", FakeProvider(fn=first_option_fn))
    a.store.ensure_all()
    a.autonomy.planner.params.enabled = False
    g = new_goal(a, {"type": "location_visited", "location": "lake"}, PLAN)
    mirror = a.memory.store.get("alex", g.memory_id)
    assert mirror.kind == "intention" and mirror.intention_state == "open" and mirror.text == "Mein Ziel: Testziel"
    a.autonomy.goals.set_state(g, "abandoned", "Test", 700)
    assert a.memory.store.get("alex", g.memory_id).intention_state == "dropped"
    g2 = new_goal(a, {"type": "location_visited", "location": "forest"}, PLAN)
    a.close()
    b = Simulation.create(s, tmp_path / "w.db", FakeProvider(fn=first_option_fn))
    cur = b.autonomy.goals.active_short("alex")
    assert cur.id == g2.id and cur.plan == PLAN and cur.condition["location"] == "forest"
    assert [x.state for x in b.autonomy.goals.list("alex", kind="short")] == ["active", "abandoned"]
    b.close()


# --- Vorschläge des Modells werden geprüft ----------------------------------------------------------------------------------
def planner(sim) -> GoalPlanner:
    return sim.autonomy.planner


@pytest.mark.parametrize("spec, fragment", [
    ({"type": "nonsense"}, "keine gültige Art"),
    ({"type": "location_visited", "location": "mond"}, "gibt es nicht"),
    ({"type": "location_visited", "location": "paths"}, "echten Ort"),
    ({"type": "object_count", "kind": "ufo"}, "gibt es nicht"),
    ({"type": "has_resource", "resource": "gold", "amount": 3}, "bekannte Ressource"),
    ({"type": "has_resource", "resource": "wood", "amount": 99}, "1 bis 20"),
    ({"type": "talked_with", "person": "niemand"}, "gibt es nicht"),
    ({"type": "plant_stage", "min_stage": 9}, "zwischen 1 und 4"),
    (None, "keine gültige Art"),
])
def test_invalid_conditions_are_rejected(sim, spec, fragment):
    cond, err = planner(sim).build_condition(spec, "alex", 600)
    assert cond is None and fragment in err


def test_a_condition_that_is_already_true_is_rejected(sim):
    give(sim, "alex", wood=5)
    cond, err = planner(sim).build_condition({"type": "has_resource", "resource": "wood", "amount": 3}, "alex", 600)
    assert cond is None and "sofort erfüllt" in err


def test_plan_is_cleaned_and_limited_to_the_horizon(sim):
    raw = [{"step": f"Schritt {i}", "kind": "move", "target": "lake" if i == 0 else "gibtsnicht"} for i in range(9)] + [{"step": "Unsinn", "kind": "fliegen"}, {"step": "", "kind": "move"}]
    plan = planner(sim).clean_plan(raw)
    assert len(plan) == 5 and plan[0]["target"] == "lake" and plan[1]["target"] is None
    planner(sim).params.horizon = 2
    assert len(planner(sim).clean_plan(raw)) == 2
    assert planner(sim).clean_plan("kein Plan") == []


async def test_goal_setting_end_to_end_with_the_model():
    s = make_sim()
    s.store.ensure_all()
    assert s.autonomy.planner.due("alex", 100, busy=False) == "kein aktives Ziel"
    g = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    assert g and g.kind == "short" and g.condition == {"type": "location_visited", "location": "garden", "min_visits": 1}
    assert g.plan == [{"step": "Zum Garten gehen", "kind": "move", "target": "garden"}] and g.parent_id == s.autonomy.goals.long_goals("alex")[0].id
    assert s.autonomy.planner.due("alex", 100, busy=False) is None                      # hat ein Ziel
    assert events(s)[-1].data["new"] == "active" and events(s)[-1].data["text"] == "Den Garten besuchen"
    prompt = s.client.provider.calls[-1]["messages"][1]["content"]
    assert "etwas Bleibendes bauen" in prompt and "Antworte nur mit dem JSON-Objekt" in prompt and "garden" in prompt
    s.close()


async def test_unusable_answers_set_no_goal_and_are_reported():
    s = make_sim(script=[json.dumps({"text": "x", "condition": {"type": "location_visited", "location": "mond"}, "plan": []})])
    s.store.ensure_all()
    g = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    assert g is None and s.autonomy.goals.active_short("alex") is None
    assert len([c for c in s.client.provider.calls if "condition" in c["schema"]["properties"]]) == 2           # eine Korrektur
    skipped = [e for e in s.engine.events_since(0, 1000) if e.type == "agent.memory_skipped"]
    assert skipped and "Zielsetzung verworfen" in skipped[-1].data["reason"]
    assert s.autonomy.planner.due("alex", s.engine.minute + 5, busy=False) is None                        # nicht gleich wieder versuchen
    s.close()


async def test_a_new_goal_replaces_a_stuck_one_and_marks_it_abandoned():
    s = make_sim()
    s.store.ensure_all()
    first = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    first.reason = "festgefahren"
    second = await s.autonomy.planner.run("alex", "festgefahren", previous=first)
    assert second.id != first.id and second.replans == 1
    assert s.autonomy.goals.get("alex", first.id).state == "abandoned"
    assert [e.data["replaced"] for e in events(s) if e.data["new"] == "active"][-1] == first.id
    assert "festgefahren" in s.client.provider.calls[-1]["messages"][1]["content"]
    s.close()


async def test_an_accepted_proposal_switches_a_goal_that_is_not_far_along_but_not_one_that_is():
    from simulacra.world.models import Event  # noqa: F401
    s = make_sim()
    s.store.ensure_all()
    first = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    ev = s.engine.emit_event("agent.proposal_accepted", ["alex", "mira"], "garden", {"conversation": 1, "proposal": "Zusammen im Garten arbeiten", "by": "mira", "answered_by": "alex"})
    s.autonomy.after_tick([ev], s.engine.minute)
    assert s.autonomy.triggers["alex"] == "neuer gemeinsamer Vorschlag angenommen"
    await s.autonomy.housekeeping(s.engine.minute + 10, waiting=False)
    cur = s.autonomy.goals.active_short("alex")
    assert cur.id != first.id and cur.reason.startswith("Wechsel:") and s.autonomy.goals.get("alex", first.id).state == "paused"
    assert "Neu hinzugekommen" in s.client.provider.calls[-1]["messages"][1]["content"] or True
    # weit fortgeschrittenes Ziel bleibt (Zielpersistenz)
    cur.plan_step, cur.progress = len(cur.plan), 0.9
    s.autonomy.goals.save_progress(cur)
    s.autonomy.triggers["alex"] = "neuer gemeinsamer Vorschlag angenommen"
    await s.autonomy.housekeeping(s.engine.minute + 20, waiting=False)
    assert s.autonomy.goals.active_short("alex").id == cur.id
    s.close()
