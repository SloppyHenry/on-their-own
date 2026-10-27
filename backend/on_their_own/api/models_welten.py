"""Modelle für die Weltenbibliothek und die Welt-Werkstatt (AP18e)."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from .models import Out
from .models_world import Stellgroessen


class WorldInfoOut(Out):
    """Karteikarte einer Welt (`info.json`)."""
    id: str
    name: str
    origin: str
    readonly: bool = False
    size: list[int]
    seed: int | None = None
    note: str = ""
    created: str
    changed: str
    startplatz: bool = False
    houses: int = 0
    locations: int = 0
    objects: int = 0
    lakes: int = 0


class WorldDoc(Out):
    info: WorldInfoOut
    world: dict[str, Any]


class BlankRequest(BaseModel):
    name: str = Field("Neue Welt", min_length=1, max_length=60)
    size: Literal["klein", "mittel", "gross"] = "mittel"
    edge: Literal["wald", "offen"] = "wald"


class GenerateWorldRequest(BaseModel):
    """Welt erzeugen (der Generator, nur beim Erschaffen): Seed, Seeufer, Gebäudemix."""
    name: str | None = Field(None, max_length=60)
    seed: int = Field(1, ge=0, le=2_000_000_000)
    lake: Literal["auto", "east", "south"] = "auto"
    mix: dict[str, int] | None = None
    style: Stellgroessen | None = None


class RenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class FromSimRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class SaveWorldRequest(BaseModel):
    world: dict[str, Any]


class CreateWorldRequest(BaseModel):
    """Speichern als: eine Weltdatei unter neuem Namen als eigene Welt ablegen (Herkunft Kopie)."""
    world: dict[str, Any]
    name: str = Field(min_length=1, max_length=60)


class PreviewWorldRequest(BaseModel):
    world: dict[str, Any]


class AddAreaRequest(BaseModel):
    """Gebiet erzeugen in der Werkstatt: ein weiteres Dorf an die Welt anfügen (der Generator als Werkzeug)."""
    world: dict[str, Any]
    at: list[int] | None = Field(None, min_length=2, max_length=2)          # linke obere Kachel des Gebiets; ohne Angabe wächst die Welt nach Süden
    seed: int = Field(1, ge=0, le=2_000_000_000)
    lake: Literal["auto", "east", "south"] = "auto"
    mix: dict[str, int] | None = None


class AddAreaOut(Out):
    ok: bool
    error: str | None = None
    village: str | None = None
    world: dict[str, Any] | None = None
    report: dict[str, Any] = {}
