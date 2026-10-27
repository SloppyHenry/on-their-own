import json
import re

from agents.conftest import make_sim, put
from on_their_own.agents.explain import NEG, PHRASE, clean_label, explain, group_factors


def opts():
    return [
        {"id": "o1", "label": "Zum See gehen (ca. 12 min)", "score": 71.0, "factors": [["Grundneigung", 24.0], ["Ziel", 26.0], ["Neugier", 14.0], ["Nacht", -9.0]]},
        {"id": "o2", "label": "Schlafen", "score": 40.0, "factors": [["Grundneigung", 14.0], ["Müdigkeit", 26.0]]},
    ]


def test_explanation_uses_only_logged_factors_with_their_values():
    text = explain("Alex", opts()[0], opts(), {"text": "Wald und See erkunden"}, "Planschritt: Zum See gehen", "will zum Wasser")
    assert text.startswith("Alex entscheidet sich für «Zum See gehen»")
    assert "es das Ziel «Wald und See erkunden» voranbringt (Planschritt: Zum See gehen) (+26,0)" in text and "(+14,0)" in text and "obwohl es dunkel ist (-9,0)" in text
    assert "Vom Agenten genannter Zweck: „will zum Wasser“." in text
    assert "Grundneigung" not in text and "Müdigkeit" not in text and "+24" not in text         # nur das Gewählte und Tatsächliche


def test_the_note_about_a_not_best_choice_names_both_scores():
    text = explain("Alex", opts()[1], opts(), None, None)
    assert "bestbewertete Option war «Zum See gehen» (71.0 gegen 40.0)" in text


def test_a_fallback_is_described_honestly():
    assert explain("Mira", None, [], None, None, fallback=True) == "Mira fand keine verwertbare Entscheidung und wartet kurz."


def test_group_sums_follow_the_specification_keys():
    g = group_factors([["Grundneigung", 24.0], ["Ziel", 26.0], ["Persönliche Ziele", 5.0], ["Hunger", 12.0], ["Nacht", -9.0], ["Wiederholung", -14.0]])
    assert g == {"base": 24.0, "goal_progress": 31.0, "need_relief": 12.0, "risk": -9.0, "repetition_penalty": -14.0}


def test_phrases_never_assume_a_gender():
    for phrase in list(PHRASE.values()) + list(NEG.values()):
        assert not re.search(r"\b(er|sie|ihm|ihr|ihn|sein|seine|seinen|seinem|ihre)\b", phrase), phrase


def test_every_label_has_a_phrase_or_is_neutral():
    assert clean_label("Etwas essen (ca. 3 min)") == "Etwas essen" and all(isinstance(v, str) for v in PHRASE.values())


# --- Mit der Simulation: das Protokoll deckt sich mit den Rohdaten ----------------------------------------------------------------------
def numbers(text):
    return {float(x.replace(",", ".")) for x in re.findall(r"\(([+-]\d+,\d)\)", text)}


async def test_every_decision_is_explainable_and_matches_the_raw_data():
    def pick_second(messages, schema, params):
        pairs = re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M)
        short = [k for k, v in pairs if not v.startswith(("Schlafen", "Im Bett", "Sich ausruhen"))]
        return json.dumps({"option_id": short[1] if len(short) > 1 else short[0], "intent": "mal etwas anderes", "utterance": "Hallo!", "importance": 4})
    s = make_sim(fn=pick_second)
    s.autonomy.planner.params.enabled = False
    put(s, "alex", 7, 7)
    put(s, "mira", 8, 7)
    await s.runner.step(300)
    rows = s.store.decisions(None, 100)
    assert len(rows) >= 12
    not_best = 0
    for r in rows:
        t = r["trace"]
        assert t and t["why"], r["id"]
        chosen = next(o for o in r["options"] if o["id"] == r["chosen"])
        logged = {v for n, v in chosen["factors"] if n != "Grundneigung"}
        assert numbers(t["why"]) <= logged, (t["why"], chosen["factors"])               # nur echte Werte im Text
        assert t["rank"] == 1 + sum(1 for o in r["options"] if o["score"] > chosen["score"])
        assert t["best"] == (t["rank"] == 1)
        assert "Vom Agenten genannter Zweck: „mal etwas anderes“" in t["why"]
        assert t["outcome"]["ok"] in (True, False) and t["groups"] == group_factors(chosen["factors"])
        if not t["best"]:
            not_best += 1
            assert "bestbewertete Option war" in t["why"]
    assert not_best >= 4
    ev = [e for e in s.engine.events_since(0, 100000) if e.type == "agent.decision"]
    assert all(e.data["why"] and e.data["rank"] for e in ev)
    row = rows[0]
    assert next(e for e in ev if e.data["decision_id"] == row["id"]).data["why"] == row["trace"]["why"]
    s.close()


async def test_the_trace_names_the_active_goal_and_the_retrieval():
    s = make_sim()
    s.store.ensure_all()
    g = await s.autonomy.planner.run("alex", "kein aktives Ziel")
    s.memory.writer.remember("alex", "episode", "Ich habe im Garten Beete gegossen.", 6, 100, location_id="garden")
    put(s, "alex", 7, 7)
    s.autonomy.planner.params.enabled = False
    await s.runner.step(3)
    d = next(r for r in s.store.decisions("alex", 10) if r["trace"]["goal"])
    assert d["trace"]["goal"]["text"] == "Den Garten besuchen" and d["goal_id"] == g.id and d["trace"]["goal"]["plan_len"] == 1
    assert d["trace"]["mood"]["word"] and "retrieval_id" in d["trace"]
    s.close()
