"""Autonomie und Entscheidungsverhalten (global), Persönlichkeit und Charakter (je Agent)."""

from ..agents.model import PERSONALITY_LABELS, Personality, load_default
from .spec import ParamSpec

T = "tests/params/test_effects_agents.py::"


def _shift(key: str, label: str, help_: str, trait: str, test: str) -> ParamSpec:
    return ParamSpec(
        key=key, group="autonomy", scope="global", type="int", label=label, help=help_ + " 50 = unverändert; wirkt als Aufschlag auf den jeweiligen Wert jedes Agenten.",
        default=50, min=0, max=100, step=1, unit="%", effect="next_decision",
        apply=lambda sim, v, a: sim.autonomy.shifts.__setitem__(trait, int(v) - 50), read=lambda sim, a: sim.autonomy.shifts[trait] + 50,
        consumers=("on_their_own.agents.autonomy:effective", "on_their_own.agents.planner:effective"), effect_test=T + test)


def _planning_horizon() -> ParamSpec:
    return ParamSpec(key="planning_horizon", group="autonomy", scope="global", type="int", label="Planungshorizont", help="Höchstzahl der Schritte eines erzeugten Plans.",
                     default=5, min=1, max=8, step=1, unit="Schritte", effect="next_decision",
                     apply=lambda sim, v, a: setattr(sim.autonomy.planner.params, "horizon", int(v)), read=lambda sim, a: sim.autonomy.planner.params.horizon,
                     consumers=("on_their_own.agents.plans:horizon",), effect_test=T + "test_planning_horizon_limits_plan_length")


def _interval() -> ParamSpec:
    return ParamSpec(key="decision_interval", group="autonomy", scope="global", type="int", label="Entscheidungsabstand",
                     help="Mindestabstand zwischen zwei Entscheidungen eines Agenten in Simulationsminuten (1 = sobald er frei ist).",
                     default=1, min=1, max=120, step=1, unit="Min.", effect="immediate",
                     apply=lambda sim, v, a: setattr(sim.runner, "decision_interval", int(v)), read=lambda sim, a: sim.runner.decision_interval,
                     consumers=("on_their_own.simulation.runner:decision_interval",), effect_test=T + "test_decision_interval_spaces_decisions")


def _top_k() -> ParamSpec:
    return ParamSpec(key="top_k_options", group="autonomy", scope="global", type="int", label="Optionen je Entscheidung", help="So viele bewertete Optionen sieht das Modell.",
                     default=6, min=3, max=10, step=1, effect="next_decision", apply=lambda sim, v, a: setattr(sim.planner.tuning, "top_k", int(v)),
                     read=lambda sim, a: sim.planner.tuning.top_k, consumers=("on_their_own.agents.scoring:top_k",), effect_test=T + "test_top_k_limits_the_offered_options")


def _rank_hint() -> ParamSpec:
    return ParamSpec(key="rank_hint", group="autonomy", scope="global", type="bool", label="Rangfolge nennen", default=True, effect="next_decision",
                     help="An: der Prompt sagt dem Modell, dass die Optionen nach Passung zu Neigungen, Zielen und Bedürfnissen geordnet sind (o1 am besten). "
                          "Aus: das Modell sieht dieselbe Reihenfolge ohne Hinweis und folgt ihr deutlich weniger. Macht die Persönlichkeitsregler im Verhalten deutlicher.",
                     apply=lambda sim, v, a: setattr(sim.planner, "rank_hint", bool(v)), read=lambda sim, a: sim.planner.rank_hint,
                     consumers=("on_their_own.agents.prompts:rank_hint",), effect_test=T + "test_rank_hint_reaches_the_prompt")


GLOBAL = [
    _shift("autonomy", "Autonomie", "Eigene Vorhaben statt Reaktion auf Ereignisse.", "autonomy", "test_global_shifts_move_scores"),
    _planning_horizon(),
    _shift("initiative", "Initiative", "Wie gern Agenten von sich aus ein Gespräch oder eine Aktivität beginnen.", "conversation_initiative", "test_global_shifts_move_scores"),
    _shift("spontaneity", "Spontaneität", "Zufallsanteil und Abweichen vom Plan.", "spontaneity", "test_global_shifts_move_scores"),
    _interval(),
    _shift("goal_persistence", "Zielpersistenz", "Wie lange und wie stark ein Agent bei einem Ziel bleibt.", "persistence", "test_global_shifts_move_scores"),
    _shift("exploration", "Erkunden", "Neugier auf Unbekanntes.", "curiosity", "test_global_shifts_move_scores"),
    _top_k(),
    _rank_hint(),
]

TRAIT_HELP = {
    "sociability": "Wie gern der Agent Gesellschaft sucht.", "curiosity": "Lust auf Neues und Unbekanntes.", "helpfulness": "Bereitschaft zu helfen und zu geben.",
    "risk_taking": "Mut bei Dunkelheit, schlechtem Wetter und Unbekanntem.", "conflict_readiness": "Wie offen der Agent widerspricht oder Konflikte anspricht.",
    "cooperation": "Neigung, gemeinsam zu arbeiten.", "calm_need": "Wie sehr der Agent Ruhe und Alleinsein braucht.", "conversation_initiative": "Wie oft der Agent ein Gespräch beginnt.",
    "suggestion_acceptance": "Wie bereitwillig der Agent Vorschläge annimmt.", "persistence": "Wie beharrlich der Agent beim Plan bleibt.",
    "spontaneity": "Wie oft der Agent spontan vom Plan abweicht.", "autonomy": "Eigene Vorhaben statt Reaktion auf andere.",
}


def _trait_default(trait: str):
    def default_for(sim, agent):
        try:
            return getattr(load_default(agent)[1], trait)
        except FileNotFoundError:
            return 50
    return default_for


def _trait(trait: str) -> ParamSpec:
    def apply(sim, v, agent):
        m = sim.store.get(agent)
        sim.store.save_profile(agent, m.profile, m.personality.model_copy(update={trait: int(v)}))

    return ParamSpec(key=f"personality.{trait}", group="personality", scope="agent", type="int", label=PERSONALITY_LABELS[trait], help=TRAIT_HELP[trait], default=50, min=0, max=100,
                     step=1, unit="%", effect="next_decision", apply=apply, read=lambda sim, agent: getattr(sim.store.get(agent).personality, trait), default_for=_trait_default(trait),
                     consumers=("on_their_own.agents.factors.social:personality", "on_their_own.agents.factors.drive:commitment", "on_their_own.agents.factors.drive:exploration"),
                     effect_test=T + "test_personality_value_moves_the_scores")


def _split(text: str) -> list[str]:
    return [p.strip() for p in text.replace(";", ",").replace("\n", ",").split(",") if p.strip()][:12]


def _persona(field_name: str, label: str, help_: str, as_list: bool) -> ParamSpec:
    def default_for(sim, agent):
        try:
            v = getattr(load_default(agent)[0], field_name)
        except FileNotFoundError:
            return ""
        return ", ".join(v) if as_list else v

    def apply(sim, v, agent):
        m = sim.store.get(agent)
        new = _split(v) if as_list else v
        sim.store.save_profile(agent, m.profile.model_copy(update={field_name: new}), m.personality)
        if field_name == "goals":
            sim.autonomy.goals.sync_long(agent, new, sim.engine.minute)

    def read(sim, agent):
        v = getattr(sim.store.get(agent).profile, field_name)
        return ", ".join(v) if as_list else v

    return ParamSpec(key=f"profile.{field_name}", group="persona", scope="agent", type="text", label=label, help=help_ + (" Mehrere Einträge mit Komma trennen." if as_list else ""),
                     default="", max_len=600, effect="next_decision", apply=apply, read=read, default_for=default_for,
                     consumers=("on_their_own.agents.prompts:system_prompt",), effect_test=T + "test_profile_text_reaches_the_prompt")


PERSONA = [
    _persona("description", "Charakterbeschreibung", "Wie der Agent ist.", False), _persona("background", "Hintergrund", "Vorgeschichte des Agenten.", False),
    _persona("interests", "Interessen", "Wofür sich der Agent interessiert (wirkt auch auf die Bewertung von Orten und Objekten).", True),
    _persona("dislikes", "Abneigungen", "Was der Agent nicht mag.", True), _persona("goals", "Persönliche Ziele", "Langfristige Ziele (werden zu Zielen des Agenten).", True),
    _persona("communication_style", "Kommunikationsstil", "Wie der Agent spricht.", False),
]
PERSONALITY = [_trait(t) for t in PERSONALITY_LABELS]
assert set(PERSONALITY_LABELS) == set(Personality.model_fields)
SPECS = GLOBAL + PERSONALITY + PERSONA
