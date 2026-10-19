"""Bestand installierter Modelle (AP17c-3): `data/models/*.gguf`, dazu `installed.json` (Herkunft, Prüfsumme) und `probes.json` (Messergebnisse).

Dateien, die jemand anders dorthin gelegt hat (z. B. `install.sh`), erscheinen auch, ohne Herkunft (`source: extern`). Die Kennung eines Modells ist der Dateiname
ohne `.gguf`; sie ist zugleich der Name, unter dem `llama-server` das Modell meldet."""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from .fit import quant_of


@dataclass
class Installed:
    id: str
    file: str
    name: str
    size_bytes: int
    quant: str | None = None
    repo: str | None = None
    sha256: str | None = None
    license: str | None = None
    installed_at: float | None = None
    source: str = "tool"            # tool: vom Tool geladen und geprüft | extern: Datei von außen


def _read(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def _write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True))
    tmp.replace(path)


class ModelStore:
    def __init__(self, data_dir: Path | str):
        self.dir = Path(data_dir) / "models"

    @property
    def _registry(self) -> Path:
        return self.dir / "installed.json"

    @property
    def _probes(self) -> Path:
        return self.dir / "probes.json"

    def path(self, model_id: str) -> Path:
        return self.dir / f"{model_id}.gguf"

    def list(self) -> list[Installed]:
        registered = {e["id"]: e for e in _read(self._registry, []) if isinstance(e, dict) and "id" in e}
        out: list[Installed] = []
        for f in sorted(self.dir.glob("*.gguf")) if self.dir.is_dir() else []:
            if not f.is_file():
                continue
            mid, size = f.stem, f.stat().st_size
            e = registered.get(mid)
            if e and e.get("size_bytes") == size:
                out.append(Installed(**{k: e.get(k) for k in Installed.__dataclass_fields__ if k in e}))
            else:                                                            # unbekannt oder geändert: wie von außen behandelt
                out.append(Installed(mid, f.name, mid, size, quant_of(f.name), source="extern"))
        return out

    def get(self, model_id: str) -> Installed | None:
        return next((m for m in self.list() if m.id == model_id), None)

    def add(self, m: Installed) -> None:
        m.installed_at = m.installed_at or time.time()
        entries = [e for e in _read(self._registry, []) if isinstance(e, dict) and e.get("id") != m.id]
        _write(self._registry, entries + [asdict(m)])

    def delete(self, model_id: str) -> bool:
        f = self.path(model_id)
        if not f.exists():
            return False
        f.unlink()
        _write(self._registry, [e for e in _read(self._registry, []) if isinstance(e, dict) and e.get("id") != model_id])
        probes = _read(self._probes, {})
        if probes.pop(model_id, None) is not None:
            _write(self._probes, probes)
        return True

    def probes(self) -> dict[str, dict]:
        data = _read(self._probes, {})
        return data if isinstance(data, dict) else {}

    def save_probe(self, model_id: str, result: dict) -> None:
        probes = self.probes()
        probes[model_id] = result
        _write(self._probes, probes)
