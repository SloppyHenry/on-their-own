"""Antwort- und Nachrichtenmodelle der API. Quelle für das JSON-Schema und die TypeScript-Typen des Frontends."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from ..events.schema import EventOut


class Out(BaseModel):
    """Basis der Antwortmodelle: Felder mit Standardwert sind in der Ausgabe immer vorhanden (so steht es im TypeScript-Typ)."""
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


class TileTypeInfo(Out):
    char: str | None = None
    walkable: bool
    cost: int
    color: str | None = None
    label: str


class MapData(Out):
    width: int
    height: int
    rows: list[str]                      # eine Zeichenkette je Kartenzeile
    legend: dict[str, str]               # Zeichen -> Kachelart


class LocationInfo(Out):
    id: str
    name: str
    rect: list[int]
    entrances: list[list[int]] = []
    props: dict[str, Any] = {}
    discovered_by: list[str] = []


class ObjectInfo(Out):
    id: str
    kind: str
    name: str
    x: int | None = None
    y: int | None = None
    location_id: str | None = None
    holder: str | None = None
    state: dict[str, Any] = {}
    portable: bool = False
    owner: str | None = None
    hidden: bool = False
    known_by: list[str] = []


class ResourceInfo(Out):
    id: str
    location_id: str
    x: int
    y: int
    resource: str
    amount: float
    cap: float
    requires_tool: str | None = None
    label: str | None = None             # Name der Quelle („Tomaten“, AP15)


class ActionInfo(Out):
    type: str
    params: dict[str, Any] = {}
    started_at: int
    ends_at: int | None = None


class WalkInfo(Out):
    """Restlicher Weg mit Fahrplan (wie `agent.walking`), damit ein Refresh mitten im Weg weiterlaufen kann."""
    path: list[list[int]]
    arrive: list[int]


class ProfileBrief(Out):
    name: str
    gender: str
    age: int
    goals: list[str] = []


class AgentInfo(Out):
    id: str
    name: str
    x: int
    y: int
    location_id: str
    facing: str
    capacity: int
    action: ActionInfo | None = None
    walk: WalkInfo | None = None
    status: str = "idle"
    needs: dict[str, float]
    words: dict[str, str]
    inventory: dict[str, int] = {}
    held: list[str] = []
    profile: ProfileBrief | None = None
    plan_next: str = ""


class ClockInfo(Out):
    minute: int
    day: int
    time: str
    weekday: str
    phase: str
    daylight: float


class WeatherInfo(Out):
    kind: str
    since: int
    until: int


class SimStatus(Out):
    state: Literal["stopped", "running", "paused", "stepping"]
    tick_delay_s: float
    speed_level: str
    stats: dict[str, Any] = {}
    llm: dict[str, Any] = {}


class Voice(BaseModel):
    """Stimme einer Figur fürs Plappern im Browser (AP17d). Reine Darstellung; die Bewohner erfahren nichts davon."""
    model_config = ConfigDict(extra="forbid")
    base: float = Field(ge=60, le=400)                    # Grundton in Hz
    timbre: Literal["weich", "klar", "rau", "hohl", "piepsig"]
    speed: float = Field(ge=0.4, le=2.0)
    size: float = Field(ge=0.7, le=1.5)                   # Vokalfarbe (Formanten)
    lively: float = Field(ge=0, le=2.5)                   # Satzmelodie
    breath: float = Field(ge=0, le=0.5)
    vib: float = Field(default=5, ge=0, le=10)
    style: Literal["plappern", "summen", "piepsen"]


class VoiceSet(BaseModel):
    voice: Voice | None = None                            # None: zurück zum Vorschlag


class VoiceOut(Out):
    agent: str
    voice: Voice | None = None


class StateSnapshot(Out):
    seq: int
    world_name: str
    map: MapData
    tile_types: dict[str, TileTypeInfo]
    locations: list[LocationInfo]
    objects: list[ObjectInfo]
    resources: list[ResourceInfo]
    agents: list[AgentInfo]
    clock: ClockInfo
    weather: WeatherInfo
    simulation: SimStatus
    rules: dict[str, Any] = {}
    links: list[list[list[int]]] = []      # Übergänge zwischen Kacheln, die nicht nebeneinander liegen (z. B. Haustür ↔ Innenbereich)
    look: dict[str, Any] | None = None     # Darstellung der Welt (Formen, Bäume, Deko), z. B. die Startwelt nach Mockup A; None = aus den Kacheln
    play_mode: Literal["leben", "gott"] = "gott"   # Spielart (AP18d): Leben = nur die Bewohner verändern die Welt, Gott = von außen; alte Spielstände gelten als Gott
    voices: dict[str, Voice] = {}        # eigene Stimmen der Figuren (AP17d); fehlt eine, gilt im Browser der Vorschlag aus Geschlecht und Alter


class DecisionBrief(Out):
    id: int
    sim_minute: int
    status: str
    chosen: str | None = None
    action: str | None = None
    intent: str | None = None
    outcome: str | None = None
    outcome_text: str | None = None
    options: list[dict[str, Any]] = []


class ObservationBrief(Out):
    sim_minute: int
    kind: str
    text: str
    importance: int


class AgentDetail(AgentInfo):
    profile_full: dict[str, Any] | None = None
    personality: dict[str, int] | None = None
    mood: str = ""
    decisions: list[DecisionBrief] = []
    observations: list[ObservationBrief] = []
    conversation: dict[str, Any] | None = None
    last_seen: dict[str, Any] = {}


class LocationDetail(Out):
    location: LocationInfo
    objects: list[ObjectInfo]
    resources: list[ResourceInfo]
    agents: list[str]
    recent_events: list[EventOut]


class EventsPage(Out):
    items: list[EventOut]
    last_seq: int


class EventDetail(Out):
    event: EventOut
    chain: list[EventOut]                 # auslösende Ereignisse von der Wurzel bis zum Vorgänger
    consequences: list[EventOut]          # Ereignisse, die dieses ausgelöst hat


class SimCommandResult(Out):
    state: str
    minute: int
    steps: int | None = None
    tick_delay_s: float | None = None
    speed_level: str | None = None
    backup: str | None = None


class StartRequest(BaseModel):
    ticks: int | None = Field(None, ge=1, le=100000)


class StepRequest(BaseModel):
    n: int = Field(1, ge=1, le=50)


class ResetRequest(BaseModel):
    confirm: bool = False
    model: str | None = None             # Modell der neuen Simulation (gilt für den ganzen Lauf)
    keep_profiles: bool = False          # Profile und Persönlichkeitswerte der Agenten behalten (sonst komplett Standard)
    play_mode: Literal["leben", "gott"] | None = None   # Spielart der neuen Simulation; ohne Angabe bleibt die bisherige


class PlayModeRequest(BaseModel):
    play_mode: Literal["leben", "gott"]
    confirm: bool = False


class SpeedRequest(BaseModel):
    level: Literal["0.5x", "1x", "2x", "4x", "max"] | None = None
    tick_delay_s: float | None = Field(None, ge=0, le=60)


# --- WebSocket ------------------------------------------------------------------------------------------
class WsHello(BaseModel):
    type: Literal["hello"]
    last_seq: int | None = None


class WsResync(BaseModel):
    type: Literal["resync"]
    last_seq: int | None = None


class WsPong(BaseModel):
    type: Literal["pong"]


class WsSnapshot(Out):
    type: Literal["snapshot"] = "snapshot"
    seq: int
    state: StateSnapshot


class WsEvents(Out):
    type: Literal["events"] = "events"
    items: list[EventOut]


class WsEvent(Out):
    type: Literal["event"] = "event"
    event: EventOut


class WsPing(Out):
    type: Literal["ping"] = "ping"


class WsClock(Out):
    """Uhrtakt ohne Speicherung und ohne Nummer, gedrosselt: hält Uhr und laufende Wege in der Oberfläche synchron."""
    type: Literal["clock"] = "clock"
    minute: int


class WsResyncRequired(Out):
    type: Literal["resync_required"] = "resync_required"
    reason: str = "backlog"


class WsClientMessage(BaseModel):
    message: WsHello | WsResync | WsPong


class WsServerMessage(BaseModel):
    message: WsSnapshot | WsEvents | WsEvent | WsPing | WsResyncRequired
