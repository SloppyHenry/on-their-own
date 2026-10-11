"""Pydantic-Modelle der Welt (Quelle für JSON-Schema und TypeScript-Typen)."""

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class RejectCode(StrEnum):
    NOT_REACHABLE = "not_reachable"
    NOT_HERE = "not_here"
    MISSING_RESOURCE = "missing_resource"
    LOCKED = "locked"
    CAPACITY = "capacity"
    FORBIDDEN_BY_RULES = "forbidden_by_rules"
    INVALID_TARGET = "invalid_target"
    BUSY = "busy"


class Location(BaseModel):
    id: str
    name: str
    rect: tuple[int, int, int, int]  # x, y, Breite, Höhe
    entrances: list[tuple[int, int]] = []
    extra_tiles: list[tuple[int, int]] = []
    props: dict[str, Any] = {}
    discovered_by: list[str] = []

    def contains(self, x: int, y: int) -> bool:
        rx, ry, w, h = self.rect
        return (rx <= x < rx + w and ry <= y < ry + h) or (x, y) in self.extra_tiles


class WorldObject(BaseModel):
    id: str
    kind: str
    name: str
    location_id: str | None = None
    x: int | None = None
    y: int | None = None
    holder: str | None = None
    state: dict[str, Any] = {}
    portable: bool = False
    owner: str | None = None
    created_by: str | None = None
    created_at: int = 0
    hidden: bool = False
    known_by: list[str] = []

    def visible_to(self, agent_id: str) -> bool:
        return not self.hidden or agent_id in self.known_by


class ResourceNode(BaseModel):
    id: str
    location_id: str
    x: int
    y: int
    resource: str
    amount: float
    cap: float
    regen_per_hour: float
    requires_tool: str | None = None
    gather_minutes: int = 5


class ActiveAction(BaseModel):
    """Laufende Aktion eines Agenten (in agents_body.action als JSON gespeichert)."""
    type: str
    params: dict[str, Any] = {}
    started_at: int
    ends_at: int | None = None  # None: endet durch eigene Logik (z. B. Ankunft beim Gehen)
    data: dict[str, Any] = {}


class AgentBody(BaseModel):
    id: str
    name: str
    x: int
    y: int
    location_id: str
    capacity: int = 10
    needs: dict[str, float] = {"energy": 85, "hunger": 25, "thirst": 20}
    action: ActiveAction | None = None
    move_budget: float = 0.0
    facing: Literal["up", "down", "left", "right"] = "down"
    inventory: dict[str, int] = {}

    @property
    def pos(self) -> tuple[int, int]:
        return (self.x, self.y)


class Event(BaseModel):
    """Einheitliches Ereignis (§12). `seq` ist die fortlaufende Ereignis-ID."""
    seq: int
    ts: str
    sim_minute: int
    type: str
    agents: list[str] = []
    location_id: str | None = None
    data: dict[str, Any] = {}
    parent_seq: int | None = None
    event_id: str | None = None          # ULID mit Präfix evt_ (ältere Ereignisse: None)
    category: str = "system"
    visibility: str = "public"
    caused_by: str | None = None         # event_id des auslösenden Ereignisses


class Rejected(BaseModel):
    code: RejectCode
    text: str


class Accepted(BaseModel):
    duration: int | None  # Minuten; None = bis zur Ankunft/Fertigstellung durch Logik
    data: dict[str, Any] = Field(default_factory=dict)


class ProposeResult(BaseModel):
    ok: bool
    rejected: Rejected | None = None
    events: list[Event] = []
    ends_at: int | None = None
