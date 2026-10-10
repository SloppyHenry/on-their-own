"""FastAPI-Fabrik und Health-Route."""

import httpx
from fastapi import Depends, FastAPI

from . import __version__
from .config import Settings, get_settings

LLM_PROBE_TIMEOUT_S = 3.0


async def probe_llm(settings: Settings) -> dict:
    """Fragt GET /models am LLM-Endpunkt ab; Fehler werden gemeldet, nie geworfen."""
    headers = {}
    key = settings.llm_api_key
    if key is not None:
        headers["Authorization"] = f"Bearer {key.get_secret_value()}"
    try:
        async with httpx.AsyncClient(timeout=LLM_PROBE_TIMEOUT_S) as client:
            resp = await client.get(f"{settings.llm_base_url.rstrip('/')}/models", headers=headers)
        resp.raise_for_status()
        models = [m["id"] for m in resp.json().get("data", [])]
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        return {"reachable": False, "error": f"{type(exc).__name__}: {exc}", "models": []}
    return {"reachable": True, "error": None, "models": models}


def create_app() -> FastAPI:
    app = FastAPI(title="Simulacra", version=__version__)

    @app.get("/api/health")
    async def health(settings: Settings = Depends(get_settings)) -> dict:
        llm = await probe_llm(settings)
        llm.update(
            base_url=settings.llm_base_url,
            configured_model=settings.llm_model,
            model_available=settings.llm_model in llm["models"],
        )
        return {
            "status": "ok",
            "version": __version__,
            "data_dir": str(settings.data_dir.resolve()),
            "llm": llm,
        }

    return app


app = create_app()
