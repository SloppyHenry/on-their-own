"""Langlauf (AP11): startet den Server als eigenen Prozess, hält eine WebSocket-Verbindung wie ein Browser und misst in festen Abständen.

  backend/.venv/bin/python scripts/langlauf.py run --mode real --hours 2 --out data/langlauf/real
  backend/.venv/bin/python scripts/langlauf.py run --mode fake --hours 4 --out data/langlauf/fake
  backend/.venv/bin/python scripts/langlauf_report.py data/langlauf/real data/langlauf/fake

`real` nutzt das Modell aus den SIM_*-Einstellungen (Standard: Router auf maintux), `fake` das deterministische Fake-LLM der
Browser-Tests. Beide laufen mit Standard-Preset und höchstem Tempo. Jede Messung landet als Zeile in `<out>/samples.jsonl`;
der WebSocket-Leser prüft dabei die Lückenlosigkeit der Ereignisnummern über die ganze Laufzeit.
Auf dem Mac mit `caffeinate -i` starten, sonst schläft der Rechner ein und der Lauf misst Pausen mit.
"""

import argparse
import asyncio
import json
import os
import signal
import sqlite3
import subprocess
import sys
import time
import uuid
from collections import Counter
from pathlib import Path

import httpx
from websockets.asyncio.client import connect

ROOT = Path(__file__).resolve().parents[1]
PY = ROOT / "backend" / ".venv" / "bin" / "python"
LIMITS = {"rss_mb": 1024, "db_mb_per_sim_day": 50, "error_streak": 5, "action_streak": 5}
UNGUARDED = ("wait", "speak")        # wie on_their_own.agents.guards.UNGUARDED_ACTIONS: Warten und Gesprächszüge sperrt der Wiederholungsschutz nicht


def start_server(mode: str, out: Path, port: int) -> subprocess.Popen:
    out.mkdir(parents=True, exist_ok=True)
    log = open(out / "server.log", "ab")
    if mode == "fake":
        cmd = [str(PY), str(ROOT / "scripts" / "e2e_server.py"), "--port", str(port), "--data-dir", str(out)]
        env = os.environ.copy()
    else:
        cmd = [str(PY), "-m", "on_their_own"]
        env = {**os.environ, "SIM_DATA_DIR": str(out), "SIM_PORT": str(port), "SIM_HOST": "127.0.0.1"}
    return subprocess.Popen(cmd, cwd=ROOT / "backend", env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)


def db_file(out: Path) -> Path:
    return out / ("e2e.db" if (out / "e2e.db").exists() else "live.db")


def rss_mb(pid: int) -> float:
    kb = subprocess.run(["ps", "-o", "rss=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return round(int(kb) / 1024, 1) if kb else 0.0


def db_mb(out: Path) -> float:
    db = db_file(out)
    return round(sum(p.stat().st_size for p in (db, Path(f"{db}-wal"), Path(f"{db}-shm")) if p.exists()) / 2**20, 2)


def longest_streak(values: list, counts=lambda v: True) -> tuple[int, object]:
    """Längste Folge gleicher Werte; `counts` wählt, welche Werte für das Maximum zählen."""
    best, cur, val, prev = 0, 0, None, object()
    for v in values:
        cur = cur + 1 if v == prev else 1
        prev = v
        if cur > best and counts(v):
            best, val = cur, v
    return best, val


def action_key(action: str | None, params: str | None) -> str:
    p = json.loads(params or "{}") or {}
    return f"{action}:" + ",".join(f"{k}={v}" for k, v in sorted(p.items()) if k != "text")


def longest_run(flags: list[bool]) -> int:
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best


def db_metrics(out: Path) -> dict:
    """Nur lesend, über eine eigene Verbindung (WAL erlaubt das neben dem schreibenden Server)."""
    con = sqlite3.connect(f"file:{db_file(out)}?mode=ro", uri=True, timeout=10)
    try:
        q = lambda sql, *a: con.execute(sql, a).fetchall()  # noqa: E731
        mem = {a: n for a, n in q("SELECT agent_id, count(*) FROM memories WHERE status='active' GROUP BY agent_id")}
        archived = q("SELECT count(*) FROM memories WHERE status!='active'")[0][0]
        streaks = {}
        for (aid,) in q("SELECT DISTINCT agent_id FROM decisions"):
            rows = q("SELECT status, action, params FROM decisions WHERE agent_id=? ORDER BY id", aid)
            keys = [action_key(a, p) for _, a, p in rows]
            same, same_key = longest_streak(keys)                                         # wie der Wiederholungsschutz: Aktion mit Ziel
            guarded, guarded_key = longest_streak(keys, lambda k: k.split(":")[0] not in UNGUARDED)   # nur, was der Schutz überwacht
            kind, kind_name = longest_streak([a for _, a, _ in rows])                     # nur die Aktionsart (zur Information)
            streaks[aid] = {"error_streak": longest_run([st != "valid" for st, _, _ in rows]), "action_streak": same, "action_streak_key": same_key, "guarded_streak": guarded, "guarded_streak_key": guarded_key,
                            "kind_streak": kind, "kind_streak_name": kind_name}
        conv = q("SELECT max(json_array_length(turns)), count(*) FROM conversations")[0]
        return {
            "events": q("SELECT coalesce(max(seq), 0) FROM events")[0][0],
            "event_types": dict(q("SELECT type, count(*) FROM events GROUP BY type")),
            "memories_active": mem, "memories_archived": archived,
            "objects": q("SELECT count(*) FROM objects")[0][0],
            "guards": q("SELECT count(*) FROM events WHERE type='agent.guard_triggered'")[0][0],
            "streaks": streaks, "conversation_max_turns": conv[0] or 0, "conversations": conv[1],
            "failed_actions": q("SELECT count(*) FROM failed_actions")[0][0],
        }
    finally:
        con.close()


class WsWatcher:
    """Liest alle Nachrichten mit, antwortet auf Pings und zählt Lücken in der Nummernfolge (müssen 0 bleiben)."""

    def __init__(self, url: str):
        self.url, self.seq, self.gaps, self.events, self.clocks, self.snapshots, self.reconnects = url, None, 0, 0, 0, 0, 0
        self.types: Counter = Counter()

    async def run(self) -> None:
        while True:
            try:
                async with connect(self.url, max_size=2**26) as ws:
                    await ws.send(json.dumps({"type": "hello", "last_seq": self.seq}))
                    async for raw in ws:
                        await self._handle(ws, json.loads(raw))
            except (OSError, Exception) as e:  # noqa: BLE001 – der Langlauf soll weiterlaufen, Abbrüche werden gezählt
                if isinstance(e, asyncio.CancelledError):
                    raise
                self.reconnects += 1
                await asyncio.sleep(1)

    async def _handle(self, ws, m: dict) -> None:
        t = m["type"]
        if t == "snapshot":
            self.seq, self.snapshots = m["seq"], self.snapshots + 1
        elif t in ("event", "events"):
            for e in ([m["event"]] if t == "event" else m["items"]):
                if self.seq is not None and e["seq"] != self.seq + 1:
                    self.gaps += 1
                self.seq, self.events = e["seq"], self.events + 1
                self.types[e["type"]] += 1
        elif t == "clock":
            self.clocks += 1
        elif t == "ping":
            await ws.send(json.dumps({"type": "pong"}))
        elif t == "resync_required":
            await ws.send(json.dumps({"type": "resync", "last_seq": self.seq}))

    def summary(self) -> dict:
        return {"seq": self.seq, "gaps": self.gaps, "events": self.events, "clocks": self.clocks, "snapshots": self.snapshots, "reconnects": self.reconnects}


async def post(c: httpx.AsyncClient, path: str, body: dict | None = None) -> dict:
    r = await c.post(path, json=body or {}, headers={"Idempotency-Key": str(uuid.uuid4())})
    r.raise_for_status()
    return r.json()


async def sample(c: httpx.AsyncClient, proc: subprocess.Popen, out: Path, ws: WsWatcher, t0: float) -> dict:
    st = (await c.get("/api/state")).json()
    sim = st["simulation"]
    return {"t_s": round(time.time() - t0, 1), "wall": time.strftime("%Y-%m-%d %H:%M:%S"), "sim_minute": st["clock"]["minute"],
            "state": sim["state"], "stats": sim["stats"], "llm": sim["llm"], "rss_mb": rss_mb(proc.pid), "db_mb": db_mb(out),
            "db": await asyncio.to_thread(db_metrics, out), "ws": ws.summary(), "alive": proc.poll() is None}


async def run(args) -> int:
    out = Path(args.out).resolve()
    if (out / "samples.jsonl").exists() and not args.resume:
        sys.exit(f"{out} enthält schon einen Lauf (--resume zum Fortsetzen)")
    proc = start_server(args.mode, out, args.port)
    base = f"http://127.0.0.1:{args.port}"
    t0 = time.time()                       # Uhrzeit, nicht monotonic: die steht auf macOS still, solange der Rechner schläft
    async with httpx.AsyncClient(base_url=base, timeout=60) as c:
        for _ in range(120):
            try:
                if (await c.get("/api/health")).status_code == 200:
                    break
            except httpx.TransportError:
                pass
            if proc.poll() is not None:
                sys.exit(f"Server beendet (Code {proc.returncode}), siehe {out / 'server.log'}")
            await asyncio.sleep(0.5)
        ws = WsWatcher(f"ws://127.0.0.1:{args.port}/ws")
        reader = asyncio.create_task(ws.run())
        await post(c, "/api/sim/speed", {"level": args.speed})
        await post(c, "/api/sim/start")
        meta = {"mode": args.mode, "hours": args.hours, "interval_s": args.interval, "speed": args.speed, "limits": LIMITS,
                "started": time.strftime("%Y-%m-%d %H:%M:%S"), "health": (await c.get("/api/health")).json()}
        (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        end = t0 + args.hours * 3600
        with open(out / "samples.jsonl", "a") as f:
            while True:
                s = await sample(c, proc, out, ws, t0)
                f.write(json.dumps(s, ensure_ascii=False) + "\n")
                f.flush()
                print(f"{s['wall']}  Sim-Minute {s['sim_minute']}  Entscheidungen {s['stats']['decisions']}  RSS {s['rss_mb']} MB  DB {s['db_mb']} MB  "
                      f"Ereignisse {s['db']['events']}  WS-Lücken {s['ws']['gaps']}", flush=True)
                if not s["alive"] or time.time() >= end:
                    break
                await asyncio.sleep(min(args.interval, max(1.0, end - time.time())))
        if proc.poll() is None:
            await post(c, "/api/sim/pause")
        reader.cancel()
    if proc.poll() is None:
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=30)
    print(f"Ende. Server-Code {proc.returncode}; Messwerte in {out / 'samples.jsonl'}")
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="langlauf")
    ap.add_argument("command", choices=["run"])
    ap.add_argument("--mode", choices=["real", "fake"], required=True)
    ap.add_argument("--hours", type=float, default=2.0)
    ap.add_argument("--interval", type=float, default=300.0, help="Sekunden zwischen zwei Messungen")
    ap.add_argument("--speed", default="max")
    ap.add_argument("--port", type=int, default=8192)
    ap.add_argument("--out", required=True)
    ap.add_argument("--resume", action="store_true")
    return asyncio.run(run(ap.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
