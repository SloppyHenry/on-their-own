"""Mitleben mit eigener Figur (AP18h): wer ist die Figur des Menschen, und entscheidet gerade das Modell für sie?

Zustand liegt im Spielstand: `meta.player` (Kennung oder fehlt) und `meta.player_autopilot` (bool). Beides kommt nie in einen Prompt, ein Ereignis mit Agenten
oder eine Erinnerung. Die eigene Figur gibt es nur in der Spielart „leben“; in „gott“ (auch nach einem Wechsel) ist sie ein normaler Bewohner, für den das Modell
entscheidet. Alte Spielstände ohne die Einträge verhalten sich wie bisher (kein Mensch, alle entscheiden das Modell).
"""

import time
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


# --- Takt (AP18h-a3) ----------------------------------------------------------------------------------------------------------------------------
HOLD_KEY, AUTO_KEY, AUTO_MIN_KEY, WAIT_KEY = "player_hold", "player_auto", "player_auto_minutes", "player_waiting"
REPLY_SECONDS = 60                      # so lange wartet ein Gespräch auf dich, mindestens (echte Sekunden, Frage 83)
AUTO_MINUTES = 5                        # Standard des Autopiloten in echten Minuten


def settings(state: Any) -> dict[str, Any]:
    """Schalter und Zustand des Taktes (alles im Spielstand)."""
    return {"player": player_id(state), "hold": bool(state.get_meta(HOLD_KEY, False)), "auto": bool(state.get_meta(AUTO_KEY, False)),
            "auto_minutes": int(state.get_meta(AUTO_MIN_KEY, AUTO_MINUTES) or AUTO_MINUTES), "autopilot": autopilot_on(state), "waiting": bool(state.get_meta(WAIT_KEY, False))}


def waiting_on(state: Any) -> bool:
    return bool(state.get_meta(WAIT_KEY, False))


class Takt:
    """Echte Zeit des Menschen: letzte Eingabe (für den Autopiloten) und Fristen offener Gespräche. Nur im Speicher; der Zustand selbst liegt im Spielstand."""

    def __init__(self) -> None:
        self.last_input = time.monotonic()
        self._seen: dict[int, tuple[int, float]] = {}
        self.waiting = False                # Spiegel von `meta.player_waiting` für die Schleife (keine Abfrage je Schritt)

    def touch(self, state: Any) -> bool:
        """Eingabe des Menschen: Autopilot aus, Warten beendet. Liefert, ob sich der Zustand geändert hat. Gehört auf den DB-Thread."""
        self.last_input, self.waiting = time.monotonic(), False
        changed = autopilot_on(state) or waiting_on(state)
        if changed:
            set_autopilot(state, False)
            state.set_meta(WAIT_KEY, False)
        return changed

    def autopilot_due(self, state: Any) -> bool:
        """Schaltet den Autopiloten ein, wenn er erlaubt ist und der Mensch lange nichts getan hat."""
        s = settings(state)
        if s["player"] is None or not s["auto"] or s["autopilot"] or time.monotonic() - self.last_input < s["auto_minutes"] * 60:
            return False
        set_autopilot(state, True)
        return True

    def protects(self, conv: Any, state: Any) -> bool:
        """Ein Gespräch mit dem Menschen endet nicht durch Stille, bevor `REPLY_SECONDS` echte Sekunden seit der letzten Äußerung vergangen sind."""
        pid = human_controlled(state)
        if pid is None or pid not in conv.participants:
            return False
        minute, at = self._seen.get(conv.id, (None, 0.0))
        if minute != conv.last_minute:
            at = time.monotonic()
            self._seen[conv.id] = (conv.last_minute, at)
        return time.monotonic() - at < REPLY_SECONDS

    def should_wait(self, state: Any, events: list[Any]) -> bool:
        """„Anhalten, wenn ich dran bin“: Figur frei und (jemand hat sie angesprochen oder ihre Handlung ist zu Ende) in diesem Schritt."""
        pid = human_controlled(state)
        body = state.agent(pid) if pid else None
        if body is None or body.action is not None or not state.get_meta(HOLD_KEY, False) or waiting_on(state):
            return False
        return any((e.type == "agent.dialogue" and e.data.get("to") == pid) or (e.type in ("agent.action_completed", "agent.action_interrupted") and e.agents and e.agents[0] == pid) for e in events)
