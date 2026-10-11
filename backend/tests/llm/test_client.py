import asyncio
import json

import httpx
import pytest

from simulacra.llm.client import LLMClient
from simulacra.llm.providers import FakeProvider, LLMError, LLMParams, OpenAICompatProvider

MSGS = [{"role": "user", "content": "Hallo"}]
SCHEMA = {"type": "object", "properties": {"a": {"type": "string"}}}


def ok_body(content='{"a":"x"}', tps=21.5):
    return {"choices": [{"message": {"content": content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 480, "completion_tokens": 20}, "timings": {"predicted_per_second": tps}}


def client(handler, **kw):
    prov = OpenAICompatProvider("http://x/v1", "geheim", transport=httpx.MockTransport(handler))
    return LLMClient(prov, LLMParams("modell-1", timeout_s=5), backoff_s=0.0, **kw), prov


async def test_request_format_schema_mode_without_thinking():
    seen = {}

    def handler(req):
        seen["auth"], seen["body"], seen["url"] = req.headers["authorization"], json.loads(req.content), str(req.url)
        return httpx.Response(200, json=ok_body())

    c, _ = client(handler)
    r = await c.chat(MSGS, SCHEMA)
    b = seen["body"]
    assert seen["auth"] == "Bearer geheim" and seen["url"] == "http://x/v1/chat/completions"
    assert b["model"] == "modell-1" and b["stream"] is False and b["max_tokens"] == 400
    assert b["response_format"] == {"type": "json_schema", "json_schema": {"name": "antwort", "strict": True, "schema": SCHEMA}}
    assert b["chat_template_kwargs"] == {"enable_thinking": False}
    assert (r.content, r.prompt_tokens, r.completion_tokens, r.tokens_per_s) == ('{"a":"x"}', 480, 20, 21.5)


async def test_format_variants_and_thinking_flag():
    bodies = []

    def handler(req):
        bodies.append(json.loads(req.content))
        return httpx.Response(200, json=ok_body())

    c, _ = client(handler)
    await c.chat(MSGS, SCHEMA, response_format="json_object")
    await c.chat(MSGS, SCHEMA, response_format="none")
    await c.chat(MSGS, None)                                   # Standard-Format, aber ohne Schema -> json_object
    await c.chat(MSGS, SCHEMA, thinking=True)
    assert bodies[0]["response_format"] == {"type": "json_object"}
    assert "response_format" not in bodies[1]
    assert bodies[2]["response_format"] == {"type": "json_object"}
    assert "chat_template_kwargs" not in bodies[3]


async def test_retries_on_5xx_then_succeeds_and_counts_attempts():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(503, text="busy") if len(calls) < 3 else httpx.Response(200, json=ok_body())

    c, _ = client(handler, retries=2)
    r = await c.chat(MSGS)
    assert r.content and len(calls) == 3 and c.metrics.records[-1].attempts == 3 and c.metrics.total_errors == 0


async def test_gives_up_after_retries_on_server_errors():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(500, text="kaputt")

    c, _ = client(handler, retries=2)
    with pytest.raises(LLMError) as e:
        await c.chat(MSGS)
    assert e.value.kind == "server" and len(calls) == 3 and c.metrics.errors_by_kind == {"server": 1}


async def test_no_retry_on_4xx():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(401, json={"error": "nope"})

    c, _ = client(handler, retries=3)
    with pytest.raises(LLMError) as e:
        await c.chat(MSGS)
    assert e.value.kind == "client" and len(calls) == 1 and not e.value.retryable


async def test_timeout_and_network_errors_are_retried_and_classified():
    n = {"t": 0, "n": 0}

    def timeout(req):
        n["t"] += 1
        raise httpx.ReadTimeout("zu langsam")

    def netfail(req):
        n["n"] += 1
        raise httpx.ConnectError("weg")

    c, _ = client(timeout, retries=1)
    with pytest.raises(LLMError) as e:
        await c.chat(MSGS)
    assert e.value.kind == "timeout" and n["t"] == 2
    c, _ = client(netfail, retries=1)
    with pytest.raises(LLMError) as e:
        await c.chat(MSGS)
    assert e.value.kind == "network" and n["n"] == 2


async def test_unreadable_answer_is_bad_response_without_retry():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(200, text="<html>Proxy</html>")

    c, _ = client(handler, retries=3)
    with pytest.raises(LLMError) as e:
        await c.chat(MSGS)
    assert e.value.kind == "bad_response" and len(calls) == 1


async def test_semaphore_limits_concurrent_requests():
    prov = FakeProvider(["{}"], delay_s=0.02)
    c = LLMClient(prov, LLMParams("m"), max_concurrent=1)
    await asyncio.gather(*(c.chat(MSGS) for _ in range(6)))
    assert prov.max_active == 1 and len(prov.calls) == 6
    prov2 = FakeProvider(["{}"], delay_s=0.02)
    c2 = LLMClient(prov2, LLMParams("m"), max_concurrent=2)
    await asyncio.gather(*(c2.chat(MSGS) for _ in range(6)))
    assert prov2.max_active == 2


async def test_queue_wait_is_measured_separately():
    c = LLMClient(FakeProvider(["{}"], delay_s=0.05), LLMParams("m"), max_concurrent=1)
    await asyncio.gather(c.chat(MSGS), c.chat(MSGS))
    waits = sorted(r.queue_s for r in c.metrics.records)
    assert waits[0] < 0.02 and waits[1] >= 0.04
    s = c.metrics.summary()
    assert s["calls"] == 2 and s["avg_response_s"] >= 0.04 and s["avg_tokens_per_s"] == 20.0


async def test_runtime_change_of_concurrency_applies_to_new_requests():
    prov = FakeProvider(["{}"], delay_s=0.02)
    c = LLMClient(prov, LLMParams("m"), max_concurrent=1)
    c.set_max_concurrent(3)
    await asyncio.gather(*(c.chat(MSGS) for _ in range(6)))
    assert prov.max_active == 3


async def test_fake_provider_scripts_errors_and_dicts():
    prov = FakeProvider([LLMError("timeout", "x"), {"a": 1}])
    c = LLMClient(prov, LLMParams("m"), retries=0)
    with pytest.raises(LLMError):
        await c.chat(MSGS)
    assert json.loads((await c.chat(MSGS)).content) == {"a": 1}


def test_settings_build_client(tmp_path):
    from simulacra.config import Settings
    s = Settings(llm_api_key_file=tmp_path / "none", llm_model="m2", llm_max_concurrent=2, llm_thinking=True)
    c = LLMClient.from_settings(s)
    assert c.params.model == "m2" and c.params.thinking and c._max_concurrent == 2 and c.params.max_tokens == 400
