"""Geplante Ereignisse und befristete Wirkungen (Tabelle `scheduled_events`).

- `fire`: Operationen zum Zeitpunkt ausführen („Am Platz findet morgen ein Markt statt“).
- `revert`: eine befristete Wirkung zurücknehmen (Knappheit für drei Tage, Strom wieder da, Parameter wieder wie vorher). Rücknahmen sind eigene Einträge mit
  den genauen alten Werten und erscheinen im Protokoll.
"""

import json
import uuid
from typing import Any


class Scheduler:
    def __init__(self, conn):
        self.conn = conn

    def add(self, minute: int, kind: str, ops: list[dict[str, Any]], text: str, now: int, inject_id: str | None = None) -> str:
        sid = "sch_" + uuid.uuid4().hex[:10]
        self.conn.execute("INSERT INTO scheduled_events(id, minute, kind, ops, text, inject_id, created) VALUES(?,?,?,?,?,?,?)",
                          (sid, minute, kind, json.dumps(ops, ensure_ascii=False), text, inject_id, now))
        return sid

    def due(self, minute: int) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM scheduled_events WHERE status='pending' AND minute<=? ORDER BY minute, rowid", (minute,)).fetchall()
        return [self._row(r) for r in rows]

    def done(self, sid: str) -> None:
        self.conn.execute("UPDATE scheduled_events SET status='done' WHERE id=?", (sid,))

    def pending(self, kind: str | None = "fire") -> list[dict[str, Any]]:
        q = "SELECT * FROM scheduled_events WHERE status='pending'" + (" AND kind=?" if kind else "") + " ORDER BY minute, rowid"
        return [self._row(r) for r in self.conn.execute(q, (kind,) if kind else ())]

    def count_pending(self) -> int:
        return self.conn.execute("SELECT COUNT(*) n FROM scheduled_events WHERE status='pending' AND kind='fire'").fetchone()["n"]

    def cancel(self, sid: str) -> bool:
        """Absagen: nur ein noch nicht ausgelöstes geplantes Ereignis (Rücknahmen laufen immer)."""
        cur = self.conn.execute("UPDATE scheduled_events SET status='cancelled' WHERE id=? AND status='pending' AND kind='fire'", (sid,))
        return cur.rowcount > 0

    @staticmethod
    def _row(r) -> dict[str, Any]:
        return {"id": r["id"], "minute": r["minute"], "kind": r["kind"], "ops": json.loads(r["ops"]), "text": r["text"], "inject_id": r["inject_id"], "status": r["status"]}
