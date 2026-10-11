import json
import re

import pytest

from simulacra.agents.model import AgentProfile, Personality
from simulacra.config import Settings
from simulacra.llm.providers import FakeProvider, first_option_fn
from simulacra.simulation.builder import Simulation


GOAL_ANSWER = json.dumps({"text": "Den Garten besuchen", "condition": {"type": "location_visited", "location": "garden"},
                          "plan": [{"step": "Zum Garten gehen", "kind": "move", "target": "garden"}]}, ensure_ascii=False)


def with_goals(fn):
    """Beantwortet Zielsetzungs-Aufrufe (Schema mit `condition`), alles andere übernimmt `fn`."""
    def wrapped(messages, schema, params):
        if "condition" in (schema or {}).get("properties", {}):
            return GOAL_ANSWER
        return fn(messages, schema, params)
    return wrapped


def make_sim(fn=first_option_fn, script=None, **settings) -> Simulation:
    s = Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0, **settings)
    prov = FakeProvider(script=script, fn=None if script else with_goals(fn))
    return Simulation.create(s, ":memory:", prov)


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    yield s
    s.close()


def options_of(messages) -> dict[str, str]:
    """Optionen aus dem Prompt: {o1: Text}."""
    return dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))     # Optionen stehen in der ersten Benutzernachricht


def chooser(*needles, utterance="Hallo, schön dich zu sehen.", **extra):
    """Fake-Antwort: wählt die erste Option, deren Text einen der Begriffe enthält (sonst o1)."""
    def fn(messages, schema, params):
        opts = options_of(messages)
        oid = next((k for k, v in opts.items() if any(n in v for n in needles)), "o1")
        return json.dumps({"option_id": oid, "intent": "Test", "utterance": utterance, "importance": 4, **extra}, ensure_ascii=False)
    return fn


def add_ai_agent(sim: Simulation, agent_id: str, name: str, tile, **personality) -> None:
    """Dritter Agent mit Profil (für Mithör-Tests)."""
    sim.engine.edit.add_agent(agent_id, name, tile)
    with sim.db.transaction() as c:
        c.execute("INSERT INTO agent_profiles(agent_id, profile, personality, updated_at) VALUES(?,?,?,0)",
                  (agent_id, AgentProfile(name=name, known_places=["house.living"]).model_dump_json(), Personality(**personality).model_dump_json()))
        c.execute("INSERT OR IGNORE INTO agent_runtime(agent_id) VALUES(?)", (agent_id,))


def put(sim: Simulation, agent_id: str, x: int, y: int) -> None:
    eng = sim.engine
    with eng.db.transaction():
        a = eng.state.agent(agent_id)
        a.x, a.y, a.location_id, a.action = x, y, eng.state.location_at(x, y), None
        eng.state.save_agent(a)


def needs(sim: Simulation, agent_id: str, **kw) -> None:
    with sim.db.transaction():
        a = sim.engine.state.agent(agent_id)
        a.needs.update(kw)
        sim.engine.state.save_agent(a)
