from fastapi import APIRouter, HTTPException, Path, Request

from . import state
from .models import AgentDetail, LocationDetail, StateSnapshot

router = APIRouter(prefix="/api")


def id_param():
    return Path(pattern=r"^[A-Za-z0-9_.\-]{1,64}$")      # je Route ein eigenes Objekt (FastAPI vermischt geteilte)


@router.get("/state", response_model=StateSnapshot)
async def get_state(request: Request):
    sim = request.app.state.sim
    return await sim.engine.db.run(lambda: state.snapshot(sim))


@router.get("/agents/{agent_id}", response_model=AgentDetail)
async def get_agent(request: Request, agent_id: str = id_param()):
    sim = request.app.state.sim
    detail = await sim.engine.db.run(lambda: state.agent_detail(sim, agent_id))
    if detail is None:
        raise HTTPException(404, f"Agent '{agent_id}' unbekannt")
    return detail


@router.get("/locations/{location_id}", response_model=LocationDetail)
async def get_location(request: Request, location_id: str = id_param()):
    sim = request.app.state.sim
    detail = await sim.engine.db.run(lambda: state.location_detail(sim, location_id))
    if detail is None:
        raise HTTPException(404, f"Ort '{location_id}' unbekannt")
    return detail
