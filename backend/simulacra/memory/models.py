"""Datenmodelle des Gedächtnisses."""

from typing import Literal

from pydantic import BaseModel

Kind = Literal["episode", "fact", "relation", "intention", "reflection", "summary"]
KINDS = ("episode", "fact", "relation", "intention", "reflection", "summary")
Status = Literal["active", "archived"]


class Memory(BaseModel):
    id: str
    agent_id: str
    kind: Kind
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
    status: Status = "active"
    intention_state: Literal["open", "done", "dropped"] | None = None
    intention_due: int | None = None


class Observed(BaseModel):
    """Eine Beobachtung eines Agenten mit den Angaben, die für eine Erinnerung gebraucht werden."""
    agent_id: str
    kind: str                      # Art der Beobachtung (seen, heard, discovery, gift, ...)
    text: str
    importance: int
    minute: int
    event_seq: int | None = None
    event_id: str | None = None
    location_id: str | None = None
    persons: list[str] = []        # beteiligte andere Agenten
    shared: bool = False
