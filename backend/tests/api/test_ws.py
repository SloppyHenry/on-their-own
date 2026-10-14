import asyncio
import json
import time
from types import SimpleNamespace

import pytest
from starlette.websockets import WebSocketDisconnect

from agents.conftest import make_sim
from simulacra.api import ws as ws_module
from simulacra.api.ws import _live
from simulacra.events.bus import EventBus
from simulacra.events.store import EventStore

from .conftest import api, event_seqs, hello, minute, post, recv_until, wait_one_minute


def all_seqs(c):
    return [e.seq for e in EventStore(c.sim.engine.state.conn).fetch(limit=100000)]


def test_first_contact_gets_a_snapshot_then_live_events():
    with api() as c:
        post(c, "/api/sim/step", {"n": 2})
        with c.websocket_connect("/ws") as ws:
            snap = hello(ws)
            assert snap["type"] == "snapshot" and snap["seq"] == snap["state"]["seq"] == all_seqs(c)[-1]
            assert {a["id"] for a in snap["state"]["agents"]} == {"alex", "mira"} and snap["state"]["map"]["width"] == 64
            post(c, "/api/sim/step", {"n": 1})
            msgs = recv_until(ws, lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
            seqs = event_seqs(msgs)
            assert seqs == list(range(snap["seq"] + 1, seqs[-1] + 1))                        # lückenlos, in Reihenfolge, nichts doppelt
            assert {m["event"]["type"] for m in msgs if m["type"] == "event"} >= {"agent.decision", "agent.action_started", "agent.status_changed"}


def test_reconnect_with_last_seq_delivers_exactly_the_missed_events():
    with api() as c:
        with c.websocket_connect("/ws") as ws:
            snap = hello(ws)
            post(c, "/api/sim/step", {"n": 2})
            msgs = recv_until(ws, lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
            seen = event_seqs(msgs)
            last = seen[-1]
        post(c, "/api/sim/step", {"n": 3})                                                   # Verbindung ist weg, die Welt läuft weiter
        missed = [s for s in all_seqs(c) if s > last]
        assert len(missed) > 5
        with c.websocket_connect("/ws") as ws:
            ws.send_json({"type": "hello", "last_seq": last})
            m = ws.receive_json()
            assert m["type"] == "events" and event_seqs([m]) == missed
            post(c, "/api/sim/step", {"n": 1})
            more = event_seqs(recv_until(ws, lambda x: x["type"] == "event" and x["event"]["type"] == "simulation.stepped"))
            assert more == list(range(missed[-1] + 1, more[-1] + 1))


def test_up_to_date_client_gets_no_backlog():
    with api() as c:
        post(c, "/api/sim/step", {"n": 1})
        head = all_seqs(c)[-1]
        with c.websocket_connect("/ws") as ws:
            ws.send_json({"type": "hello", "last_seq": head})
            post(c, "/api/sim/step", {"n": 1})
            first = ws.receive_json()
            assert first["type"] == "event" and first["event"]["seq"] == head + 1


def test_large_gap_or_unknown_future_seq_gets_a_snapshot():
    with api(ws_max_gap=5) as c:
        post(c, "/api/sim/step", {"n": 3})
        with c.websocket_connect("/ws") as ws:
            assert hello(ws, 1)["type"] == "snapshot"                                          # Rückstand > 5
        with c.websocket_connect("/ws") as ws:
            assert hello(ws, 999999)["type"] == "snapshot"                                     # Client kennt eine andere Welt


def test_client_can_ask_for_a_resync_at_any_time():
    with api() as c:
        post(c, "/api/sim/step", {"n": 2})
        with c.websocket_connect("/ws") as ws:
            snap = hello(ws)
            post(c, "/api/sim/step", {"n": 1})
            recv_until(ws, lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
            ws.send_json({"type": "resync", "last_seq": snap["seq"]})
            m = ws.receive_json()
            assert m["type"] == "events" and event_seqs([m])[0] == snap["seq"] + 1
            ws.send_json({"type": "resync", "last_seq": None})
            assert ws.receive_json()["type"] == "snapshot"


def test_browser_refresh_restores_the_same_state():
    with api() as c:
        post(c, "/api/sim/step", {"n": 4})
        with c.websocket_connect("/ws") as ws:
            snap = hello(ws)["state"]
        rest = c.get("/api/state").json()
        for key in ("seq", "map", "agents", "objects", "resources", "clock", "weather", "locations"):
            assert snap[key] == rest[key], key


def test_disconnect_does_not_disturb_the_simulation():
    with api() as c:
        c.sim.runner.set_speed(0.02)
        with c.websocket_connect("/ws") as ws:
            hello(ws)
            post(c, "/api/sim/start")
            ws.receive_json()
        m = minute(c)
        time.sleep(0.3)
        assert minute(c) > m and c.sim.runner.state.value == "running"                 # läuft ohne Zuschauer weiter
        post(c, "/api/sim/pause")


def test_two_clients_receive_the_same_events():
    with api() as c:
        with c.websocket_connect("/ws") as a, c.websocket_connect("/ws") as b:
            hello(a), hello(b)
            post(c, "/api/sim/step", {"n": 1})
            end = lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped"
            assert event_seqs(recv_until(a, end)) == event_seqs(recv_until(b, end))


def test_heartbeat_pings_and_closes_silent_clients():
    with api(ws_ping_s=0.1) as c:
        with c.websocket_connect("/ws") as ws:
            hello(ws)
            assert ws.receive_json() == {"type": "ping"}
            ws.send_json({"type": "pong"})
            assert ws.receive_json() == {"type": "ping"}
            with pytest.raises(WebSocketDisconnect) as e:                                    # jetzt antworten wir nicht mehr
                for _ in range(20):
                    ws.receive_json()
            assert e.value.code == 4008


def test_first_message_must_be_hello_and_garbage_closes_quietly():
    with api() as c:
        with c.websocket_connect("/ws") as ws:
            ws.send_json({"type": "events"})
            with pytest.raises(WebSocketDisconnect) as e:
                ws.receive_json()
            assert e.value.code == 4400
        with c.websocket_connect("/ws") as ws:
            ws.send_text("kein json")
            with pytest.raises(WebSocketDisconnect):
                ws.receive_json()
        assert c.get("/api/health").status_code == 200                                      # Server lebt weiter


def test_reset_pushes_a_fresh_snapshot_to_connected_clients():
    with api() as c:
        post(c, "/api/sim/step", {"n": 3})
        with c.websocket_connect("/ws") as ws:
            hello(ws)
            post(c, "/api/sim/reset", {"confirm": True})
            msgs = recv_until(ws, lambda m: m["type"] == "snapshot")
            snap = msgs[-1]
            assert snap["state"]["clock"]["minute"] == 420 and snap["seq"] <= 2
            post(c, "/api/sim/step", {"n": 1})
            nxt = recv_until(ws, lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
            assert event_seqs(nxt)[0] == snap["seq"] + 1


def test_reconnect_after_reset_with_old_seq_gets_a_snapshot():
    with api() as c:
        post(c, "/api/sim/step", {"n": 4})
        old_head = all_seqs(c)[-1]
        post(c, "/api/sim/reset", {"confirm": True})
        with c.websocket_connect("/ws") as ws:
            assert hello(ws, old_head)["type"] == "snapshot"


def test_messages_follow_the_documented_schema():
    from simulacra.api.models import WsEvent, WsEvents, WsSnapshot
    with api() as c:
        post(c, "/api/sim/step", {"n": 1})
        with c.websocket_connect("/ws") as ws:
            WsSnapshot.model_validate(hello(ws))
            ws.send_json({"type": "resync", "last_seq": 1})
            WsEvents.model_validate(ws.receive_json())
            post(c, "/api/sim/step", {"n": 1})
            WsEvent.model_validate(ws.receive_json())


def test_clock_follows_steps_without_sequence_numbers():
    with api() as c:
        with c.websocket_connect("/ws") as ws:
            snap = hello(ws)
            post(c, "/api/sim/step", {"n": 3})
            target = snap["state"]["clock"]["minute"] + 3
            msgs = recv_until(ws, lambda m: m["type"] == "clock" and m["minute"] == target)
            clocks = [m for m in msgs if m["type"] == "clock"]
            assert all(set(m) == {"type", "minute"} for m in clocks)                       # nicht gespeichert, ohne Nummer
            assert [m["minute"] for m in clocks] == sorted(m["minute"] for m in clocks)
            assert event_seqs(msgs) == list(range(snap["seq"] + 1, event_seqs(msgs)[-1] + 1))  # Ereignisse bleiben lückenlos


def test_clock_is_throttled_and_heartbeat_keeps_running_at_full_speed():
    with api(ws_ping_s=0.3) as c:
        with c.websocket_connect("/ws") as ws:
            hello(ws)
            post(c, "/api/sim/speed", {"level": "max"})
            post(c, "/api/sim/start", {})
            t0, clocks, pings = time.monotonic(), 0, 0
            while time.monotonic() - t0 < 1.0:
                m = ws.receive_json()
                clocks += m["type"] == "clock"
                if m["type"] == "ping":
                    pings += 1
                    ws.send_json({"type": "pong"})
            post(c, "/api/sim/pause", {})
            assert 1 <= clocks <= 14 and pings >= 2                                        # höchstens ~10 Takte/s; Heartbeat trotz Dauerverkehr


def test_clock_after_reset_never_carries_the_old_minute():
    with api() as c:
        with c.websocket_connect("/ws") as ws:
            hello(ws)
            post(c, "/api/sim/step", {"n": 5})
            post(c, "/api/sim/reset", {"confirm": True})
            msgs = recv_until(ws, lambda m: m["type"] == "snapshot")
            post(c, "/api/sim/step", {"n": 1})
            after = recv_until(ws, lambda m: m["type"] == "clock" and m["minute"] == 421)
            assert all(m["minute"] <= 421 for m in after if m["type"] == "clock")
            assert msgs[-1]["state"]["clock"]["minute"] == 420


class _RecordingWs:
    """Steht für den Browser: merkt sich alles Gesendete, schickt selbst nichts."""
    def __init__(self):
        self.sent: list[dict] = []

    async def send_text(self, text: str) -> None:
        self.sent.append(json.loads(text))

    async def receive_text(self) -> str:
        await asyncio.Future()

    async def close(self, code: int = 1000, reason: str = "") -> None:
        pass


async def _until(pred, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while not pred():
        assert time.monotonic() < deadline, "erwartete Nachricht kam nicht"
        await asyncio.sleep(0.01)


async def test_clock_already_fetched_before_the_reset_is_dropped_not_sent_after_the_snapshot():
    """Rennen unter Last (12.10.2026): Die Warte-Aufgabe für den Uhrtakt hatte Minute 425 der alten Welt schon abgeholt, als das
    Reset-Ereignis kam; beide waren in derselben Runde fertig, der Snapshot ging zuerst raus und danach der alte Takt.
    Hier liegen Takt und Reset gezielt gleichzeitig an, bevor die Verbindung sie liest."""
    sim = make_sim(fn=wait_one_minute)
    try:
        await sim.runner.step(5)
        sub = sim.engine.bus.subscribe()
        sim.engine.bus.clock(sim.engine.minute)                     # Takt der alten Welt (425), noch nicht gesendet
        await sim.reset()
        ws = _RecordingWs()
        live = asyncio.create_task(_live(ws, sim, sub, 0, 60.0, 5000))
        await _until(lambda: any(m["type"] == "snapshot" for m in ws.sent))
        await sim.runner.step(1)
        await _until(lambda: any(m["type"] == "clock" and m["minute"] == 421 for m in ws.sent))
        live.cancel()
        sub.close()
        types = [m["type"] for m in ws.sent]
        after = ws.sent[types.index("snapshot"):]
        assert after[0]["state"]["clock"]["minute"] == 420
        assert [m["minute"] for m in after if m["type"] == "clock"] == [421]
    finally:
        sim.close()
class _FakeWs:
    def __init__(self, incoming):
        self.incoming, self.sent = list(incoming), []

    async def receive_text(self):
        if self.incoming:
            return self.incoming.pop(0)
        await asyncio.Event().wait()                                                         # danach schweigt der Client

    async def send_text(self, text):
        self.sent.append(json.loads(text))


@pytest.mark.parametrize("trigger", ["reset", "hello"])
async def test_tick_finished_in_the_same_round_as_a_snapshot_is_dropped(monkeypatch, trigger):
    async def fake_sync(ws, sim, last_seq, max_gap):
        await ws.send_text(json.dumps({"type": "snapshot"}))
        return 0
    monkeypatch.setattr(ws_module, "_sync", fake_sync)
    sub = EventBus().subscribe()
    sub._clock(425)                                                                          # Takt der alten Welt liegt schon bereit …
    if trigger == "reset":                                                                   # … und das Reset-Ereignis bzw. ein hello wird in derselben Runde fertig
        sub._push([SimpleNamespace(type="simulation.reset", seq=1)])
    ws = _FakeWs([json.dumps({"type": "hello", "last_seq": None})] if trigger == "hello" else [])
    task = asyncio.create_task(ws_module._live(ws, None, sub, 0, ping_s=60, max_gap=100))
    await asyncio.sleep(0.05)
    task.cancel()
    assert ws.sent == [{"type": "snapshot"}]
