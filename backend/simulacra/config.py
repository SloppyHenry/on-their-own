"""Konfiguration: Umgebungsvariablen mit Präfix SIM_, lokale Überschreibung in .env."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SIM_", env_file=".env", extra="ignore"
    )

    llm_base_url: str = "http://maintux:8080/v1"
    llm_api_key_file: Path = Path("~/.config/qwen/maintux-api-key")
    llm_api_key_value: SecretStr | None = Field(default=None, validation_alias="SIM_LLM_API_KEY")
    llm_model: str = "qwen3.8-9b-uncensored"
    llm_timeout_s: float = 90.0
    llm_temperature: float = 1.0          # Router-Voreinstellung, so wurde in AP00 gemessen
    llm_top_p: float = 0.95
    llm_max_tokens: int = 400             # Entscheidungen brauchen im Mittel ca. 90 Tokens
    llm_retries: int = 2                  # nur bei Netzwerkfehler, 5xx und Timeout
    llm_backoff_s: float = 1.0
    llm_max_concurrent: int = 1           # passend zu parallel = 1 im Router
    llm_response_format: str = "json_schema"   # json_schema | json_object | none
    llm_thinking: bool = False            # Denkmodus aus (Standardvariante C2)

    sim_top_k: int = 6                    # Optionen je Entscheidung
    sim_correction_retries: int = 2
    sim_conversation_max_turns: int = 8
    sim_memory_lines: int = 10            # letzte Beobachtungen im Prompt
    mem_store_threshold: int = 4          # Gedächtnis (AP05): ab dieser Wichtigkeit dauerhaft speichern
    mem_budget_tokens: int = 450          # Token-Budget abgerufener Erinnerungen je Prompt
    mem_max_items: int = 6
    mem_half_life_h: float = 36.0         # Halbwertszeit der Aktualität (Simulationsstunden)
    mem_min_score: float = 0.35           # Schwelle für den Abruf (0-1)
    mem_w_rel: float = 1.0
    mem_w_rec: float = 0.6
    mem_w_imp: float = 0.6
    mem_w_shared: float = 0.2
    mem_reflect_enabled: bool = True
    mem_reflect_threshold: int = 45       # Wichtigkeitssumme seit der letzten Reflexion
    mem_max_active: int = 2000            # aktive Erinnerungen je Agent
    mem_archive_after_days: int = 2
    mem_debug_skips: bool = False         # nicht Gemerktes als Ereignis melden (Debug)
    sim_tick_delay_s: float = 0.0         # Pause zwischen Ticks (Echtzeit)
    sim_min_decision_gap_s: float = 0.0   # Mindestabstand zwischen Entscheidungen desselben Agenten (Echtzeit)
    sim_max_decisions_per_minute: int = 0 # 0 = unbegrenzt
    sim_autostart: bool = False           # Simulation beim Start des Servers sofort laufen lassen
    ws_ping_s: float = 15.0               # Heartbeat der WebSocket-Verbindung
    ws_max_backlog: int = 2000            # Rückstand je Verbindung, danach Resync statt unbegrenztem Speicher
    ws_max_gap: int = 5000                # größerer Rückstand eines Clients -> neuer Snapshot statt Nachlieferung

    data_dir: Path = Path("./data")
    host: str = "127.0.0.1"
    port: int = 8090

    @computed_field  # type: ignore[prop-decorator]
    @property
    def llm_api_key(self) -> SecretStr | None:
        """Key aus SIM_LLM_API_KEY, sonst aus der Key-Datei; None, wenn beides fehlt."""
        if self.llm_api_key_value is not None:
            return self.llm_api_key_value
        path = self.llm_api_key_file.expanduser()
        if path.is_file():
            return SecretStr(path.read_text().strip())
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
