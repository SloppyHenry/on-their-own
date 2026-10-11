import csv
import io
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request
from fastapi.responses import Response

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
                      limit: int = Query(200, ge=1, le=1000), order: Literal["asc", "desc"] = "asc", from_minute: int | None = Query(None, ge=0), to_minute: int | None = Query(None, ge=0),
                      q: str | None = Query(None, max_length=100)):
    sim = request.app.state.sim

    def work():
        store = EventStore(sim.engine.state.conn)
        items = store.fetch(after_seq, before_seq, type, type_prefix, agent, category, location, limit, order, from_minute, to_minute, q)
        return EventsPage(items=[to_out(e) for e in items], last_seq=store.last_seq())
    return await sim.engine.db.run(work)


EXPORT_LIMIT = 200_000


@router.get("/export")
async def export_events(request: Request, format: Literal["csv", "json"] = "csv", type_prefix: str | None = name_param(), agent: str | None = name_param(), location: str | None = name_param(),
                        category: Literal["world", "dialogue", "planning", "memory", "system"] | None = None, from_minute: int | None = Query(None, ge=0), to_minute: int | None = Query(None, ge=0),
                        q: str | None = Query(None, max_length=100)):
    """Ereignisverlauf mit denselben Filtern wie die Liste als Datei (CSV oder JSON)."""
    sim = request.app.state.sim

    def work():
        store, out, after = EventStore(sim.engine.state.conn), [], 0
        while len(out) < EXPORT_LIMIT:
            page = store.fetch(after, None, None, type_prefix, agent, category, location, 1000, "asc", from_minute, to_minute, q)
            if not page:
                break
            out += [to_out(e) for e in page]
            after = page[-1].seq
        return out
    items = await sim.engine.db.run(work)
    if format == "json":
        return Response(json.dumps([e.model_dump(mode="json") for e in items], ensure_ascii=False), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="ereignisse.json"'})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["seq", "sim_minute", "tag", "uhrzeit", "typ", "kategorie", "agenten", "ort", "daten"])
    for e in items:
        w.writerow([e.seq, e.sim_time.total, e.sim_time.day, f"{e.sim_time.minute // 60:02d}:{e.sim_time.minute % 60:02d}", e.type, e.category, ";".join(e.agents), e.location or "", json.dumps(e.data, ensure_ascii=False)])
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="ereignisse.csv"'})


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
