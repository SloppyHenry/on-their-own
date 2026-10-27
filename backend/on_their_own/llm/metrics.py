"""Messwerte der LLM-Anfragen: Einzelwerte und gleitende Mittel für die Statusanzeige."""

import time
from collections import deque
from dataclasses import dataclass, field
from statistics import fmean


@dataclass
class CallRecord:
    queue_s: float                 # Wartezeit auf die Semaphore
    total_s: float                 # Antwortzeit ohne Wartezeit
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    tokens_per_s: float | None = None
    error: str | None = None       # None bei Erfolg, sonst Fehlerart
    attempts: int = 1
    at: float = field(default_factory=time.time)


@dataclass
class LLMMetrics:
    window: int = 50
    records: deque = field(default_factory=lambda: deque(maxlen=50))
    total_calls: int = 0
    total_errors: int = 0
    errors_by_kind: dict[str, int] = field(default_factory=dict)

    def add(self, r: CallRecord) -> None:
        self.records.append(r)
        self.total_calls += 1
        if r.error:
            self.total_errors += 1
            self.errors_by_kind[r.error] = self.errors_by_kind.get(r.error, 0) + 1

    def summary(self) -> dict:
        ok = [r for r in self.records if not r.error]

        def avg(vals):
            vals = [v for v in vals if v is not None]
            return round(fmean(vals), 3) if vals else None

        return {"calls": self.total_calls, "errors": self.total_errors, "errors_by_kind": dict(self.errors_by_kind),
                "avg_response_s": avg(r.total_s for r in ok), "avg_queue_s": avg(r.queue_s for r in self.records),
                "avg_prompt_tokens": avg(r.prompt_tokens for r in ok), "avg_completion_tokens": avg(r.completion_tokens for r in ok),
                "avg_tokens_per_s": avg(r.tokens_per_s for r in ok), "window": len(self.records),
                "errors_15min": sum(1 for r in self.records if r.error and r.at >= time.time() - 900)}
