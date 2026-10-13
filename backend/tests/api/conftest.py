import json
import re
import uuid
from contextlib import contextmanager

from fastapi.testclient import TestClient

from agents.conftest import make_sim
from simulacra.api.app import create_app


def wait_one_minute(messages, schema, params):
    return json.dumps({"option_id": "other", "intent": "kurz warten", "utterance": "", "importance": 1,
                       "other_action": "wait", "other_params": {"minutes": 1}})


@contextmanager
def api(sim=None, **settings):
    sim = sim or make_sim(fn=wait_one_minute, **settings)
    app = create_app(sim, settings=sim.settings)
    with TestClient(app) as client:
        client.sim = sim
        yield client
    sim.close()


def post(client, path, json_body=None, key="auto"):
    headers = {} if key is None else {"Idempotency-Key": str(uuid.uuid4()) if key == "auto" else key}
    return client.post(path, json=json_body, headers=headers)


def minute(client) -> int:
    """Simulationsminute über die API (gelesen auf dem DB-Thread). Nie `client.sim.engine.minute`, solange die Simulation läuft:
    zwei Threads auf der Schreibverbindung lassen `fetchone()` gelegentlich `None` liefern."""
    return client.get("/api/state").json()["clock"]["minute"]


def recv_until(ws, pred, limit=500):
    """Liest Nachrichten, bis `pred` zutrifft; gibt alle gelesenen zurück."""
    got = []
    for _ in range(limit):
        m = ws.receive_json()
        got.append(m)
        if pred(m):
            return got
    raise AssertionError("erwartete Nachricht kam nicht")


def hello(ws, last_seq=None):
    ws.send_json({"type": "hello", "last_seq": last_seq})
    return ws.receive_json()


def event_seqs(messages):
    out = []
    for m in messages:
        if m["type"] == "event":
            out.append(m["event"]["seq"])
        elif m["type"] == "events":
            out += [e["seq"] for e in m["items"]]
    return out
