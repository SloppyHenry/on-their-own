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
