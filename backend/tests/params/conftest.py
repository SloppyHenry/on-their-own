import json

import pytest
from agents.conftest import make_sim

from simulacra.simulation.builder import Simulation


def wait_one_minute(messages, schema, params):
    return json.dumps({"option_id": "other", "intent": "kurz warten", "utterance": "", "importance": 1, "other_action": "wait", "other_params": {"minutes": 1}})


async def patch(sim: Simulation, key: str, value, agent: str | None = None) -> dict:
    """Ändert einen Parameter über den Dienst (wie die API) und verlangt, dass er angenommen wird."""
    [r] = await sim.params.patch([{"key": key, "value": value, "agent": agent}])
    assert r["status"] != "rejected", r
    return r


@pytest.fixture
def sim():
    s = make_sim(fn=wait_one_minute)
    s.store.ensure_all()
    yield s
    s.close()
