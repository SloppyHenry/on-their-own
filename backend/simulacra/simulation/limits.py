"""Grenzen für die Entscheidungshäufigkeit (Echtzeit): Mindestabstand je Agent und Höchstzahl pro Minute."""

import asyncio
import time
from collections import deque


class DecisionLimiter:
    def __init__(self, min_gap_s: float = 0.0, max_per_minute: int = 0):
        self.min_gap_s, self.max_per_minute = min_gap_s, max_per_minute
        self._last: dict[str, float] = {}
        self._window: deque[float] = deque()
        self.power_cap = 0                       # Energiesparen: zusätzliche Obergrenze je Minute (0 = aus)

    def configure(self, min_gap_s: float | None = None, max_per_minute: int | None = None) -> None:
        if min_gap_s is not None:
            self.min_gap_s = max(0.0, min_gap_s)
        if max_per_minute is not None:
            self.max_per_minute = max(0, max_per_minute)

    def delay_for(self, agent_id: str, now: float | None = None) -> float:
        now = time.monotonic() if now is None else now
        wait = max(0.0, self._last.get(agent_id, -1e9) + self.min_gap_s - now)
        limit = min([x for x in (self.max_per_minute, self.power_cap) if x > 0], default=0)
        if limit > 0:
            while self._window and self._window[0] <= now - 60:
                self._window.popleft()
            if len(self._window) >= limit:
                wait = max(wait, self._window[len(self._window) - limit] + 60 - now)
        return wait

    async def acquire(self, agent_id: str) -> float:
        """Wartet, bis die Grenzen eine Entscheidung erlauben, und verbucht sie. Gibt die Wartezeit zurück."""
        wait = self.delay_for(agent_id)
        if wait > 0:
            await asyncio.sleep(wait)
        now = time.monotonic()
        self._last[agent_id] = now
        self._window.append(now)
        return wait
