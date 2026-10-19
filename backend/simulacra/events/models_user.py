"""Datenmodelle der Ereignisse aus der freien Eingabe (AP08)."""

from typing import Any

from .models import D


class EventInjected(D):
    inject_id: str
    text: str
    source: str                          # rule | llm
    mode: str
    directive: bool = False              # enthält direkte Anweisungen an Agenten (nur im Eingriffsmodus)
    summary: list[str] = []              # Klartext der ausgeführten Operationen
    ops: list[dict[str, Any]] = []


class EventScheduled(D):
    inject_id: str | None = None
    scheduled_id: str
    at: int
    text: str


class EventFired(D):
    scheduled_id: str
    kind: str                            # fire | revert
    text: str


class EffectEnded(D):
    what: str
    text: str


class Informed(D):
    """Eine Information, Nachricht, Einladung oder Situation erreicht genau die Empfänger in `agents`."""
    kind: str                            # inform | message | invite | situation | suggestion
    content: str
    sender: str = ""                     # Absender oder Quelle in Worten („ein Brief“, „Alex“, „eine Stimme von außen“)
    truth: str = "true"                  # true | rumor | false (nur für den Beobachter im Protokoll, der Empfänger weiß es nicht)
    when: int | None = None
    where: str | None = None
    about: list[str] = []                # genannte Figuren (für den Abruf im Gedächtnis)
    inject_id: str | None = None


class NpcAction(D):
    npc: str
    what: str


class VoiceChanged(D):
    agent: str
    voice: dict[str, Any] | None = None   # None: zurück zum Vorschlag aus Geschlecht und Alter


class SimSaved(D):
    save_id: str
    name: str
    kind: str                            # manual | auto | backup | import
    minute: int


class SimLoaded(D):
    save_id: str | None = None
    name: str
    minute: int
    backup: str | None = None            # Sicherung des vorherigen Stands („Vor dem Laden“)
