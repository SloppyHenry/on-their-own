"""Die Schreibverbindung gehört dem DB-Thread: kein Zugriff vom Thread der Ereignisschleife aus.

Zwei Threads auf derselben sqlite3-Verbindung lassen `fetchone()` gelegentlich `None` liefern (beobachtet: TypeError in
`WorldState.minute`, die Simulationsschleife brach ab). Der Wettlauf selbst ist Zufall; geprüft wird deshalb, *von wo* zugegriffen wird.
"""

import asyncio
import json
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest

from agents.conftest import make_sim
from on_their_own.api import app as app_module
from on_their_own.db.connection import Database

from .conftest import api, minute, post

SRC = Path(app_module.__file__).resolve().parents[1]                                # .../on_their_own


@contextmanager
def loop_thread_access():
    """Sammelt Aufrufstellen, die `Database.conn` aus einem Thread mit laufender Ereignisschleife (nicht dem DB-Thread) benutzen."""
    hits: set[str] = set()
    original = Database.conn

    def spy(db):
        if not threading.current_thread().name.startswith("sim-db-write"):
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                return original.fget(db)                                                # Testcode im Hauptthread, keine Schleife: hier läuft nichts parallel
            f, chain = sys._getframe(1), []
            while f is not None and len(chain) < 5:
                if f.f_code.co_filename.startswith(str(SRC)):
                    chain.append(f"{Path(f.f_code.co_filename).relative_to(SRC.parent)}:{f.f_lineno}")
                f = f.f_back
            hits.add(" <- ".join(chain))
        return original.fget(db)
    Database.conn = property(spy)
    try:
        yield hits
    finally:
        Database.conn = original


def wait_long(messages, schema, params):
    """Lange warten: niemand wartet auf eine Entscheidung, also läuft auch die Zielplanung (Pflege nach dem Tick)."""
    return json.dumps({"option_id": "other", "intent": "warten", "utterance": "", "importance": 1, "other_action": "wait", "other_params": {"minutes": 30}})


def patch_params(c, changes):
    r = c.patch("/api/params", json={"changes": changes}, headers={"Idempotency-Key": str(uuid.uuid4())})
    assert r.status_code == 200 and all(x["status"] != "rejected" for x in r.json()["results"]), r.json()


@pytest.mark.parametrize("waits", [True, False])
def test_running_simulation_and_api_never_touch_the_connection_from_the_event_loop(monkeypatch, waits):
    async def no_llm(settings):
        return {"reachable": False, "error": "Test", "models": []}
    monkeypatch.setattr(app_module, "probe_llm", no_llm)
    with api(make_sim(fn=wait_long)) as c, loop_thread_access() as hits:
        patch_params(c, [{"key": "sim.time_waits_for_decisions", "value": waits}])
        c.sim.runner.set_speed(0.01)
        post(c, "/api/sim/start")
        m = minute(c)
        for _ in range(100):                                                            # Schritte mit Pflege (Ziele, Reflexion) laufen durch
            if minute(c) > m + 3:
                break
            time.sleep(0.02)
        assert c.get("/api/health").json()["simulation"]["state"] == "running"
        post(c, "/api/sim/speed", {"tick_delay_s": 0.02})
        patch_params(c, [{"key": "personality.curiosity", "value": 70, "agent": "alex"}])
        assert post(c, "/api/params/reset", {"agent": "alex"}).status_code == 200
        post(c, "/api/sim/pause")
        post(c, "/api/sim/step", {"n": 2})
        post(c, "/api/sim/resume")
        time.sleep(0.05)
        post(c, "/api/sim/pause")
        assert c.sim.runner._task is not None and not c.sim.runner._task.done()        # die Schleife lebt noch
    assert not hits, "Zugriffe vom Thread der Ereignisschleife:\n" + "\n".join(sorted(hits))
