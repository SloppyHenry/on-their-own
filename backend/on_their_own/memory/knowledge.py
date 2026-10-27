"""Wissen eines Agenten über Orte und Gegenstände, Abrufprotokoll und Reflexionszustand. Jede Methode verlangt `agent_id`."""

import json
from typing import Any

from ..world.state import WorldState


class KnowledgeStore:
    def __init__(self, state: WorldState):
        self.state = state

    @property
    def conn(self):
        return self.state.conn

    # --- Gegenstände: was der Agent zuletzt gesehen hat (kann veraltet sein, das ist gewollt) -------------------
    def note_object(self, agent_id: str, object_id: str, name: str, kind: str, note: str, location_id: str | None, minute: int) -> bool:
        """Schreibt nur bei Änderung. Gibt zurück, ob sich etwas geändert hat."""
        r = self.conn.execute("SELECT note, location_id FROM known_objects WHERE agent_id=? AND object_id=?", (agent_id, object_id)).fetchone()
        if r and r["note"] == note and r["location_id"] == location_id:
            return False
        self.conn.execute("INSERT INTO known_objects(agent_id, object_id, name, kind, note, location_id, seen_at) VALUES(?,?,?,?,?,?,?) "
                          "ON CONFLICT(agent_id, object_id) DO UPDATE SET name=excluded.name, kind=excluded.kind, note=excluded.note, "
                          "location_id=excluded.location_id, seen_at=excluded.seen_at", (agent_id, object_id, name, kind, note, location_id, minute))
        return True

    def objects(self, agent_id: str) -> list[dict[str, Any]]:
        return [dict(r) for r in self.conn.execute("SELECT object_id, name, kind, note, location_id, seen_at FROM known_objects WHERE agent_id=? "
                                                   "ORDER BY seen_at DESC", (agent_id,)).fetchall()]

    # --- Orte -----------------------------------------------------------------------------------------
    def note_location(self, agent_id: str, location_id: str, minute: int, visit: bool = False) -> None:
        self.conn.execute("INSERT INTO known_locations(agent_id, location_id, discovered_at, visits, last_visit) VALUES(?,?,?,?,?) "
                          "ON CONFLICT(agent_id, location_id) DO UPDATE SET visits=visits+?, last_visit=CASE WHEN ? THEN ? ELSE last_visit END",
                          (agent_id, location_id, minute, int(visit), minute if visit else None, int(visit), int(visit), minute))

    def locations(self, agent_id: str) -> list[dict[str, Any]]:
        return [dict(r) for r in self.conn.execute("SELECT location_id, discovered_at, visits, last_visit FROM known_locations WHERE agent_id=? "
                                                   "ORDER BY discovered_at", (agent_id,)).fetchall()]

    # --- Abrufprotokoll ---------------------------------------------------------------------------------
    def log_retrieval(self, agent_id: str, minute: int, query: str, items: list[dict[str, Any]], tokens: int) -> int:
        cur = self.conn.execute("INSERT INTO retrievals(agent_id, sim_minute, query, items, tokens) VALUES(?,?,?,?,?)",
                                (agent_id, minute, query, json.dumps(items, ensure_ascii=False), tokens))
        return cur.lastrowid

    def link_decision(self, agent_id: str, retrieval_id: int, decision_id: int) -> None:
        self.conn.execute("UPDATE retrievals SET decision_id=? WHERE agent_id=? AND id=?", (decision_id, agent_id, retrieval_id))

    def retrievals(self, agent_id: str, limit: int = 30) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT id, sim_minute, decision_id, query, items, tokens FROM retrievals WHERE agent_id=? ORDER BY id DESC LIMIT ?",
                                 (agent_id, limit)).fetchall()
        return [dict(r) | {"items": json.loads(r["items"])} for r in rows]

    def retrievals_of(self, agent_id: str, memory_id: str, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT r.id, r.sim_minute, r.decision_id, r.items FROM retrievals r, json_each(r.items) j "
                                 "WHERE r.agent_id=? AND json_extract(j.value, '$.id')=? ORDER BY r.id DESC LIMIT ?", (agent_id, memory_id, limit)).fetchall()
        out = []
        for r in rows:
            item = next((i for i in json.loads(r["items"]) if i["id"] == memory_id), {})
            out.append({"id": r["id"], "sim_minute": r["sim_minute"], "decision_id": r["decision_id"], "score": item.get("score")})
        return out

    # --- Reflexionszustand ------------------------------------------------------------------------------------
    def state_of(self, agent_id: str) -> dict[str, Any]:
        self.conn.execute("INSERT OR IGNORE INTO memory_state(agent_id) VALUES(?)", (agent_id,))
        return dict(self.conn.execute("SELECT * FROM memory_state WHERE agent_id=?", (agent_id,)).fetchone())

    def add_importance(self, agent_id: str, amount: int) -> None:
        self.state_of(agent_id)
        self.conn.execute("UPDATE memory_state SET importance_since_reflection=importance_since_reflection+? WHERE agent_id=?", (amount, agent_id))

    def mark_reflected(self, agent_id: str, minute: int, day: int) -> None:
        self.state_of(agent_id)
        self.conn.execute("UPDATE memory_state SET importance_since_reflection=0, last_reflection_minute=?, last_reflection_day=? WHERE agent_id=?",
                          (minute, day, agent_id))

    def mark_summarized(self, agent_id: str, day: int) -> None:
        self.state_of(agent_id)
        self.conn.execute("UPDATE memory_state SET last_summary_day=? WHERE agent_id=?", (day, agent_id))

    def set_last_plan(self, agent_id: str, plan: str) -> None:
        self.state_of(agent_id)
        self.conn.execute("UPDATE memory_state SET last_plan=? WHERE agent_id=?", (plan, agent_id))
