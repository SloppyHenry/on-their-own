"""Verzeichnis der Spielstände (`data/saves/index.db`): Metadaten je Stand; die Daten selbst liegen als `<id>.db` daneben."""

import sqlite3
import threading
from pathlib import Path
from typing import Any

FIELDS = ("id", "kind", "name", "description", "sim_minute", "created", "app_version", "schema_version", "size", "sha256", "model")


class SaveIndex:
    def __init__(self, directory: Path):
        self.dir = directory
        directory.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.conn = sqlite3.connect(directory / "index.db", check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', "
                          "sim_minute INTEGER NOT NULL, created TEXT NOT NULL, app_version TEXT NOT NULL, schema_version INTEGER NOT NULL, size INTEGER NOT NULL, "
                          "sha256 TEXT NOT NULL, model TEXT NOT NULL DEFAULT '')")

    def path(self, save_id: str) -> Path:
        return self.dir / f"{save_id}.db"

    def add(self, entry: dict[str, Any]) -> None:
        with self._lock:
            self.conn.execute(f"INSERT OR REPLACE INTO saves({','.join(FIELDS)}) VALUES({','.join('?' * len(FIELDS))})", [entry[k] for k in FIELDS])

    def get(self, save_id: str) -> dict[str, Any] | None:
        with self._lock:
            r = self.conn.execute("SELECT * FROM saves WHERE id=?", (save_id,)).fetchone()
        return dict(r) if r else None

    def list(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self.conn.execute("SELECT * FROM saves ORDER BY created DESC, rowid DESC")]

    def by_name(self, name: str, kind: str = "manual") -> dict[str, Any] | None:
        with self._lock:
            r = self.conn.execute("SELECT * FROM saves WHERE kind=? AND lower(name)=lower(?)", (kind, name)).fetchone()
        return dict(r) if r else None

    def delete(self, save_id: str) -> None:
        with self._lock:
            self.conn.execute("DELETE FROM saves WHERE id=?", (save_id,))
        self.path(save_id).unlink(missing_ok=True)

    def close(self) -> None:
        self.conn.close()
