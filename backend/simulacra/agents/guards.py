"""Schutzmechanismen (§15): wiederholte Aktionen, Gesprächsschleifen, festgefahrene Pläne, Fehlschlag-Historie, Ruhemodus.

Jede Auslösung wird als `agent.guard_triggered` gemeldet und ist damit im Protokoll nachvollziehbar.
"""

import json
from dataclasses import dataclass
from typing import Any

from ..world.engine import WorldEngine
from ..world.models import Event
from .scoring import Option


@dataclass
class GuardParams:
    repeat_window: int = 6              # so viele letzte Entscheidungen werden betrachtet
    repeat_limit: int = 3               # gleiche Aktion + Ziel so oft: Sperre
    lock_minutes: int = 60
    fallback_limit: int = 3             # unbrauchbare Antworten in Folge: Ruhemodus
    rest_minutes: int = 30
    abandon_limit: int = 3              # so viele aufgegebene Ziele in Folge: Ruhemodus


class Guards:
    def __init__(self, engine: WorldEngine, params: GuardParams | None = None):
        self.engine, self.params = engine, params or GuardParams()
        self.rest_until: dict[str, int] = {}
        self.fallbacks: dict[str, int] = {}

    @property
    def conn(self):
        return self.engine.state.conn

    def _emit(self, agent_id: str, guard: str, detail: str, key: str | None = None, until: int | None = None) -> None:
        loc = self.engine.state.agent(agent_id).location_id if self.engine.state.agent(agent_id) else None
        self.engine.emit_event("agent.guard_triggered", [agent_id], loc, {"guard": guard, "detail": detail, "key": key, "until": until})

    # --- Fehlschlag-Historie ---------------------------------------------------------------------------------
    def log_failure(self, agent_id: str, minute: int, action: str, params: dict[str, Any], code: str, text: str, context: dict[str, Any], event_seq: int | None) -> None:
        self.conn.execute("INSERT INTO failed_actions(agent_id, sim_minute, action, params, code, text, context, event_seq) VALUES(?,?,?,?,?,?,?,?)",
                          (agent_id, minute, action, json.dumps(params, ensure_ascii=False), code, text, json.dumps(context, ensure_ascii=False), event_seq))

    def failures(self, agent_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM failed_actions WHERE agent_id=? ORDER BY id DESC LIMIT ?", (agent_id, limit)).fetchall()
        return [dict(r) | {"params": json.loads(r["params"]), "context": json.loads(r["context"])} for r in rows]

    # --- Wiederholung ------------------------------------------------------------------------------------------
    def locks(self, agent_id: str, minute: int) -> dict[str, int]:
        return {r["key"]: r["until"] for r in self.conn.execute("SELECT key, until FROM action_locks WHERE agent_id=? AND until>?", (agent_id, minute)).fetchall()}

    def check_repetition(self, agent_id: str, chosen: Option | None, minute: int, recent: list[dict[str, Any]]) -> bool:
        """Gleiche Aktion mit gleichem Ziel `repeat_limit`-mal in den letzten Entscheidungen: Sperre für `lock_minutes`."""
        if chosen is None or chosen.kind in ("wait", "reply", "end_talk", "accept", "decline", "speak"):
            return False
        same = 1 + sum(1 for r in recent[: self.params.repeat_window - 1] if r["action"] + ":" + ",".join(f"{k}={v}" for k, v in sorted(r["params"].items()) if k != "text") == chosen.key)
        if same < self.params.repeat_limit:
            return False
        until = minute + self.params.lock_minutes
        self.conn.execute("INSERT OR REPLACE INTO action_locks(agent_id, key, until, reason) VALUES(?,?,?,?)", (agent_id, chosen.key, until, "wiederholt"))
        self._emit(agent_id, "wiederholung", f"Dieselbe Aktion {same}× in Folge: «{chosen.label}» wird {self.params.lock_minutes} Minuten gesperrt.", chosen.key, until)
        return True

    # --- Gespräch ------------------------------------------------------------------------------------------------
    def on_events(self, events: list[Event]) -> None:
        for ev in events:
            if ev.type == "agent.conversation_ended" and ev.data.get("reason") == "repetition":
                for a in ev.data["participants"]:
                    self._emit(a, "gesprächsschleife", "Das Gespräch wurde beendet, weil es sich nur noch wiederholte.")

    # --- Ruhemodus -----------------------------------------------------------------------------------------------
    def note_decision(self, agent_id: str, status: str) -> bool:
        """Zählt unbrauchbare Antworten in Folge; gibt True zurück, wenn der Ruhemodus ausgelöst werden soll."""
        self.fallbacks[agent_id] = self.fallbacks.get(agent_id, 0) + 1 if status == "fallback" else 0
        return self.fallbacks[agent_id] >= self.params.fallback_limit

    def start_rest(self, agent_id: str, minute: int, reason: str) -> None:
        until = minute + self.params.rest_minutes
        self.rest_until[agent_id] = until
        self.fallbacks[agent_id] = 0
        self._emit(agent_id, "ruhemodus", f"Ruhemodus für {self.params.rest_minutes} Minuten: {reason}", None, until)

    def resting(self, agent_id: str, minute: int) -> bool:
        return self.rest_until.get(agent_id, 0) > minute
