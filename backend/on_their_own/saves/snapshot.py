"""Konsistente Kopien der Datenbank (SQLite-Backup-API) mit Prüfsumme und Integritätsprüfung."""

import hashlib
import json
import os
import sqlite3
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def copy_db(src: sqlite3.Connection, dest: Path, meta: dict[str, object] | None = None) -> None:
    """Kopie des laufenden Standes nach `dest` (über eine Zwischendatei, damit nie eine halbe Datei als Spielstand liegt). Gehört auf den DB-Thread."""
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.unlink(missing_ok=True)
    dst = sqlite3.connect(tmp)
    try:
        src.backup(dst)
        for k, v in (meta or {}).items():
            dst.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, json.dumps(v, ensure_ascii=False)))
        dst.commit()
        dst.execute("PRAGMA journal_mode = DELETE")                      # eine einzelne Datei ohne -wal/-shm
    finally:
        dst.close()
    os.replace(tmp, dest)


def read_meta(path: Path) -> dict[str, object]:
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return {k: json.loads(v) for k, v in c.execute("SELECT key, value FROM meta")}
    finally:
        c.close()


def integrity_ok(path: Path) -> bool:
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return c.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    except sqlite3.DatabaseError:
        return False
    finally:
        c.close()
