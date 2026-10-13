import asyncio

import pytest

from simulacra.db.connection import Database


def test_migration_applies_once_and_sets_version(tmp_path):
    db = Database(tmp_path / "w.db")
    assert db.schema_version() >= 1
    v = db.schema_version()
    db.close()
    db2 = Database(tmp_path / "w.db")  # erneutes Öffnen wendet nichts doppelt an
    assert db2.schema_version() == v


def test_file_db_uses_wal(tmp_path):
    db = Database(tmp_path / "w.db")
    assert db.conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_transaction_rolls_back_on_error():
    db = Database(":memory:")
    with pytest.raises(RuntimeError):
        with db.transaction() as c:
            c.execute("INSERT INTO meta VALUES('a','1')")
            raise RuntimeError("boom")
    assert db.conn.execute("SELECT COUNT(*) FROM meta").fetchone()[0] == 0


def test_nested_transaction_commits_only_outermost():
    db = Database(":memory:")
    with pytest.raises(RuntimeError):
        with db.transaction() as c:
            c.execute("INSERT INTO meta VALUES('a','1')")
            with db.transaction() as c2:
                c2.execute("INSERT INTO meta VALUES('b','2')")
            raise RuntimeError("außen")
    assert db.conn.execute("SELECT COUNT(*) FROM meta").fetchone()[0] == 0


def test_reader_sees_committed_data_while_writer_open(tmp_path):
    db = Database(tmp_path / "w.db")
    with db.transaction() as c:
        c.execute("INSERT INTO meta VALUES('a','1')")
        r = db.reader()
        assert r.execute("SELECT COUNT(*) FROM meta").fetchone()[0] == 0  # noch nicht committet
    assert r.execute("SELECT COUNT(*) FROM meta").fetchone()[0] == 1


async def test_async_writes_are_serialized(tmp_path):
    db = Database(tmp_path / "w.db")

    def add(i):
        def fn(c):
            n = c.execute("SELECT COUNT(*) FROM meta").fetchone()[0]
            c.execute("INSERT INTO meta VALUES(?,?)", (f"k{i}", str(n)))
        return fn

    await asyncio.gather(*(db.write(add(i)) for i in range(20)))
    vals = sorted(int(r[0]) for r in db.conn.execute("SELECT value FROM meta"))
    assert vals == list(range(20))  # jeder Schreiber sah den Stand des Vorgängers


def test_one_connection_is_not_safe_across_threads(tmp_path):
    """Belegt die Ursache des Flackerns (test_ws): zwei Threads mit derselben SQL-Anfrage auf einer Verbindung bekommen leere Treffer.
    Darum liest alles außerhalb des DB-Threads nur `committed_minute` oder geht über `db.run`."""
    import threading
    db = Database(tmp_path / "t.db")
    db.conn.execute("INSERT INTO clock(id, minute) VALUES(1, 0)")
    stop, misses = threading.Event(), []

    def read():
        while not stop.is_set():
            if db.conn.execute("SELECT minute FROM clock").fetchone() is None:
                misses.append(1)
    threads = [threading.Thread(target=read) for _ in range(2)]
    [t.start() for t in threads]
    for _ in range(50):
        if misses:
            break
        stop.wait(0.1)
    stop.set()
    [t.join() for t in threads]
    assert misses, "gleichzeitige Nutzung einer Verbindung ging diesmal gut – Annahme prüfen"
    db.close()
