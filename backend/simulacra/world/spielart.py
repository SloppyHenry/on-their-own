"""Spielart einer Simulation (AP18d): „leben“ (nur die Bewohner verändern die Welt) oder „gott“ (der Spieler verändert sie von außen).

Die Spielart gehört zum Spielstand (`meta.play_mode`). Alte Spielstände ohne den Eintrag gelten als „gott“, damit nichts verloren geht. Sie regelt nur, was der Spieler
von außen darf; die Bewohner erfahren nie davon (kein Prompt, keine Erinnerung, kein Ereignis mit Agenten).
"""

from typing import Any

PLAY_MODES = ("leben", "gott")
DEFAULT = "gott"


def get(state: Any) -> str:
    mode = state.get_meta("play_mode")
    return mode if mode in PLAY_MODES else DEFAULT


def set_mode(state: Any, mode: str) -> None:
    if mode not in PLAY_MODES:
        raise ValueError(f"Unbekannte Spielart '{mode}'.")
    state.set_meta("play_mode", mode)
