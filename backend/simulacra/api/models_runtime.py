"""Modellverwaltung (AP17c-3): Zustand und Anfragen. Ein einziger Gesamtzustand (`LlmStatusOut`) geht über REST und als WebSocket-Nachricht `models`."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..models.probe import SEALS
from ..models.service import ModelService
from .models import Out

Phase = Literal["preparing", "downloading", "verifying", "unpacking", "done", "failed", "cancelled"]


class TransferOut(Out):
    id: str
    kind: Literal["model", "runtime"]
    label: str                                    # z. B. „Qwen3-8B“ oder „llama.cpp b6532 (metal)“
    file: str
    source: str
    total: int                                    # Bytes laut Quelle (0 = unbekannt)
    done: int                                     # Bytes (beim Prüfen: geprüfte Bytes)
    phase: Phase
    speed_bps: float
    eta_s: float | None
    error: str | None
    model_id: str | None


class ProbeOut(Out):
    n: int
    valid: int
    valid_pct: float
    errors: int
    avg_s: float | None                           # mittlere Dauer je Entscheidung
    tokens_per_s: float | None
    seal: Literal["checked", "limited", "unfit"]
    seal_label: str                               # geprüft | mit Einschränkung | ungeeignet
    at: float
    hardware: str | None
    runtime: str | None


class ProbeJobOut(Out):
    model_id: str
    phase: Literal["starting", "running", "done", "failed", "cancelled"]
    step: int
    n: int
    error: str | None
    result: ProbeOut | None


class InstalledOut(Out):
    id: str                                       # Dateiname ohne .gguf, zugleich der Name, den der Server meldet
    file: str
    name: str
    repo: str | None
    quant: str | None
    size_bytes: int
    size_mb: float
    license: str | None
    source: Literal["tool", "extern"]
    running: bool                                 # dieses Modell läuft gerade im eingebauten Server
    is_default: bool                              # Modell für neue Simulationen
    is_sim_model: bool                            # Modell der laufenden Simulation
    probe: ProbeOut | None


class RuntimeOut(Out):
    installed: bool
    version: str | None
    kind: str | None
    binary: str | None
    state: Literal["stopped", "starting", "running", "failed"]
    model_id: str | None
    error: str | None
    log_tail: list[str]


class LlmStatusOut(Out):
    mode: Literal["builtin", "external"]
    locked: bool                                  # Adresse per Umgebung festgelegt (SIM_LLM_BASE_URL)
    external_url: str | None
    external_key_set: bool
    base_url: str                                 # was die Simulation gerade anspricht
    sim_model: str | None
    sim_running: bool
    default_model: str | None
    runtime: RuntimeOut
    installed: list[InstalledOut]
    transfer: TransferOut | None
    probe: ProbeJobOut | None


class WsModels(Out):
    type: Literal["models"] = "models"
    status: LlmStatusOut


class ModeSet(BaseModel):
    mode: Literal["builtin", "external"]
    external_url: str | None = Field(None, max_length=300)
    external_key: str | None = Field(None, max_length=300)


class ExternalTest(BaseModel):
    url: str | None = Field(None, max_length=300)
    key: str | None = Field(None, max_length=300)


class ExternalTestOut(Out):
    reachable: bool
    models: list[str]
    error: str | None
    url: str


class DownloadRequest(BaseModel):
    repo: str = Field(max_length=200)
    file: str = Field(max_length=200)
    confirm: bool = False                         # ohne Bestätigung wird nichts geladen


class RuntimeInstallRequest(BaseModel):
    confirm: bool = False


class ModelRef(BaseModel):
    model_id: str = Field(max_length=200)


def _probe(d: dict | None) -> ProbeOut | None:
    if not d:
        return None
    return ProbeOut(n=d["n"], valid=d["valid"], valid_pct=d["valid_pct"], errors=d.get("errors", 0), avg_s=d.get("avg_s"), tokens_per_s=d.get("tokens_per_s"), seal=d["seal"],
                    seal_label=SEALS[d["seal"]], at=d["at"], hardware=d.get("hardware"), runtime=d.get("runtime"))


def status_out(svc: ModelService) -> LlmStatusOut:
    cfg, rt, mode = svc.conf.load(), svc.runtime, svc.mode()
    probes = svc.store.probes()
    sim_model = svc.sim_model()
    ver, kind = svc.runtime_version()
    binary = svc.binary()
    installed = [InstalledOut(id=m.id, file=m.file, name=m.name, repo=m.repo, quant=m.quant, size_bytes=m.size_bytes, size_mb=round(m.size_bytes / 1048576, 1), license=m.license, source=m.source,  # type: ignore[arg-type]
                              running=rt.model_id == m.id and rt.state in ("starting", "running"), is_default=cfg.default_model == m.id, is_sim_model=sim_model == m.id, probe=_probe(probes.get(m.id)))
                 for m in svc.store.list()]
    t, p = svc.transfers.current, svc.probe_job
    return LlmStatusOut(
        mode=mode, locked=svc.locked, external_url=svc.settings.llm_base_url if svc.locked else cfg.external_url, external_key_set=bool(cfg.external_key), base_url=svc.settings.llm_base_url,
        sim_model=sim_model, sim_running=svc.sim_running(), default_model=cfg.default_model,
        runtime=RuntimeOut(installed=binary is not None, version=ver, kind=kind, binary=str(binary) if binary else None, state=rt.state, model_id=rt.model_id, error=rt.error, log_tail=rt.log_tail()),  # type: ignore[arg-type]
        installed=installed,
        transfer=TransferOut(id=t.id, kind=t.kind, label=t.label, file=t.file, source=t.source, total=t.total, done=t.done, phase=t.phase, speed_bps=round(t.speed_bps), eta_s=t.eta_s, error=t.error, model_id=t.model_id) if t else None,  # type: ignore[arg-type]
        probe=ProbeJobOut(model_id=p.model_id, phase=p.phase, step=p.step, n=p.n, error=p.error, result=_probe(p.result)) if p else None,  # type: ignore[arg-type]
    )
