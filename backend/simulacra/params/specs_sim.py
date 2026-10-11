"""Geschwindigkeit, Systemlast und Beobachtungsmodus (global)."""

from ..agents.modes import DEFAULT_CREATOR_TEXT, MODE_LABELS
from .spec import ParamSpec

T = "tests/params/test_effects_sim.py::"
SPEEDS = {"0.5x": 2.0, "1x": 1.0, "2x": 0.5, "4x": 0.25, "max": 0.0}


def _speed_of(delay: float) -> str:
    return next((k for k, v in SPEEDS.items() if abs(v - delay) < 1e-9), "custom")


SPECS = [
    ParamSpec(key="sim.speed", group="sim", scope="global", type="enum", label="Tempo", options=tuple((k, k.replace("x", "×") if k != "max" else "max.") for k in SPEEDS), default="max",
              effect="immediate", help="Wie schnell die Simulation läuft (Pause zwischen den Takten).", apply=lambda sim, v, a: sim.runner.set_speed(SPEEDS[v]),
              read=lambda sim, a: _speed_of(sim.runner.tick_delay_s), consumers=("simulacra.simulation.runner:tick_delay_s",), effect_test=T + "test_speed_sets_the_tick_pause"),
    ParamSpec(key="sim.tick_pause_ms", group="sim", scope="global", type="int", label="Pause je Takt", default=0, min=0, max=5000, step=50, unit="ms", effect="immediate",
              help="Feineinstellung der Pause zwischen den Takten (überschreibt das Tempo).", apply=lambda sim, v, a: sim.runner.set_speed(int(v) / 1000),
              read=lambda sim, a: round(sim.runner.tick_delay_s * 1000), consumers=("simulacra.simulation.runner:tick_delay_s",), effect_test=T + "test_speed_sets_the_tick_pause"),
    ParamSpec(key="sim.max_decisions_per_min", group="sim", scope="global", type="int", label="Höchstzahl Entscheidungen je Minute", default=0, min=0, max=60, step=1, unit="/min", effect="immediate",
              help="Begrenzt die Last auf das Modell (0 = unbegrenzt).", apply=lambda sim, v, a: sim.runner.limiter.configure(max_per_minute=int(v)),
              read=lambda sim, a: sim.runner.limiter.max_per_minute, consumers=("simulacra.simulation.limits:max_per_minute",), effect_test=T + "test_decision_limit_throttles_real_time"),
    ParamSpec(key="sim.time_waits_for_decisions", group="sim", scope="global", type="bool", label="Zeit wartet auf Entscheidungen", default=True, effect="immediate",
              help="An: die Simulationszeit steht, bis alle freien Agenten entschieden haben. Aus: die Zeit läuft weiter, Entscheidungen kommen, wenn das Modell fertig ist.",
              apply=lambda sim, v, a: setattr(sim.runner, "waits_for_decisions", bool(v)), read=lambda sim, a: sim.runner.waits_for_decisions,
              consumers=("simulacra.simulation.runner:waits_for_decisions",), effect_test=T + "test_time_can_run_without_waiting_for_decisions"),
    ParamSpec(key="sim.power_save", group="sim", scope="global", type="bool", label="Energiesparen", default=False, effect="immediate",
              help="An: höchstens 4 Entscheidungen je Minute, tagsüber keine Reflexion, Pause, solange kein Browser verbunden ist.",
              apply=lambda sim, v, a: (setattr(sim.runner, "power_save", bool(v)), setattr(sim.runner.limiter, "power_cap", 4 if v else 0), setattr(sim.memory.params, "quiet_reflection", bool(v))),
              read=lambda sim, a: sim.runner.power_save, consumers=("simulacra.simulation.runner:power_save", "simulacra.simulation.limits:power_cap", "simulacra.memory.reflection:quiet_reflection"),
              effect_test=T + "test_power_save"),
    ParamSpec(key="mode", group="mode", scope="global", type="enum", label="Beobachtungsmodus", options=tuple(MODE_LABELS.items()), default="observer", effect="next_decision",
              help="Beobachter: die Agenten erfahren nichts. Schöpfer: sie wissen von einer äußeren Instanz. Eingriff: wie Beobachter, mit direkten Nachrichten (später).",
              apply=lambda sim, v, a: setattr(sim.planner.mode, "mode", v), read=lambda sim, a: sim.planner.mode.mode, consumers=("simulacra.agents.modes:prompt_extra",),
              effect_test=T + "test_modes_change_the_prompt_but_not_the_memories"),
    ParamSpec(key="mode.creator_text", group="mode", scope="global", type="text", label="Text für den Schöpfer-Modus", default=DEFAULT_CREATOR_TEXT, max_len=600, effect="next_decision",
              help="Was die Agenten im Schöpfer-Modus über die äußere Instanz erfahren.", apply=lambda sim, v, a: setattr(sim.planner.mode, "creator_text", v),
              read=lambda sim, a: sim.planner.mode.creator_text, consumers=("simulacra.agents.modes:creator_text",), effect_test=T + "test_modes_change_the_prompt_but_not_the_memories"),
]
