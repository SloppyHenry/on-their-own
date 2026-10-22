from fastapi import APIRouter, Query, Request

from ..stats.queries import compute
from .models_saves import StatsOut, stats_out

router = APIRouter(prefix="/api")


@router.get("/stats", response_model=StatsOut)
async def stats(request: Request, agent: str | None = Query(None, max_length=64, pattern=r"^[A-Za-z0-9_.\-]+$"), from_minute: int | None = Query(None, ge=0), to_minute: int | None = Query(None, ge=0)):
    """Statistiken je Agent und gesamt, berechnet per SQL aus den Protokolltabellen."""
    sim = request.app.state.sim

    def work():
        st = sim.engine.state
        names = {a.id: a.name for a in st.agents()}
        locs = {l.id: l.name for l in st.locations.values()}
        return compute(st.conn, sim.store.profile_ids(), names, locs, agent, from_minute, to_minute)
    return stats_out(await sim.engine.db.run(work))
