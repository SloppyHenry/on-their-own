"""Modelle der freien Ereigniseingabe (AP08)."""

from typing import Any

from pydantic import BaseModel, Field

from .models import Out


class InjectParseRequest(BaseModel):
    text: str = Field("", max_length=1200)
    agents: list[str] | None = None                 # vom Benutzer gewählte betroffene Figuren
    at: int | None = None                           # Zeitpunkt (Simulationsminute); leer = sofort
    answer_to: str | None = None                    # Antwort auf die Rückfrage dieser Eingabe
    answer: str | int | None = None


class InjectConfirmRequest(BaseModel):
    proposal_id: str


class ClarifyOption(Out):
    label: str
    value: str | int


class Clarification(Out):
    question: str
    options: list[ClarifyOption] = []
    op: int = 0
    field: str = ""
    free_text: bool = False


class InjectProposal(Out):
    id: str
    text: str
    status: str                                     # needs_clarification | ready | needs_confirmation | executed | rejected | cancelled
    source: str                                     # rule | llm
    ops: list[dict[str, Any]] = []
    preview: list[str] = []
    clarification: Clarification | None = None
    reason: str = ""
    mode: str
    needs_confirmation: bool = False
    directive: bool = False
    at_minute: int | None = None
    created: int
    executed: int | None = None
    event_seqs: list[int] = []


class ScheduledOut(Out):
    id: str
    minute: int
    text: str
    inject_id: str | None = None
