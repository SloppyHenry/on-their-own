"""SQLite-Zugriff: WAL, nummerierte Migrationen, ein Schreibzugriff zur Zeit."""

import asyncio
import re
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator, TypeVar

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
T = TypeVar("T")


def _connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


class Database:
    """Eine Schreibverbindung (serialisiert über Sperre/Executor), Leseverbindungen auf Anforderung.

    `transaction()` ist wiederverwendbar verschachtelt: Nur die äußerste Ebene committet,
    jede Ausnahme rollt alles zurück.
    """

    def __init__(self, path: str | Path):
        self.path = str(path)
        self._memory = self.path == ":memory:"
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="sim-db-write")
        self._depth = 0
        self._writer = _connect(self.path)
        if not self._memory:
            self._writer.execute("PRAGMA journal_mode = WAL")
            self._writer.execute("PRAGMA synchronous = NORMAL")
        self.migrate()

    # --- Migrationen -------------------------------------------------------------------
    def schema_version(self) -> int:
        return self._writer.execute("PRAGMA user_version").fetchone()[0]

    def migrate(self) -> int:
        files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for f in files:
            m = re.match(r"(\d+)_", f.name)
            if not m:
                raise ValueError(f"Migration ohne Nummer: {f.name}")
            number = int(m.group(1))
            if number <= self.schema_version():
                continue
            with self._lock:
                self._writer.executescript(f"BEGIN;\n{f.read_text()}\nPRAGMA user_version = {number};\nCOMMIT;")
        return self.schema_version()

    # --- Schreiben ---------------------------------------------------------------------
    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            outer = self._depth == 0
            if outer:
                self._writer.execute("BEGIN IMMEDIATE")
            self._depth += 1
            try:
                yield self._writer
            except BaseException:
                self._depth -= 1
                if outer:
                    self._writer.execute("ROLLBACK")
                raise
            else:
                self._depth -= 1
                if outer:
                    self._writer.execute("COMMIT")

    async def write(self, fn: Callable[[sqlite3.Connection], T]) -> T:
        """Führt `fn` in einer Transaktion auf dem einzigen Schreib-Thread aus (asyncio-Warteschlange)."""
        def run() -> T:
            with self.transaction() as conn:
                return fn(conn)
        return await asyncio.get_running_loop().run_in_executor(self._executor, run)

    async def run(self, fn: Callable[[], T]) -> T:
        """Führt `fn` (das selbst Transaktionen öffnet) auf dem Schreib-Thread aus."""
        return await asyncio.get_running_loop().run_in_executor(self._executor, fn)

    # --- Lesen -------------------------------------------------------------------------
    @property
    def conn(self) -> sqlite3.Connection:
        """Verbindung des Engine-Threads (liest innerhalb einer offenen Transaktion den eigenen Stand)."""
        return self._writer

    def reader(self) -> sqlite3.Connection:
        """Eigene Leseverbindung (parallel zum Schreiben dank WAL). Im Speicher-Modus nicht möglich."""
        if self._memory:
            raise RuntimeError("Leseverbindungen gibt es nur bei dateibasierter Datenbank")
        conn = _connect(self.path)
        conn.execute("PRAGMA query_only = ON")
        return conn

    def close(self) -> None:
        self._executor.shutdown(wait=True)
        with self._lock:
            self._writer.close()


def rows(cur: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(r) for r in cur.fetchall()]
