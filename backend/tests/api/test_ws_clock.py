"""Uhrtakte und Snapshot: ein schon fertiger Takt der alten Welt darf nach dem Snapshot nicht mehr hinausgehen."""

import asyncio
import json
from types import SimpleNamespace

import pytest

from on_their_own.api import ws as ws_module
from on_their_own.events.bus import EventBus


class FakeSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def receive_text(self) -> str:
        await asyncio.Event().wait()                    # der Client sagt nichts
        return ""

    async def send_text(self, text: str) -> None:
        self.sent.append(json.loads(text))

    async def close(self, code: int = 1000, reason: str = "") -> None:
        pass


@pytest.mark.parametrize("event_type", ["simulation.reset", "simulation.loaded"])
async def test_clock_already_finished_when_the_world_is_replaced_is_not_sent(monkeypatch, event_type):
    async def fake_sync(ws, sim, last_seq, max_gap):
        await ws.send_text(json.dumps({"type": "snapshot"}))
        return 1
    monkeypatch.setattr(ws_module, "_sync", fake_sync)
    sock, bus = FakeSocket(), EventBus()
    sub = bus.subscribe()
    sub._clock(425)                                                       # alter Takt ist abholbereit …
    sub._push([SimpleNamespace(type=event_type, seq=2)])                  # … und das Reset-Ereignis liegt im selben Durchlauf bereit
    live = asyncio.create_task(ws_module._live(sock, None, sub, 0, 60.0, 100))
    await asyncio.sleep(0.05)
    sub._clock(421)                                                       # der erste Takt der neuen Welt
    await asyncio.sleep(0.3)
    live.cancel()
    assert [m["type"] for m in sock.sent] == ["snapshot", "clock"]
    assert sock.sent[1]["minute"] == 421
