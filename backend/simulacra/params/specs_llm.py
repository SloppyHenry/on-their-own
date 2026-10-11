"""Modell und Inferenz (global). Das Modell selbst gilt für die ganze Simulation (siehe offene-fragen.md Nr. 10) und wird beim Anlegen einer neuen Simulation gewählt."""

from dataclasses import replace

from .spec import ParamSpec

T = "tests/params/test_effects.py::"
THINKING = (("off", "aus"), ("short", "kurz"), ("normal", "normal"))
EFFORT = {"off": (False, None), "short": (True, "low"), "normal": (True, "medium")}


def _p(key, label, help_, attr, default, lo, hi, step, *, type_="float", unit="", effect="next_decision", warn=None, test="test_llm_parameters_reach_the_request"):
    def apply(sim, v, a):
        sim.client.params = replace(sim.client.params, **{attr: v})
        setattr(sim.settings, f"llm_{attr}", v)

    return ParamSpec(key=f"llm.{key}", group="llm", scope="global", type=type_, label=label, help=help_, default=default, min=lo, max=hi, step=step, unit=unit, effect=effect, warn=warn,
                     apply=apply, read=lambda sim, a: getattr(sim.client.params, attr), consumers=(f"simulacra.llm.providers:{attr}",), effect_test=T + test)


async def _check_url(sim, value):
    """Verbindungstest vor dem Wechsel der Adresse: nur annehmen, wenn der Router unter der neuen Adresse antwortet."""
    from ..llm.providers import LLMError, OpenAICompatProvider
    if not hasattr(sim.client.provider, "base_url"):
        return None
    try:
        await OpenAICompatProvider(value, None).models()
    except LLMError as e:
        return f"Keine Verbindung zu {value}: {e.text}"
    return None


def _apply_url(sim, v, a):
    prov = sim.client.provider
    if hasattr(prov, "base_url"):
        prov.base_url = v.rstrip("/")
    sim.settings.llm_base_url = v.rstrip("/")


def _apply_thinking(sim, v, a):
    on, effort = EFFORT[v]
    sim.client.params = replace(sim.client.params, thinking=on, reasoning_effort=effort)


def _read_thinking(sim, a):
    p = sim.client.params
    return "off" if not p.thinking else "short" if p.reasoning_effort == "low" else "normal"


SPECS = [
    ParamSpec(key="llm.base_url", group="llm", scope="global", type="text", label="Adresse des Routers", default="http://maintux:8080/v1", max_len=200, effect="immediate",
              help="OpenAI-kompatible Adresse. Wird erst nach einem erfolgreichen Verbindungstest übernommen.", apply=_apply_url,
              read=lambda sim, a: getattr(sim.client.provider, "base_url", sim.settings.llm_base_url), check=_check_url, consumers=("simulacra.llm.providers:base_url",),
              effect_test=T + "test_base_url_needs_a_working_connection", tags=("nopreset",)),
    ParamSpec(key="llm.model", group="llm", scope="global", type="text", label="Modell", default="qwen3.8-9b-uncensored", max_len=100, effect="restart_model",
              help="Das Modell gilt für die ganze Simulation. Wer ein anderes will, legt eine neue Simulation an (Zurücksetzen mit Modellwahl).",
              locked="Das Modell lässt sich im Lauf nicht wechseln. Lege eine neue Simulation an und wähle dort das Modell.",
              apply=lambda sim, v, a: None, read=lambda sim, a: sim.client.params.model, consumers=("simulacra.llm.providers:model",), effect_test=T + "test_the_model_cannot_change_during_a_run"),
    _p("temperature", "Temperatur", "Wie frei das Modell formuliert (höher = zufälliger).", "temperature", 1.0, 0.0, 1.5, 0.05),
    _p("top_p", "Top-p", "Begrenzung der Wortauswahl.", "top_p", 0.95, 0.1, 1.0, 0.05),
    _p("max_tokens", "Höchstzahl Antwort-Tokens", "Längenbegrenzung der Antwort.", "max_tokens", 400, 64, 2048, 16, type_="int", unit="Tokens"),
    ParamSpec(key="llm.context_budget", group="llm", scope="global", type="int", label="Kontextbudget", default=6000, min=1000, max=16000, step=250, unit="Tokens", effect="next_decision",
              help="Höchstlänge eines Prompts (Schätzung). Darüber werden erst Langzeit-, dann ältere Kurzzeiterinnerungen weggelassen.",
              apply=lambda sim, v, a: setattr(sim.planner, "context_budget", int(v)), read=lambda sim, a: sim.planner.context_budget,
              consumers=("simulacra.agents.planner:context_budget",), effect_test=T + "test_context_budget_trims_the_prompt"),
    ParamSpec(key="llm.max_concurrent", group="llm", scope="global", type="int", label="Gleichzeitige Anfragen", default=1, min=1, max=4, step=1, effect="immediate",
              help="Werte über 1 helfen nur, wenn der Router mehrere Plätze hat.", warn="Werte über 1 brauchen mehr Plätze im Router (Neustart des Routers auf maintux nötig).",
              apply=lambda sim, v, a: sim.client.set_max_concurrent(int(v)), read=lambda sim, a: sim.client._max_concurrent, consumers=("simulacra.llm.client:_max_concurrent",),
              effect_test=T + "test_max_concurrent_limits_parallel_requests"),
    ParamSpec(key="llm.timeout_s", group="llm", scope="global", type="int", label="Zeitlimit", default=90, min=5, max=300, step=5, unit="s", effect="next_decision",
              help="So lange wartet eine Anfrage auf das Modell.", apply=lambda sim, v, a: sim.client.__setattr__("params", replace(sim.client.params, timeout_s=float(v))),
              read=lambda sim, a: int(sim.client.params.timeout_s), consumers=("simulacra.llm.providers:timeout_s",), effect_test=T + "test_llm_parameters_reach_the_request"),
    ParamSpec(key="llm.retries", group="llm", scope="global", type="int", label="Wiederholungen", default=2, min=0, max=5, step=1, effect="next_decision",
              help="Wie oft eine fehlgeschlagene Anfrage wiederholt wird.", apply=lambda sim, v, a: setattr(sim.client, "retries", int(v)), read=lambda sim, a: sim.client.retries,
              consumers=("simulacra.llm.client:retries",), effect_test=T + "test_retries_repeat_failed_requests"),
    ParamSpec(key="llm.thinking", group="llm", scope="global", type="enum", label="Denken", options=THINKING, default="off", effect="next_decision",
              help="Ob das Modell vor der Antwort nachdenkt (kostet deutlich Zeit).", apply=_apply_thinking, read=_read_thinking, consumers=("simulacra.llm.providers:thinking",),
              effect_test=T + "test_llm_parameters_reach_the_request"),
]
