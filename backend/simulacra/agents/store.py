"""Datenbankzugriff der Agenten: Profile, Laufzeit, Beobachtungen, Entscheidungsprotokoll.

Alle Aufrufe gehören auf den Schreib-Thread der Datenbank (`db.run`), wie die Engine selbst.
"""

import json
from typing import Any

from ..world.state import WorldState
from .model import AgentModel, AgentProfile, Personality, load_default


class AgentStore:
    def __init__(self, state: WorldState):
        self.state = state

    @property
    def conn(self):
        return self.state.conn

    # --- Profile ---------------------------------------------------------------------------
    def ensure(self, agent_id: str) -> AgentModel | None:
        """Lädt das Profil; legt es aus den Startwerten an, wenn es noch fehlt. Ohne Startwerte: None (kein KI-Agent)."""
        existing = self.get(agent_id)
        if existing is not None:
            return existing
        try:
            profile, personality = load_default(agent_id)
        except FileNotFoundError:
            return None
        with self.state.db.transaction() as c:
            c.execute("INSERT INTO agent_profiles(agent_id, profile, personality, updated_at) VALUES(?,?,?,?)",
                      (agent_id, profile.model_dump_json(), personality.model_dump_json(), self.state.minute))
            c.execute("INSERT OR IGNORE INTO agent_runtime(agent_id) VALUES(?)", (agent_id,))
            for place in profile.known_places:
                if place in self.state.locations:
                    self.state.mark_discovered(place, agent_id)
        return self.get(agent_id)

    def ensure_all(self) -> list[str]:
        return [a.id for a in self.state.agents() if self.ensure(a.id) is not None]

    def get(self, agent_id: str) -> AgentModel | None:
        r = self.conn.execute("SELECT p.*, r.status, r.plan_next, r.plan_minute, r.last_decision_minute FROM agent_profiles p "
                              "LEFT JOIN agent_runtime r ON r.agent_id = p.agent_id WHERE p.agent_id=?", (agent_id,)).fetchone()
        if r is None:
            return None
        return AgentModel(id=agent_id, profile=AgentProfile(**json.loads(r["profile"])), personality=Personality(**json.loads(r["personality"])),
                          status=r["status"] or "idle", plan_next=r["plan_next"] or "", plan_minute=r["plan_minute"],
                          last_decision_minute=r["last_decision_minute"])

    def ai_agent_ids(self) -> list[str]:
        return [r["agent_id"] for r in self.conn.execute("SELECT agent_id FROM agent_profiles ORDER BY agent_id")]

    def save_profile(self, agent_id: str, profile: AgentProfile, personality: Personality) -> None:
        self.conn.execute("UPDATE agent_profiles SET profile=?, personality=?, updated_at=? WHERE agent_id=?",
                          (profile.model_dump_json(), personality.model_dump_json(), self.state.minute, agent_id))

    # --- Laufzeit ----------------------------------------------------------------------------
    def set_status(self, agent_id: str, status: str) -> None:
        self.conn.execute("UPDATE agent_runtime SET status=? WHERE agent_id=?", (status, agent_id))

    def set_plan(self, agent_id: str, text: str) -> None:
        self.conn.execute("UPDATE agent_runtime SET plan_next=?, plan_minute=? WHERE agent_id=?", (text.strip(), self.state.minute, agent_id))

    def mark_decided(self, agent_id: str) -> None:
        self.conn.execute("UPDATE agent_runtime SET last_decision_minute=? WHERE agent_id=?", (self.state.minute, agent_id))

    def note_seen(self, agent_id: str, other_id: str, location_id: str, minute: int) -> None:
        r = self.conn.execute("SELECT last_seen FROM agent_runtime WHERE agent_id=?", (agent_id,)).fetchone()
        seen = json.loads(r["last_seen"]) if r else {}
        if seen.get(other_id, {}).get("loc") != location_id or seen.get(other_id, {}).get("minute", -99) < minute - 5:
            seen[other_id] = {"loc": location_id, "minute": minute}
            self.conn.execute("UPDATE agent_runtime SET last_seen=? WHERE agent_id=?", (json.dumps(seen), agent_id))

    def last_seen(self, agent_id: str) -> dict[str, dict]:
        r = self.conn.execute("SELECT last_seen FROM agent_runtime WHERE agent_id=?", (agent_id,)).fetchone()
        return json.loads(r["last_seen"]) if r else {}

    # --- Beobachtungen (Kurzzeitspeicher; vollständige Historie bleibt erhalten, abgefragt werden die letzten N) ----------
    def add_observation(self, agent_id: str, minute: int, kind: str, text: str, importance: int = 3, event_seq: int | None = None) -> None:
        self.conn.execute("INSERT INTO observations(agent_id, sim_minute, kind, text, importance, event_seq) VALUES(?,?,?,?,?,?)",
                          (agent_id, minute, kind, text, importance, event_seq))

    def recent_observations(self, agent_id: str, n: int) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT id, sim_minute, kind, text, importance FROM observations WHERE agent_id=? ORDER BY id DESC LIMIT ?",
                                 (agent_id, n)).fetchall()
        return [dict(r) for r in reversed(rows)]

    # --- Entscheidungsprotokoll ----------------------------------------------------------------------
    def log_decision(self, d: dict[str, Any]) -> int:
        cols = ("sim_minute", "agent_id", "status", "options", "chosen", "action", "params", "intent", "importance", "utterance", "plan_next",
                "attempts", "latency_ms", "prompt_tokens", "completion_tokens", "error", "outcome", "outcome_text", "event_seq")
        vals = [json.dumps(d.get(c), ensure_ascii=False) if c in ("options", "params") else d.get(c) for c in cols]
        cur = self.conn.execute(f"INSERT INTO decisions({','.join(cols)}) VALUES({','.join('?' * len(cols))})", vals)
        return cur.lastrowid

    def set_decision_outcome(self, decision_id: int, outcome: str, text: str | None, event_seq: int | None) -> None:
        self.conn.execute("UPDATE decisions SET outcome=?, outcome_text=?, event_seq=? WHERE id=?", (outcome, text, event_seq, decision_id))

    def decisions(self, agent_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        q, args = "SELECT * FROM decisions", []
        if agent_id:
            q, args = q + " WHERE agent_id=?", [agent_id]
        rows = self.conn.execute(q + " ORDER BY id DESC LIMIT ?", args + [limit]).fetchall()
        return [dict(r) | {"options": json.loads(r["options"]), "params": json.loads(r["params"]) if r["params"] else None} for r in rows]

    def recent_actions(self, agent_id: str, n: int = 8) -> list[dict[str, Any]]:
        """Zuletzt abgeschlossene Aktionen (neueste zuerst), Grundlage der Wiederholungserkennung."""
        rows = self.conn.execute("SELECT sim_minute, action, params FROM action_log WHERE actor=? AND outcome='completed' ORDER BY id DESC LIMIT ?",
                                 (agent_id, n)).fetchall()
        return [{"minute": r["sim_minute"], "action": r["action"], "params": json.loads(r["params"])} for r in rows]
