import pytest

from agents.conftest import make_sim, needs, put
from on_their_own.agents import mood as mood_mod
from on_their_own.agents.needs import NeedParams


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    s.autonomy.planner.params.enabled = False
    yield s
    s.close()


def run_ticks(sim, n, talking=()):
    for _ in range(n):
        sim.autonomy.needs.tick(["alex", "mira"], sim.engine.minute, set(talking))


def test_social_need_rises_alone_and_falls_when_together_or_talking(sim):
    put(sim, "alex", 7, 7)
    put(sim, "mira", 50, 30)
    before = sim.autonomy.needs.get("alex")["social"]
    run_ticks(sim, 120)
    alone = sim.autonomy.needs.get("alex")["social"]
    assert alone == pytest.approx(before + 10, abs=0.2)                       # 5 je Stunde, zwei Stunden
    put(sim, "mira", 8, 7)
    run_ticks(sim, 30)
    assert sim.autonomy.needs.get("alex")["social"] < alone - 3               # zusammen
    run_ticks(sim, 10, talking=["alex"])
    assert sim.autonomy.needs.get("alex")["social"] < alone - 10              # beim Reden deutlich mehr


def test_calm_need_rises_when_talking_and_drops_alone_faster_in_quiet_places(sim):
    put(sim, "alex", 7, 7)
    put(sim, "mira", 8, 7)
    run_ticks(sim, 60, talking=["alex"])
    talked = sim.autonomy.needs.get("alex")["calm"]
    assert talked > 30
    put(sim, "mira", 50, 30)
    run_ticks(sim, 120)
    alone = sim.autonomy.needs.get("alex")["calm"]
    assert alone < talked - 10


def test_warmth_is_off_by_default_and_works_when_enabled(sim):
    put(sim, "alex", 40, 25)                                                    # draußen auf dem Platz
    sim.engine.set_weather("rain", 600)
    run_ticks(sim, 120)
    assert sim.autonomy.needs.get("alex")["warmth"] == 0.0
    sim.autonomy.needs.params.enabled["warmth"] = True
    run_ticks(sim, 120)
    assert sim.autonomy.needs.get("alex")["warmth"] > 20
    put(sim, "alex", 7, 7)
    run_ticks(sim, 120)
    assert sim.autonomy.needs.get("alex")["warmth"] < 10                        # drinnen wird es wieder warm


def test_a_switched_off_need_stays_still(sim):
    sim.autonomy.needs.params.enabled["social"] = False
    put(sim, "alex", 7, 7)
    put(sim, "mira", 50, 30)
    before = sim.autonomy.needs.get("alex")["social"]
    run_ticks(sim, 600)
    assert sim.autonomy.needs.get("alex")["social"] == before


def test_critical_needs_are_reported_and_energy_works_the_other_way(sim):
    needs(sim, "alex", energy=10, hunger=90)
    body = sim.engine.state.agent("alex")
    soft = sim.autonomy.needs.get("alex")
    assert set(sim.autonomy.needs.critical(body.needs, soft)) >= {"energy", "hunger"}
    sim.autonomy.needs.params.enabled["hunger"] = False
    assert "hunger" not in sim.autonomy.needs.critical(body.needs, soft)


def test_a_switched_off_need_is_absent_from_the_prompt(sim):
    needs(sim, "alex", hunger=95, thirst=95)
    sim.autonomy.needs.params.enabled.update(hunger=False, thirst=False)
    prep = sim.planner.prepare("alex")
    text = prep.messages[1]["content"]
    assert "hungrig" not in text and "durstig" not in text and "Hunger" not in text
    sim.autonomy.needs.params.enabled.update(hunger=True, thirst=True)
    assert "hungrig" in sim.planner.prepare("alex").messages[1]["content"]
    sim.autonomy.needs.params.enabled["social"] = True
    sim.engine.state.conn.execute("UPDATE agent_needs SET social=95 WHERE agent_id='alex'")
    assert "Gesellschaft" in sim.planner.prepare("alex").messages[1]["content"]
    sim.autonomy.needs.params.enabled["social"] = False
    assert "Gesellschaft" not in sim.planner.prepare("alex").messages[1]["content"]


# --- Stimmung -----------------------------------------------------------------------------------------------------------
BODY = {"energy": 90.0, "hunger": 20.0, "thirst": 20.0}
SOFT = {"social": 20.0, "calm": 20.0, "warmth": 0.0}
ON = NeedParams().enabled


def test_mood_is_a_value_between_minus_one_and_one_with_reasons():
    m = mood_mod.compute(BODY, SOFT, ON, ["accepted"] * 4, True)
    assert -1 <= m.value <= 1 and m.word == "zufrieden" and m.reasons[0][0] == "Grundstimmung"
    assert dict(m.reasons)["Erfolge und Misserfolge"] > 0 and dict(m.reasons)["Gespräch"] > 0


def test_mood_drops_with_unmet_needs_and_failures_and_names_the_cause():
    tired = mood_mod.compute({**BODY, "energy": 5.0}, SOFT, ON, [], False)
    hungry = mood_mod.compute({**BODY, "hunger": 100.0, "thirst": 95.0}, SOFT, ON, [], False)
    lonely = mood_mod.compute(BODY, {**SOFT, "social": 100.0}, ON, [], False)
    assert tired.word == "erschöpft" and hungry.word == "gereizt" and lonely.word in ("einsam", "etwas matt", "ausgeglichen")
    assert tired.value < 0.1 and hungry.value < 0 and lonely.value < mood_mod.compute(BODY, SOFT, ON, [], False).value
    failing = mood_mod.compute(BODY, SOFT, ON, ["rejected"] * 6, False)
    assert dict(failing.reasons)["Erfolge und Misserfolge"] < 0 and failing.value < mood_mod.compute(BODY, SOFT, ON, ["accepted"] * 6, False).value


def test_switched_off_needs_do_not_darken_the_mood():
    on = mood_mod.compute({**BODY, "hunger": 100.0}, SOFT, ON, [], False)
    off = mood_mod.compute({**BODY, "hunger": 100.0}, SOFT, {**ON, "hunger": False}, [], False)
    assert off.value > on.value and "Hunger" not in dict(off.reasons)


def test_mood_word_in_the_prompt_comes_from_the_new_mood(sim):
    needs(sim, "alex", energy=5)
    assert "erschöpft" in sim.planner.prepare("alex").messages[1]["content"]
