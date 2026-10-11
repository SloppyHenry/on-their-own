"""LLM-Client: begrenzt gleichzeitige Anfragen, wiederholt gezielt und misst jede Anfrage."""

import asyncio
import time
from dataclasses import replace

from ..config import Settings
from .metrics import CallRecord, LLMMetrics
from .providers import LLMError, LLMParams, LLMProvider, LLMResult, OpenAICompatProvider


class LLMClient:
    def __init__(self, provider: LLMProvider, params: LLMParams, *, retries: int = 2, backoff_s: float = 1.0, max_concurrent: int = 1):
        self.provider = provider
        self.params = params
        self.retries = retries
        self.backoff_s = backoff_s
        self.metrics = LLMMetrics()
        self._sem = asyncio.Semaphore(max_concurrent)
        self._max_concurrent = max_concurrent

    @classmethod
    def from_settings(cls, s: Settings, provider: LLMProvider | None = None) -> "LLMClient":
        key = s.llm_api_key.get_secret_value() if s.llm_api_key else None
        params = LLMParams(model=s.llm_model, temperature=s.llm_temperature, top_p=s.llm_top_p, max_tokens=s.llm_max_tokens,
                           timeout_s=s.llm_timeout_s, response_format=s.llm_response_format, thinking=s.llm_thinking)
        return cls(provider or OpenAICompatProvider(s.llm_base_url, key), params, retries=s.llm_retries,
                   backoff_s=s.llm_backoff_s, max_concurrent=s.llm_max_concurrent)

    def set_max_concurrent(self, n: int) -> None:
        """Wirkt für neue Anfragen; laufende bleiben unberührt."""
        self._sem = asyncio.Semaphore(max(1, n))
        self._max_concurrent = max(1, n)

    async def chat(self, messages: list[dict], schema: dict | None = None, **overrides) -> LLMResult:
        params = replace(self.params, **overrides) if overrides else self.params
        t_wait = time.perf_counter()
        async with self._sem:
            queue_s = time.perf_counter() - t_wait
            attempts, t0 = 0, time.perf_counter()
            while True:
                attempts += 1
                try:
                    result = await self.provider.complete(messages, schema, params)
                except LLMError as e:
                    if e.retryable and attempts <= self.retries:
                        await asyncio.sleep(self.backoff_s * 2 ** (attempts - 1))
                        continue
                    self.metrics.add(CallRecord(queue_s, time.perf_counter() - t0, error=e.kind, attempts=attempts))
                    raise
                self.metrics.add(CallRecord(queue_s, time.perf_counter() - t0, result.prompt_tokens, result.completion_tokens,
                                            result.tokens_per_s, None, attempts))
                return result
