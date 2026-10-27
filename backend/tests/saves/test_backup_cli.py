"""AP10: Sicherung und Wiederherstellung des Datenverzeichnisses (scripts/backup.sh, restore.sh)."""

import io
import json
import sqlite3
import subprocess
import sys
import tarfile

import pytest
from saves.conftest import dump, file_sim

from on_their_own.saves import cli


def tar_of(members: dict[str, bytes]) -> io.BytesIO:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t:
        for name, data in members.items():
            i = tarfile.TarInfo(name)
            i.size = len(data)
            t.addfile(i, io.BytesIO(data))
    buf.seek(0)
    return buf


@pytest.fixture
def running(tmp_path):
    """Datenverzeichnis wie im Container: live.db (offen, WAL), ein manueller Stand, ein Autosave."""
    data = tmp_path / "data"
    data.mkdir()
    sim = file_sim(data / "live.db")
    sim.engine.advance(60)
    sim.saves.create("Mein Stand", "", kind="manual")
    sim.saves.create("Auto", "", kind="auto")
    yield data, sim
    sim.close()


def backup_bytes(data) -> bytes:
    buf = io.BytesIO()
    cli.write_backup(data, buf)
    return buf.getvalue()


def test_backup_of_a_running_simulation_is_consistent_and_complete(running):
    data, sim = running
    raw = backup_bytes(data)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as t:
        names = set(t.getnames())
        manifest = json.load(t.extractfile("manifest.json"))
    assert {"manifest.json", "live.db", "saves/index.db"} <= names and sum(n.startswith("saves/") and n != "saves/index.db" for n in names) == 2
    assert manifest["format"] == 1 and set(manifest["files"]) == names - {"manifest.json"}
    assert not any(n.endswith(("-wal", "-shm", ".tmp")) for n in names)


def test_backup_then_restore_gives_an_identical_state(running, tmp_path):
    data, sim = running
    raw = backup_bytes(data)
    want = dump(data / "live.db")
    sim.engine.advance(120)                                       # danach passiert noch etwas
    sim.saves.create("Später", "", kind="manual")
    sim.close()
    manifest = cli.restore(data, io.BytesIO(raw))
    assert dump(data / "live.db") == want and manifest["safety_backup"]
    assert len(list((data / "saves").glob("*.db"))) == 3          # index + 2 Stände, „Später“ ist weg
    c = sqlite3.connect(data / "saves" / "index.db")
    assert sorted(r[0] for r in c.execute("SELECT name FROM saves")) == ["Auto", "Mein Stand"]
    c.close()
    assert not list(data.glob(".restore-*")) and not (data / ".before-restore").exists()


def test_restore_first_saves_the_current_state_and_that_backup_is_restorable(running):
    data, sim = running
    raw = backup_bytes(data)
    sim.engine.advance(30)
    now = dump(data / "live.db")
    sim.close()
    safety = cli.restore(data, io.BytesIO(raw))["safety_backup"]
    cli.restore(data, open(safety, "rb"))
    assert dump(data / "live.db") == now


@pytest.mark.parametrize("name", ["../evil.db", "/etc/passwd", "saves/../x.db", "saves/sub/x.db", "live.db-wal", "extra.txt"])
def test_restore_rejects_unknown_or_dangerous_entries(tmp_path, name):
    with pytest.raises(cli.RestoreError):
        cli.restore(tmp_path / "d", tar_of({"manifest.json": b"{}", name: b"x"}))
    assert not (tmp_path / "evil.db").exists()


def test_restore_rejects_tampered_or_foreign_archives_and_changes_nothing(running):
    data, sim = running
    raw = backup_bytes(data)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as t:
        members = {n: t.extractfile(n).read() for n in t.getnames()}
    sim.close()
    before = dump(data / "live.db")

    bad = dict(members); bad["live.db"] = members["live.db"][:-100] + b"\0" * 100          # Prüfsumme
    newer = dict(members); newer["manifest.json"] = json.dumps({**json.loads(members["manifest.json"]), "schema_version": 999}).encode()
    nomani = {k: v for k, v in members.items() if k != "manifest.json"}
    for case, text in [(bad, "Prüfsumme"), (newer, "neueren"), (nomani, "manifest.json")]:
        with pytest.raises(cli.RestoreError, match=text):
            cli.restore(data, tar_of(case))
    with pytest.raises(cli.RestoreError):
        cli.restore(data, io.BytesIO(b"kein archiv"))
    assert dump(data / "live.db") == before and not list(data.glob(".restore-*"))


def test_command_line_roundtrip_via_stdout_and_stdin(running, tmp_path):
    data, sim = running
    sim.close()
    py = [sys.executable, "-m", "on_their_own.saves.cli", "--data-dir", str(data)]
    out = subprocess.run([*py[:3], "backup", "-", *py[3:]], capture_output=True, check=True)
    assert out.stdout[:2] == b"\x1f\x8b" and b"Backup:" in out.stderr
    want = dump(data / "live.db")
    (data / "live.db").unlink()
    done = subprocess.run([*py[:3], "restore", "-", *py[3:]], input=out.stdout, capture_output=True)
    assert done.returncode == 0 and dump(data / "live.db") == want
    bad = subprocess.run([*py[:3], "restore", "-", *py[3:]], input=b"quatsch", capture_output=True)
    assert bad.returncode == 2 and b"Abgebrochen" in bad.stderr


def test_backup_of_an_empty_data_dir_does_not_crash(tmp_path):
    raw = backup_bytes(tmp_path / "leer")
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as t:
        assert t.getnames() == ["manifest.json"]
