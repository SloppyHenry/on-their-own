"""Wirkungstests: Die Modell-Regler kommen bei der Anfrage an (Client, Anfragekörper, Prompt)."""

import asyncio

import pytest

from simulacra.llm.providers import FakeProvider, LLMError, OpenAICompatProvider

from .conftest import patch
from .test_effects_memory import SIT, fill


async def ask(sim):
    return await sim.client.chat([{"role": "user", "content": "hallo"}], {"type": "object"})


async def test_llm_parameters_reach_the_request(sim):
    await patch(sim, "llm.temperature", 0.3)
    await patch(sim, "llm.top_p", 0.5)
    await patch(sim, "llm.max_tokens", 123 + 5)                      # Schrittweite 16 ab 64: 64 + 16 × 4 = 128
    await patch(sim, "llm.timeout_s", 20)
    await patch(sim, "llm.thinking", "short")
    await ask(sim)
    p = sim.client.provider.calls[-1]["params"]
    assert (p.temperature, p.top_p, p.max_tokens, p.timeout_s, p.thinking, p.reasoning_effort) == (0.3, 0.5, 128, 20, True, "low")
    body = OpenAICompatProvider("http://x/v1", None).build_body([], None, p)                  # und so landet es im echten Anfragekörper
    assert body["temperature"] == 0.3 and body["top_p"] == 0.5 and body["max_tokens"] == 128 and body["reasoning_effort"] == "low"
    assert "chat_template_kwargs" not in body
    await patch(sim, "llm.thinking", "normal")
    assert sim.client.params.reasoning_effort == "medium"
    await patch(sim, "llm.thinking", "off")
    body = OpenAICompatProvider("http://x/v1", None).build_body([], None, sim.client.params)
    assert body["chat_template_kwargs"] == {"enable_thinking": False} and "reasoning_effort" not in body


async def test_base_url_needs_a_working_connection(sim, monkeypatch):
    sim.client.provider.base_url = "http://alt/v1"
    seen = []

    async def models(self):
        seen.append(self.base_url)
        if "kaputt" in self.base_url:
            raise LLMError("network", "ConnectError")
        return ["m"]
    monkeypatch.setattr(OpenAICompatProvider, "models", models)
    [bad] = await sim.params.patch([{"key": "llm.base_url", "value": "http://kaputt:1/v1"}])
    assert bad["status"] == "rejected" and "Keine Verbindung" in bad["reason"]
    assert sim.client.provider.base_url == "http://alt/v1"                              # unverändert
    [good] = await sim.params.patch([{"key": "llm.base_url", "value": "http://neu:8080/v1"}])
    assert good["status"] == "applied" and sim.client.provider.base_url == "http://neu:8080/v1" and seen == ["http://kaputt:1/v1", "http://neu:8080/v1"]
    assert sim.params.current_value("llm.base_url") == "http://neu:8080/v1"


async def test_the_model_cannot_change_during_a_run(sim):
    before = sim.client.params.model
    [r] = await sim.params.patch([{"key": "llm.model", "value": "ein-anderes-modell"}])
    assert r["status"] == "rejected" and "neue Simulation" in r["reason"]
    assert sim.client.params.model == before
    await sim.reset(model="ein-anderes-modell")                                         # nur beim Anlegen einer neuen Simulation
    assert sim.client.params.model == "ein-anderes-modell"


async def test_context_budget_trims_the_prompt(sim):
    fill(sim, n=40, start=10, step=15)
    await patch(sim, "memory.retrieval_threshold", 0.0)
    await patch(sim, "memory.max_in_context", 40)
    await patch(sim, "memory.context_token_budget", 4000)
    await patch(sim, "llm.context_budget", 16000)
    full = (await sim.engine.db.run(lambda: sim.planner.prepare("alex"))).messages
    await patch(sim, "llm.context_budget", 1000)
    short = (await sim.engine.db.run(lambda: sim.planner.prepare("alex"))).messages
    size = lambda m: sum(len(x["content"]) for x in m)           # noqa: E731
    assert size(short) < size(full) and size(short) / 3.2 <= 1000 * 1.05
    assert short[0] == full[0]


async def test_max_concurrent_limits_parallel_requests(sim):
    sim.client.provider = FakeProvider(["{}"], delay_s=0.05)
    await asyncio.gather(ask(sim), ask(sim), ask(sim))
    assert sim.client.provider.max_active == 1
    await patch(sim, "llm.max_concurrent", 2)
    await asyncio.gather(ask(sim), ask(sim), ask(sim))
    assert sim.client.provider.max_active == 2


async def test_retries_repeat_failed_requests(sim):
    sim.client.provider = FakeProvider([LLMError("network", "weg")])
    sim.client.backoff_s = 0.0
    await patch(sim, "llm.retries", 3)
    with pytest.raises(LLMError):
        await ask(sim)
    assert len(sim.client.provider.calls) == 4                                          # erster Versuch + 3 Wiederholungen
    sim.client.provider.calls.clear()
    await patch(sim, "llm.retries", 0)
    with pytest.raises(LLMError):
        await ask(sim)
    assert len(sim.client.provider.calls) == 1
