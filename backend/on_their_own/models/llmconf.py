"""Einstellung der Betriebsart (AP17c-3): `data/llm.json`. Die Umgebungsvariablen `SIM_LLM_*` gewinnen weiter (bestehende Installationen laufen unverändert)."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

from ..config import Settings


@dataclass
class LlmConfig:
    mode: str | None = None              # builtin | external; None: noch nicht gewählt (dann entscheidet der Bestand)
    external_url: str | None = None
    external_key: str | None = None      # nur in dieser Datei (Rechte 600), nie in der API-Antwort
    default_model: str | None = None     # Modell für neue Simulationen (Kennung im Bestand)
    last_model: str | None = None        # zuletzt gestartetes Modell


class ConfigFile:
    def __init__(self, data_dir: Path | str):
        self.path = Path(data_dir) / "llm.json"

    def load(self) -> LlmConfig:
        try:
            raw = json.loads(self.path.read_text())
            return LlmConfig(**{k: raw.get(k) for k in LlmConfig.__dataclass_fields__ if isinstance(raw.get(k), (str, type(None)))})
        except (OSError, ValueError, AttributeError, TypeError):
            return LlmConfig()

    def save(self, c: LlmConfig) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(asdict(c), ensure_ascii=False, indent=1))
        tmp.chmod(0o600)
        tmp.replace(self.path)


def env_locked(s: Settings) -> bool:
    """Adresse des Modellservers ist per Umgebung oder `backend/.env` festgelegt (`SIM_LLM_BASE_URL`): das Tool ändert sie dann nicht."""
    return "llm_base_url" in s.model_fields_set
