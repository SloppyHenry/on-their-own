"""LLM-Anbieter: OpenAI-kompatibler Endpunkt und Test-Anbieter. Das Modell führt nie Code aus; es liefert nur Text."""

import json
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Protocol

import httpx


class LLMError(Exception):
    """kind: timeout | network | server (5xx) | client (4xx) | bad_response"""

    def __init__(self, kind: str, text: str):
        super().__init__(f"{kind}: {text}")
        self.kind, self.text = kind, text

    @property
    def retryable(self) -> bool:
        return self.kind in ("timeout", "network", "server")


@dataclass
class LLMParams:
    model: str
    temperature: float = 1.0
    top_p: float = 0.95
    max_tokens: int = 400
    timeout_s: float = 90.0
    response_format: str = "json_schema"      # json_schema | json_object | none
    thinking: bool = False
    schema_name: str = "antwort"


@dataclass
class LLMResult:
    content: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    tokens_per_s: float | None = None
    raw: dict = field(default_factory=dict)


class LLMProvider(Protocol):
    async def complete(self, messages: list[dict], schema: dict | None, params: LLMParams) -> LLMResult: ...


class OpenAICompatProvider:
    """`/v1/chat/completions` mit Bearer-Key (z. B. llama.cpp-Router). Ohne Streaming; Zeiten aus `timings`."""

    def __init__(self, base_url: str, api_key: str | None, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._transport = transport
        self._client: httpx.AsyncClient | None = None

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(transport=self._transport)
        return self._client

    def build_body(self, messages: list[dict], schema: dict | None, p: LLMParams) -> dict[str, Any]:
        body: dict[str, Any] = {"model": p.model, "messages": messages, "temperature": p.temperature, "top_p": p.top_p,
                                "max_tokens": p.max_tokens, "stream": False}
        if not p.thinking:
            body["chat_template_kwargs"] = {"enable_thinking": False}
        if p.response_format == "json_schema" and schema is not None:
            body["response_format"] = {"type": "json_schema", "json_schema": {"name": p.schema_name, "strict": True, "schema": schema}}
        elif p.response_format in ("json_schema", "json_object"):
            body["response_format"] = {"type": "json_object"}
        return body

    async def complete(self, messages: list[dict], schema: dict | None, params: LLMParams) -> LLMResult:
        try:
            r = await self._http().post(f"{self.base_url}/chat/completions", json=self.build_body(messages, schema, params),
                                        headers=self._headers, timeout=httpx.Timeout(params.timeout_s, connect=min(5.0, params.timeout_s)))
        except httpx.TimeoutException as e:
            raise LLMError("timeout", f"{type(e).__name__}") from None
        except httpx.HTTPError as e:
            raise LLMError("network", f"{type(e).__name__}: {e}") from None
        if r.status_code >= 500:
            raise LLMError("server", f"HTTP {r.status_code}: {r.text[:200]}")
        if r.status_code >= 400:
            raise LLMError("client", f"HTTP {r.status_code}: {r.text[:200]}")
        try:
            data = r.json()
            content = data["choices"][0]["message"].get("content") or ""
        except (ValueError, KeyError, IndexError, TypeError):
            raise LLMError("bad_response", f"Antwort nicht lesbar: {r.text[:200]}") from None
        usage, timings = data.get("usage") or {}, data.get("timings") or {}
        return LLMResult(content=content, prompt_tokens=usage.get("prompt_tokens"), completion_tokens=usage.get("completion_tokens"),
                         tokens_per_s=timings.get("predicted_per_second"), raw={"finish_reason": data["choices"][0].get("finish_reason")})

    async def models(self) -> list[str]:
        """Modelle des Routers (für Verbindungsprüfung und Auswahl)."""
        try:
            r = await self._http().get(f"{self.base_url}/models", headers=self._headers, timeout=5.0)
            r.raise_for_status()
            return [m["id"] for m in r.json().get("data", [])]
        except (httpx.HTTPError, ValueError, KeyError) as e:
            raise LLMError("network", f"{type(e).__name__}: {e}") from None

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()


class FakeProvider:
    """Für Tests und den Offline-Betrieb. `script` enthält Antworten (str), Ausnahmen oder Funktionen
    `fn(messages, schema, params) -> str`; ist es erschöpft, wird die letzte Antwort wiederholt."""

    def __init__(self, script: list[Any] | None = None, fn: Callable[[list[dict], dict | None, LLMParams], str] | None = None, delay_s: float = 0.0):
        self.script = list(script or [])
        self.fn = fn
        self.delay_s = delay_s
        self.calls: list[dict] = []
        self.active = 0
        self.max_active = 0

    async def complete(self, messages: list[dict], schema: dict | None, params: LLMParams) -> LLMResult:
        import asyncio
        self.calls.append({"messages": messages, "schema": schema, "params": params})
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            if self.delay_s:
                await asyncio.sleep(self.delay_s)
            if self.fn is not None:
                item: Any = self.fn(messages, schema, params)
            else:
                item = self.script.pop(0) if len(self.script) > 1 else (self.script[0] if self.script else "{}")
            if isinstance(item, BaseException):
                raise item
            if isinstance(item, dict):
                item = json.dumps(item, ensure_ascii=False)
            return LLMResult(content=item, prompt_tokens=100, completion_tokens=20, tokens_per_s=20.0)
        finally:
            self.active -= 1


def first_option_fn(messages: list[dict], schema: dict | None, params: LLMParams) -> str:
    """Wählt immer die erste angebotene Option (bei Gesprächsoptionen mit einem Satz); Offline-Betrieb ohne Modell."""
    enum = (schema or {}).get("properties", {}).get("option_id", {}).get("enum", ["o1"])
    return json.dumps({"option_id": enum[0], "intent": "erste Option", "utterance": "Hallo!", "importance": 3}, ensure_ascii=False)
