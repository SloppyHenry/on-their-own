"""Antwortmodelle der Gedächtnis-Schnittstellen (AP05)."""

from ..events.schema import EventOut
from .models import Out


class MemoryOut(Out):
    id: str
    agent_id: str
    kind: str
    text: str
    keywords: list[str] = []
    persons: list[str] = []
    location_id: str | None = None
    importance: int
    shared: bool = False
    sim_created: int
    sim_last_access: int | None = None
    access_count: int = 0
    source_event_id: str | None = None
    source_memory_ids: list[str] = []
    status: str = "active"
    intention_state: str | None = None
    intention_due: int | None = None


class MemoriesPage(Out):
    items: list[MemoryOut]
    total: int
    next_cursor: str | None = None


class RetrievalRef(Out):
    id: int
    sim_minute: int
    decision_id: int | None = None
    score: float | None = None


class MemoryDetail(Out):
    memory: MemoryOut
    sources: list[MemoryOut] = []                  # Quellerinnerungen (bei Reflexionen und Zusammenfassungen)
    derived: list[MemoryOut] = []                  # Reflexionen und Zusammenfassungen, die sich auf diese Erinnerung stützen
    source_event: EventOut | None = None
    retrievals: list[RetrievalRef] = []


class KnownLocation(Out):
    location_id: str
    name: str
    discovered_at: int
    visits: int
    last_visit: int | None = None


class KnownObject(Out):
    object_id: str
    name: str
    kind: str
    note: str = ""
    location_id: str | None = None
    location_name: str = ""
    seen_at: int


class KnownPerson(Out):
    id: str
    name: str
    last_seen_location: str | None = None
    last_seen_minute: int | None = None
    memories: int = 0


class Knowledge(Out):
    locations: list[KnownLocation]
    objects: list[KnownObject]
    persons: list[KnownPerson]


class RetrievedMemory(Out):
    id: str
    score: float
    parts: dict[str, float] = {}
    kind: str = ""
    text: str = ""


class RetrievalOut(Out):
    id: int
    sim_minute: int
    decision_id: int | None = None
    query: str
    tokens: int
    items: list[RetrievedMemory]


class MemoryStats(Out):
    active: int
    archived: int
    by_kind: dict[str, int] = {}
    importance_since_reflection: int = 0
    last_reflection_minute: int | None = None


__all__ = ["MemoryOut", "MemoriesPage", "RetrievalRef", "MemoryDetail", "KnownLocation", "KnownObject", "KnownPerson", "Knowledge", "RetrievedMemory",
           "RetrievalOut", "MemoryStats"]
