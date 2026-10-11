import pytest

from simulacra.db.connection import Database
from simulacra.world.engine import WorldEngine


@pytest.fixture
def eng():
    return WorldEngine.create(Database(":memory:"))


def run(eng, actor, action, max_ticks=3000, **params):
    """Vorschlag stellen und bis zum Ende der Aktion simulieren. Gibt (Ergebnis, alle Ereignisse) zurück."""
    res = eng.propose(actor, action, params)
    events = list(res.events)
    if res.ok:
        for _ in range(max_ticks):
            if eng.state.agent(actor).action is None:
                break
            events += eng.tick()
        else:
            raise AssertionError("Aktion endet nicht")
    return res, events


def ok(eng, actor, action, **params):
    res, events = run(eng, actor, action, **params)
    assert res.ok, res.rejected
    assert not [e for e in events if e.type == "agent.action_failed"], [e.data for e in events if e.type == "agent.action_failed"]
    return events


def settle(eng, actor):
    """Wartet den Zeitverlust (`recover`) nach einer Ablehnung ab."""
    while (a := eng.state.agent(actor)) and a.action is not None and a.action.type == "recover":
        eng.tick()


def reject(eng, actor, action, code, **params):
    res = eng.propose(actor, action, params)
    assert not res.ok, f"{action} wurde angenommen"
    assert res.rejected.code.value == code, res.rejected
    settle(eng, actor)
    return res


def failed(eng, actor, action, code, **params):
    """Aktion wird angenommen, scheitert aber bei Abschluss."""
    res, events = run(eng, actor, action, **params)
    assert res.ok, res.rejected
    f = [e for e in events if e.type == "agent.action_failed"]
    assert f and f[0].data["code"] == code, [e.data for e in events]
    settle(eng, actor)
    return f[0]


def put(eng, agent_id, x, y):
    """Testhilfe: Agent direkt an eine Kachel setzen."""
    with eng.db.transaction():
        a = eng.state.agent(agent_id)
        a.x, a.y, a.location_id = x, y, eng.state.location_at(x, y)
        a.action = None
        eng.state.save_agent(a)


def stock(eng, agent_id, **items):
    with eng.db.transaction():
        for r, q in items.items():
            eng.state.inv_set(agent_id, r, q)


def types(events):
    return [e.type for e in events]
