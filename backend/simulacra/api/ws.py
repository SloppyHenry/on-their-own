"""WebSocket `/ws`: Snapshot oder verpasste Ereignisse beim Verbinden, danach Live-Ereignisse mit Heartbeat.

Ablauf: Client sendet `hello` mit seiner letzten `seq`. Der Server abonniert zuerst den Bus, liest dann den Rückstand aus
der Datenbank und verwirft beim Weiterreichen alles, was er schon geschickt hat; so geht nichts verloren und nichts doppelt.
"""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..events.bus import OVERFLOW, Subscription
from ..events.schema import to_out
from ..events.store import EventStore
from . import state
from .models import WsClock, WsEvent, WsEvents, WsPing, WsResyncRequired, WsSnapshot

router = APIRouter()
HELLO_TIMEOUT_S = 10.0
CLOCK_MIN_GAP_S = 0.1                     # höchstens zehn Uhrtakte je Sekunde und Verbindung


async def _sync(ws: WebSocket, sim, last_seq: int | None, max_gap: int) -> int:
    """Schickt Snapshot oder die verpassten Ereignisse; gibt die zuletzt gesendete `seq` zurück."""
    def work():
        store = EventStore(sim.engine.state.conn)
        head = store.last_seq()
        if last_seq is None or last_seq > head or head - last_seq > max_gap:
            return "snapshot", state.snapshot(sim), head
        return "events", [to_out(e) for e in store.fetch(after_seq=last_seq, limit=max_gap)], head
    kind, payload, head = await sim.engine.db.run(work)
    if kind == "snapshot":
        await ws.send_text(WsSnapshot(seq=payload.seq, state=payload).model_dump_json())
        return payload.seq
    if payload:
        await ws.send_text(WsEvents(items=payload).model_dump_json())
    return payload[-1].seq if payload else (last_seq or 0)


async def _live(ws: WebSocket, sim, sub: Subscription, sent: int, ping_s: float, max_gap: int) -> None:
    recv: asyncio.Task = asyncio.create_task(ws.receive_text())
    queue: asyncio.Task = asyncio.create_task(sub.get())
    clock: asyncio.Task = asyncio.create_task(sub.next_clock())
    loop = asyncio.get_running_loop()
    last_heard = last_ping = loop.time()
    awaiting_resync = False
    try:
        while True:
            wait = max(0.0, last_ping + ping_s - loop.time())
            done, _ = await asyncio.wait({recv, queue, clock}, timeout=wait, return_when=asyncio.FIRST_COMPLETED)
            now = loop.time()
            if now - last_ping >= ping_s:                              # Heartbeat im festen Takt (Uhrtakte zählen nicht als Lebenszeichen des Clients)
                if now - last_heard > 2 * ping_s:
                    await ws.close(code=4008, reason="Heartbeat ausgeblieben")
                    return
                await ws.send_text(WsPing().model_dump_json())
                last_ping = now
            if recv in done:
                last_heard = now
                msg = json.loads(recv.result())
                recv = asyncio.create_task(ws.receive_text())
                if msg.get("type") in ("hello", "resync"):
                    sub.reset()
                    awaiting_resync = False
                    sent = await _sync(ws, sim, msg.get("last_seq"), max_gap)
            if queue in done:
                item = queue.result()
                queue = asyncio.create_task(sub.get())
                if item is OVERFLOW:
                    awaiting_resync = True
                    await ws.send_text(WsResyncRequired().model_dump_json())
                elif not awaiting_resync:
                    for e in item:
                        if e.type in ("simulation.reset", "simulation.loaded"):   # neue Welt oder geladener Stand: alle bekommen einen frischen Snapshot
                            sub.drop_clock()
                            sent = await _sync(ws, sim, None, max_gap)
                        elif e.seq > sent:
                            await ws.send_text(WsEvent(event=to_out(e)).model_dump_json())
                            sent = e.seq
            if clock in done:
                minute = clock.result()
                clock = asyncio.create_task(sub.next_clock(CLOCK_MIN_GAP_S))
                if not awaiting_resync:
                    await ws.send_text(WsClock(minute=minute).model_dump_json())
    finally:
        recv.cancel()
        queue.cancel()
        clock.cancel()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    sim = ws.app.state.sim
    settings = ws.app.state.settings
    await ws.accept()
    sub = sim.engine.bus.subscribe(settings.ws_max_backlog)
    try:
        hello = json.loads(await asyncio.wait_for(ws.receive_text(), HELLO_TIMEOUT_S))
        if hello.get("type") != "hello":
            await ws.close(code=4400, reason="Erste Nachricht muss 'hello' sein")
            return
        sent = await _sync(ws, sim, hello.get("last_seq"), settings.ws_max_gap)
        await _live(ws, sim, sub, sent, settings.ws_ping_s, settings.ws_max_gap)
    except WebSocketDisconnect:
        pass
    except (asyncio.TimeoutError, json.JSONDecodeError, AttributeError, TypeError, RuntimeError) as e:
        reason = "Keine gültige Nachricht" if not isinstance(e, asyncio.TimeoutError) else "Kein hello erhalten"
        try:
            await ws.close(code=4400, reason=reason)
        except RuntimeError:
            pass
    finally:
        sub.close()
