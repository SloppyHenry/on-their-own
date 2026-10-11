"""Persistenz der geänderten Parameter. Nur Abweichungen vom Standard werden gespeichert; beim Start werden sie wieder angewendet."""

import json
from typing import Any


class ParamStore:
    def __init__(self, conn):
        self.conn = conn

    def set(self, key: str, agent: str | None, value: Any, minute: int) -> None:
        self.conn.execute("INSERT INTO params(key, agent_id, value, updated) VALUES(?,?,?,?) ON CONFLICT(key, agent_id) DO UPDATE SET value=excluded.value, updated=excluded.updated",
                          (key, agent or "", json.dumps(value, ensure_ascii=False), minute))

    def delete(self, key: str, agent: str | None) -> None:
        self.conn.execute("DELETE FROM params WHERE key=? AND agent_id=?", (key, agent or ""))

    def get(self, key: str, agent: str | None = None, default: Any = None) -> Any:
        r = self.conn.execute("SELECT value FROM params WHERE key=? AND agent_id=?", (key, agent or "")).fetchone()
        return json.loads(r["value"]) if r else default

    def all(self) -> list[tuple[str, str | None, Any]]:
        return [(r["key"], r["agent_id"] or None, json.loads(r["value"])) for r in self.conn.execute("SELECT key, agent_id, value FROM params ORDER BY rowid")]
