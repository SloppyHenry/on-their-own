import json

import pytest
from agents.conftest import make_sim

from simulacra.events import types as event_types
from simulacra.llm.providers import FakeProvider


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    s.inject.rate = 1000
    yield s
    s.close()


def llm_says(sim, **answer):
    """Das Sprachmodell antwortet mit genau diesem Ergebnis der Interpretation (Operationen, Sicherheit, Rückfrage)."""
    body = {"ops": [], "confidence": 0.9, "clarification": "", **answer}
    sim.client.provider = FakeProvider([json.dumps(body)])
    return sim.client.provider


async def say(sim, text, preview_ok=False, **kw):
    """Eingabe prüfen lassen und, wenn sie bereit ist, bestätigen (eine Vorschau nur mit `preview_ok`). Gibt (Vorschlag, ausgeführter Vorschlag oder None) zurück."""
    p = await sim.inject.parse(text, **kw)
    if p["status"] == "ready" or (preview_ok and p["status"] == "needs_confirmation"):
        return p, await sim.engine.db.run(lambda: sim.inject.confirm(p["id"]))
    return p, None


def objects(sim, name):
    return [o for o in sim.engine.state.all_objects() if o.name == name]


def memories(sim, agent):
    return [m.text for m in sim.memory.store.list(agent, limit=100)[0]]


assert event_types.REGISTRY
