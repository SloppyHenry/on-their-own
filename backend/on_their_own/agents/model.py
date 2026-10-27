"""Agentenmodell: editierbares Profil, Persönlichkeitswerte (0-100) und Laufzeitstatus."""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

DEFAULTS_DIR = Path(__file__).parent / "defaults"
Status = Literal["idle", "deciding", "acting", "talking", "sleeping", "stuck", "resting_mode"]

# Schlüssel -> deutsche Bezeichnung (für Prompts und später die Oberfläche)
PERSONALITY_LABELS = {
    "sociability": "Geselligkeit", "curiosity": "Neugier", "helpfulness": "Hilfsbereitschaft", "risk_taking": "Risikobereitschaft",
    "conflict_readiness": "Konfliktbereitschaft", "cooperation": "Kooperationsneigung", "calm_need": "Bedürfnis nach Ruhe",
    "conversation_initiative": "Gesprächsinitiative", "suggestion_acceptance": "Bereitschaft, Vorschläge anzunehmen",
    "persistence": "Zielpersistenz", "spontaneity": "Spontaneität", "autonomy": "Autonomie",
}


class Personality(BaseModel):
    sociability: int = Field(50, ge=0, le=100)
    curiosity: int = Field(50, ge=0, le=100)
    helpfulness: int = Field(50, ge=0, le=100)
    risk_taking: int = Field(50, ge=0, le=100)
    conflict_readiness: int = Field(50, ge=0, le=100)
    cooperation: int = Field(50, ge=0, le=100)
    calm_need: int = Field(50, ge=0, le=100)
    conversation_initiative: int = Field(50, ge=0, le=100)
    suggestion_acceptance: int = Field(50, ge=0, le=100)
    persistence: int = Field(50, ge=0, le=100)      # Zielpersistenz: beim Plan bleiben
    spontaneity: int = Field(50, ge=0, le=100)      # Spontaneität: vom Plan abweichen, kontrollierter Zufall
    autonomy: int = Field(50, ge=0, le=100)         # Autonomie: eigene Vorhaben statt Reaktion auf Ereignisse

    def f(self, key: str) -> float:
        """Wert als Faktor von -1 (0) über 0 (50) bis +1 (100); damit gewichten die Bewertungen."""
        return (getattr(self, key) - 50) / 50


class AgentProfile(BaseModel):
    name: str
    gender: Literal["männlich", "weiblich", "divers"] = "divers"
    age: int = Field(30, ge=0, le=120)
    description: str = ""
    background: str = ""
    interests: list[str] = []
    dislikes: list[str] = []
    goals: list[str] = []
    communication_style: str = ""
    known_places: list[str] = []          # Orte, die der Agent zu Beginn schon kennt


class AgentModel(BaseModel):
    id: str
    profile: AgentProfile
    personality: Personality
    status: Status = "idle"
    plan_next: str = ""
    plan_minute: int | None = None
    last_decision_minute: int | None = None


def load_default(agent_id: str) -> tuple[AgentProfile, Personality]:
    path = DEFAULTS_DIR / f"{agent_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Kein Startprofil für '{agent_id}' ({path.name})")
    d = json.loads(path.read_text())
    return AgentProfile(**d["profile"]), Personality(**d["personality"])
