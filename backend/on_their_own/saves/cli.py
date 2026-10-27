"""Sicherung und Wiederherstellung des ganzen Datenverzeichnisses (`/data`), gedacht für scripts/backup.sh und restore.sh.

    python -m on_their_own.saves.cli backup  [-]        # tar.gz auf stdout (oder in eine Datei): live.db, saves/, manifest.json
    python -m on_their_own.saves.cli restore [-]        # tar.gz von stdin (oder aus einer Datei) einspielen – nur bei gestoppter App

Das Backup läuft über die SQLite-Backup-API und ist deshalb auch bei laufender Simulation konsistent. Die Wiederherstellung
prüft Manifest, Prüfsummen und Integrität, legt vorher selbst eine Sicherung des aktuellen Standes an und ersetzt erst dann.
"""

import argparse
import json
import shutil
import sqlite3
import sys
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path

from .. import __version__
from ..config import get_settings
from ..db.connection import Database
from . import snapshot

FORMAT = 1
MAX_MEMBER_BYTES = 2 * 1024**3
NAME_OK = ("live.db", "saves/index.db")


class RestoreError(ValueError):
    pass


def _member_ok(name: str) -> bool:
    return name in NAME_OK or (name.startswith("saves/") and name.endswith(".db") and "/" not in name[6:] and name[6:] not in ("", ".db") and ".." not in name)


def _copy(src: Path, dest: Path) -> None:
    """Konsistente Kopie einer SQLite-Datei, auch während sie benutzt wird."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    s = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    d = sqlite3.connect(dest)
    try:
        s.backup(d)
        d.execute("PRAGMA journal_mode = DELETE")
    finally:
        d.close()
        s.close()


def stage_backup(data: Path, work: Path) -> dict:
    """Legt alle zu sichernden Dateien (konsistente Kopien) in `work` ab und gibt das Manifest zurück."""
    files: dict[str, Path] = {}
    if (data / "live.db").is_file():
        _copy(data / "live.db", work / "live.db")
        files["live.db"] = work / "live.db"
    saves = data / "saves"
    if saves.is_dir():
        for p in sorted(saves.glob("*.db")):
            _copy(p, work / "saves" / p.name)
            files[f"saves/{p.name}"] = work / "saves" / p.name
    schema = Database(":memory:")
    try:
        version = schema.schema_version()
    finally:
        schema.close()
    manifest = {"format": FORMAT, "app_version": __version__, "schema_version": version, "created": datetime.now().isoformat(timespec="seconds"),
                "files": {n: {"sha256": snapshot.sha256(p), "size": p.stat().st_size} for n, p in files.items()}}
    (work / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest


def write_backup(data: Path, out) -> dict:
    with tempfile.TemporaryDirectory(dir=data if data.is_dir() else None) as tmp:
        work = Path(tmp)
        manifest = stage_backup(data, work)
        with tarfile.open(fileobj=out, mode="w|gz") as tar:
            tar.add(work / "manifest.json", "manifest.json")
            for name in manifest["files"]:
                tar.add(work / name, name)
    return manifest


def _read_archive(src, work: Path) -> dict:
    """Entpackt nur bekannte Dateinamen als normale Dateien; alles andere ist ein Fehler."""
    try:
        with tarfile.open(fileobj=src, mode="r|gz") as tar:
            for m in tar:
                if m.name != "manifest.json" and not _member_ok(m.name):
                    raise RestoreError(f"Unerwarteter Eintrag im Archiv: {m.name!r}")
                if not m.isfile() or m.size > MAX_MEMBER_BYTES:
                    raise RestoreError(f"Eintrag ist keine normale Datei oder zu groß: {m.name!r}")
                target = work / m.name
                target.parent.mkdir(parents=True, exist_ok=True)
                with open(target, "wb") as f:
                    shutil.copyfileobj(tar.extractfile(m), f)
    except tarfile.TarError as e:
        raise RestoreError(f"Das ist kein gültiges Backup-Archiv ({e}).") from e
    if not (work / "manifest.json").is_file():
        raise RestoreError("manifest.json fehlt im Archiv.")
    return json.loads((work / "manifest.json").read_text())


def verify(work: Path, manifest: dict, current_schema: int) -> None:
    if manifest.get("format") != FORMAT:
        raise RestoreError(f"Unbekanntes Archivformat: {manifest.get('format')!r}.")
    if manifest.get("schema_version", 10**9) > current_schema:
        raise RestoreError("Das Backup stammt aus einer neueren Programmversion.")
    files = manifest.get("files", {})
    on_disk = {p.relative_to(work).as_posix() for p in work.rglob("*.db")}
    if on_disk != set(files):
        raise RestoreError("Dateien im Archiv und im Manifest passen nicht zusammen.")
    for name, info in files.items():
        p = work / name
        if snapshot.sha256(p) != info["sha256"]:
            raise RestoreError(f"Prüfsumme falsch: {name}")
        if not snapshot.integrity_ok(p):
            raise RestoreError(f"Integritätsprüfung fehlgeschlagen: {name}")


def restore(data: Path, src, current_schema: int | None = None) -> dict:
    data.mkdir(parents=True, exist_ok=True)
    if current_schema is None:
        schema = Database(":memory:")
        try:
            current_schema = schema.schema_version()
        finally:
            schema.close()
    work = Path(tempfile.mkdtemp(prefix=".restore-", dir=data))
    try:
        manifest = _read_archive(src, work)
        verify(work, manifest, current_schema)
        safety = data / "backups" / f"vor-restore-{datetime.now():%Y%m%d-%H%M%S}.tar.gz"
        if (data / "live.db").exists() or (data / "saves").exists():
            safety.parent.mkdir(parents=True, exist_ok=True)
            with open(safety, "wb") as f:
                write_backup(data, f)
        old = data / ".before-restore"
        shutil.rmtree(old, ignore_errors=True)
        old.mkdir()
        for name in ("live.db", "live.db-wal", "live.db-shm", "saves"):
            if (data / name).exists():
                shutil.move(data / name, old / name)
        for name in ("live.db", "saves"):
            if (work / name).exists():
                shutil.move(work / name, data / name)
        shutil.rmtree(old, ignore_errors=True)
        manifest["safety_backup"] = str(safety) if safety.exists() else None
        return manifest
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="on_their_own.saves.cli")
    ap.add_argument("command", choices=["backup", "restore"])
    ap.add_argument("file", nargs="?", default="-", help="Datei oder - für stdout/stdin")
    ap.add_argument("--data-dir", type=Path, default=None)
    args = ap.parse_args(argv)
    data = args.data_dir or get_settings().data_dir
    try:
        if args.command == "backup":
            out = sys.stdout.buffer if args.file == "-" else open(args.file, "wb")
            m = write_backup(data, out)
            out.flush()
            print(f"Backup: {len(m['files'])} Dateien, Schema {m['schema_version']}", file=sys.stderr)
        else:
            src = sys.stdin.buffer if args.file == "-" else open(args.file, "rb")
            m = restore(data, src)
            print(f"Wiederhergestellt: {len(m['files'])} Dateien aus Backup vom {m['created']}; vorheriger Stand gesichert in {m['safety_backup']}", file=sys.stderr)
    except RestoreError as e:
        print(f"Abgebrochen: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
