#!/usr/bin/env python3
"""Liest die Live-Ereignisse der Simulation über den WebSocket mit (wie `websocat`, aber mit Wiederverbindung).

    backend/.venv/bin/python scripts/ws_tail.py [--url ws://127.0.0.1:8090/ws] [--last-seq N] [--no-moved] [--reconnect]
Merkt sich die letzte `seq` und bekommt nach einer Unterbrechung genau die verpassten Ereignisse; prüft die Lückenlosigkeit.
"""

import argparse
import asyncio
import json
import sys

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed


def line(e: dict, quiet_moves: bool) -> str | None:
    if quiet_moves and e["type"] == "agent.moved":
        return None
    t = e["sim_time"]
    data = json.dumps(e["data"], ensure_ascii=False)
    return f"#{e['seq']:<5} T{t['day']} {t['minute'] // 60:02d}:{t['minute'] % 60:02d}  {e['type']:<28} {','.join(e['agents']):<10} {data[:110]}"


async def tail(url: str, last_seq: int | None, quiet_moves: bool, reconnect: bool) -> None:
    while True:
        try:
            async with connect(url) as ws:
                await ws.send(json.dumps({"type": "hello", "last_seq": last_seq}))
                async for raw in ws:
                    m = json.loads(raw)
                    if m["type"] == "ping":
                        await ws.send(json.dumps({"type": "pong"}))
                    elif m["type"] == "snapshot":
                        last_seq = m["seq"]
                        print(f"== Snapshot seq={last_seq}, {m['state']['clock']['time']} Uhr, Zustand der Simulation: {m['state']['simulation']['state']}", flush=True)
                    elif m["type"] in ("event", "events"):
                        for e in ([m["event"]] if m["type"] == "event" else m["items"]):
                            if last_seq is not None and e["seq"] != last_seq + 1:
                                print(f"!! Lücke: erwartet {last_seq + 1}, bekommen {e['seq']}", flush=True)
                            last_seq = e["seq"]
                            if (s := line(e, quiet_moves)):
                                print(s, flush=True)
                    elif m["type"] == "resync_required":
                        await ws.send(json.dumps({"type": "resync", "last_seq": last_seq}))
        except (ConnectionClosed, OSError) as e:
            print(f"-- Verbindung weg ({type(e).__name__}), letzte seq={last_seq}", flush=True)
            if not reconnect:
                return
            await asyncio.sleep(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="ws://127.0.0.1:8090/ws")
    ap.add_argument("--last-seq", type=int, default=None)
    ap.add_argument("--no-moved", action="store_true")
    ap.add_argument("--reconnect", action="store_true")
    a = ap.parse_args()
    try:
        asyncio.run(tail(a.url, a.last_seq, a.no_moved, a.reconnect))
    except KeyboardInterrupt:
        sys.exit(0)
