"""Weltregeln mit Grenzen. AP07 hängt hieran die Regler; die Engine liest nur dieses Objekt."""

from typing import Literal

from pydantic import BaseModel, Field


class WorldRules(BaseModel):
    resource_scarcity: float = Field(1.0, ge=0.1, le=3.0)       # skaliert Nachwuchs und Obergrenze
    resource_availability: float = Field(1.0, ge=0.0, le=2.0)   # skaliert nur die Obergrenzen je Ort
    gather_time_mult: float = Field(1.0, ge=0.25, le=4.0)
    build_cost_mult: float = Field(1.0, ge=0.25, le=4.0)
    build_duration_mult: float = Field(1.0, ge=0.25, le=4.0)
    max_objects: int = Field(150, ge=20, le=500)
    movement_blocked_locations: list[str] = []
    home_radius: int | None = Field(None, ge=3, le=64)           # Kacheln um das Zuhause; None = frei
    failure_penalty: Literal["none", "time", "energy"] = "time"
    failure_penalty_minutes: int = Field(1, ge=1, le=30)
    needs_enabled: bool = True
    energy_decay_per_hour: float = Field(3.0, ge=0, le=20)
    hunger_rise_per_hour: float = Field(3.0, ge=0, le=20)
    thirst_rise_per_hour: float = Field(4.0, ge=0, le=20)
    energy_per_tile: float = Field(0.05, ge=0, le=1)
    plant_hours_per_stage: float = Field(8.0, ge=1, le=48)
