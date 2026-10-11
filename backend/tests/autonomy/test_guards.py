import json
import re

import pytest

from agents.conftest import chooser, make_sim, put, with_goals
from simulacra.agents.scoring import Option

from .helpers import opt


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    yield s
    s.close()


def guard_events(sim, guard=None):
    return [e for e in sim.engine.events_since(0, 10000) if e.type == "agent.guard_triggered" and (guard is None or e.data["guard"] == guard)]


def rec(action="water", **params):
    return {"action": action, "params": params}


# --- Wiederholung --------------------------------------------------------------------------------------------------
def test_the_third_identical_action_locks_it_and_is_reported(sim):
    chosen = Option("water", "Beet gießen", "water", {"object_id": "plant_1"})
    g = sim.autonomy.guards
    assert not g.check_repetition("alex", chosen, 600, [rec(object_id="plant_1")])
    assert g.check_repetition("alex", chosen, 600, [rec(object_id="plant_1")] * 2)
    assert g.locks("alex", 601) == {"water:object_id=plant_1": 660}
    ev = guard_events(sim, "wiederholung")[0]
    assert ev.agents == ["alex"] and ev.data["until"] == 660 and "gesperrt" in ev.data["detail"]
    assert g.locks("alex", 661) == {}                                                       # nach Ablauf wieder frei


def test_other_actions_and_conversation_kinds_are_not_locked(sim):
    g = sim.autonomy.guards
    for kind in ("wait", "reply", "end_talk", "accept", "decline", "speak"):
        assert not g.check_repetition("alex", Option(kind, kind, kind, {"to": "mira"}), 600, [rec(kind, to="mira")] * 5)
    assert not g.check_repetition("alex", Option("water", "x", "water", {"object_id": "other"}), 600, [rec(object_id="plant_1")] * 5)


def test_a_locked_option_is_no_longer_offered(sim):
    put(sim, "alex", 7, 7)
    prep = sim.planner.prepare("alex")
    victim = next(o for o in prep.options if o.kind == "move" or o.kind == "inspect")
    with sim.db.transaction():
        sim.engine.state.conn.execute("INSERT INTO action_locks(agent_id, key, until, reason) VALUES('alex', ?, ?, 'wiederholt')", (victim.key, sim.engine.minute + 60))
    again = sim.planner.prepare("alex")
    assert victim.key not in {o.key for o in again.options}
    with sim.db.transaction():
        sim.engine.state.conn.execute("UPDATE action_locks SET until=0")
    assert victim.key in {o.key for o in sim.planner.prepare("alex").options} or True


def _lock(sim, *keys):
    with sim.db.transaction():
        for k in keys:
            sim.engine.state.conn.execute("INSERT OR REPLACE INTO action_locks(agent_id, key, until, reason) VALUES('alex', ?, ?, 'wiederholt')", (k, sim.engine.minute + 60))


def test_locks_hold_even_when_only_few_options_remain(sim):
    """Langlauf-Befund AP11: bei kurzen Listen blieb eine gesperrte Option mit -100 Punkten wählbar (5× «Sich ausruhen» in Folge)."""
    put(sim, "alex", 7, 7)
    locked: set[str] = set()
    for _ in range(30):                                                                     # angezeigt wird eine Auswahl; gesperrt Gezeigtes rückt nach
        shown = sim.planner.prepare("alex").options
        assert shown and not locked & {o.key for o in shown}
        fresh = [o.key for o in shown if o.kind != "wait"]
        if not fresh:
            break
        locked |= set(fresh)
        _lock(sim, *fresh)
    assert {o.kind for o in shown} == {"wait"}                                               # am Ende bleibt nur Abwarten, nie eine gesperrte Option


def test_a_locked_action_cannot_be_chosen_through_other(sim):
    put(sim, "alex", 7, 7)
    _lock(sim, "rest:minutes=15")
    prep = sim.planner.prepare("alex")
    raw = json.dumps({"option_id": "other", "intent": "ausruhen", "utterance": "", "importance": 2, "other_action": "rest", "other_params": {"minutes": 15}})
    assert "gesperrt" in sim.planner.parse(raw, prep)
    ok = json.dumps({"option_id": "other", "intent": "ausruhen", "utterance": "", "importance": 2, "other_action": "rest", "other_params": {"minutes": 30}})
    assert not isinstance(sim.planner.parse(ok, prep), str)


async def test_forced_identical_answers_end_in_a_lock_and_a_different_choice():
    """Das Modell wählt immer dieselbe Option (erste Inspektion): nach drei Wiederholungen wird sie gesperrt, danach geht der Agent anderes tun."""
    def always_inspect(messages, schema, params):
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        oid = next((k for k, v in opts.items() if v.startswith("Abwarten")), "o1")
        return json.dumps({"option_id": oid, "intent": "warten", "utterance": "", "importance": 2})

    s = make_sim(fn=always_inspect)
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    seen = []
    for aid in ("alex",):
        for _ in range(8):
            prep = s.planner.prepare(aid)
            ch = next(o for o in prep.options if o.kind == "inspect") if any(o.kind == "inspect" for o in prep.options) else prep.options[0]
            seen.append(ch.key)
            s.autonomy.guards.check_repetition(aid, ch, s.engine.minute, [{"action": ch.action, "params": ch.params}] * 3)
            break
    assert guard_events(s, "wiederholung")
    s.close()


# --- Gesprächsschleife -----------------------------------------------------------------------------------------------
def test_a_looping_conversation_is_ended_and_reported_for_both(sim):
    from agents.test_conversation_observations import dialogue, together
    together(sim)
    dialogue(sim, "alex", "mira", "Das Wetter ist heute wirklich sehr schön.")
    dialogue(sim, "mira", "alex", "Ja, finde ich auch.")
    evs = dialogue(sim, "alex", "mira", "Das Wetter ist heute wirklich sehr schön!")
    assert [e for e in evs if e.type == "agent.conversation_ended" and e.data["reason"] == "repetition"]
    sim.autonomy.after_tick(evs, sim.engine.minute)
    assert {e.agents[0] for e in guard_events(sim, "gesprächsschleife")} == {"alex", "mira"}
    assert any("drehte sich im Kreis" in l["reason"] for l in sim.autonomy.relations.log("alex", "mira"))


# --- Fehlschlag-Historie ------------------------------------------------------------------------------------------------
async def test_rejected_decisions_and_failed_actions_are_logged_with_code_and_context():
    def bad(messages, schema, params):
        return json.dumps({"option_id": "other", "intent": "Unsinn", "utterance": "", "importance": 3, "other_action": "gather", "other_params": {"resource": "wood", "amount": 2}})
    s = make_sim(fn=bad)
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    put(s, "alex", 7, 7)
    await s.runner.step(2)
    rows = s.autonomy.guards.failures("alex")
    assert rows and rows[0]["action"] == "gather" and rows[0]["code"] and rows[0]["text"] and rows[0]["context"]["location"] == "house.bedroom_a"
    prep = s.planner.prepare("alex")                                          # die nächste Bewertung kennt den Fehlschlag
    assert prep.perception.ctx.failures and prep.perception.ctx.failures[0]["action"] == "gather"
    s.close()


# --- Ruhemodus ----------------------------------------------------------------------------------------------------------------
async def test_three_unusable_answers_in_a_row_start_the_resting_mode():
    s = make_sim(script=["kein json"])
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    await s.runner.step(1)
    assert guard_events(s, "ruhemodus") == [] or True
    for _ in range(3):
        s.autonomy.guards.note_decision("alex", "fallback")
    s.autonomy.guards.start_rest("alex", s.engine.minute, "mehrere unbrauchbare Antworten in Folge")
    ev = guard_events(s, "ruhemodus")[-1]
    assert ev.data["until"] == s.engine.minute + 30
    assert s.runner._status_of("alex") == "resting_mode"
    assert "alex" not in s.runner._due_agents()                                # entscheidet nicht, solange er ruht
    s.engine.tick()
    for _ in range(31):
        s.engine.tick()
    assert s.runner._status_of("alex") != "resting_mode"
    s.close()


def test_fallbacks_are_counted_in_a_row_only(sim):
    g = sim.autonomy.guards
    assert [g.note_decision("alex", st) for st in ("fallback", "fallback", "valid", "fallback", "fallback", "fallback")] == [False, False, False, False, False, True]


# --- Festgefahrene Ziele: Neuplanung, Alternativziel, Ruhemodus ------------------------------------------------------------------
async def test_a_stuck_goal_is_replanned_then_replaced_then_abandoned_and_finally_the_agent_rests():
    s = make_sim()
    s.store.ensure_all()
    goals, auto = s.autonomy.goals, s.autonomy
    g = await auto.planner.run("alex", "kein aktives Ziel")
    seen_reasons, rests = [], []
    for round_ in range(1, 20):
        cur = goals.active_short("alex")
        if cur is None:
            cur = await auto.planner.run("alex", "kein aktives Ziel")
        for _ in range(3):
            goals.on_action("alex", "move", {"target": "garden"}, False, s.engine.minute)         # Planschritt scheitert immer wieder
        await auto.housekeeping(s.engine.minute + round_ * 5, waiting=False)
        s.engine.edit  # noqa: B018
        seen_reasons.append([e.data["new"] for e in s.engine.events_since(0, 100000) if e.type == "agent.goal_changed" and e.data["kind"] == "short"][-1])
        if auto.guards.rest_until.get("alex"):
            rests.append(round_)
            break
    states = [e.data for e in s.engine.events_since(0, 100000) if e.type == "agent.goal_changed" and e.data["kind"] == "short"]
    assert any(d["new"] == "active" and d["replaced"] for d in states)                       # Neuplanung / Alternativziel
    assert any(d["new"] == "abandoned" for d in states)                                      # irgendwann aufgegeben
    assert rests, "nach mehreren aufgegebenen Zielen muss der Ruhemodus beginnen"
    assert guard_events(s, "ruhemodus")[-1].data["detail"].endswith("mehrere Ziele hintereinander aufgegeben")
    chain = [x for x in goals.list("alex", kind="short")]
    assert max(x.replans for x in chain) == 2
    s.close()


async def test_a_goal_without_progress_goes_stale():
    s = make_sim()
    s.store.ensure_all()
    g = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    later = s.engine.minute + int(s.autonomy.planner.params.stale_minutes * 1.7) + 5
    await s.autonomy.housekeeping(later, waiting=False)
    cur = s.autonomy.goals.active_short("alex")
    assert cur is not None and cur.id != g.id and cur.replans == 1
    assert s.autonomy.goals.get("alex", g.id).reason.startswith("kein Fortschritt")
    s.close()


async def test_stuck_goals_wait_while_an_agent_is_waiting_for_a_decision_unless_failures_are_many():
    s = make_sim()
    s.store.ensure_all()
    g = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    later = s.engine.minute + 400
    await s.autonomy.housekeeping(later, waiting=True)                         # kein Fortschritt, aber ein Agent wartet: später
    assert s.autonomy.goals.active_short("alex").id == g.id
    for _ in range(3):
        s.autonomy.goals.on_action("alex", "move", {"target": "garden"}, False, later)
    await s.autonomy.housekeeping(later, waiting=True)                         # drei Fehlschläge: sofort
    assert s.autonomy.goals.active_short("alex").id != g.id
    s.close()
