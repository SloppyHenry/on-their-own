"""Event-Bus: verteilt Ereignisse erst nach dem Commit an Abonnenten (Rückrufe und Warteschlangen je Verbindung)."""

import asyncio
from typing import Callable

from ..world.models import Event

OVERFLOW = object()


class Subscription:
    """Warteschlange einer Verbindung. Läuft sie über (`max_backlog` Ereignisse Rückstand), wird sie geleert und
    meldet `OVERFLOW`: der Client muss sich neu synchronisieren, statt dass der Speicher unbegrenzt wächst."""

    def __init__(self, bus: "EventBus", loop: asyncio.AbstractEventLoop, max_backlog: int):
        self._bus, self._loop, self.max_backlog = bus, loop, max_backlog
        self._queue: asyncio.Queue = asyncio.Queue()
        self.pending = 0
        self.overflowed = False
        self.minute: int | None = None                           # letzter Uhrtakt (nur der neueste zählt)
        self._ticked = asyncio.Event()

    def _clock(self, minute: int) -> None:                        # läuft im Thread der Schleife
        self.minute = minute
        self._ticked.set()

    async def next_clock(self, delay: float = 0.0) -> int:
        """Wartet `delay` Sekunden (Drosselung) und dann auf einen neuen Uhrtakt; liefert die neueste Minute."""
        if delay:
            await asyncio.sleep(delay)
        await self._ticked.wait()
        self._ticked.clear()
        return self.minute  # type: ignore[return-value]

    def _push(self, events: list[Event]) -> None:                 # läuft im Thread der Schleife
        if self.overflowed:
            return
        if self.pending + len(events) > self.max_backlog:
            self.overflowed = True
            while not self._queue.empty():
                self._queue.get_nowait()
            self.pending = 0
            self._queue.put_nowait(OVERFLOW)
            return
        self.pending += len(events)
        self._queue.put_nowait(events)

    async def get(self):
        item = await self._queue.get()
        if item is not OVERFLOW:
            self.pending -= len(item)
        return item

    def reset(self) -> None:
        """Nach einer Neu-Synchronisierung wieder Ereignisse annehmen."""
        while not self._queue.empty():
            self._queue.get_nowait()
        self.pending, self.overflowed = 0, False
        self.drop_clock()

    def drop_clock(self) -> None:
        """Nach einem Snapshot: ein noch nicht gesendeter Takt stammt womöglich aus der alten Welt."""
        self._ticked.clear()

    def close(self) -> None:
        self._bus._subs.discard(self)


class EventBus:
    def __init__(self) -> None:
        self.listeners: list[Callable[[list[Event]], None]] = []   # synchrone Rückrufe (z. B. Konsolenausgabe)
        self._subs: set[Subscription] = set()

    @property
    def watched(self) -> bool:
        """Mindestens ein Browser (WebSocket) hört zu."""
        return bool(self._subs)

    def subscribe(self, max_backlog: int = 2000) -> Subscription:
        """Warteschlange für die aktuelle asyncio-Schleife anlegen."""
        sub = Subscription(self, asyncio.get_running_loop(), max_backlog)
        self._subs.add(sub)
        return sub

    def publish(self, events: list[Event]) -> None:
        """Aus jedem Thread aufrufbar; wird vom Commit-Haken der Datenbank gerufen, nie vor dem Commit."""
        if not events:
            return
        for cb in list(self.listeners):
            cb(events)
        for sub in list(self._subs):
            sub._loop.call_soon_threadsafe(sub._push, events)

    def clock(self, minute: int) -> None:
        """Uhrtakt an alle Verbindungen, ohne Speicherung; ältere, noch nicht gesendete Takte werden überschrieben."""
        for sub in list(self._subs):
            sub._loop.call_soon_threadsafe(sub._clock, minute)
