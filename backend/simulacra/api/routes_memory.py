"""Gedächtnis-Schnittstellen (AP05): Erinnerungen, Wissen, Abrufe. Nur lesend; geschrieben wird ausschließlich vom Agentenzyklus."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request

from ..events.schema import to_out
from ..events.store import EventStore
from ..memory.models import KINDS, Memory
from .models_memory import (Knowledge, KnownLocation, KnownObject, KnownPerson, MemoriesPage, MemoryDetail, MemoryOut, MemoryStats, RetrievalOut,
                            RetrievalRef, RetrievedMemory)

router = APIRouter(prefix="/api/agents")


def id_param():
    return Path(pattern=r"^[A-Za-z0-9_.\-]{1,64}$")


def mid_param():
    return Path(pattern=r"^mem_[A-Za-z0-9]{10,40}$")


def _out(m: Memory) -> MemoryOut:
    return MemoryOut(**m.model_dump())


def _need_agent(sim, agent_id: str) -> None:
    if sim.engine.state.agent(agent_id) is None:
        raise HTTPException(404, f"Agent '{agent_id}' unbekannt")


@router.get("/{agent_id}/memories", response_model=MemoriesPage)
async def list_memories(request: Request, agent_id: str = id_param(), kind: Literal[KINDS] | None = None, status: Literal["active", "archived"] | None = None,  # type: ignore[valid-type]
                        q: str | None = Query(None, max_length=100), person: str | None = Query(None, max_length=64), location: str | None = Query(None, max_length=64),
                        sort: Literal["time", "importance", "access"] = "time", limit: int = Query(50, ge=1, le=200), cursor: str | None = Query(None, pattern=r"^\d{1,7}$")):
    sim = request.app.state.sim
    offset = int(cursor or 0)

    def work():
        _need_agent(sim, agent_id)
        return sim.memory.store.list(agent_id, kind=kind, status=status, q=q, person=person, location=location, sort=sort, limit=limit, offset=offset)
    items, total = await sim.engine.db.run(work)
    return MemoriesPage(items=[_out(m) for m in items], total=total, next_cursor=str(offset + limit) if offset + limit < total else None)


@router.get("/{agent_id}/memories/{memory_id}", response_model=MemoryDetail)
async def get_memory(request: Request, agent_id: str = id_param(), memory_id: str = mid_param()):
    sim = request.app.state.sim

    def work():
        mem = sim.memory.store.get(agent_id, memory_id)
        if mem is None:
            return None
        sources = sim.memory.store.get_many(agent_id, mem.source_memory_ids)
        derived = [m for m in sim.memory.store.recent(agent_id, kinds=("reflection", "summary"), limit=200, status="active") + sim.memory.store.recent(agent_id, kinds=("reflection", "summary"), limit=200, status="archived")
                   if memory_id in m.source_memory_ids]
        ev = EventStore(sim.engine.state.conn).get(mem.source_event_id) if mem.source_event_id else None
        return mem, sources, derived, ev, sim.memory.know.retrievals_of(agent_id, memory_id)
    got = await sim.engine.db.run(work)
    if got is None:
        raise HTTPException(404, "Erinnerung unbekannt")
    mem, sources, derived, ev, rets = got
    return MemoryDetail(memory=_out(mem), sources=[_out(m) for m in sources], derived=[_out(m) for m in derived], source_event=to_out(ev) if ev else None,
                        retrievals=[RetrievalRef(**r) for r in rets])


@router.get("/{agent_id}/knowledge", response_model=Knowledge)
async def get_knowledge(request: Request, agent_id: str = id_param()):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        st, know = sim.engine.state, sim.memory.know
        locs = [KnownLocation(location_id=r["location_id"], name=st.locations[r["location_id"]].name, discovered_at=r["discovered_at"], visits=r["visits"], last_visit=r["last_visit"])
                for r in know.locations(agent_id) if r["location_id"] in st.locations]
        known = {r["location_id"] for r in know.locations(agent_id)}
        locs += [KnownLocation(location_id=l.id, name=l.name, discovered_at=0, visits=0) for l in st.locations.values()
                 if agent_id in l.discovered_by and l.id not in known and not l.props.get("fallback")]
        objs = [KnownObject(object_id=o["object_id"], name=o["name"], kind=o["kind"], note=o["note"], location_id=o["location_id"],
                            location_name=st.locations[o["location_id"]].name if o["location_id"] in st.locations else "", seen_at=o["seen_at"]) for o in know.objects(agent_id)]
        seen = sim.store.last_seen(agent_id)
        people = []
        for other in st.agents():
            if other.id == agent_id:
                continue
            s = seen.get(other.id, {})
            people.append(KnownPerson(id=other.id, name=other.name, last_seen_location=s.get("loc"), last_seen_minute=s.get("minute"),
                                      memories=sim.memory.store.list(agent_id, person=other.id, limit=1)[1]))
        return Knowledge(locations=locs, objects=objs, persons=people)
    return await sim.engine.db.run(work)


@router.get("/{agent_id}/retrievals", response_model=list[RetrievalOut])
async def get_retrievals(request: Request, agent_id: str = id_param(), limit: int = Query(30, ge=1, le=100)):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        rows = sim.memory.know.retrievals(agent_id, limit)
        mems = {m.id: m for m in sim.memory.store.get_many(agent_id, list({i["id"] for r in rows for i in r["items"]}))}
        return [RetrievalOut(id=r["id"], sim_minute=r["sim_minute"], decision_id=r["decision_id"], query=r["query"], tokens=r["tokens"],
                             items=[RetrievedMemory(id=i["id"], score=i["score"], parts=i.get("parts", {}), kind=mems[i["id"]].kind if i["id"] in mems else "",
                                                    text=mems[i["id"]].text if i["id"] in mems else "") for i in r["items"]]) for r in rows]
    return await sim.engine.db.run(work)


@router.get("/{agent_id}/memory-stats", response_model=MemoryStats)
async def get_stats(request: Request, agent_id: str = id_param()):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        st = sim.memory.know.state_of(agent_id)
        by_kind: dict[str, int] = {}
        for k, n in sim.memory.store.stats(agent_id).items():
            kind, status = k.split("/")
            if status == "active":
                by_kind[kind] = n
        return MemoryStats(active=sim.memory.store.count(agent_id), archived=sim.memory.store.count(agent_id, "archived"), by_kind=by_kind,
                           importance_since_reflection=st["importance_since_reflection"], last_reflection_minute=st["last_reflection_minute"])
    return await sim.engine.db.run(work)
