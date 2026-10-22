"""Mitleben mit eigener Figur (AP18h): wer ist die Figur des Menschen, und entscheidet gerade das Modell für sie?

Zustand liegt im Spielstand: `meta.player` (Kennung oder fehlt) und `meta.player_autopilot` (bool). Beides kommt nie in einen Prompt, ein Ereignis mit Agenten
oder eine Erinnerung. Die eigene Figur gibt es nur in der Spielart „leben“; in „gott“ (auch nach einem Wechsel) ist sie ein normaler Bewohner, für den das Modell
entscheidet. Alte Spielstände ohne die Einträge verhalten sich wie bisher (kein Mensch, alle entscheiden das Modell).
"""

from typing import Any

from ..world import spielart

PLAYER_KEY = "player"
AUTOPILOT_KEY = "player_autopilot"


def player_id(state: Any) -> str | None:
    """Kennung der vom Menschen gesteuerten Figur, nur in der Spielart „leben“ und nur, wenn der Bewohner existiert."""
    if spielart.get(state) != "leben":
        return None
    pid = state.get_meta(PLAYER_KEY)
    return pid if isinstance(pid, str) and pid and state.agent(pid) is not None else None


def set_player(state: Any, agent_id: str | None) -> None:
    """Wählt die eigene Figur (None: keine). Schaltet den Autopilot aus, weil ein Wechsel eine neue Steuerung beginnt."""
    if agent_id is not None and state.agent(agent_id) is None:
        raise ValueError(f"Unbekannter Bewohner '{agent_id}'.")
    state.set_meta(PLAYER_KEY, agent_id)
    state.set_meta(AUTOPILOT_KEY, False)


def autopilot_on(state: Any) -> bool:
    return bool(state.get_meta(AUTOPILOT_KEY, False))


def set_autopilot(state: Any, on: bool) -> None:
    state.set_meta(AUTOPILOT_KEY, bool(on))


def human_controlled(state: Any) -> str | None:
    """Die Figur, für die das Modell gerade **nicht** entscheidet (eigene Figur ohne laufenden Autopilot), sonst None."""
    pid = player_id(state)
    return pid if pid is not None and not autopilot_on(state) else None
