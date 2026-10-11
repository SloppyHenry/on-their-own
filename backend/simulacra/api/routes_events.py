from typing import Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request

from ..events.schema import to_out
from ..events.store import EventStore
from .models import EventDetail, EventsPage

router = APIRouter(prefix="/api/events")


def name_param():
    """Jeder Parameter braucht sein eigenes Query-Objekt (ein gemeinsames wird von FastAPI vermischt)."""
    return Query(None, max_length=64, pattern=r"^[A-Za-z0-9_.\-]+$")


@router.get("", response_model=EventsPage)
async def list_events(request: Request, after_seq: int = Query(0, ge=0), before_seq: int | None = Query(None, ge=1), type: str | None = name_param(),
                      type_prefix: str | None = name_param(), agent: str | None = name_param(), location: str | None = name_param(),
                      category: Literal["world", "dialogue", "planning", "memory", "system"] | None = None,
                      limit: int = Query(200, ge=1, le=1000), order: Literal["asc", "desc"] = "asc"):
    sim = request.app.state.sim

    def work():
        store = EventStore(sim.engine.state.conn)
        items = store.fetch(after_seq, before_seq, type, type_prefix, agent, category, location, limit, order)
        return EventsPage(items=[to_out(e) for e in items], last_seq=store.last_seq())
    return await sim.engine.db.run(work)


@router.get("/{ref}", response_model=EventDetail)
async def get_event(request: Request, ref: str = Path(pattern=r"^(evt_[0-9A-Z]{26}|evt_legacy_\d+|\d{1,12})$")):
    sim = request.app.state.sim

    def work():
        store = EventStore(sim.engine.state.conn)
        e = store.get(ref)
        if e is None:
            return None
        return EventDetail(event=to_out(e), chain=[to_out(x) for x in store.chain(e.seq)], consequences=[to_out(x) for x in store.children(e.seq)])
    detail = await sim.engine.db.run(work)
    if detail is None:
        raise HTTPException(404, f"Ereignis '{ref}' unbekannt")
    return detail
