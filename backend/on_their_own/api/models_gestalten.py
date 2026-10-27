"""Modelle für das Gestalten (AP16a): Entwurf = Liste von Aktionen, Vorschau, Prüfbericht, Übernehmen."""

from typing import Any

from pydantic import BaseModel, Field

from .models import Out, StateSnapshot


class AktionStatus(Out):
    ok: bool
    grund: str | None = None                          # warum die Aktion nicht geht (für den Cursor)
    ort: list[int] | None = None                      # Kachel, an der es hakt


class Meldung(Out):
    stufe: str                                        # ok, hinweis, fehler (✓, !, ✗)
    text: str
    ort: list[int] | None = None


class DraftRequest(BaseModel):
    actions: list[dict[str, Any]] = Field(max_length=200)


class DraftApplyRequest(DraftRequest):
    digest: str = Field(max_length=32)
    confirm: bool = False


class DraftPreview(Out):
    ok: bool                                          # keine abgelehnte Aktion, kein ✗ und der Trockenlauf der Engine ging durch
    error: str | None = None
    digest: str | None = None
    stati: list[AktionStatus] = []
    meldungen: list[Meldung] = []
    fehler: int = 0
    hinweise: int = 0
    counts: dict[str, int] = {}
    snapshot: StateSnapshot | None = None             # die Welt, wie sie nach dem Übernehmen aussähe (nur Ansicht)


class DraftApplied(Out):
    patch: str
    backup: str | None = None
    counts: dict[str, int] = {}
    actions: int


class FileDraftRequest(BaseModel):
    """Werkstatt: Weltdatei und Aktionen seit dem letzten Speichern → neue Weltdatei, Prüfbericht, auf Wunsch Zustandsabzug."""
    world: dict[str, Any]
    actions: list[dict[str, Any]] = Field(max_length=200)
    snapshot: bool = False


class FileDraft(Out):
    ok: bool                                          # kein ✗ in der Prüfung und keine abgelehnte Aktion
    spielbar: bool                                    # kein ✗: „Damit spielen“ ist erlaubt (Speichern geht immer)
    digest: str
    stati: list[AktionStatus] = []
    meldungen: list[Meldung] = []
    fehler: int = 0
    hinweise: int = 0
    world: dict[str, Any]
    snapshot: StateSnapshot | None = None
