"""FastAPI-Anwendung: Health, Zustand, Ereignisse, Steuerung, WebSocket."""

import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI

from .. import __version__
from ..config import Settings, get_settings
from ..models.llmconf import env_locked
from ..simulation.builder import Simulation
from . import auth, routes_autonomy, routes_events, routes_gestalten, routes_inject, routes_llm, routes_memory, routes_models, routes_newsim, routes_params, routes_player, routes_saves, routes_sim, routes_state, routes_stats, routes_voices, routes_welten, routes_world, ws
from .idempotency import Idempotency
from .static import mount_frontend

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
        app.state.llm_env_locked = env_locked(s)                 # vor jeder Änderung durch die Modellverwaltung festhalten
        if sim is None:
            (s.data_dir).mkdir(parents=True, exist_ok=True)
            app.state.sim = Simulation.create(s, s.data_dir / "live.db")
        else:
            app.state.sim = sim
        await app.state.sim.engine.db.run(app.state.sim.store.ensure_all)
        if (s.data_dir / "llm.json").exists() or any((s.data_dir / "models").glob("*.gguf")):
            app.state.autostart_task = asyncio.create_task(routes_llm.service_of(app).autostart())       # eingebautes Modell passend zur Simulation laden (im Hintergrund)
        if s.sim_autostart:
            await app.state.sim.runner.start()
        yield
        if getattr(app.state, "models_service", None) is not None:
            await app.state.models_service.aclose()
        await app.state.sim.runner.stop()
        if getattr(app.state, "rules_sim", None) is not None:
            app.state.rules_sim[1].close()
        if getattr(app.state, "catalog", None) is not None:
            await app.state.catalog.aclose()
        if sim is None:
            app.state.sim.close()

    app = FastAPI(title="On Their Own", version=__version__, lifespan=lifespan)
    app.state.idempotency = Idempotency()
    app.state.settings = settings or get_settings()
    app.state.auth_fails = []
    token = app.state.settings.access_token
    if token is not None and token.get_secret_value():
        app.add_middleware(auth.AccessMiddleware, token=token.get_secret_value())
    if sim is not None:                                  # auch ohne Lifespan (z. B. in Tests) erreichbar
        app.state.sim = sim

    @app.get("/api/health")
    async def health(settings: Settings = Depends(get_settings)) -> dict:
        llm = await probe_llm(settings)
        llm.update(base_url=settings.llm_base_url, configured_model=settings.llm_model, model_available=settings.llm_model in llm["models"])
        out = {"status": "ok", "version": __version__, "data_dir": str(settings.data_dir.resolve()), "llm": llm}
        current = getattr(app.state, "sim", None)
        if current is not None:
            minute = await current.engine.db.run(lambda: current.engine.minute)
            out["simulation"] = {"state": current.runner.state.value, "minute": minute, "decisions": current.runner.stats.decisions}
        return out

    app.include_router(routes_state.router)
    app.include_router(routes_events.router)
    app.include_router(routes_memory.router)
    app.include_router(routes_autonomy.router)
    app.include_router(routes_player.router)
    app.include_router(routes_inject.router)
    app.include_router(routes_models.router)
    app.include_router(routes_llm.router)
    app.include_router(routes_params.router)
    app.include_router(routes_saves.router)
    app.include_router(routes_stats.router)
    app.include_router(routes_sim.router)
    app.include_router(routes_world.router)
    app.include_router(routes_voices.router)
    app.include_router(routes_newsim.router)
    app.include_router(routes_gestalten.router)
    app.include_router(routes_gestalten.router_welten)
    app.include_router(routes_gestalten.router_katalog)
    app.include_router(routes_welten.router)
    app.include_router(ws.router)
    app.include_router(auth.router)
    if app.state.settings.static_dir is not None:          # zuletzt: der Auffangpfad darf keine API-Route überdecken
        mount_frontend(app, app.state.settings.static_dir)
    return app


app = create_app()
