"""Modelle für den Assistenten „Neue Simulation“ und die Vorlagen (AP17b): Entwurf, Vorschau, Ergebnis."""

from typing import Literal

from pydantic import BaseModel, Field

from ..agents.schema import MAX_RESIDENTS
from .models import Out, StateSnapshot, Voice
from .models_world import ReportOut

KNOWN = Literal["square", "garden", "rooms", "lake", "forest"]             # Orte, die ein Bewohner zu Beginn kennt (Platz, Garten, Gemeinschaftsräume, See, Wald)


class WorldSpec(BaseModel):
    """`start`: die handgemachte Startwelt (nur Alex und Mira), `generated`: ein Dorf für genau diese Bewohner, `library`: eine Welt aus der Weltenbibliothek."""
    kind: Literal["start", "generated", "library"] = "generated"
    library_id: str | None = Field(None, max_length=60)                    # Welt aus der Bibliothek (kind „library“, AP18e): wird kopiert, die Bibliothek bleibt unverändert
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


class StartEvent(BaseModel):
    """Ein Weltereignis zum Start (aus dem Textfeld „Weltregeln“): der geprüfte Vorschlag der Ereigniseingabe (AP08), nach der Vorschau bestätigt. Für die Bewohner ein natürlicher Vorgang."""
    text: str = Field(max_length=1000)
    source: Literal["rule", "llm"] = "rule"
    ops: list[dict]                                                        # 1 bis 5 Operationen (die Prüfung der Ereigniseingabe lehnt mehr ab)


class RulesSpec(BaseModel):
    """Regeln der neuen Simulation. Alles ist optional: ohne Angabe gelten die Einstellungen, wie sie sind (sie bleiben über eine neue Simulation erhalten)."""
    preset: str | None = None                                              # Preset (nur seine allgemeinen Werte; Werte je Bewohner stehen im Profil)
    autonomy: int | None = Field(None, ge=0, le=100)
    scarcity: int | None = Field(None, ge=0, le=100)
    mode: Literal["observer", "creator", "intervention"] = "observer"      # Beobachtungsmodus (Frage 36): Standard Beobachter
    creator_text: str | None = Field(None, max_length=600)
    events: list[StartEvent] = []                     # Startereignisse (Weltregeln als Text), werden gleich nach dem Anlegen ausgeführt


class NewSimRequest(BaseModel):
    world: WorldSpec = WorldSpec()
    residents: list[ResidentIn]                                             # 1 bis 8 (Prüfung in `newsim.resolve`)
    relations: list[RelationIn] = []
    stories: list[StoryIn] = []
    rules: RulesSpec = RulesSpec()
    model: str | None = Field(None, max_length=200)                        # Modell der neuen Simulation (gilt fest, Frage 10); ohne Angabe das bisherige
    run: Literal["paused", "running"] = "paused"
    play_mode: Literal["leben", "gott"] = "leben"                          # Spielart (AP18d): Leben ist der Standard für neue Simulationen


class RulesPreviewRequest(BaseModel):
    """Ein Satz der Weltregeln wie in der Ereigniseingabe: Text oder Antwort auf eine Rückfrage, im Entwurf (die Welt, auf die er sich bezieht)."""
    draft: NewSimRequest
    text: str = Field("", max_length=1000)
    answer_to: str | None = None
    answer: str | int | None = None


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
    warnings: list[str] = []


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
