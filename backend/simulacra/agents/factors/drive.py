"""Antrieb: Ziele und Plan, Erkunden, Risiko, Planbindung, Eigeninitiative."""

from ..context import AgentContext
from ..goals import Goal
from ..model import Personality
from ..perception import Perception
from . import Env, Factors, add
from .core import tokens

REACTIVE = {"reply", "accept", "decline", "end_talk"}


def goal_match(o, g: Goal, p: Perception) -> tuple[float, str]:
    """Wie stark bringt die Option das aktive Ziel voran? (Wert, Grund)"""
    step, c = g.step, g.condition or {}
    best, why = 0.0, ""
    if step:
        kind_ok = step["kind"] == o.kind or (step["kind"] == "move" and o.kind in ("explore", "search"))
        target = step.get("target")
        if kind_ok and (not target or target in {str(v) for v in o.params.values()} or target == o.target_loc):
            best, why = 26.0, f"Planschritt: {step['step']}"
    t = c.get("type")
    hit = 0.0
    if t == "location_visited" and o.target_loc == c.get("location"):
        hit = 22.0
    elif t == "has_resource" and o.kind == "gather" and o.params.get("resource") == c.get("resource"):
        hit = 22.0
    elif t == "object_count" and o.kind in ("build", "resume") and o.meta.get("bp_kind") == c.get("kind"):
        hit = 24.0
    elif t == "talked_with" and o.kind in ("speak", "reply") and o.params.get("to") == c.get("person"):
        hit = 24.0
    elif t == "plant_stage" and o.kind in ("water", "plant"):
        hit = 18.0
    if hit > best:
        best, why = hit, "Bedingung des Ziels"
    return best, why


def goal(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = []
    g = ctx.goal
    if g is not None and g.state == "active":
        value, why = goal_match(o, g, p)
        if value:
            add(f, "Ziel", value)
            env.extra.setdefault("goal_hits", {})[o.key] = why
    return f


def exploration(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = []
    if o.kind == "explore":
        add(f, "Neugier", 25 * pers.f("curiosity"))
        add(f, "Risikobereitschaft", 10 * pers.f("risk_taking"))
    if o.kind in ("inspect", "read", "take"):
        add(f, "Neugier", 14 * pers.f("curiosity"))
    if o.kind == "move":
        add(f, "Neugier", 4 * pers.f("curiosity"))
    if o.kind == "inspect" and o.meta.get("object_kind") in {"item", "map", "note", "key", "board", "bookshelf", "desk", "plant", "workbench"}:
        add(f, "Interessantes Objekt", 8)
    return f


def commitment(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    """Zielpersistenz × Spontaneität: beim Plan bleiben oder abweichen; Autonomie: eigene Vorhaben statt Reaktion."""
    f: Factors = []
    g = ctx.goal
    if g is not None and g.state == "active" and g.step is not None:
        matches = goal_match(o, g, p)[0] >= 26.0
        if matches:
            add(f, "Planbindung", 12 * pers.f("persistence") - 8 * pers.f("spontaneity"))
        elif o.kind not in REACTIVE and o.kind not in ("eat", "drink", "sleep", "rest"):
            add(f, "Planbindung", -6 * pers.f("persistence") + 6 * pers.f("spontaneity"))
    if o.kind in REACTIVE:
        add(f, "Eigeninitiative", -8 * pers.f("autonomy"))
    elif o.kind not in ("wait", "rest", "sleep", "eat", "drink"):
        add(f, "Eigeninitiative", 8 * pers.f("autonomy"))
    return f
