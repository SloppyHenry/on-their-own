"""Persistenz der Erinnerungen. **Jede Methode verlangt `agent_id` und filtert danach**: ein Agent kann nie ein fremdes Gedächtnis lesen.

Alle Aufrufe gehören auf den Schreib-Thread der Datenbank (wie die Engine).
"""

import json
from typing import Any

from ..events.ulid import new_ulid
from ..world.state import WorldState
from .models import Memory

_COLS = ("id, agent_id, kind, text, keywords, persons, location_id, importance, shared, sim_created, sim_last_access, access_count, "
         "source_event_id, source_memory_ids, status, intention_state, intention_due")
SORTS = {"time": "sim_created DESC, rowid DESC", "importance": "importance DESC, sim_created DESC", "access": "access_count DESC, sim_created DESC"}


def _memory(r) -> Memory:
    return Memory(id=r["id"], agent_id=r["agent_id"], kind=r["kind"], text=r["text"], keywords=r["keywords"].split(), persons=json.loads(r["persons"]),
                  location_id=r["location_id"], importance=r["importance"], shared=bool(r["shared"]), sim_created=r["sim_created"],
                  sim_last_access=r["sim_last_access"], access_count=r["access_count"], source_event_id=r["source_event_id"],
                  source_memory_ids=json.loads(r["source_memory_ids"]), status=r["status"], intention_state=r["intention_state"], intention_due=r["intention_due"])


class MemoryStore:
    def __init__(self, state: WorldState):
        self.state = state

    @property
    def conn(self):
        return self.state.conn

    # --- Schreiben ----------------------------------------------------------------------------
    def add(self, agent_id: str, kind: str, text: str, importance: int, minute: int, *, keywords: list[str] | None = None, persons: list[str] | None = None,
            location_id: str | None = None, shared: bool = False, source_event_id: str | None = None, source_memory_ids: list[str] | None = None,
            intention_state: str | None = None, intention_due: int | None = None) -> Memory:
        mid = "mem_" + new_ulid()
        self.conn.execute(
            "INSERT INTO memories(id, agent_id, kind, text, keywords, persons, location_id, importance, shared, sim_created, source_event_id, "
            "source_memory_ids, intention_state, intention_due) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (mid, agent_id, kind, text, " ".join(keywords or []), json.dumps(persons or []), location_id, max(1, min(10, int(importance))), int(shared), minute,
             source_event_id, json.dumps(source_memory_ids or []), intention_state, intention_due))
        return self.get(agent_id, mid)  # type: ignore[return-value]

    def touch(self, agent_id: str, ids: list[str], minute: int) -> None:
        for mid in ids:
            self.conn.execute("UPDATE memories SET sim_last_access=?, access_count=access_count+1 WHERE agent_id=? AND id=?", (minute, agent_id, mid))

    def set_status(self, agent_id: str, ids: list[str], status: str) -> None:
        for mid in ids:
            self.conn.execute("UPDATE memories SET status=? WHERE agent_id=? AND id=?", (status, agent_id, mid))

    def set_intention(self, agent_id: str, mid: str, state: str) -> None:
        self.conn.execute("UPDATE memories SET intention_state=? WHERE agent_id=? AND id=?", (state, agent_id, mid))

    # --- Lesen ------------------------------------------------------------------------------------
    def get(self, agent_id: str, mid: str) -> Memory | None:
        r = self.conn.execute(f"SELECT {_COLS} FROM memories WHERE agent_id=? AND id=?", (agent_id, mid)).fetchone()
        return _memory(r) if r else None

    def get_many(self, agent_id: str, ids: list[str]) -> list[Memory]:
        if not ids:
            return []
        rows = self.conn.execute(f"SELECT {_COLS} FROM memories WHERE agent_id=? AND id IN ({','.join('?' * len(ids))})", [agent_id, *ids]).fetchall()
        by_id = {r["id"]: _memory(r) for r in rows}
        return [by_id[i] for i in ids if i in by_id]

    def list(self, agent_id: str, *, kind: str | None = None, status: str | None = None, q: str | None = None, person: str | None = None,
             location: str | None = None, sort: str = "time", limit: int = 50, offset: int = 0) -> tuple[list[Memory], int]:
        where, args = ["agent_id=?"], [agent_id]
        for col, val in (("kind", kind), ("status", status), ("location_id", location)):
            if val:
                where.append(f"{col}=?")
                args.append(val)
        if person:
            where.append("EXISTS (SELECT 1 FROM json_each(memories.persons) WHERE value=?)")
            args.append(person)
        if q:
            where.append("(text LIKE ? OR keywords LIKE ?)")
            args += [f"%{q}%", f"%{q}%"]
        cond = " AND ".join(where)
        total = self.conn.execute(f"SELECT COUNT(*) FROM memories WHERE {cond}", args).fetchone()[0]
        rows = self.conn.execute(f"SELECT {_COLS} FROM memories WHERE {cond} ORDER BY {SORTS.get(sort, SORTS['time'])} LIMIT ? OFFSET ?",
                                 args + [limit, offset]).fetchall()
        return [_memory(r) for r in rows], total

    def search(self, agent_id: str, match: str, limit: int) -> list[tuple[Memory, float]]:
        """Stichwortsuche (FTS5) in den aktiven Erinnerungen dieses Agenten; Rang: größer = besser."""
        rows = self.conn.execute(
            f"SELECT {', '.join('m.' + c.strip() for c in _COLS.split(','))}, bm25(memories_fts, 0.0, 1.0) AS rank FROM memories_fts "
            "JOIN memories m ON m.rowid = memories_fts.rowid WHERE memories_fts MATCH ? AND m.agent_id=? AND m.status='active' ORDER BY rank LIMIT ?",
            (match, agent_id, limit)).fetchall()
        return [(_memory(r), -float(r["rank"])) for r in rows]

    def related(self, agent_id: str, persons: list[str], location_id: str | None, limit: int) -> list[Memory]:
        """Aktive Erinnerungen mit passender Person oder passendem Ort (unabhängig von Stichwörtern)."""
        where, args = [], []
        for p in persons:
            where.append("EXISTS (SELECT 1 FROM json_each(memories.persons) WHERE value=?)")
            args.append(p)
        if location_id:
            where.append("location_id=?")
            args.append(location_id)
        if not where:
            return []
        rows = self.conn.execute(f"SELECT {_COLS} FROM memories WHERE agent_id=? AND status='active' AND ({' OR '.join(where)}) "
                                 "ORDER BY importance DESC, sim_created DESC LIMIT ?", [agent_id, *args, limit]).fetchall()
        return [_memory(r) for r in rows]

    def pinned(self, agent_id: str, limit: int = 8) -> list[Memory]:
        """Offene Vorhaben und jüngste Reflexionen: sie werden bevorzugt."""
        rows = self.conn.execute(
            f"SELECT {_COLS} FROM memories WHERE agent_id=? AND status='active' AND (kind='reflection' OR (kind='intention' AND intention_state='open')) "
            "ORDER BY sim_created DESC LIMIT ?", (agent_id, limit)).fetchall()
        return [_memory(r) for r in rows]

    def recent(self, agent_id: str, *, kinds: tuple[str, ...] | None = None, min_importance: int = 1, limit: int = 20, status: str = "active") -> list[Memory]:
        q, args = f"SELECT {_COLS} FROM memories WHERE agent_id=? AND status=? AND importance>=?", [agent_id, status, min_importance]
        if kinds:
            q += f" AND kind IN ({','.join('?' * len(kinds))})"
            args += list(kinds)
        return [_memory(r) for r in self.conn.execute(q + " ORDER BY sim_created DESC, rowid DESC LIMIT ?", args + [limit]).fetchall()]

    def episodes_of_day(self, agent_id: str, day: int) -> list[Memory]:
        lo, hi = (day - 1) * 1440, day * 1440
        rows = self.conn.execute(f"SELECT {_COLS} FROM memories WHERE agent_id=? AND kind IN ('episode','fact','relation') AND status='active' "
                                 "AND sim_created>=? AND sim_created<? ORDER BY sim_created", (agent_id, lo, hi)).fetchall()
        return [_memory(r) for r in rows]

    def count(self, agent_id: str, status: str = "active") -> int:
        return self.conn.execute("SELECT COUNT(*) FROM memories WHERE agent_id=? AND status=?", (agent_id, status)).fetchone()[0]

    def stats(self, agent_id: str) -> dict[str, Any]:
        rows = self.conn.execute("SELECT kind, status, COUNT(*) AS n FROM memories WHERE agent_id=? GROUP BY kind, status", (agent_id,)).fetchall()
        return {f"{r['kind']}/{r['status']}": r["n"] for r in rows}
