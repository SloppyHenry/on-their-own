"""Export und Import als ZIP (`state.db` + `manifest.json`). Der Import prüft streng und legt immer einen **neuen** Spielstand an, nie den Live-Stand."""

import io
import json
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from .. import __version__
from ..db.connection import Database
from . import snapshot

FORMAT = 1
MAX_DB_BYTES = 500 * 1024 * 1024
MAX_MANIFEST_BYTES = 64 * 1024
MEMBERS = {"state.db", "manifest.json"}


class ImportError_(ValueError):
    pass


def _expected_objects() -> set[tuple[str, str]]:
    """Alle Tabellen, Indizes und Auslöser, die eine gültige Datenbank dieser Version haben darf (aus einer frisch migrierten)."""
    db = Database(":memory:")
    try:
        return {(r["type"], r["name"]) for r in db.conn.execute("SELECT type, name FROM sqlite_master")}
    finally:
        db.close()


def build_zip(db_path: Path, entry: dict[str, Any]) -> bytes:
    manifest = {"format": FORMAT, "app_version": __version__, "schema_version": entry["schema_version"], "name": entry["name"], "description": entry["description"],
                "sim_minute": entry["sim_minute"], "model": entry["model"], "created": entry["created"], "exported": datetime.now().isoformat(timespec="seconds"),
                "sha256": snapshot.sha256(db_path), "size": db_path.stat().st_size, "contents": _contents(db_path)}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(db_path, "state.db")
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=1))
    return buf.getvalue()


def _contents(path: Path) -> dict[str, int]:
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return {t: c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("events", "memories", "objects", "agents_body", "decisions", "goals", "relations", "action_log")}
    finally:
        c.close()


def validate_zip(data: bytes, workdir: Path, current_schema: int) -> tuple[Path, dict[str, Any]]:
    """Entpackt `state.db` nach `workdir` und gibt (Pfad, Manifest) zurück; wirft `ImportError_` mit verständlichem Grund."""
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ImportError_("Das ist keine ZIP-Datei.")
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        infos = {i.filename: i for i in z.infolist()}
        if set(infos) != MEMBERS:
            raise ImportError_(f"Das ZIP muss genau {', '.join(sorted(MEMBERS))} enthalten (gefunden: {', '.join(sorted(infos)) or 'nichts'}).")
        if infos["state.db"].file_size > MAX_DB_BYTES or infos["manifest.json"].file_size > MAX_MANIFEST_BYTES:
            raise ImportError_("Die Datei ist zu groß.")
        try:
            manifest = json.loads(z.read("manifest.json"))
        except ValueError:
            raise ImportError_("manifest.json ist kein gültiges JSON.") from None
        if not isinstance(manifest, dict) or manifest.get("format") != FORMAT:
            raise ImportError_(f"Unbekanntes Format (erwartet {FORMAT}).")
        for key, typ in (("sha256", str), ("schema_version", int), ("sim_minute", int), ("name", str)):
            if not isinstance(manifest.get(key), typ):
                raise ImportError_(f"Im Manifest fehlt „{key}“ oder es ist ungültig.")
        if manifest["schema_version"] > current_schema:
            raise ImportError_(f"Der Spielstand stammt aus einer neueren Version (Schema {manifest['schema_version']}, diese App kennt {current_schema}).")
        target = workdir / "import.db"
        with z.open("state.db") as src, open(target, "wb") as dst:
            written = 0
            for block in iter(lambda: src.read(1 << 20), b""):
                written += len(block)
                if written > MAX_DB_BYTES:
                    raise ImportError_("Die Datenbank ist zu groß.")
                dst.write(block)
    if snapshot.sha256(target) != manifest["sha256"]:
        target.unlink(missing_ok=True)
        raise ImportError_("Die Prüfsumme stimmt nicht: die Datei wurde verändert oder ist beschädigt.")
    try:
        if not snapshot.integrity_ok(target):
            raise ImportError_("Die Datenbank ist beschädigt (Integritätsprüfung fehlgeschlagen).")
        c = sqlite3.connect(f"file:{target}?mode=ro", uri=True)
        try:
            schema = c.execute("PRAGMA user_version").fetchone()[0]
            found = {(r[0], r[1]) for r in c.execute("SELECT type, name FROM sqlite_master")}
        finally:
            c.close()
    except sqlite3.DatabaseError:
        target.unlink(missing_ok=True)
        raise ImportError_("Das ist keine gültige Spielstand-Datenbank.") from None
    if schema > current_schema or schema != manifest["schema_version"]:
        raise ImportError_("Schema-Version der Datenbank und des Manifests passen nicht zusammen oder sind zu neu.")
    foreign = sorted(n for t, n in found - _expected_objects() if not n.startswith("sqlite_") and not n.startswith("memories_fts"))
    if foreign:
        raise ImportError_(f"Die Datenbank enthält unbekannte Teile ({', '.join(foreign[:5])}) und wird nicht importiert.")
    return target, manifest


def scratch_dir() -> Path:
    return Path(tempfile.mkdtemp(prefix="on-their-own-import-"))
