"""Modelle für den Assistenten „Neue Simulation“ und die Vorlagen (AP17b): Entwurf, Vorschau, Ergebnis."""

from typing import Literal

from pydantic import BaseModel, Field

from ..agents.schema import MAX_RESIDENTS
from .models import Out, StateSnapshot, Voice
from .models_world import ReportOut

KNOWN = Literal["square", "garden", "rooms", "lake", "forest"]             # Orte, die ein Bewohner zu Beginn kennt (Platz, Garten, Gemeinschaftsräume, See, Wald)


class WorldSpec(BaseModel):
    """`start`: die handgemachte Startwelt (nur Alex und Mira), `generated`: ein Dorf für genau diese Bewohner."""
    kind: Literal["start", "generated"] = "generated"
    seed: int = Field(1, ge=0, le=2_000_000_000)
    lake: Literal["auto", "east", "south"] = "auto"
    houses: int | None = Field(None, ge=1, le=6)                           # Wohnhäuser; ohne Angabe aufgerundet halb so viele wie Bewohner
    mix: dict[str, int] | None = None                                      # übrige Gebäude je Art (shop, workshop, barn, stable); ohne Angabe nach Bewohnerzahl


class ResidentIn(BaseModel):
    """Die Profilmaske eines Bewohners: dieselbe wie im Charaktereditor und in Vorlagen. Kein Feld für Steuerungsart oder Sonderstatus."""
    template: str | None = None                                            # Vorlage, aus der er stammt (bei der Startwelt: alex oder mira)
    profile: dict
    personality: dict
    home: int | None = Field(None, ge=1, le=6)                             # „wohnt schon in Haus N“ (nur erzeugtes Dorf); sonst sucht sich der Bewohner selbst eine Bleibe
    known: list[KNOWN] = ["square", "garden", "rooms"]
    voice: Voice | None = None


class RelationIn(BaseModel):
    """Startwerte der Beziehung von Bewohner `a` zu Bewohner `b` (Nummern in `residents`, ab 0)."""
    a: int = Field(ge=0, lt=MAX_RESIDENTS)
    b: int = Field(ge=0, lt=MAX_RESIDENTS)
    trust: float = Field(50, ge=0, le=100)
    sympathy: float = Field(50, ge=0, le=100)
    tension: float = Field(10, ge=0, le=100)
    familiarity: float = Field(30, ge=0, le=100)


class StoryIn(BaseModel):
    """Vorgeschichte eines Paares: wird bei beiden zu einer gewöhnlichen Erinnerung (Art Fakt)."""
    a: int = Field(ge=0, lt=MAX_RESIDENTS)
    b: int = Field(ge=0, lt=MAX_RESIDENTS)
    text: str = Field(max_length=2000)


class NewSimRequest(BaseModel):
    world: WorldSpec = WorldSpec()
    residents: list[ResidentIn] = Field(min_length=1, max_length=MAX_RESIDENTS)
    relations: list[RelationIn] = []
    stories: list[StoryIn] = []
    run: Literal["paused", "running"] = "paused"


class NewSimApplyRequest(NewSimRequest):
    digest: str = Field(max_length=32)                                      # Prüfsumme der Vorschau: nur was angeschaut wurde, wird angelegt
    confirm: bool = False


class ResidentOut(Out):
    id: str
    name: str
    home: int | None = None


class HouseOut(Out):
    n: int
    name: str
    beds: int


class NewSimPreview(Out):
    ok: bool
    errors: list[str] = []
    warnings: list[str] = []
    residents: list[ResidentOut] = []
    houses: list[HouseOut] = []
    report: ReportOut | None = None
    digest: str | None = None
    village: str | None = None
    seed: int | None = None
    counts: dict[str, int] = {}
    snapshot: StateSnapshot | None = None


class NewSimApplied(Out):
    village: str
    seed: int | None = None
    residents: list[ResidentOut] = []
    backup: str | None = None
    counts: dict[str, int] = {}
    state: str = "stopped"


class NewSimLimits(Out):
    max_residents: int
    seconds_per_decision: float
    max_per_house: int = 2


class TemplateOut(Out):
    id: str
    builtin: bool
    profile: dict
    personality: dict


class TemplateIn(BaseModel):
    profile: dict
    personality: dict


class TemplateImported(Out):
    template: TemplateOut
    warnings: list[str] = []
