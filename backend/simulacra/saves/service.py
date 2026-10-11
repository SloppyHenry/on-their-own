"""Spielstände speichern, auflisten, löschen, automatisch sichern, exportieren und importieren. Nichts wird stillschweigend überschrieben oder gelöscht:
Überschreiben braucht den ausdrücklichen Wunsch, Laden und Zurücksetzen sichern vorher, Autosaves berühren nie manuelle Stände.
"""

import re
import shutil
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from .. import __version__
from ..world import clock
from . import portable, snapshot
from .index import SaveIndex

KINDS = ("manual", "auto", "backup", "import")


class SaveError(Exception):
    def __init__(self, code: str, text: str, status: int = 409):
        super().__init__(text)
        self.code, self.text, self.status = code, text, status


@dataclass
class AutoSavePolicy:
    sim_hours: int = 6               # alle so viele Simulationsstunden (0 = aus)
    real_minutes: int = 30           # und alle so viele Echtzeitminuten (0 = aus)
    keep: int = 5                    # Ringpuffer: so viele Autosaves bleiben


def current_schema() -> int:
    from ..db.connection import Database
    db = Database(":memory:")
    try:
        return db.schema_version()
    finally:
        db.close()


class SaveService:
    def __init__(self, sim, directory: Path):
        self.sim = sim
        self.index = SaveIndex(directory)
        self._last_sim = sim.engine.minute
        self._last_real = time.monotonic()

    @property
    def dir(self) -> Path:
        return self.index.dir

    # --- Anlegen --------------------------------------------------------------------------------------------------
    def _name(self, name: str) -> str:
        name = re.sub(r"\s+", " ", name or "").strip()
        if not 1 <= len(name) <= 80 or not name.isprintable():
            raise SaveError("invalid", "Der Name muss 1 bis 80 druckbare Zeichen lang sein.", 422)
        return name

    def create(self, name: str, description: str = "", kind: str = "manual", overwrite: bool = False) -> dict[str, Any]:
        """Konsistente Kopie des Live-Standes (DB-Thread). Gleicher Name bei manuellen Ständen: ohne `overwrite` abgelehnt."""
        name = self._name(name)
        existing = self.index.by_name(name) if kind == "manual" else None
        if existing and not overwrite:
            raise SaveError("exists", f"Einen Spielstand „{name}“ gibt es schon. Speichere unter einem neuen Namen oder bestätige das Überschreiben.")
        sid = existing["id"] if existing else f"sav_{datetime.now():%Y%m%d%H%M%S}_{uuid.uuid4().hex[:6]}"
        eng = self.sim.engine
        dest = self.index.path(sid)
        snapshot.copy_db(eng.state.conn, dest, {"llm_model": self.sim.settings.llm_model})
        entry = {"id": sid, "kind": kind, "name": name, "description": (description or "").strip()[:300], "sim_minute": eng.minute, "created": datetime.now().isoformat(timespec="seconds"),
                 "app_version": __version__, "schema_version": self.sim.db.schema_version(), "size": dest.stat().st_size, "sha256": snapshot.sha256(dest), "model": self.sim.settings.llm_model}
        self.index.add(entry)
        eng.emit_event("simulation.saved", data={"save_id": sid, "name": name, "kind": kind, "minute": eng.minute})
        if kind == "auto":
            self.prune_auto()
        return entry

    def backup(self, label: str) -> dict[str, Any]:
        """Sicherung vor einem destruktiven Schritt („Vor dem Laden – 11.10.2026 14:03“)."""
        return self.create(f"{label} – {datetime.now():%d.%m.%Y %H:%M:%S}", "Automatisch vor einem destruktiven Schritt", kind="backup")

    # --- Autosave ----------------------------------------------------------------------------------------------------
    def maybe_autosave(self, minute: int) -> dict[str, Any] | None:
        p = self.sim.autosave
        due_sim = p.sim_hours > 0 and minute - self._last_sim >= p.sim_hours * 60
        due_real = p.real_minutes > 0 and time.monotonic() - self._last_real >= p.real_minutes * 60
        if not (due_sim or due_real):
            return None
        self._last_sim, self._last_real = minute, time.monotonic()
        return self.create(f"Autosave – {clock.fmt(minute)}", "", kind="auto")

    def prune_auto(self) -> None:
        autos = [e for e in self.index.list() if e["kind"] == "auto"]
        for e in autos[max(0, self.sim.autosave.keep):]:
            self.index.delete(e["id"])

    # --- Lesen und Löschen ------------------------------------------------------------------------------------------------
    def list(self) -> list[dict[str, Any]]:
        out = []
        for e in self.index.list():
            p = self.index.path(e["id"])
            out.append({**e, "sim_label": clock.fmt(e["sim_minute"]), "available": p.exists()})
        return out

    def get(self, sid: str) -> dict[str, Any]:
        e = self.index.get(sid)
        if e is None or not self.index.path(sid).exists():
            raise SaveError("not_found", "Diesen Spielstand gibt es nicht.", 404)
        return e

    def delete(self, sid: str) -> None:
        self.get(sid)
        self.index.delete(sid)

    # --- Export und Import ----------------------------------------------------------------------------------------------------
    def export(self, sid: str) -> tuple[bytes, str]:
        e = self.get(sid)
        slug = re.sub(r"[^A-Za-z0-9._-]+", "_", e["name"]).strip("_") or "spielstand"
        return portable.build_zip(self.index.path(sid), e), f"simulacra-{slug}.zip"

    def import_bytes(self, data: bytes) -> dict[str, Any]:
        work = portable.scratch_dir()
        try:
            try:
                path, manifest = portable.validate_zip(data, work, current_schema())
            except portable.ImportError_ as e:
                raise SaveError("invalid_import", str(e), 422) from None
            sid = f"sav_{datetime.now():%Y%m%d%H%M%S}_{uuid.uuid4().hex[:6]}"
            dest = self.index.path(sid)
            shutil.move(path, dest)
            name = self._unique_import_name(str(manifest["name"]))
            meta = snapshot.read_meta(dest)
            entry = {"id": sid, "kind": "import", "name": name, "description": str(manifest.get("description") or "")[:300], "sim_minute": manifest["sim_minute"],
                     "created": datetime.now().isoformat(timespec="seconds"), "app_version": str(manifest.get("app_version", "?")), "schema_version": manifest["schema_version"],
                     "size": dest.stat().st_size, "sha256": snapshot.sha256(dest), "model": str(meta.get("llm_model") or manifest.get("model") or "")}
            self.index.add(entry)
            return entry
        finally:
            shutil.rmtree(work, ignore_errors=True)

    def _unique_import_name(self, name: str) -> str:
        base, n = f"{self._name(name)} (Import)", 1
        taken = {e["name"].lower() for e in self.index.list()}
        out = base
        while out.lower() in taken:
            n += 1
            out = f"{base} {n}"
        return out
