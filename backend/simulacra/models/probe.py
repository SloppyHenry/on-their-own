"""Probelauf (AP17c-3, Frage 42): zehn Entscheidungen mit dem Messprompt aus AP00 und `json_schema`, danach Siegel und Messwerte.

Gemessen wird, was für die Simulation zählt: wie oft die Antwort dem Schema entspricht (gültig), wie lange eine Entscheidung dauert und wie schnell das
Modell Token erzeugt. Das Siegel sagt, ob das Modell auf diesem Rechner taugt; die Live-Liste schlägt nur vor."""

from __future__ import annotations

import json
import re
import statistics
import time
from dataclasses import dataclass, field
from typing import Callable

from ..llm.providers import LLMError, LLMParams, LLMProvider
from .probe_data import SCENARIOS, build_messages

RUNS = 10
VALID_MIN_PCT = 90.0            # darunter „ungeeignet“ (Frage 42)
SLOW_S = 20.0                   # ab dieser mittleren Dauer je Entscheidung „mit Einschränkung“ (Annahme, nicht von Henry vorgegeben)
SEALS = {"checked": "geprüft", "limited": "mit Einschränkung", "unfit": "ungeeignet"}


class ProbeCancelled(Exception):
    pass


def decision_schema(option_ids: list[str]) -> dict:
    return {"type": "object", "additionalProperties": False, "required": ["option_id", "reason", "utterance", "importance"],
            "properties": {"option_id": {"type": "string", "enum": option_ids}, "reason": {"type": "string"}, "utterance": {"type": "string"},
                           "importance": {"type": "integer", "minimum": 1, "maximum": 10}}}


def validate(content: str, option_ids: list[str]) -> tuple[bool, bool, dict | None]:
    """(strikt_json, gültig, Objekt). Gültig = nach Schema, auch wenn in Fences/Text verpackt."""
    def check(obj):
        return (isinstance(obj, dict) and obj.get("option_id") in option_ids and isinstance(obj.get("reason"), str)
                and isinstance(obj.get("utterance"), str) and isinstance(obj.get("importance"), int)
                and not isinstance(obj.get("importance"), bool) and 1 <= obj["importance"] <= 10)
    try:
        obj = json.loads(content)
        return True, check(obj), obj
    except (ValueError, TypeError):
        m = re.search(r"\{.*\}", content or "", re.S)
        try:
            obj = json.loads(m.group(0)) if m else None
        except ValueError:
            obj = None
        return False, check(obj), obj


def seal_of(valid_pct: float, avg_s: float | None) -> str:
    if valid_pct < VALID_MIN_PCT:
        return "unfit"
    return "limited" if avg_s is not None and avg_s > SLOW_S else "checked"


@dataclass
class ProbeResult:
    n: int
    valid: int
    errors: int
    avg_s: float | None
    tokens_per_s: float | None
    seal: str
    at: float = field(default_factory=time.time)

    @property
    def valid_pct(self) -> float:
        return round(100.0 * self.valid / self.n, 1) if self.n else 0.0

    def to_dict(self, **extra) -> dict:
        return {"n": self.n, "valid": self.valid, "valid_pct": self.valid_pct, "errors": self.errors, "avg_s": None if self.avg_s is None else round(self.avg_s, 2),
                "tokens_per_s": None if self.tokens_per_s is None else round(self.tokens_per_s, 1), "seal": self.seal, "at": self.at, **extra}


async def run_probe(provider: LLMProvider, model: str, *, runs: int = RUNS, on_step: Callable[[int, int], None] | None = None,
                    cancelled: Callable[[], bool] = lambda: False, timeout_s: float = 180.0) -> ProbeResult:
    """Stellt `runs` Anfragen (abwechselnd Alex und Mira, Szenen der Reihe nach). Fehlgeschlagene Anfragen zählen als ungültig."""
    params = LLMParams(model=model, response_format="json_schema", thinking=False, max_tokens=600, timeout_s=timeout_s, schema_name="entscheidung")
    times: list[float] = []
    speeds: list[float] = []
    valid = errors = done = 0
    for i in range(runs):
        if cancelled():
            raise ProbeCancelled()
        persona, sc = ("Alex", "Mira")[i % 2], SCENARIOS[(i // 2) % len(SCENARIOS)]
        ids = [o[0] for o in sc["opt"]]
        t0 = time.perf_counter()
        try:
            res = await provider.complete(build_messages(persona, sc), decision_schema(ids), params)
        except LLMError:
            errors += 1
        else:
            times.append(time.perf_counter() - t0)
            if validate(res.content, ids)[1]:
                valid += 1
            if res.tokens_per_s:
                speeds.append(res.tokens_per_s)
        done += 1
        if on_step:
            on_step(done, runs)
    avg = statistics.fmean(times) if times else None
    pct = 100.0 * valid / runs if runs else 0.0
    return ProbeResult(runs, valid, errors, avg, statistics.fmean(speeds) if speeds else None, seal_of(pct, avg))
