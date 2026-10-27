from types import SimpleNamespace

from on_their_own.agents.context import AgentContext
from on_their_own.agents.goals import Goal
from on_their_own.agents.model import Personality
from on_their_own.agents.relations import Relation
from on_their_own.agents.scoring import Option, Tuning, score_option

NO_JITTER = Tuning(jitter=0.0)


def stub(needs=None, phase="day", weather="Klar", people=(), conversation=None, plan_next="", inventory=None, goals=(), interests=(), dislikes=(), minute=600):
    """Eine minimale Wahrnehmung für Faktor-Tests (nur, was die Faktoren lesen)."""
    body = SimpleNamespace(needs={"energy": 80.0, "hunger": 20.0, "thirst": 20.0, **(needs or {})}, inventory=dict(inventory or {}))
    prof = SimpleNamespace(goals=list(goals), interests=list(interests), dislikes=list(dislikes))
    return SimpleNamespace(body=body, phase=phase, weather=weather, people=list(people), conversation=conversation, plan_next=plan_next, minute=minute,
                           agent=SimpleNamespace(id="alex", profile=prof), ctx=None)


def person(pid="mira", hearing=True):
    return SimpleNamespace(id=pid, name=pid.title(), in_hearing=hearing, distance=1.0)


def opt(kind, action=None, **kw):
    params = kw.pop("params", {})
    return Option(kind, kw.pop("label", kind), action or kind, params, **kw)


def ctx(**kw):
    soft = {"social": 20.0, "calm": 20.0, "warmth": 0.0, **kw.pop("soft", {})}
    enabled = {"energy": True, "hunger": True, "thirst": True, "social": True, "calm": True, "warmth": True, **kw.pop("enabled", {})}
    return AgentContext(soft=soft, enabled=enabled, **kw)


def score(o, p, pers=None, c=None, indoors=False, themes=None, recent=()):
    score_option(o, p, pers or Personality(), list(recent), NO_JITTER, indoors, themes, c or ctx())
    return o


def total(o):
    return round(sum(v for _, v in o.factors), 1)


def factor(o, name):
    return sum(v for n, v in o.factors if n == name)


def goal(**kw):
    base = dict(id="goal_x", agent_id="alex", kind="short", text="Test", created=0, updated=0, last_progress=0)
    return Goal(**{**base, **kw})


def relation(**kw):
    return Relation("alex", "mira", **kw)


def give(sim, agent_id, **inventory):
    with sim.db.transaction():
        for resource, qty in inventory.items():
            sim.engine.state.inv_set(agent_id, resource, qty)
