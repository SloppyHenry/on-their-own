"""Hilfen der Abnahmesuite (§17): echte Serverprozesse, die sich hart beenden und neu starten lassen, und eine gemeinsame Simulation."""

import os
import signal
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
import pytest

from agents.conftest import make_sim

ROOT = Path(__file__).resolve().parents[3]


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Server:
    """Backend als eigener Prozess (Fake-LLM der Browser-Tests, Datenbank im angegebenen Verzeichnis)."""

    def __init__(self, data_dir: Path, *extra: str):
        self.data_dir, self.port, self.proc, self.extra = data_dir, free_port(), None, list(extra)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def start(self) -> "Server":
        cmd = [sys.executable, str(ROOT / "scripts" / "e2e_server.py"), "--port", str(self.port), "--data-dir", str(self.data_dir), *self.extra]
        self.proc = subprocess.Popen(cmd, cwd=ROOT / "backend", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        for _ in range(200):
            try:
                if httpx.get(f"{self.url}/api/health", timeout=1).status_code == 200:
                    return self
            except httpx.TransportError:
                time.sleep(0.05)
        raise AssertionError("Server startet nicht")

    def kill(self, sig: int = signal.SIGKILL) -> None:
        """Hart beenden (wie ein Absturz oder Stromausfall): kein geordnetes Herunterfahren."""
        os.killpg(self.proc.pid, sig)
        self.proc.wait(timeout=20)

    def get(self, path: str, **params):
        r = httpx.get(self.url + path, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: dict | None = None):
        r = httpx.post(self.url + path, json=body or {}, headers={"Idempotency-Key": str(uuid.uuid4())}, timeout=60)
        r.raise_for_status()
        return r.json()

    def patch(self, path: str, body):
        r = httpx.patch(self.url + path, json=body, headers={"Idempotency-Key": str(uuid.uuid4())}, timeout=30)
        r.raise_for_status()
        return r.json()


@pytest.fixture
def server(tmp_path):
    srv = Server(tmp_path).start()
    yield srv
    if srv.proc.poll() is None:
        srv.kill(signal.SIGTERM)


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    yield s
    s.close()
