"""FastAPI-Anwendung: Health, Zustand, Ereignisse, Steuerung, WebSocket."""

from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI

from .. import __version__
from ..config import Settings, get_settings
from ..simulation.builder import Simulation
from . import routes_autonomy, routes_events, routes_inject, routes_memory, routes_params, routes_sim, routes_state, ws
from .idempotency import Idempotency

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


def create_app(sim: Simulation | None = None, settings: Settings | None = None) -> FastAPI:
    """Ohne `sim` legt der Start des Servers die Simulation selbst an (data/live.db)."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        s = settings or get_settings()
        app.state.settings = s
        if sim is None:
            (s.data_dir).mkdir(parents=True, exist_ok=True)
            app.state.sim = Simulation.create(s, s.data_dir / "live.db")
        else:
            app.state.sim = sim
        await app.state.sim.engine.db.run(app.state.sim.store.ensure_all)
        if s.sim_autostart:
            await app.state.sim.runner.start()
        yield
        await app.state.sim.runner.stop()
        if sim is None:
            app.state.sim.close()

    app = FastAPI(title="Simulacra", version=__version__, lifespan=lifespan)
    app.state.idempotency = Idempotency()
    app.state.settings = settings or get_settings()
    if sim is not None:                                  # auch ohne Lifespan (z. B. in Tests) erreichbar
        app.state.sim = sim

    @app.get("/api/health")
    async def health(settings: Settings = Depends(get_settings)) -> dict:
        llm = await probe_llm(settings)
        llm.update(base_url=settings.llm_base_url, configured_model=settings.llm_model, model_available=settings.llm_model in llm["models"])
        out = {"status": "ok", "version": __version__, "data_dir": str(settings.data_dir.resolve()), "llm": llm}
        current = getattr(app.state, "sim", None)
        if current is not None:
            out["simulation"] = {"state": current.runner.state.value, "minute": current.engine.minute, "decisions": current.runner.stats.decisions}
        return out

    app.include_router(routes_state.router)
    app.include_router(routes_events.router)
    app.include_router(routes_memory.router)
    app.include_router(routes_autonomy.router)
    app.include_router(routes_inject.router)
    app.include_router(routes_params.router)
    app.include_router(routes_sim.router)
    app.include_router(ws.router)
    return app


app = create_app()
