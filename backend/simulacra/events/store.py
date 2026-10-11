"""Lesender Zugriff auf gespeicherte Ereignisse: Verlauf mit Filtern, Einzelereignis, Ursachenkette."""

import sqlite3
from typing import Literal

from ..world.events import row_to_event
from ..world.models import Event

SELECT = "SELECT e.*, p.event_id AS parent_event_id FROM events e LEFT JOIN events p ON p.seq = e.parent_seq"


class EventStore:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def _events(self, sql: str, args: list) -> list[Event]:
        return [row_to_event(r, r["parent_event_id"]) for r in self.conn.execute(sql, args)]

    def last_seq(self) -> int:
        return self.conn.execute("SELECT COALESCE(MAX(seq), 0) FROM events").fetchone()[0]

    def fetch(self, after_seq: int = 0, before_seq: int | None = None, type: str | None = None, type_prefix: str | None = None,
              agent: str | None = None, category: str | None = None, location: str | None = None, limit: int = 200,
              order: Literal["asc", "desc"] = "asc") -> list[Event]:
        where, args = ["e.seq > ?"], [after_seq]
        if before_seq is not None:
            where.append("e.seq < ?"); args.append(before_seq)
        if type:
            where.append("e.type = ?"); args.append(type)
        if type_prefix:
            where.append("e.type LIKE ? ESCAPE '\\'"); args.append(type_prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%")
        if agent:
            where.append("EXISTS (SELECT 1 FROM json_each(e.agents) WHERE value = ?)"); args.append(agent)
        if category:
            where.append("e.category = ?"); args.append(category)
        if location:
            where.append("e.location_id = ?"); args.append(location)
        direction = "DESC" if order == "desc" else "ASC"
        return self._events(f"{SELECT} WHERE {' AND '.join(where)} ORDER BY e.seq {direction} LIMIT ?", args + [limit])

    def get(self, ref: str) -> Event | None:
        """Per Ereignis-ID (evt_…) oder Sequenznummer."""
        col, val = ("e.seq", int(ref)) if ref.isdigit() else ("e.event_id", ref)
        found = self._events(f"{SELECT} WHERE {col} = ?", [val])
        return found[0] if found else None

    def chain(self, seq: int) -> list[Event]:
        """Auslösende Ereignisse von der Wurzel bis zum direkten Vorgänger (ohne das Ereignis selbst)."""
        out: list[Event] = []
        cur = self.get(str(seq))
        while cur is not None and cur.parent_seq is not None and len(out) < 50:
            cur = self.get(str(cur.parent_seq))
            if cur is not None:
                out.append(cur)
        return list(reversed(out))

    def children(self, seq: int, limit: int = 200) -> list[Event]:
        return self._events(f"{SELECT} WHERE e.parent_seq = ? ORDER BY e.seq LIMIT ?", [seq, limit])
