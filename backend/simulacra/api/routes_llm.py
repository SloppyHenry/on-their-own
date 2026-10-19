"""Modellverwaltung (AP17c-3): Betriebsart, Laufzeit, Download, Bestand und Probelauf. Verändernde Anfragen brauchen einen Idempotency-Key; Downloads und das
Laden der Laufzeit außerdem `confirm: true` (nichts wird ohne Bestätigung geladen), Löschen `?confirm=true`."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from ..models.llmconf import env_locked
from ..models.service import ModelService
from ..models.transfer import TransferError
from .models_runtime import (DownloadRequest, ExternalTest, ExternalTestOut, LlmStatusOut, ModeSet, ModelRef, RuntimeInstallRequest, status_out)

router = APIRouter(prefix="/api")


def service_of(app) -> ModelService:
    """Der Dienst entsteht beim ersten Zugriff. `app.state.hardware_probe`, `hf_transport`, `download_transport` ersetzen Erkennung und Netz (Tests)."""
    st = app.state
    if getattr(st, "models_service", None) is None:
        locked = getattr(st, "llm_env_locked", None)
        st.models_service = ModelService(st.settings, lambda: getattr(st, "sim", None), hardware_probe=getattr(st, "hardware_probe", None), hf_transport=getattr(st, "hf_transport", None),
                                         download_transport=getattr(st, "download_transport", None), releases_url=getattr(st, "releases_url", None),
                                         ready_timeout=getattr(st, "llm_ready_timeout", None), locked=env_locked(st.settings) if locked is None else locked)
    return st.models_service


async def prepare(request: Request, model: str | None, *, strict: bool) -> None:
    """Vor Zurücksetzen, neuer Simulation und Laden: das Modell der Simulation läuft im eingebauten Server (sonst nichts zu tun)."""
    try:
        await service_of(request.app).prepare_for(model, strict=strict)
    except TransferError as e:
        raise HTTPException(e.status, e.text) from None


async def _do(request: Request, payload, action):
    """Eine verändernde Anfrage: idempotent, Fehler des Dienstes werden zu HTTP-Fehlern, Antwort ist der neue Gesamtzustand."""
    svc = service_of(request.app)

    async def handler() -> LlmStatusOut:
        try:
            await action(svc)
        except TransferError as e:
            raise HTTPException(e.status, e.text) from None
        return status_out(svc)
    return await request.app.state.idempotency.run(request.app.state.sim, request, payload, handler)


def _need_confirm(ok: bool, what: str) -> None:
    if not ok:
        raise HTTPException(400, f"Bestätigung fehlt: {what} wird nur nach ausdrücklicher Bestätigung geladen (confirm: true).")


@router.get("/llm", response_model=LlmStatusOut)
async def get_llm(request: Request):
    """Gesamtzustand der Modellverwaltung: Betriebsart, Laufzeit, installierte Modelle mit Siegel, laufende Übertragung und Probelauf."""
    return status_out(service_of(request.app))


@router.put("/llm", response_model=LlmStatusOut)
async def put_llm(request: Request, body: ModeSet):
    """Betriebsart wählen (eingebaut oder externer Server mit Adresse). Nur bei angehaltener Simulation; bei fester Adresse in der Umgebung nicht möglich."""
    return await _do(request, body, lambda svc: svc.set_mode(body.mode, body.external_url, body.external_key))


@router.post("/llm/test", response_model=ExternalTestOut)
async def test_llm(request: Request, body: ExternalTest):
    """Verbindungstest zum externen Server (`GET <Adresse>/models`); ohne Angabe die aktuelle Adresse."""
    return ExternalTestOut(**await service_of(request.app).test_external(body.url, body.key))


@router.post("/llm/runtime/install", response_model=LlmStatusOut)
async def install_runtime(request: Request, body: RuntimeInstallRequest):
    """Lädt die passende llama.cpp-Version aus den offiziellen Releases (GitHub), prüft die Prüfsumme und richtet sie ein. Fortschritt über WebSocket."""
    _need_confirm(body.confirm, "llama.cpp")
    return await _do(request, body, lambda svc: svc.install_runtime())


@router.post("/llm/start", response_model=LlmStatusOut)
async def start_model(request: Request, body: ModelRef):
    """Startet ein installiertes Modell im eingebauten Server (ein laufendes wird beendet). Nur bei angehaltener Simulation. Kehrt sofort zurück; der Zustand folgt per WebSocket."""
    return await _do(request, body, lambda svc: svc.start_model(body.model_id))


@router.post("/llm/stop", response_model=LlmStatusOut)
async def stop_model(request: Request):
    return await _do(request, None, lambda svc: svc.stop_runtime())


@router.put("/llm/default", response_model=LlmStatusOut)
async def put_default(request: Request, body: ModelRef):
    """Modell für neue Simulationen. Eine laufende Simulation behält ihres (Frage 10)."""
    async def action(svc):
        svc.set_default(body.model_id)
    return await _do(request, body, action)


@router.post("/models/downloads", response_model=LlmStatusOut)
async def start_download(request: Request, body: DownloadRequest):
    """Lädt eine .gguf-Datei von Hugging Face (nur dort, nur HTTPS), fortsetzbar, mit SHA-256-Prüfung gegen die Angabe von Hugging Face. Ein Download zugleich."""
    _need_confirm(body.confirm, f"{body.file}")
    return await _do(request, body, lambda svc: svc.download(body.repo, body.file))


@router.delete("/models/downloads/current", response_model=LlmStatusOut)
async def cancel_download(request: Request):
    """Bricht die laufende Übertragung ab (die Teildatei wird entfernt); eine beendete Meldung wird ausgeblendet."""
    async def action(svc):
        if not svc.cancel_transfer():
            svc.transfers.dismiss()
    return await _do(request, None, action)


@router.delete("/models/installed/{model_id}", response_model=LlmStatusOut)
async def delete_model(request: Request, model_id: str, confirm: bool = Query(False)):
    """Löscht ein Modell (Datei und Messergebnis). Nur mit `?confirm=true`."""
    if not confirm:
        raise HTTPException(400, "Bestätigung fehlt: Das Löschen verlangt ?confirm=true.")
    return await _do(request, None, lambda svc: svc.delete_model(model_id))


@router.post("/models/installed/{model_id}/probe", response_model=LlmStatusOut)
async def probe_model(request: Request, model_id: str):
    """Probelauf: zehn Entscheidungen mit dem Messprompt, danach Siegel (geprüft, mit Einschränkung, ungeeignet) und Messwerte. Startet das Modell bei Bedarf."""
    async def action(svc):
        await svc.probe(model_id)
    return await _do(request, None, action)


@router.delete("/models/probe", response_model=LlmStatusOut)
async def cancel_probe(request: Request):
    async def action(svc):
        svc.cancel_probe()
    return await _do(request, None, action)
