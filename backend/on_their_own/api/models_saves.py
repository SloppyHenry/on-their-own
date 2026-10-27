"""Modelle für Spielstände und Statistik (AP09)."""

from typing import Any

from pydantic import BaseModel, Field

from .models import Out


class SaveOut(Out):
    id: str
    kind: str                                    # manual | auto | backup | import
    name: str
    description: str = ""
    sim_minute: int
    sim_label: str
    created: str
    app_version: str
    schema_version: int
    size: int
    model: str = ""
    available: bool = True


class SaveCreate(BaseModel):
    name: str = Field(max_length=120)
    description: str = Field("", max_length=300)
    overwrite: bool = False                      # nur mit ausdrücklicher Bestätigung: einen gleichnamigen manuellen Stand ersetzen


class SaveLoadRequest(BaseModel):
    confirm: bool = False


class ImportMeta(BaseModel):
    sha256: str = Field(max_length=64)           # Prüfsumme des hochgeladenen Inhalts (für die Idempotenz)


class ActionStat(Out):
    action: str
    started: int
    completed: int
    failed: int
    success_rate: float | None = None


class Rejection(Out):
    code: str
    text: str
    count: int


class ActionsOut(Out):
    by_action: list[ActionStat]
    completed: int
    failed: int
    success_rate: float | None = None
    top_rejections: list[Rejection]


class Keyword(Out):
    word: str
    count: int


class ConversationsOut(Out):
    count: int
    avg_turns: float | None = None
    proposals_accepted: int
    proposals_declined: int
    keywords: list[Keyword]


class PlaceTime(Out):
    location: str
    name: str
    minutes: int


class PlacesOut(Out):
    time_by_location: list[PlaceTime]
    discovered_locations: int
    discovered_objects: int


class DayCount(Out):
    day: int
    memories: int
    reflections: int


class LlmStats(Out):
    decisions: int
    valid: int
    fallback: int
    avg_latency_ms: int | None = None
    prompt_tokens: int
    completion_tokens: int
    corrections: int


class SeriesOut(Out):
    needs_mood: list[dict[str, float | int | None]]
    relations: dict[str, list[dict[str, float | int]]]


class AgentStats(Out):
    agent: str | None = None
    name: str
    actions: ActionsOut
    conversations: ConversationsOut
    places: PlacesOut
    memories_per_day: list[DayCount]
    llm: LlmStats
    series: SeriesOut


class StatsOut(Out):
    minute: int
    agents: list[AgentStats]
    total: AgentStats | None = None
    from_minute: int | None = None
    to_minute: int | None = None


def stats_out(raw: dict[str, Any]) -> StatsOut:
    raw = {**raw, "from_minute": raw.pop("from"), "to_minute": raw.pop("to")}
    return StatsOut(**raw)
