"""§17 Nr. 5, 6, 12, 13 auf Protokollebene: was der Browser über den WebSocket bekommt (die Browser-Tests prüfen dasselbe im Bild)."""

import json
import time
from datetime import datetime

from websockets.sync.client import connect

from .conftest import Server


class Client:
    """Minimaler Browser-Ersatz: hält Snapshot, Ereignisse und Uhrtakt und leitet daraus Positionen ab wie das Frontend."""

    def __init__(self, server: Server, last_seq=None):
        self.ws = connect(server.url.replace("http", "ws") + "/ws", max_size=2**26)
        self.ws.send(json.dumps({"type": "hello", "last_seq": last_seq}))
        self.seq, self.minute, self.pos, self.walks, self.log = None, 0, {}, {}, []

    def snapshot(self, s):
        self.seq, self.minute = s["seq"], s["state"]["clock"]["minute"]
        self.pos = {a["id"]: (a["x"], a["y"]) for a in s["state"]["agents"]}
        self.walks = {a["id"]: {"from": [a["x"], a["y"]], **a["walk"]} for a in s["state"]["agents"] if a.get("walk")}

    def apply(self, e):
        assert self.seq is None or e["seq"] == self.seq + 1, "Lücke in der Ereignisfolge"
        self.seq = e["seq"]
        self.log.append((time.time(), e))
        aid, d = (e["agents"] or [None])[0], e["data"]
        if e["type"] == "agent.walking":
            self.walks[aid] = d
        elif e["type"] in ("agent.arrived", "agent.action_interrupted", "agent.action_failed") and aid in self.walks:
            self.walks.pop(aid)
        if d.get("at") and aid:
            self.pos[aid] = tuple(d["at"])
        self.clock(e["sim_time"]["total"])

    def clock(self, minute):
        self.minute = max(self.minute, minute)
        for aid, w in self.walks.items():
            reached = [t for t, at in zip(w["path"], w["arrive"]) if at <= self.minute]
            self.pos[aid] = tuple(reached[-1] if reached else w["from"])

    def pump(self, until=lambda m: False, timeout=10.0):
        end = time.time() + timeout
        while time.time() < end:
            try:
                m = json.loads(self.ws.recv(timeout=max(0.01, end - time.time())))
            except TimeoutError:
                return None
            if m["type"] == "snapshot":
                self.snapshot(m)
            elif m["type"] == "event":
                self.apply(m["event"])
            elif m["type"] == "events":
                for e in m["items"]:
                    self.apply(e)
            elif m["type"] == "clock":
                self.clock(m["minute"])
            elif m["type"] == "ping":
                self.ws.send(json.dumps({"type": "pong"}))
            if until(m):
                return m
        return None


def positions(server):
    return {a["id"]: (a["x"], a["y"]) for a in server.get("/api/state")["agents"]}


def test_k05_dialoge_kommen_live_binnen_zwei_sekunden(server: Server):
    c = Client(server)
    c.pump(lambda m: m["type"] == "snapshot")
    server.post("/api/sim/speed", {"level": "1x"})
    server.post("/api/sim/start")
    got = c.pump(lambda m: m["type"] == "event" and m["event"]["type"] == "agent.dialogue", timeout=60)
    server.post("/api/sim/pause")
    assert got is not None, "kein Dialog in 60 s"
    created = datetime.fromisoformat(got["event"]["ts"]).timestamp()
    received = c.log[-1][0]
    assert received - created < 2.0 and got["event"]["data"]["text"]


def test_k06_ortswechsel_folgen_im_client_jeder_minute(server: Server):
    c = Client(server)
    c.pump(lambda m: m["type"] == "snapshot")
    walked = moved = 0
    for _ in range(80):
        server.post("/api/sim/step", {"n": 1})
        c.pump(lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
        c.pump(timeout=0.15)                                                              # Uhrtakt dieser Minute
        truth = positions(server)
        assert c.pos == truth, (c.minute, c.pos, truth)                                   # Client-Position = Weltzustand, jede Minute
        walked += bool(c.walks)
        moved += any(e["type"] == "agent.location_changed" for _, e in c.log[-30:])
    assert walked > 5 and moved                                                           # es wurde wirklich gelaufen und Orte gewechselt


def test_k12_pause_fortsetzen_einzelschritt(server: Server):
    server.post("/api/sim/speed", {"level": "max"})
    server.post("/api/sim/start")
    time.sleep(0.5)
    server.post("/api/sim/pause")
    a = server.get("/api/state")
    assert a["simulation"]["state"] == "paused"
    time.sleep(1.0)
    b = server.get("/api/state")
    assert (b["clock"]["minute"], b["seq"]) == (a["clock"]["minute"], a["seq"])          # Pause hält Zeit und Ereignisse an
    server.post("/api/sim/step", {"n": 3})
    assert server.get("/api/state")["clock"]["minute"] == a["clock"]["minute"] + 3         # genau drei Minuten
    server.post("/api/sim/resume")
    time.sleep(0.5)
    assert server.get("/api/state")["clock"]["minute"] > a["clock"]["minute"] + 3          # läuft weiter
    server.post("/api/sim/pause")


def test_k13_neu_verbinden_stellt_denselben_zustand_her_auch_mitten_im_weg(server: Server):
    c = Client(server)
    c.pump(lambda m: m["type"] == "snapshot")
    for _ in range(120):                                                                  # anhalten, während jemand unterwegs ist
        server.post("/api/sim/step", {"n": 1})
        c.pump(lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
        if any(len(w["path"]) - sum(1 for at in w["arrive"] if at <= c.minute) >= 3 for w in c.walks.values()):
            break
    c.pump(timeout=0.3)
    assert c.walks, "niemand unterwegs"
    fresh = Client(server)                                                                # „Seite neu laden“: neuer Client ohne Vorwissen
    fresh.pump(lambda m: m["type"] == "snapshot")
    assert (fresh.seq, fresh.minute, fresh.pos) == (c.seq, c.minute, c.pos)
    for aid in c.walks:                                                                   # der restliche Weg ist derselbe
        rest = [t for t, at in zip(c.walks[aid]["path"], c.walks[aid]["arrive"]) if at > c.minute]
        assert fresh.walks[aid]["path"] == rest
    server.post("/api/sim/step", {"n": 2})                                                # und beide laufen gleich weiter
    for cl in (c, fresh):
        cl.pump(lambda m: m["type"] == "event" and m["event"]["type"] == "simulation.stepped")
        cl.pump(timeout=0.3)
    assert c.pos == fresh.pos == positions(server)
