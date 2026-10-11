"""Presets: mitgelieferte (schreibgeschützt, JSON in `params/presets/`) und eigene (SQLite). Laden nutzt denselben Weg wie einzelne Änderungen."""

import json
import re
import uuid
from pathlib import Path
from typing import Any

from .registry import REGISTRY, SPEC_LIST

DIR = Path(__file__).parent / "presets"


class PresetError(ValueError):
    def __init__(self, code: str, text: str):
        super().__init__(text)
        self.code, self.text = code, text


def _builtin() -> dict[str, dict[str, Any]]:
    out = {}
    for f in sorted(DIR.glob("*.json")):
        d = json.loads(f.read_text())
        out[d["id"]] = {"id": d["id"], "name": d["name"], "description": d["description"], "data": d["values"], "builtin": True}
    return out


class PresetManager:
    def __init__(self, sim):
        self.sim = sim

    @property
    def conn(self):
        return self.sim.engine.state.conn

    # --- Lesen -----------------------------------------------------------------------------------------------
    def _custom(self) -> dict[str, dict[str, Any]]:
        return {r["id"]: {"id": r["id"], "name": r["name"], "description": r["description"], "data": json.loads(r["data"]), "builtin": False}
                for r in self.conn.execute("SELECT * FROM presets ORDER BY created, rowid").fetchall()}

    def list(self) -> list[dict[str, Any]]:
        return [{k: v for k, v in p.items() if k != "data"} | {"count": len(p["data"])} for p in [*_builtin().values(), *self._custom().values()]]

    def get(self, preset_id: str) -> dict[str, Any]:
        p = _builtin().get(preset_id) or self._custom().get(preset_id)
        if p is None:
            raise PresetError("not_found", "Dieses Preset gibt es nicht.")
        return p

    # --- Schreiben ---------------------------------------------------------------------------------------------
    def _name_ok(self, name: str, exclude: str | None = None) -> str:
        name = name.strip()
        if not 1 <= len(name) <= 60:
            raise PresetError("invalid", "Der Name muss 1 bis 60 Zeichen lang sein.")
        if any(p["name"].lower() == name.lower() and p["id"] != exclude for p in [*_builtin().values(), *self._custom().values()]):
            raise PresetError("exists", f"Ein Preset mit dem Namen „{name}“ gibt es schon.")
        return name

    def snapshot(self, groups: list[str] | None = None) -> dict[str, Any]:
        """Aktueller Stand (alles oder ausgewählte Gruppen); maschinenabhängiges (Adresse, Modell) gehört nicht in ein Preset."""
        data: dict[str, Any] = {}
        for s in SPEC_LIST:
            if s.locked or "nopreset" in s.tags or (groups and s.group not in groups):
                continue
            data[s.key] = {a: self.sim.params.current(s, a) for a in self.sim.params.agents()} if s.scope == "agent" else self.sim.params.current(s)
        return data

    def save(self, name: str, description: str = "", groups: list[str] | None = None, data: dict | None = None) -> dict[str, Any]:
        name = self._name_ok(name)
        pid = "custom-" + uuid.uuid4().hex[:10]
        data = data if data is not None else self.snapshot(groups)
        minute = self.sim.engine.minute
        self.conn.execute("INSERT INTO presets(id, name, description, data, created, updated) VALUES(?,?,?,?,?,?)", (pid, name, description.strip()[:300], json.dumps(data, ensure_ascii=False), minute, minute))
        return self.get(pid)

    def duplicate(self, preset_id: str, name: str | None = None) -> dict[str, Any]:
        src = self.get(preset_id)
        return self.save(name or f"{src['name']} (Kopie)", src["description"], data=src["data"])

    def rename(self, preset_id: str, name: str, description: str | None = None) -> dict[str, Any]:
        p = self.get(preset_id)
        if p["builtin"]:
            raise PresetError("builtin", "Mitgelieferte Presets lassen sich nicht ändern. Dupliziere es und ändere die Kopie.")
        self.conn.execute("UPDATE presets SET name=?, description=?, updated=? WHERE id=?", (self._name_ok(name, preset_id), (p["description"] if description is None else description.strip()[:300]), self.sim.engine.minute, preset_id))
        return self.get(preset_id)

    def delete(self, preset_id: str) -> None:
        if self.get(preset_id)["builtin"]:
            raise PresetError("builtin", "Mitgelieferte Presets lassen sich nicht löschen.")
        self.conn.execute("DELETE FROM presets WHERE id=?", (preset_id,))

    # --- Laden ----------------------------------------------------------------------------------------------------------
    def changes(self, preset_id: str) -> list[dict[str, Any]]:
        """Die Änderungen eines Presets als Liste für `ParamService.patch` (Schlüssel, die es nicht mehr gibt, werden übersprungen)."""
        out = []
        for key, value in self.get(preset_id)["data"].items():
            spec = REGISTRY.get(key)
            if spec is None or spec.locked:
                continue
            if spec.scope == "agent":
                out += [{"key": key, "agent": a, "value": v} for a, v in (value or {}).items() if a in self.sim.params.agents()]
            else:
                out.append({"key": key, "agent": None, "value": value})
        return out

    def preview(self, preset_id: str) -> list[dict[str, Any]]:
        """Was sich ändern würde (nur echte Unterschiede), ohne etwas anzuwenden."""
        diff = []
        for c in self.changes(preset_id):
            spec = REGISTRY[c["key"]]
            now = self.sim.params.current(spec, c["agent"])
            if now != c["value"]:
                diff.append({"key": c["key"], "label": spec.label, "agent": c["agent"], "old": now, "new": c["value"]})
        return diff


def safe_id(text: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", text.lower()).strip("-")
