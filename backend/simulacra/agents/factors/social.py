"""Persönlichkeit im Umgang mit anderen und die Beziehung zum Gegenüber."""

from ..context import AgentContext
from ..model import Personality
from ..perception import Perception
from . import Env, Factors, add
from .core import SOCIAL


def personality(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = []
    if o.kind in SOCIAL:
        add(f, "Geselligkeit", 22 * pers.f("sociability"))
    if o.kind == "speak":
        add(f, "Gesprächsinitiative", 14 * pers.f("conversation_initiative"))
    if o.kind == "end_talk":
        add(f, "Geselligkeit", -12 * pers.f("sociability"))
        add(f, "Konfliktbereitschaft", 6 * pers.f("conflict_readiness"))
        add(f, "Gesprächslänge", 2.5 * p.conversation["turn_count"] if p.conversation else 0)
    if o.kind == "give":
        add(f, "Hilfsbereitschaft", 20 * pers.f("helpfulness"))
    if o.kind in ("water", "plant", "harvest", "gather", "build"):
        add(f, "Hilfsbereitschaft", 5 * pers.f("helpfulness"))
        if any(x.in_hearing for x in p.people):
            add(f, "Kooperation", 6 * pers.f("cooperation"))
    if o.kind == "accept":
        add(f, "Annahmebereitschaft", 25 * pers.f("suggestion_acceptance"))
        add(f, "Kooperation", 15 * pers.f("cooperation"))
    if o.kind == "decline":
        add(f, "Annahmebereitschaft", -25 * pers.f("suggestion_acceptance"))
        add(f, "Konfliktbereitschaft", 10 * pers.f("conflict_readiness"))
    if o.kind in ("rest", "sleep", "wait"):
        add(f, "Ruhebedürfnis", 18 * pers.f("calm_need"))
    return f


def partner_of(o, p: Perception) -> str | None:
    return o.params.get("to") or o.meta.get("partner") or (o.params.get("target") if o.params.get("target") in {x.id for x in p.people} else None) or o.meta.get("search")


def relation(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    """Sympathie, Vertrauen und Spannung zum Gegenüber verschieben Gesprächs- und Hilfsoptionen."""
    f: Factors = []
    other = partner_of(o, p)
    rel = ctx.relations.get(other) if other else None
    if rel is None or o.kind not in SOCIAL | {"decline", "end_talk"}:
        return f
    if o.kind in ("speak", "search", "reply"):
        add(f, "Beziehung", 10 * (rel.sympathy - 50) / 50 + 4 * (rel.familiarity - 30) / 70)
    if o.kind in ("accept", "give"):
        add(f, "Vertrauen", 12 * (rel.trust - 50) / 50)
    if o.kind == "decline":
        add(f, "Vertrauen", -8 * (rel.trust - 50) / 50)
    if rel.tension > 30:
        t = (rel.tension - 30) / 70
        if o.kind in ("speak", "search", "accept"):
            add(f, "Spannung", -14 * t * (1 - 0.6 * max(0.0, pers.f("conflict_readiness"))))
        if o.kind in ("decline", "end_talk"):
            add(f, "Spannung", 10 * t * (0.4 + 0.6 * max(0.0, pers.f("conflict_readiness"))))
    return f
