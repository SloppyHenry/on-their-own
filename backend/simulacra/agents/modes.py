"""Beobachtungsmodi (§11): was die Agenten über den Benutzer erfahren.

- **Beobachter** (Standard): nichts. Vom Benutzer eingespielte Ereignisse erscheinen als natürliche Vorkommnisse (AP08).
- **Schöpfer**: der Systemprompt enthält einen editierbaren Abschnitt über eine äußere Instanz, die die Welt geschaffen hat.
- **Eingriff**: wie Beobachter; zusätzlich darf der Benutzer einzelnen Agenten direkte Nachrichten senden (AP08, gekennzeichnet zugestellt).

Ein Moduswechsel gilt ab der nächsten Entscheidung und ändert keine bestehenden Erinnerungen.
"""

from dataclasses import dataclass

MODES = ("observer", "creator", "intervention")
MODE_LABELS = {"observer": "Beobachter", "creator": "Schöpfer", "intervention": "Eingriff"}
DEFAULT_CREATOR_TEXT = ("Du weißt, dass diese Welt und ihre Bewohner von jemandem außerhalb geschaffen wurden, der gelegentlich zusieht und die Welt verändern kann. "
                        "Du darfst darüber nachdenken oder davon erzählen, musst es aber nicht.")


@dataclass
class ModeState:
    mode: str = "observer"
    creator_text: str = DEFAULT_CREATOR_TEXT

    def prompt_extra(self) -> str:
        """Zusatz für das Ende des Systemprompts (der stabile Teil davor bleibt gleich, der Prompt-Cache wirkt weiter)."""
        return self.creator_text.strip() if self.mode == "creator" else ""
