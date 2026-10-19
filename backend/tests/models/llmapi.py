"""Hilfen für die API-Tests der Modellverwaltung (AP17c-3): App mit Attrappen für Netz und Hardware, Aufrufe mit Idempotency-Key, Warten auf Zustände."""

import os
import time
import uuid
from contextlib import contextmanager

from fastapi.testclient import TestClient

from agents.conftest import make_sim
from api.conftest import wait_one_minute

from simulacra.api.app import create_app

from .conftest import machine
from .fakes import FakeHub

DATA = os.urandom(200_000)
REPO, FILE, MID = "Qwen/Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf", "Qwen3-8B-Q4_K_M"


@contextmanager
def llm_api(tmp_path, hub=None, hw=None, **settings):
    sim = make_sim(fn=wait_one_minute, data_dir=tmp_path, **settings)
    app = create_app(sim, settings=sim.settings)
    app.state.hardware_probe = lambda d: hw or machine("cpu")
    app.state.llm_ready_timeout = 10.0
    if hub is not None:
        app.state.hf_transport = app.state.download_transport = hub.transport
        app.state.releases_url = "https://api.github.com/repos/ggml-org/llama.cpp/releases"
    with TestClient(app) as client:
        client.sim = sim
        yield client
    sim.close()


def call(client, method, path, body=None, key="auto"):
    headers = {} if key is None else {"Idempotency-Key": str(uuid.uuid4()) if key == "auto" else key}
    return client.request(method, path, json=body, headers=headers)


def status(client):
    return client.get("/api/llm").json()


def wait_for(client, pred, what, seconds=15):
    end = time.time() + seconds
    while time.time() < end:
        s = status(client)
        if pred(s):
            return s
        time.sleep(0.05)
    raise AssertionError(f"Zustand nicht erreicht: {what}; zuletzt {status(client)}")


def hub_with_model():
    hub = FakeHub()
    hub.add(REPO, FILE, DATA)
    return hub


def download(client):
    r = call(client, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE, "confirm": True})
    assert r.status_code == 200, r.text
    return wait_for(client, lambda s: s["transfer"] and s["transfer"]["phase"] in ("done", "failed"), "Download beendet")
