"""Meldet Änderungen der Modellverwaltung (Fortschritt, Laufzeit, Probelauf) an alle verbundenen Browser (AP17c-3).

Der Hub kennt nur „es hat sich etwas geändert“; die WebSocket-Verbindung schickt dann den aktuellen Gesamtzustand. Mehrere Änderungen kurz hintereinander
ergeben so eine Nachricht, und ein langsamer Browser staut nichts auf."""

from __future__ import annotations

import asyncio


class Subscription:
    def __init__(self, hub: "Hub"):
        self._hub = hub
        self._event = asyncio.Event()

    async def changed(self) -> None:
        await self._event.wait()
        self._event.clear()

    def close(self) -> None:
        self._hub._subs.discard(self)


class Hub:
    def __init__(self) -> None:
        self._subs: set[Subscription] = set()

    def subscribe(self) -> Subscription:
        s = Subscription(self)
        self._subs.add(s)
        return s

    def publish(self) -> None:
        for s in self._subs:
            s._event.set()
