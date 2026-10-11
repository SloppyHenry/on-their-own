"""Bewertungsfaktoren der Optionen. Jeder Faktor hat einen Klartextnamen (steht so im Entscheidungsprotokoll) und gehört zu einer Gruppe mit festem Schlüssel
(`FACTOR_KEYS`, siehe docs/konfiguration.md). Eine Option bekommt die Summe ihrer Faktoren."""

from dataclasses import dataclass, field
from typing import Any

Factors = list[tuple[str, float]]


@dataclass
class Env:
    """Was die Faktoren außer Option, Wahrnehmung, Persönlichkeit und Kontext brauchen."""
    recent: list[dict[str, Any]]                  # zuletzt abgeschlossene Aktionen, neueste zuerst
    tuning: Any
    indoors_target: bool
    place_themes: list[str] | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def add(out: Factors, name: str, value: float) -> None:
    if abs(value) >= 0.5:
        out.append((name, round(value, 1)))

# Klartextname -> Schlüssel der Gruppe (Spezifikation AP06)
FACTOR_KEYS = {
    "Grundneigung": "base", "Weg": "base", "Schon genug dabei": "base",
    "Ziel": "goal_progress", "Persönliche Ziele": "goal_progress", "Interessen": "goal_progress", "Abneigungen": "goal_progress",
    "Passt zu Zielen und Interessen des Ortes": "goal_progress",
    "Müdigkeit": "need_relief", "Erschöpfung": "need_relief", "Hunger": "need_relief", "Durst": "need_relief", "Bedürfnis Geselligkeit": "need_relief", "Wärme": "need_relief",
    "Neugier": "exploration", "Interessantes Objekt": "exploration",
    "Geselligkeit": "social", "Gesprächsinitiative": "social", "Gesprächslänge": "social", "Beziehung": "social",
    "Ruhebedürfnis": "calm", "Bedürfnis Ruhe": "calm",
    "Hilfsbereitschaft": "helpfulness", "Kooperation": "cooperation",
    "Risikobereitschaft": "risk", "Nacht": "risk", "Wetter": "risk",
    "Konfliktbereitschaft": "conflict", "Spannung": "conflict",
    "Annahmebereitschaft": "proposal_accept", "Vertrauen": "proposal_accept",
    "Vorhaben": "plan_stick", "Planbindung": "plan_stick",
    "Eigeninitiative": "autonomy",
    "Wiederholung": "repetition_penalty", "Gleiche Art wie zuletzt": "repetition_penalty", "Zu oft gewartet": "repetition_penalty", "Gesperrt": "repetition_penalty",
    "Zuletzt gescheitert": "failure_penalty",
}
KEY_LABELS = {
    "base": "Grundneigung", "goal_progress": "Ziel voranbringen", "need_relief": "Bedürfnis stillen", "exploration": "Erkunden", "social": "Gesellig sein",
    "calm": "Ruhe", "helpfulness": "Helfen", "cooperation": "Zusammenarbeiten", "risk": "Risiko", "conflict": "Konflikt", "proposal_accept": "Vorschlag annehmen",
    "plan_stick": "Beim Plan bleiben", "autonomy": "Eigeninitiative", "repetition_penalty": "Wiederholung", "failure_penalty": "Zuletzt gescheitert",
}


def key_of(label: str) -> str:
    return FACTOR_KEYS.get(label, "base")
