"""Datenmodelle der Ereignisdaten (`data`) je Ereignistyp. Quelle für JSON-Schema und TypeScript-Typen."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class D(BaseModel):
    """Basis: keine unbekannten Felder (so fällt jedes vergessene Feld im Test auf); Felder wie `from` laufen über Aliase."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Loose(BaseModel):
    """Für geplante Typen, deren Felder erst mit ihrem Paket feststehen."""
    model_config = ConfigDict(extra="allow")


class ObjectData(D):
    id: str
    kind: str
    name: str
    x: int | None = None
    y: int | None = None
    location_id: str | None = None
    holder: str | None = None
    state: dict[str, Any] = {}


# --- Aktionen und Bewegung -------------------------------------------------------------------------
class ActionStarted(D):
    action: str
    params: dict[str, Any] = {}
    ends_at: int | None = None


class ActionCompleted(D):
    action: str
    params: dict[str, Any] = {}


class ActionProblem(D):
    """action_failed und action_rejected."""
    action: str
    params: dict[str, Any] = {}
    code: str
    text: str


class ActionInterrupted(D):
    action: str
    reason: str = ""


class Moved(D):
    from_: list[int] = Field(alias="from")
    to: list[int]
    facing: str
    remaining: int = 0                       # Kacheln bis zum Ziel des Weges


class Arrived(D):
    target: str | None = None
    label: str | None = None
    at: list[int]


class LocationChanged(D):
    from_location: str
    to_location: str


class LocationDiscovered(D):
    location: str


# --- Ergebnisse von Aktionen ---------------------------------------------------------------------------
class Dialogue(D):
    speaker: str
    to: str
    text: str


class Inspected(D):
    object: ObjectData | None = None
    node: str | None = None
    resource: str | None = None
    amount: int | None = None
    requires_tool: str | None = None


class Read(D):
    object: str
    name: str
    content: list[Any] = []


class Fished(D):
    caught: bool


class Ate(D):
    hunger: float


class Drank(D):
    thirst: float


class Slept(D):
    energy: float
    minutes: int


class Rested(D):
    energy: float


class ItemMoved(D):
    """item_taken und item_dropped."""
    object: ObjectData


class ItemGiven(D):
    from_: str = Field(alias="from")
    to: str
    object: ObjectData | None = None
    resource: str | None = None
    amount: int | None = None


class InventoryChanged(D):
    resource: str
    delta: int
    qty: int


# --- Entscheidungen und Gespräche ----------------------------------------------------------------------
class OptionSummary(D):
    id: str
    kind: str
    label: str
    score: float


class Decision(D):
    decision_id: int
    status: str                               # valid | fallback
    chosen: str | None = None
    action: str
    params: dict[str, Any] = {}
    intent: str = ""
    importance: int = 3
    options: list[OptionSummary] = []
    factors: list[list[Any]] = []             # [Name, Punkte] der gewählten Option
    attempts: int = 1
    latency_ms: int = 0
    why: str = ""                            # Erklärung aus den Daten (agents/explain.py)
    rank: int | None = None                   # Platz der gewählten Option nach Punkten (1 = bestbewertet)
    goal: str | None = None                   # aktives Ziel zum Zeitpunkt der Entscheidung
    retrieval_id: int | None = None           # Abruf aus dem Gedächtnis für diese Entscheidung


class DecisionFailed(D):
    reason: str | None = None
    attempts: int = 0


class RetrievedItem(D):
    id: str
    kind: str
    score: float
    text: str


class MemoryCreated(D):
    memory_id: str
    kind: str
    text: str
    importance: int
    location: str | None = None
    persons: list[str] = []
    shared: bool = False
    source_event_id: str | None = None
    source_memory_ids: list[str] = []


class MemoryRetrieved(D):
    retrieval_id: int
    items: list[RetrievedItem]
    tokens: int
    query: list[str] = []


class MemorySkipped(D):
    text: str
    importance: int
    reason: str


class MemoryArchived(D):
    count: int
    memory_ids: list[str]
    reason: str


class RelationChanged(D):
    other: str
    deltas: dict[str, float]
    values: dict[str, float]
    reason: str
    source: str


class GoalChanged(D):
    goal_id: str
    kind: str
    text: str
    old: str | None = None
    new: str
    reason: str
    progress: float = 0.0
    replaced: str | None = None


class GuardTriggered(D):
    guard: str
    detail: str
    key: str | None = None
    until: int | None = None


class StatusChanged(D):
    old: str
    new: str


class ConversationStarted(D):
    conversation: int
    by: str


class ConversationEnded(D):
    conversation: int
    reason: str
    reason_text: str
    turns: int
    participants: list[str]


class ProposalAnswered(D):
    conversation: int
    proposal: str
    by: str
    answered_by: str


# --- Welt ---------------------------------------------------------------------------------------------------
class ObjectCreated(D):
    object: ObjectData
    cause: str = ""


class ObjectRemoved(D):
    object: ObjectData
    cause: str = ""


class ObjectChanged(ObjectData):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    change: str = ""


class ObjectDiscovered(D):
    object: ObjectData


class ResourceChanged(D):
    node: str
    resource: str
    amount: float
    cause: str = ""


class ResourceAdded(D):
    node: str
    resource: str
    amount: float
    cap: float
    tile: list[int]


class WeatherChanged(D):
    from_: str = Field(alias="from")
    to: str
    until: int
    cause: str = ""


class PhaseChanged(D):
    phase: str
    time: str


class DayStarted(D):
    day: int
    weekday: str


class WorldTime(D):
    day: int
    time: str
    phase: str
    daylight: float


class TileChanged(D):
    x: int
    y: int
    type: str


class TileChange(D):
    x: int
    y: int
    type: str
    from_: str = Field(alias="from")


class TilesChanged(D):
    count: int
    changes: list[TileChange]
    truncated: bool = False
    cause: str = ""


class TileTypeAdded(D):
    id: str
    walkable: bool
    cost: int
    char: str | None = None
    color: str | None = None
    label: str


class MapExtended(D):
    from_: list[int] = Field(alias="from")
    to: list[int]
    fill: str


class LocationEvent(D):
    """location_added und location_updated."""
    location: dict[str, Any]
    claim: bool | None = None
    reassigned: dict[str, int] | None = None


class AgentAdded(D):
    id: str
    name: str
    tile: list[int]
    capacity: int


class PatchApplied(D):
    id: str
    description: str = ""
    counts: dict[str, int]


# --- Simulation ----------------------------------------------------------------------------------------------
class SimControl(D):
    minute: int


class SimStepped(D):
    n: int
    minute: int


class SimReset(D):
    backup: str | None = None


class ParameterChanged(D):
    group: str
    rules: dict[str, Any] = {}               # nur bei Weltregeln: alle Regeln nach der Änderung
    key: str | None = None
    agent: str | None = None
    old: Any = None
    new: Any = None
    status: str | None = None                # applied | pending_next_decision | requires_model_restart


class SpeedChanged(D):
    tick_delay_s: float
    level: str
