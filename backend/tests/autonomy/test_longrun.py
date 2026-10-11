"""Langlauf über sieben Simulationstage mit dem Fake-Modell: keine Endlosschleife, begrenzte Mengen, Werte im Rahmen (Aufruf: pytest -m slow)."""

import json
import re

import pytest

from agents.conftest import make_sim, put
from simulacra.agents.relations import METRICS

pytestmark = pytest.mark.slow


def model():
    state = {"n": 0}

    def fn(messages, schema, params):
        if "reflections" in schema.get("properties", {}):
            return json.dumps({"reflections": [{"text": f"Ich merke Muster {state['n']} in meinem Tag.", "importance": 6, "sources": [1, 2]}]})
        pairs = re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M)
        state["n"] += 1
        talk = next((k for k, v in pairs if "antworten" in v or "Gespräch beginnen" in v), None)
        return json.dumps({"option_id": talk or pairs[state["n"] % len(pairs)][0], "intent": f"Aufgabe {state['n'] % 13}", "importance": 5,
                           "utterance": f"Gedanke {state['n'] % 9}: Das Wetter ist {['mild', 'kühl', 'schön'][state['n'] % 3]}.", "plan_next": f"Später Aufgabe {state['n'] % 5}"})
    return fn


async def test_seven_days_run_without_loops_and_within_limits():
    s = make_sim(fn=model())
    put(s, "alex", 7, 7)
    put(s, "mira", 8, 7)
    for _ in range(7):
        await s.runner.step(1440)
    assert s.engine.minute >= 7 * 1440
    c = s.engine.state.conn
    assert 800 < s.runner.stats.decisions < 6000                                      # keine Endlosschleife, keine Stille
    assert s.runner.stats.valid == s.runner.stats.decisions
    assert c.execute("SELECT COUNT(*) FROM events").fetchone()[0] < 60000
    for a in ("alex", "mira"):
        assert s.memory.store.count(a) <= s.memory.params.max_active
        assert s.memory.store.count(a) + s.memory.store.count(a, "archived") < 2500
        assert len(s.memory.store.list(a, kind="summary")[0]) >= 5                    # Tagesrückblicke
        for r in s.autonomy.relations.all_of(a):
            assert all(0 <= getattr(r, m) <= 100 for m in METRICS)
        assert c.execute("SELECT COUNT(*) FROM goals WHERE agent_id=? AND kind='short' AND state='active'", (a,)).fetchone()[0] <= 1      # höchstens ein aktives kurzfristiges Ziel
    assert c.execute("SELECT COUNT(*) FROM goals WHERE state IN ('achieved','abandoned')").fetchone()[0] >= 2
    states = {r["state"] for r in c.execute("SELECT state FROM goals WHERE kind='short'")}
    assert "active" in states
    assert c.execute("SELECT COUNT(*) FROM action_locks").fetchone()[0] < 500
    assert c.execute("SELECT COUNT(*) FROM failed_actions").fetchone()[0] < 3000
    s.close()
