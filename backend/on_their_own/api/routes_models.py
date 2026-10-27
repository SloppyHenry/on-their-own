"""Hardware und Modellkatalog (AP17c-2). Nur lesend; Download und Laufzeit folgen mit AP17c-3."""

import asyncio
from typing import Literal

from fastapi import APIRouter, Query, Request

from ..models.catalog import Catalog
from ..models.hardware import Hardware, detect
from .models_llm import CatalogOut, HardwareOut, catalog_out, hardware_out

router = APIRouter(prefix="/api")


async def _hardware(request: Request) -> Hardware:
    """Rechner neu erkennen (der freie Grafikspeicher ändert sich); die Befehle laufen im Thread. `app.state.hardware_probe` ersetzt die Erkennung (Tests)."""
    probe = getattr(request.app.state, "hardware_probe", None) or detect
    return await asyncio.to_thread(probe, request.app.state.settings.data_dir)


def _catalog(request: Request) -> Catalog:
    app = request.app
    if getattr(app.state, "catalog", None) is None:
        app.state.catalog = Catalog(app.state.settings.data_dir, transport=getattr(app.state, "hf_transport", None))
    return app.state.catalog


@router.get("/hardware", response_model=HardwareOut)
async def get_hardware(request: Request):
    """Erkannte Hardware: Grafikkarte (NVIDIA, Apple Silicon, AMD), Speicher (bei Grafikkarten der freie), Platz im Datenordner."""
    return hardware_out(await _hardware(request))


@router.get("/models/catalog", response_model=CatalogOut)
async def get_catalog(request: Request, q: str = Query("", max_length=80), only_fit: bool = False, publishers: Literal["trusted", "all"] = "trusted",
                      refresh: bool = False, limit: int = Query(50, ge=1, le=200)):
    """Modelle für diesen Rechner: Live-Liste von Hugging Face (6 h Zwischenspeicher) und kuratierte Liste, nach Passung geordnet.
    `publishers=trusted` zeigt die Herausgeber der Positivliste, `all` jeden; `refresh=true` umgeht den Zwischenspeicher. Ohne Netz kommt die kuratierte Liste."""
    hw = await _hardware(request)
    result = await _catalog(request).load(hw, q=q, only_fit=only_fit, trusted_only=publishers == "trusted", refresh=refresh, limit=limit)
    return catalog_out(hw, result)
