"""Geschwindigkeit, Systemlast und Beobachtungsmodus (global)."""

from ..agents.modes import DEFAULT_CREATOR_TEXT, MODE_LABELS
from ..world.ereignis_takt import FREQUENCY_LABELS
from .spec import ParamSpec

T = "tests/params/test_effects_sim.py::"
SPEEDS = {"0.5x": 2.0, "1x": 1.0, "2x": 0.5, "4x": 0.25, "max": 0.0}


def _speed_of(delay: float) -> str:
    return next((k for k, v in SPEEDS.items() if abs(v - delay) < 1e-9), "custom")


async def _only_while_time_stands_still(sim, value):
    """Der Beobachtungsmodus ändert sich nur, solange die Zeit steht (angehalten oder im Editor-Modus; Frage 36): so gilt er sauber ab der nächsten Entscheidung."""
    if sim.runner.state.value == "running":
        return "Der Beobachtungsmodus lässt sich nur ändern, solange die Zeit steht. Bitte die Simulation anhalten (oder in den Editor-Modus wechseln)."
    return None


SPECS = [
    ParamSpec(key="sim.speed", group="sim", scope="global", type="enum", label="Tempo", options=tuple((k, k.replace("x", "×") if k != "max" else "max.") for k in SPEEDS), default="max",
              effect="immediate", help="Wie schnell die Simulation läuft (Pause zwischen den Takten).", apply=lambda sim, v, a: sim.runner.set_speed(SPEEDS[v]),
              read=lambda sim, a: _speed_of(sim.runner.tick_delay_s), consumers=("on_their_own.simulation.runner:tick_delay_s",), effect_test=T + "test_speed_sets_the_tick_pause"),
    ParamSpec(key="sim.tick_pause_ms", group="sim", scope="global", type="int", label="Pause je Takt", default=0, min=0, max=5000, step=50, unit="ms", effect="immediate",
              help="Feineinstellung der Pause zwischen den Takten (überschreibt das Tempo).", apply=lambda sim, v, a: sim.runner.set_speed(int(v) / 1000),
              read=lambda sim, a: round(sim.runner.tick_delay_s * 1000), consumers=("on_their_own.simulation.runner:tick_delay_s",), effect_test=T + "test_speed_sets_the_tick_pause"),
    ParamSpec(key="sim.max_decisions_per_min", group="sim", scope="global", type="int", label="Höchstzahl Entscheidungen je Minute", default=0, min=0, max=60, step=1, unit="/min", effect="immediate",
              help="Begrenzt die Last auf das Modell (0 = unbegrenzt).", apply=lambda sim, v, a: sim.runner.limiter.configure(max_per_minute=int(v)),
              read=lambda sim, a: sim.runner.limiter.max_per_minute, consumers=("on_their_own.simulation.limits:max_per_minute",), effect_test=T + "test_decision_limit_throttles_real_time"),
    ParamSpec(key="sim.time_waits_for_decisions", group="sim", scope="global", type="bool", label="Zeit wartet auf Entscheidungen", default=True, effect="immediate",
              help="An: die Simulationszeit steht, bis alle freien Agenten entschieden haben. Aus: die Zeit läuft weiter, Entscheidungen kommen, wenn das Modell fertig ist.",
              apply=lambda sim, v, a: setattr(sim.runner, "waits_for_decisions", bool(v)), read=lambda sim, a: sim.runner.waits_for_decisions,
              consumers=("on_their_own.simulation.runner:waits_for_decisions",), effect_test=T + "test_time_can_run_without_waiting_for_decisions"),
    ParamSpec(key="sim.power_save", group="sim", scope="global", type="bool", label="Energiesparen", default=False, effect="immediate",
              help="An: höchstens 4 Entscheidungen je Minute, tagsüber keine Reflexion, Pause, solange kein Browser verbunden ist.",
              apply=lambda sim, v, a: (setattr(sim.runner, "power_save", bool(v)), setattr(sim.runner.limiter, "power_cap", 4 if v else 0), setattr(sim.memory.params, "quiet_reflection", bool(v))),
              read=lambda sim, a: sim.runner.power_save, consumers=("on_their_own.simulation.runner:power_save", "on_their_own.simulation.limits:power_cap", "on_their_own.memory.reflection:quiet_reflection"),
              effect_test=T + "test_power_save"),
    ParamSpec(key="sim.autosave_sim_hours", group="sim", scope="global", type="int", label="Autosave alle … Simulationsstunden", default=6, min=0, max=48, step=1, unit="Sim-Std.", effect="immediate",
              help="So oft wird automatisch gesichert (0 = aus). Autosaves überschreiben nie manuelle Stände.", apply=lambda sim, v, a: setattr(sim.autosave, "sim_hours", int(v)),
              read=lambda sim, a: sim.autosave.sim_hours, consumers=("on_their_own.saves.service:sim_hours",), effect_test=T + "test_autosave_follows_the_interval_and_keeps_a_ring"),
    ParamSpec(key="sim.autosave_real_minutes", group="sim", scope="global", type="int", label="Autosave alle … Echtzeitminuten", default=30, min=0, max=240, step=5, unit="Min.", effect="immediate",
              help="Zusätzlich nach so vielen Minuten Echtzeit (0 = aus).", apply=lambda sim, v, a: setattr(sim.autosave, "real_minutes", int(v)),
              read=lambda sim, a: sim.autosave.real_minutes, consumers=("on_their_own.saves.service:real_minutes",), effect_test=T + "test_autosave_follows_the_interval_and_keeps_a_ring"),
    ParamSpec(key="sim.autosave_keep", group="sim", scope="global", type="int", label="Autosaves behalten", default=5, min=1, max=20, step=1, effect="immediate",
              help="Ringpuffer: so viele Autosaves bleiben, ältere werden gelöscht.", apply=lambda sim, v, a: setattr(sim.autosave, "keep", int(v)),
              read=lambda sim, a: sim.autosave.keep, consumers=("on_their_own.saves.service:prune_auto",), effect_test=T + "test_autosave_follows_the_interval_and_keeps_a_ring"),
    ParamSpec(key="world.events", group="world", scope="global", type="enum", label="Automatische Ereignisse", options=FREQUENCY_LABELS, default="manchmal", effect="immediate",
              help="Wie oft die Welt von sich aus Ereignisse bringt (Gewitter, ein umgestürzter Baum, ein Fuchs im Garten, Nachtfrost …). Niemand löst sie aus; für die Bewohner sind es natürliche Vorgänge.",
              apply=lambda sim, v, a: setattr(sim.inject.welt, "frequency", v), read=lambda sim, a: sim.inject.welt.frequency, consumers=("on_their_own.events_user.welt:FREQUENCIES",),
              effect_test="tests/events_user/test_welt.py::test_frequency_decides_whether_anything_happens"),
    ParamSpec(key="mode", group="mode", scope="global", type="enum", label="Wissen über den Gott", options=tuple(MODE_LABELS.items()), default="observer", effect="next_decision",
              help="Was die Bewohner über eine äußere Instanz wissen. Verborgen: die Agenten erfahren nichts. Schöpfer: sie wissen von einer äußeren Instanz. Eingriff: wie Verborgen, mit direkten Nachrichten (später). Änderbar nur, solange die Zeit steht.",
              apply=lambda sim, v, a: setattr(sim.planner.mode, "mode", v), read=lambda sim, a: sim.planner.mode.mode, check=_only_while_time_stands_still, consumers=("on_their_own.agents.modes:prompt_extra",),
              effect_test=T + "test_modes_change_the_prompt_but_not_the_memories"),
    ParamSpec(key="mode.creator_text", group="mode", scope="global", type="text", label="Text für den Schöpfer-Modus", default=DEFAULT_CREATOR_TEXT, max_len=600, effect="next_decision",
              help="Was die Agenten im Schöpfer-Modus über die äußere Instanz erfahren.", apply=lambda sim, v, a: setattr(sim.planner.mode, "creator_text", v),
              read=lambda sim, a: sim.planner.mode.creator_text, check=_only_while_time_stands_still, consumers=("on_their_own.agents.modes:creator_text",), effect_test=T + "test_modes_change_the_prompt_but_not_the_memories"),
]
