"""Steuerbefehle. Alle verändernden Anfragen brauchen einen Idempotency-Key."""

from fastapi import APIRouter, HTTPException, Request

from .routes_llm import prepare
from .models import ResetRequest, SimCommandResult, SpeedRequest, StartRequest, StepRequest
from .state import SPEED_LEVELS, speed_level

router = APIRouter(prefix="/api/sim")


async def _result(sim, **extra) -> SimCommandResult:
    minute = await sim.engine.db.run(lambda: sim.engine.minute)        # nie vom Thread der Ereignisschleife aus lesen: die Verbindung gehört dem DB-Thread
    return SimCommandResult(state=sim.runner.state.value, minute=minute, tick_delay_s=sim.runner.tick_delay_s,
                            speed_level=speed_level(sim.runner.tick_delay_s), **extra)


async def _command(request: Request, payload, action):
    sim = request.app.state.sim

    async def handler():
        try:
            return await action(sim)
        except RuntimeError as e:
            raise HTTPException(409, str(e)) from None
    return await request.app.state.idempotency.run(sim, request, payload, handler)


@router.post("/start", response_model=SimCommandResult)
async def start(request: Request, body: StartRequest | None = None):
    body = body or StartRequest()

    async def action(sim):
        await sim.runner.start(ticks=body.ticks)
        return await _result(sim)
    return await _command(request, body, action)


@router.post("/pause", response_model=SimCommandResult)
async def pause(request: Request):
    async def action(sim):
        await sim.runner.pause()
        return await _result(sim)
    return await _command(request, None, action)


@router.post("/resume", response_model=SimCommandResult)
async def resume(request: Request):
    async def action(sim):
        await sim.runner.resume()
        return await _result(sim)
    return await _command(request, None, action)


@router.post("/step", response_model=SimCommandResult)
async def step(request: Request, body: StepRequest | None = None):
    body = body or StepRequest()

    async def action(sim):
        done = await sim.runner.step(body.n)
        return await _result(sim, steps=done)
    return await _command(request, body, action)


@router.post("/reset", response_model=SimCommandResult)
async def reset(request: Request, body: ResetRequest | None = None):
    body = body or ResetRequest()
    if not body.confirm:
        raise HTTPException(400, "Zurücksetzen braucht die ausdrückliche Bestätigung {\"confirm\": true}. Die bisherige Welt wird gesichert, nicht gelöscht.")

    async def action(sim):
        await prepare(request, body.model, strict=True)
        saved = await sim.reset(model=body.model, keep_profiles=body.keep_profiles)
        return await _result(sim, backup=str(saved) if saved else None)
    return await _command(request, body, action)


@router.post("/speed", response_model=SimCommandResult)
async def speed(request: Request, body: SpeedRequest):
    if (body.level is None) == (body.tick_delay_s is None):
        raise HTTPException(422, "Entweder 'level' oder 'tick_delay_s' angeben.")

    async def action(sim):
        delay = SPEED_LEVELS[body.level] if body.level else body.tick_delay_s
        sim.runner.set_speed(delay)
        await sim.engine.db.run(lambda: sim.engine.emit_event("simulation.speed_changed", data={"tick_delay_s": delay, "level": speed_level(delay)}))
        return await _result(sim)
    return await _command(request, body, action)
