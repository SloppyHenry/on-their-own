"""Gedächtnis und Reflexion (global)."""

from .spec import ParamSpec

T = "tests/params/test_effects.py::"


def _mem(key, label, help_, attr, default, lo, hi, step, *, type_="float", unit="", test, to=None, frm=None, consumers=None):
    to = to or (lambda v: v)
    frm = frm or (lambda v: v)
    return ParamSpec(key=f"memory.{key}", group="memory", scope="global", type=type_, label=label, help=help_, default=default, min=lo, max=hi, step=step, unit=unit,
                     effect="next_decision", apply=lambda sim, v, a: setattr(sim.memory.params, attr, to(v)), read=lambda sim, a: frm(getattr(sim.memory.params, attr)),
                     consumers=consumers or (f"simulacra.memory.retrieval:{attr}",), effect_test=T + test)


SPECS = [
    _mem("max_in_context", "Erinnerungen im Prompt", "Höchstzahl abgerufener Erinnerungen je Entscheidung.", "max_items", 6, 3, 40, 1, type_="int", test="test_memory_retrieval_parameters"),
    _mem("retrieval_threshold", "Abrufschwelle", "Mindestpunktzahl (0–1), ab der eine Erinnerung abgerufen wird.", "min_score", 0.35, 0.0, 1.0, 0.01, test="test_memory_retrieval_parameters"),
    _mem("w_importance", "Gewicht Wichtigkeit", "Wie stark die Wichtigkeit beim Abruf zählt.", "w_imp", 0.6, 0.0, 1.0, 0.05, test="test_memory_weights_change_the_order"),
    _mem("w_recency", "Gewicht Aktualität", "Wie stark Neues beim Abruf zählt.", "w_rec", 0.6, 0.0, 1.0, 0.05, test="test_memory_weights_change_the_order"),
    _mem("w_relevance", "Gewicht Relevanz", "Wie stark die Passung zur Lage beim Abruf zählt.", "w_rel", 1.0, 0.0, 1.0, 0.05, test="test_memory_weights_change_the_order"),
    _mem("w_shared", "Gewicht gemeinsamer Erlebnisse", "Bevorzugung von Erlebnissen mit anderen.", "w_shared", 0.2, 0.0, 1.0, 0.05, test="test_memory_weights_change_the_order"),
    _mem("recency_half_life", "Halbwertszeit der Aktualität", "Nach dieser Zeit zählt eine Erinnerung nur noch halb so viel.", "half_life_h", 36, 1, 168, 1, type_="int", unit="Sim-Std.",
         test="test_memory_weights_change_the_order"),
    _mem("reflection_threshold", "Reflexionsschwelle", "Summe der Wichtigkeit neuer Erinnerungen, ab der ein Agent nachdenkt.", "reflect_threshold", 80, 10, 300, 5, type_="int", unit="Punkte",
         test="test_lower_reflection_threshold_means_more_reflections", consumers=("simulacra.memory.reflection:reflect_threshold",)),
    _mem("summary_interval", "Zusammenfassung", "Abstand der Tageszusammenfassungen.", "summary_interval_days", 24, 24, 168, 24, type_="int", unit="Sim-Std.",
         test="test_summary_interval_and_archive", to=lambda v: max(1, int(v) // 24), frm=lambda d: d * 24, consumers=("simulacra.memory.maintenance:summary_interval_days",)),
    _mem("archive_after_days", "Archivierung nach", "Zusammengefasste Erinnerungen werden nach so vielen Tagen archiviert (0 = nie).", "archive_after_days", 2, 0, 60, 1, type_="int", unit="Sim-Tage",
         test="test_summary_interval_and_archive", consumers=("simulacra.memory.maintenance:archive_after_days",)),
    _mem("context_token_budget", "Token-Budget für Erinnerungen", "Höchstzahl Tokens abgerufener Erinnerungen je Prompt.", "budget_tokens", 400, 300, 4000, 50, type_="int", unit="Tokens",
         test="test_memory_retrieval_parameters"),
]
