"""Modelle für den Weltgenerator in der Leitstelle (AP12c): Wunsch, Vorschau, Ergebnis."""

from typing import Literal

from pydantic import BaseModel, Field

from .models import Out, StateSnapshot


class GenerateRequest(BaseModel):
    """Was erzeugt werden soll. `extend`: ein weiteres Dorf an die laufende Welt, `new`: eine neue Simulation mit einem Dorf."""
    kind: Literal["extend", "new"] = "extend"
    seed: int = Field(1, ge=0, le=2_000_000_000)
    lake: Literal["auto", "east", "south"] = "auto"
    mix: dict[str, int] | None = None                 # Gebäude je Art (house, shop, workshop, barn, stable); ohne Angabe 3 Häuser und 2 Sondergebäude


class GenerateApplyRequest(GenerateRequest):
    digest: str = Field(max_length=32)                # Prüfsumme der Vorschau: nur was angeschaut wurde, wird übernommen
    confirm: bool = False
    keep_profiles: bool = False                       # nur `new`: Profile und Persönlichkeit der Figuren behalten


class PatchPreviewRequest(BaseModel):
    """Beliebiger Welt-Patch (Format: docs/welt-erweitern.md) für einen Trockenlauf, z. B. eine Einzeländerung des Editors."""
    patch: dict


class PatchPreview(Out):
    ok: bool
    error: str | None = None
    counts: dict[str, int] = {}
    snapshot: StateSnapshot | None = None


class CheckOut(Out):
    name: str
    ok: bool
    detail: str = ""


class ReportOut(Out):
    ok: bool
    errors: list[str] = []
    checks: list[CheckOut] = []


class GeneratePreview(Out):
    kind: str
    ok: bool                                          # Prüfung des Generators und Trockenlauf der Engine bestanden
    error: str | None = None
    report: ReportOut
    digest: str | None = None
    village: str | None = None
    seed: int | None = None                           # der Seed, der die Prüfung bestanden hat (kann vom gewünschten abweichen)
    focus: list[int] | None = None                    # Dorfplatz des neuen Dorfs (Kachel), dorthin fährt die Kamera
    region: str | None = None                         # Gebiet in `snapshot.look`, das neu ist
    counts: dict[str, int] = {}
    snapshot: StateSnapshot | None = None             # die Welt, wie sie nach dem Übernehmen aussähe (nur Ansicht, nichts davon ist angewendet)


class GenerateApplied(Out):
    kind: str
    village: str
    seed: int
    patch: str | None = None
    backup: str | None = None
    counts: dict[str, int] = {}
    focus: list[int] | None = None
