"""Modellverwaltung (AP17c-3): verbindet Bestand, Download, Laufzeit und Probelauf mit der laufenden Simulation.

Grundsätze:
- **Eingebaut** (Backend startet `llama-server`) oder **Externer Server** (wie bisher). Steht `SIM_LLM_BASE_URL` in der Umgebung oder in `backend/.env`, gewinnt das:
  die Betriebsart ist dann fest „Externer Server“ und das Tool ändert die Adresse nicht.
- Die Laufzeit **folgt der Simulation**: Beim Zurücksetzen, bei einer neuen Simulation und beim Start des Servers läuft das Modell, das die Simulation braucht (Frage 10:
  das Modell gilt fest für eine Simulation). Das Wechseln von Hand (Starten, Testen, Löschen) geht nur bei angehaltener Simulation.
- Alle Änderungen gehen über den Hub an die Browser (WebSocket-Nachricht `models`)."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import httpx
from pydantic import SecretStr

from ..config import Settings
from ..llm.providers import OpenAICompatProvider
from ..simulation.runner import SimState
from . import hardware as hw
from .download import ModelDownloader
from .hf import HFClient
from .hub import Hub
from .llamacpp import RuntimeInstaller, find_binary, version_of
from .llmconf import ConfigFile, env_locked
from .probe import ProbeCancelled, run_probe
from .runtime import LlamaRuntime, RuntimeFail
from .store import Installed, ModelStore
from .transfer import Transfer, TransferError, TransferManager

MODES = ("builtin", "external")


@dataclass
class ProbeJob:
    model_id: str
    phase: str = "starting"             # starting | running | done | failed | cancelled
    step: int = 0
    n: int = 10
    error: str | None = None
    result: dict | None = None
    cancel: bool = False
    started: float = field(default_factory=time.time)

    @property
    def active(self) -> bool:
        return self.phase in ("starting", "running")


class ModelService:
    def __init__(self, settings: Settings, get_sim: Callable[[], Any], *, hardware_probe: Callable[[Path], hw.Hardware] | None = None, hf_transport: httpx.AsyncBaseTransport | None = None,
                 download_transport: httpx.AsyncBaseTransport | None = None, releases_url: str | None = None, ready_timeout: float | None = None, locked: bool | None = None):
        self.settings, self.get_sim = settings, get_sim
        self.locked = env_locked(settings) if locked is None else locked      # vor jeder eigenen Änderung an den Einstellungen festhalten
        self.data_dir = Path(settings.data_dir)
        self.hub = Hub()
        self.store = ModelStore(self.data_dir)
        self.conf = ConfigFile(self.data_dir)
        self.transfers = TransferManager(self.hub.publish)
        self.runtime = LlamaRuntime(self.data_dir, self.hub.publish, **({"ready_timeout": ready_timeout} if ready_timeout else {}))
        self.hf = HFClient(self.data_dir / "models" / "cache", transport=hf_transport)
        self.downloader = ModelDownloader(self.store, self.transfers, self.hf, download_transport)
        self.runtime_dir = self.data_dir / "runtime" / "llama.cpp"
        self.installer = RuntimeInstaller(self.runtime_dir, self.transfers, download_transport, **({"releases_url": releases_url} if releases_url else {}))
        self.probe_job: ProbeJob | None = None
        self._hardware_probe = hardware_probe or hw.detect
        self._tasks: set[asyncio.Task] = set()
        self._binary: tuple[Path, Path | None] | None = None
        self._was_installing = False

    # ---------- Zustand ----------
    async def hardware(self) -> hw.Hardware:
        return await asyncio.to_thread(self._hardware_probe, self.data_dir)

    def binary(self) -> Path | None:
        cur = self.runtime_dir / "current"
        key = cur.resolve() if cur.exists() else cur
        if self._binary is None or self._binary[0] != key or (self._binary[1] is not None and not self._binary[1].exists()):
            self._binary = (key, find_binary(self.runtime_dir))
        return self._binary[1]

    def runtime_version(self) -> tuple[str | None, str | None]:
        return version_of(self.runtime_dir)

    def mode(self) -> str:
        if self.locked:
            return "external"
        cfg = self.conf.load()
        if cfg.mode in MODES:
            return cfg.mode
        return "builtin" if self.binary() is not None and self.store.list() else "external"      # noch nicht gewählt: eingebaut, sobald es dafür etwas gibt

    def sim_running(self) -> bool:
        sim = self.get_sim()
        return sim is not None and sim.runner.state in (SimState.RUNNING, SimState.STEPPING)

    def sim_model(self) -> str | None:
        sim = self.get_sim()
        return getattr(getattr(sim, "settings", None), "llm_model", None) if sim is not None else None

    def _task(self, coro) -> asyncio.Task:
        t = asyncio.create_task(coro)
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)
        return t

    def apply_endpoint(self) -> None:
        """Passt die Einstellungen und den Client der Simulation an die Betriebsart an (außer bei fester Umgebung)."""
        if self.locked:
            return
        s, cfg = self.settings, self.conf.load()
        if self.mode() == "builtin":
            s.llm_builtin = True
            if self.runtime.base_url:
                s.llm_base_url = self.runtime.base_url
            key: str | None = None
        else:
            s.llm_builtin = False
            if cfg.external_url:
                s.llm_base_url = cfg.external_url
            s.llm_api_key_value = SecretStr(cfg.external_key) if cfg.external_key else None
            key = s.llm_api_key.get_secret_value() if s.llm_api_key else None
        sim = self.get_sim()
        provider = getattr(getattr(sim, "client", None), "provider", None)
        if hasattr(provider, "reconfigure"):
            provider.reconfigure(s.llm_base_url, key)

    # ---------- Betriebsart ----------
    def _need_stopped(self, what: str) -> None:
        if self.sim_running():
            raise TransferError(409, f"Die Simulation läuft. {what} geht nur bei angehaltener Simulation (oben pausieren).")

    async def set_mode(self, mode: str, external_url: str | None, external_key: str | None) -> None:
        if self.locked:
            raise TransferError(409, "Die Adresse des Modellservers ist in der Umgebung festgelegt (SIM_LLM_BASE_URL, z. B. in backend/.env). Das Tool ändert sie nicht.")
        if mode not in MODES:
            raise TransferError(422, "Betriebsart ist „builtin“ oder „external“.")
        url = (external_url or "").strip() or None
        if mode == "external" and url and not url.lower().startswith(("http://", "https://")):
            raise TransferError(422, "Die Adresse muss mit http:// oder https:// beginnen.")
        self._need_stopped("Das Wechseln der Betriebsart")
        cfg = self.conf.load()
        cfg.mode = mode
        if mode == "external":
            cfg.external_url = url or cfg.external_url
            if external_key is not None:
                cfg.external_key = external_key.strip() or None
        self.conf.save(cfg)
        if mode == "external":
            await self.runtime.stop()
        self.apply_endpoint()
        if mode == "builtin":
            self._task(self.autostart())
        self.hub.publish()

    async def test_external(self, url: str | None, key: str | None) -> dict:
        cfg = self.conf.load()
        base = (url or (cfg.external_url if not self.locked else None) or self.settings.llm_base_url).rstrip("/")
        secret = key if key else (cfg.external_key if url is None else None)
        if not secret and not self.locked and self.settings.llm_api_key is not None and not self.settings.llm_builtin:
            secret = self.settings.llm_api_key.get_secret_value()
        headers = {"Authorization": f"Bearer {secret}"} if secret else {}
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                r = await c.get(f"{base}/models", headers=headers)
            r.raise_for_status()
            return {"reachable": True, "models": [m["id"] for m in r.json().get("data", [])], "error": None, "url": base}
        except (httpx.HTTPError, ValueError, KeyError) as e:
            return {"reachable": False, "models": [], "error": f"{type(e).__name__}: {e}"[:200], "url": base}

    # ---------- Laufzeit ----------
    async def install_runtime(self) -> Transfer:
        t = await self.installer.start(await self.hardware())
        self._task(self._after_transfer(t))
        return t

    async def _after_transfer(self, t: Transfer) -> None:
        """Wartet auf das Ende einer Übertragung und meldet es (der Bestand hat sich geändert)."""
        while t.active:
            await asyncio.sleep(0.2)
        self._binary = None
        self.hub.publish()

    def _binary_or_fail(self) -> Path:
        b = self.binary()
        if b is None:
            raise TransferError(409, "Die Laufzeit llama.cpp ist nicht installiert. Bitte zuerst „Laufzeit installieren“.")
        return b

    async def _start(self, m: Installed) -> None:
        try:
            await self.runtime.start(self._binary_or_fail(), self.store.path(m.id), m.id)
        except RuntimeFail as e:
            raise TransferError(502, str(e)) from None
        cfg = self.conf.load()
        if cfg.last_model != m.id:
            cfg.last_model = m.id
            self.conf.save(cfg)
        self.apply_endpoint()

    async def start_model(self, model_id: str, wait: bool = False) -> None:
        """Startet ein installiertes Modell (nur eingebaut, nur bei angehaltener Simulation). Ohne `wait` kehrt der Aufruf sofort zurück; der Zustand kommt über den Hub."""
        if self.mode() != "builtin":
            raise TransferError(409, "Die Betriebsart ist „Externer Server“. Zum Starten eines eigenen Modells auf „Eingebaut“ wechseln.")
        m = self.store.get(model_id)
        if m is None:
            raise TransferError(404, f"Das Modell „{model_id}“ ist nicht installiert.")
        self._binary_or_fail()
        self._need_stopped("Das Wechseln des Modells")
        if self.probe_job and self.probe_job.active:
            raise TransferError(409, "Ein Probelauf läuft gerade.")
        if wait:
            await self._start(m)
        else:
            self._task(self._start_quiet(m))
            await asyncio.sleep(0)

    async def _start_quiet(self, m: Installed) -> None:
        try:
            await self._start(m)
        except TransferError:
            pass                                          # der Grund steht in runtime.error und geht an die Oberfläche

    async def stop_runtime(self) -> None:
        self._need_stopped("Das Beenden des Modells")
        await self.runtime.stop()
        self.hub.publish()

    def desired_model(self) -> str | None:
        """Welches Modell die Laufzeit gerade haben sollte: das der Simulation, wenn es installiert ist, sonst das zuletzt gestartete."""
        cfg = self.conf.load()
        for mid in (self.sim_model(), cfg.last_model, cfg.default_model):
            if mid and self.store.get(mid) is not None:
                return mid
        return None

    async def autostart(self) -> None:
        """Beim Start des Servers (und beim Wechsel auf „Eingebaut“): das passende Modell laden, wenn Laufzeit und Modell da sind."""
        if self.mode() != "builtin" or self.locked or self.binary() is None:
            return
        mid = self.desired_model()
        if mid is not None:
            await self._start_quiet(self.store.get(mid))  # type: ignore[arg-type]

    async def prepare_for(self, alias: str | None, *, strict: bool) -> None:
        """Vor dem Zurücksetzen, einer neuen Simulation oder dem Laden: das Modell der Simulation läuft. `strict`: ein nicht installiertes Modell ist ein Fehler
        (der Mensch hat es gewählt); sonst bleibt alles, wie es ist (z. B. ein alter Spielstand mit einem Modell, das es hier nicht gibt)."""
        if self.mode() != "builtin":
            return
        mid = alias or self.sim_model()
        m = self.store.get(mid) if mid else None
        if m is None:
            if strict and alias:
                raise TransferError(422, f"Das Modell „{alias}“ ist nicht installiert (Menü → Einstellungen → Modelle).")
            return
        if self.runtime.state == "running" and self.runtime.model_id == m.id:
            return
        if self.binary() is None:
            if strict:
                self._binary_or_fail()
            return
        if self.probe_job and self.probe_job.active:
            raise TransferError(409, "Ein Probelauf läuft gerade. Bitte abwarten oder abbrechen.")
        sim = self.get_sim()
        if sim is not None:
            await sim.runner.stop()                       # ohne laufende Entscheidungen auf ein Modell, das gerade wechselt
        await self._start(m)

    # ---------- Bestand ----------
    async def download(self, repo: str, file: str) -> Transfer:
        t = await self.downloader.start(repo, file)
        self._task(self._after_transfer(t))
        return t

    def cancel_transfer(self) -> bool:
        return self.transfers.cancel()

    async def delete_model(self, model_id: str) -> None:
        m = self.store.get(model_id)
        if m is None:
            raise TransferError(404, f"Das Modell „{model_id}“ ist nicht installiert.")
        t = self.transfers.current
        if t is not None and t.active and t.model_id == model_id:
            raise TransferError(409, "Dieses Modell wird gerade geladen.")
        if self.probe_job and self.probe_job.active and self.probe_job.model_id == model_id:
            raise TransferError(409, "Für dieses Modell läuft ein Probelauf.")
        if self.runtime.model_id == model_id and self.runtime.state in ("starting", "running"):
            self._need_stopped("Das Löschen des laufenden Modells")
            await self.runtime.stop()
        if self.sim_model() == model_id and self.mode() == "builtin" and self.sim_running():
            raise TransferError(409, "Die laufende Simulation nutzt dieses Modell.")
        self.store.delete(model_id)
        cfg = self.conf.load()
        changed = False
        for name in ("default_model", "last_model"):
            if getattr(cfg, name) == model_id:
                setattr(cfg, name, None)
                changed = True
        if changed:
            self.conf.save(cfg)
        self.hub.publish()

    def set_default(self, model_id: str) -> None:
        if self.store.get(model_id) is None:
            raise TransferError(404, f"Das Modell „{model_id}“ ist nicht installiert.")
        cfg = self.conf.load()
        cfg.default_model = model_id
        self.conf.save(cfg)
        self.hub.publish()

    # ---------- Probelauf ----------
    async def probe(self, model_id: str) -> ProbeJob:
        if self.mode() != "builtin":
            raise TransferError(409, "Der Probelauf misst das eingebaute Modell. Bitte auf „Eingebaut“ wechseln.")
        m = self.store.get(model_id)
        if m is None:
            raise TransferError(404, f"Das Modell „{model_id}“ ist nicht installiert.")
        self._binary_or_fail()
        self._need_stopped("Der Probelauf")
        if self.probe_job and self.probe_job.active:
            raise TransferError(409, "Es läuft schon ein Probelauf.")
        job = self.probe_job = ProbeJob(model_id)
        previous = self.desired_model()
        self._task(self._run_probe(job, m, previous))
        self.hub.publish()
        return job

    async def _run_probe(self, job: ProbeJob, m: Installed, previous: str | None) -> None:
        provider: OpenAICompatProvider | None = None
        try:
            await self._start(m)
            if job.cancel:
                raise ProbeCancelled()
            job.phase = "running"
            self.hub.publish()
            provider = OpenAICompatProvider(self.runtime.base_url or "", None)

            def step(done: int, n: int) -> None:
                job.step, job.n = done, n
                self.hub.publish()
            res = await run_probe(provider, m.id, on_step=step, cancelled=lambda: job.cancel)
            h = await self.hardware()
            ver, kind = self.runtime_version()
            job.result = res.to_dict(hardware=h.summary(), runtime=f"{ver or '?'} {kind or ''}".strip())
            self.store.save_probe(m.id, job.result)
            job.phase = "done"
        except ProbeCancelled:
            job.phase = "cancelled"
        except TransferError as e:
            job.phase, job.error = "failed", e.text
        except Exception as e:                            # unerwartet: melden statt still sterben
            job.phase, job.error = "failed", f"{type(e).__name__}: {e}"
        finally:
            if provider is not None:
                await provider.aclose()
            self.hub.publish()
        target = previous if previous and previous != m.id else None
        if target and self.store.get(target) is not None and not self.sim_running():
            await self._start_quiet(self.store.get(target))  # type: ignore[arg-type]
        self.hub.publish()

    def cancel_probe(self) -> bool:
        if self.probe_job and self.probe_job.active:
            self.probe_job.cancel = True
            return True
        return False

    # ---------- Ende ----------
    async def aclose(self) -> None:
        self.cancel_probe()
        for t in list(self._tasks):
            t.cancel()
        await self.transfers.aclose()
        await self.runtime.stop()
        await self.downloader.aclose()
        await self.installer.aclose()
        await self.hf.aclose()
