"""Vorlagen für Bewohner (AP17b): mitgelieferte (`agents/defaults/*.json`, schreibgeschützt) und eigene Dateien in `data/vorlagen/` neben den Spielständen.

Eine Vorlage ist ein Profil mit Persönlichkeit, keine Figur in der Welt. Export und Import sind einzelne JSON-Dateien mit Schemaversion
(`agents/schema.py`); der Import schreibt nie über eine bestehende Vorlage, sondern legt eine neue an.
"""

import json
from pathlib import Path
from typing import Any

from .model import DEFAULTS_DIR, AgentProfile, Personality
from .schema import TEMPLATE_MAX_BYTES, TemplateInvalid, check_profile, parse_template, slug, template_data

PREFIX = "eigene-"
BUILTIN_ORDER = ("alex", "mira", "hanne", "jonas", "rosa", "kim")


class TemplateError(Exception):
    """Vorlage nicht möglich (Statuscode für die API); `errors` nennt jeden Fehler einzeln."""

    def __init__(self, status: int, text: str, errors: list[str] | None = None):
        super().__init__(text)
        self.status, self.text, self.errors = status, text, errors or [text]


class TemplateStore:
    """Liest die mitgelieferten Vorlagen und verwaltet die eigenen (Ordner oder, ohne Ordner, nur im Speicher)."""

    def __init__(self, folder: Path | None):
        self.folder = folder
        self._mem: dict[str, dict[str, Any]] = {}

    # --- Lesen ---------------------------------------------------------------------------------------------------------------------
    def builtin(self) -> dict[str, tuple[AgentProfile, Personality]]:
        out = {}
        for p in sorted(DEFAULTS_DIR.glob("*.json"), key=lambda p: (BUILTIN_ORDER.index(p.stem) if p.stem in BUILTIN_ORDER else 99, p.stem)):
            d = json.loads(p.read_text())
            out[p.stem] = (AgentProfile(**d["profile"]), Personality(**d["personality"]))
        return out

    def _custom_files(self) -> dict[str, dict[str, Any]]:
        if self.folder is None:
            return dict(self._mem)
        out = {}
        for p in sorted(self.folder.glob(f"{PREFIX}*.json")) if self.folder.exists() else []:
            try:
                out[p.stem] = json.loads(p.read_text())
            except (OSError, ValueError):
                continue                                                     # eine beschädigte Datei darf die Liste nicht verhindern
        return out

    def list(self) -> list[dict[str, Any]]:
        out = [self._entry(i, p, q, True) for i, (p, q) in self.builtin().items()]
        for i, d in self._custom_files().items():
            try:
                p, q, _ = parse_template(d)
            except TemplateInvalid:
                continue
            out.append(self._entry(i, p, q, False))
        return out

    @staticmethod
    def _entry(tid: str, p: AgentProfile, q: Personality, builtin: bool) -> dict[str, Any]:
        return {"id": tid, "builtin": builtin, "profile": p.model_dump(), "personality": q.model_dump()}

    def get(self, tid: str) -> dict[str, Any]:
        found = next((t for t in self.list() if t["id"] == tid), None)
        if found is None:
            raise TemplateError(404, f"Es gibt keine Vorlage „{tid}“.")
        return found

    def models(self, tid: str) -> tuple[AgentProfile, Personality]:
        t = self.get(tid)
        return AgentProfile(**t["profile"]), Personality(**t["personality"])

    def export(self, tid: str) -> dict:
        return template_data(*self.models(tid))

    # --- Schreiben -----------------------------------------------------------------------------------------------------------------
    def _write(self, tid: str, data: dict) -> None:
        if self.folder is None:
            self._mem[tid] = data
            return
        self.folder.mkdir(parents=True, exist_ok=True)
        tmp = self.folder / f".{tid}.tmp"
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
        tmp.replace(self.folder / f"{tid}.json")

    def _new_id(self, name: str) -> str:
        taken = {t["id"] for t in self.list()}
        base, n = PREFIX + slug(name)[:24], 1
        cand = base
        while cand in taken:
            n += 1
            cand = f"{base}-{n}"
        return cand

    def _checked(self, profile: AgentProfile, personality: Personality) -> None:
        errs = check_profile(profile, personality)
        if errs:
            raise TemplateError(422, "Die Vorlage ist nicht gültig.", errs)

    def create(self, profile: AgentProfile, personality: Personality) -> dict[str, Any]:
        """Neue eigene Vorlage (nie über eine bestehende)."""
        self._checked(profile, personality)
        tid = self._new_id(profile.name)
        self._write(tid, template_data(profile, personality))
        return self.get(tid)

    def update(self, tid: str, profile: AgentProfile, personality: Personality) -> dict[str, Any]:
        t = self.get(tid)
        if t["builtin"]:
            raise TemplateError(403, "Mitgelieferte Vorlagen sind schreibgeschützt. Duplizieren legt eine eigene an.")
        self._checked(profile, personality)
        self._write(tid, template_data(profile, personality))
        return self.get(tid)

    def delete(self, tid: str) -> None:
        t = self.get(tid)
        if t["builtin"]:
            raise TemplateError(403, "Mitgelieferte Vorlagen lassen sich nicht löschen.")
        if self.folder is None:
            self._mem.pop(tid, None)
        else:
            (self.folder / f"{tid}.json").unlink(missing_ok=True)

    def duplicate(self, tid: str) -> dict[str, Any]:
        p, q = self.models(tid)
        return self.create(p.model_copy(update={"name": f"{p.name} (Kopie)"[:24]}), q)

    def import_bytes(self, raw: bytes) -> tuple[dict[str, Any], list[str]]:
        """Importiert eine Datei als **neue** Vorlage. Fehler (zu groß, kein JSON, Schema, Grenzen) kommen alle auf einmal zurück. Zweiter Wert: Warnungen der Wortprüfung."""
        if len(raw) > TEMPLATE_MAX_BYTES:
            raise TemplateError(413, f"Die Datei ist größer als {TEMPLATE_MAX_BYTES // 1000} KB.")
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as e:
            raise TemplateError(422, f"Die Datei ist kein gültiges JSON: {e}") from None
        try:
            profile, personality, warnings = parse_template(data)
        except TemplateInvalid as e:
            raise TemplateError(422, "Die Datei ist keine gültige Vorlage.", e.errors) from None
        return self.create(profile, personality), warnings
