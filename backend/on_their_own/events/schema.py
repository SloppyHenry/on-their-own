"""Ereignis, wie API und Frontend es sehen (§12)."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from ..world import clock
from ..world.models import Event


class SimTime(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    day: int
    minute: int          # Minute des Tages (0-1439)
    total: int           # Minuten seit Beginn der Simulation


class EventOut(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    id: str
    seq: int
    ts: str
    sim_time: SimTime
    type: str
    category: Literal["world", "dialogue", "planning", "memory", "system"]
    agents: list[str] = []
    location: str | None = None
    data: dict[str, Any] = {}
    caused_by: str | None = None
    visibility: str = "public"


def to_out(e: Event) -> EventOut:
    return EventOut(id=e.event_id or f"evt_legacy_{e.seq}", seq=e.seq, ts=e.ts,
                    sim_time=SimTime(day=clock.day_of(e.sim_minute), minute=clock.minute_of_day(e.sim_minute), total=e.sim_minute),
                    type=e.type, category=e.category, agents=e.agents, location=e.location_id, data=e.data,
                    caused_by=e.caused_by, visibility=e.visibility)
