"""Alles, was die Bewertung über den Agenten über Wahrnehmung hinaus wissen muss: Bedürfnisse, Stimmung, Beziehungen, Ziele, Sperren, Fehlschläge."""

from dataclasses import dataclass, field
from typing import Any

from .goals import Goal
from .mood import Mood
from .relations import Relation


@dataclass
class AgentContext:
    soft: dict[str, float] = field(default_factory=lambda: {"social": 20.0, "calm": 20.0, "warmth": 0.0})
    enabled: dict[str, bool] = field(default_factory=lambda: {"energy": True, "hunger": True, "thirst": True, "social": False, "calm": False, "warmth": False})
    mood: Mood = field(default_factory=lambda: Mood(0.3, "ausgeglichen"))
    relations: dict[str, Relation] = field(default_factory=dict)
    goal: Goal | None = None
    long_goals: list[Goal] = field(default_factory=list)
    locks: dict[str, int] = field(default_factory=dict)           # Option.key -> gesperrt bis (Simulationsminute)
    failures: list[dict[str, Any]] = field(default_factory=list)  # jüngste Fehlschläge, neueste zuerst
    critical: list[str] = field(default_factory=list)             # kritische Bedürfnisse (dringender Anlass)
    seed: int = 1

    def on(self, need: str) -> bool:
        return self.enabled.get(need, True)
