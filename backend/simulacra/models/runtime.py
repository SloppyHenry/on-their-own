"""Laufzeit (AP17c-3): `llama-server` als vom Backend verwalteter Kindprozess. Ein Modell zugleich (Wechsel = Neustart), nur auf 127.0.0.1, freier Port,
Gesundheitsprüfung über `/health`, Absturz wird gemeldet, Stopp beim Beenden.

Die Kommandozeile entspricht der des Install-Skripts (`scripts/install/services.sh`): voller GPU-Auslagerung (`-ngl 99`), Kontext 8192, ein Slot, `--jinja`."""

from __future__ import annotations

import asyncio
import os
import socket
import time
from pathlib import Path
from typing import Callable

import httpx

READY_TIMEOUT_S = 600.0         # große Modelle brauchen auf langsamen Platten Minuten zum Laden
STOP_GRACE_S = 10.0
LOG_TAIL = 8


class RuntimeFail(Exception):
    pass


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LlamaRuntime:
    def __init__(self, data_dir: Path | str, notify: Callable[[], None], ready_timeout: float = READY_TIMEOUT_S):
        self.data_dir = Path(data_dir)
        self._notify = notify
        self.ready_timeout = ready_timeout
        self.state = "stopped"          # stopped | starting | running | failed
        self.model_id: str | None = None
        self.port: int | None = None
        self.error: str | None = None
        self.started_at: float | None = None
        self._proc: asyncio.subprocess.Process | None = None
        self._watch: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self._stopping = False

    @property
    def base_url(self) -> str | None:
        return f"http://127.0.0.1:{self.port}/v1" if self.port else None

    @property
    def log_path(self) -> Path:
        return self.data_dir / "logs" / "llm.log"

    def log_tail(self, n: int = LOG_TAIL) -> list[str]:
        try:
            return [line.rstrip() for line in self.log_path.read_text(errors="replace").splitlines()[-n:]]
        except OSError:
            return []

    def _set(self, state: str, error: str | None = None) -> None:
        self.state, self.error = state, error
        self._notify()

    async def start(self, binary: Path, model_file: Path, model_id: str) -> None:
        """Startet das Modell (ein laufendes wird vorher beendet) und kehrt zurück, wenn der Server bereit ist. Bei Fehler `RuntimeFail` mit dem Grund."""
        async with self._lock:
            if self.state == "running" and self.model_id == model_id and self._proc and self._proc.returncode is None:
                return
            await self._stop_locked()
            self.model_id, self.port, self.started_at, self._stopping = model_id, free_port(), time.time(), False
            self._set("starting")
            env = dict(os.environ)
            lib = str(binary.parent)
            env["LD_LIBRARY_PATH"] = lib + ":" + env.get("LD_LIBRARY_PATH", "")
            env["DYLD_LIBRARY_PATH"] = lib + ":" + env.get("DYLD_LIBRARY_PATH", "")
            cmd = [str(binary), "-m", str(model_file), "--alias", model_id, "--host", "127.0.0.1", "--port", str(self.port), "-c", "8192", "-ngl", "99", "--parallel", "1", "--jinja"]
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with self.log_path.open("ab") as log:
                log.write(f"\n--- {time.strftime('%Y-%m-%d %H:%M:%S')} Start: {' '.join(cmd)}\n".encode())
                log.flush()
                try:
                    self._proc = await asyncio.create_subprocess_exec(*cmd, stdin=asyncio.subprocess.DEVNULL, stdout=log, stderr=log, env=env)
                except OSError as e:
                    self._proc = None
                    self._set("failed", f"llama-server lässt sich nicht starten: {e}")
                    raise RuntimeFail(self.error) from None
            try:
                await self._wait_ready()
            except RuntimeFail as e:
                await self._stop_locked(keep_error=str(e))
                raise
            self._watch = asyncio.create_task(self._monitor(self._proc))
            self._set("running")

    async def _wait_ready(self) -> None:
        deadline = time.monotonic() + self.ready_timeout
        async with httpx.AsyncClient(timeout=2.0) as client:
            while time.monotonic() < deadline:
                proc = self._proc
                if self._stopping:
                    raise RuntimeFail("Abgebrochen.")
                if proc is None or proc.returncode is not None:
                    tail = " | ".join(self.log_tail(3))
                    raise RuntimeFail(f"llama-server hat sich beendet (Code {proc.returncode if proc else '?'}). {tail}".strip())
                try:
                    if (await client.get(f"http://127.0.0.1:{self.port}/health")).status_code == 200:
                        return
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.25)
        raise RuntimeFail(f"llama-server war nach {int(self.ready_timeout)} s nicht bereit. Letzte Zeilen: " + " | ".join(self.log_tail(3)))

    async def _monitor(self, proc: asyncio.subprocess.Process) -> None:
        code = await proc.wait()
        if not self._stopping and self._proc is proc:
            self._set("failed", f"llama-server ist abgestürzt (Code {code}). " + " | ".join(self.log_tail(3)))

    async def _stop_locked(self, keep_error: str | None = None) -> None:
        self._stopping = True
        proc, self._proc = self._proc, None
        if self._watch is not None:
            self._watch.cancel()
            self._watch = None
        if proc is not None and proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), STOP_GRACE_S)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
        if keep_error is not None:
            self.state, self.error = "failed", keep_error
        else:
            self.state, self.error, self.model_id, self.port = "stopped", None, None, None
        self._notify()

    async def stop(self) -> None:
        self._stopping = True                       # bricht ein laufendes Starten ab (es hält die Sperre bis zum Ende des Wartens)
        async with self._lock:
            await self._stop_locked()
