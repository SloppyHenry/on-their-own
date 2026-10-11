"""Erklärung einer Entscheidung **aus den gespeicherten Daten per Vorlage** (§13): nichts davon erfindet das Modell nachträglich.
Das `intent`-Feld des Modells erscheint getrennt als „vom Agenten genannter Zweck“."""

import re
from typing import Any

from .factors import FACTOR_KEYS, KEY_LABELS

PHRASE = {
    "Ziel": "es sein Ziel voranbringt", "Planbindung": "es zu seinem Plan passt", "Hunger": "er Hunger hat", "Durst": "er Durst hat", "Müdigkeit": "er müde ist",
    "Erschöpfung": "er erschöpft ist", "Bedürfnis Geselligkeit": "er Gesellschaft braucht", "Bedürfnis Ruhe": "er Ruhe braucht", "Wärme": "ihm kalt ist",
    "Neugier": "er neugierig ist", "Geselligkeit": "er gesellig ist", "Gesprächsinitiative": "er gern das Gespräch beginnt", "Hilfsbereitschaft": "er gern hilft",
    "Kooperation": "er gern zusammenarbeitet", "Annahmebereitschaft": "er Vorschlägen gegenüber offen ist", "Konfliktbereitschaft": "er Konflikten nicht ausweicht",
    "Ruhebedürfnis": "er Ruhe mag", "Beziehung": "er die andere Person mag", "Vertrauen": "er ihr vertraut", "Spannung": "zwischen ihnen Spannung liegt",
    "Persönliche Ziele": "es zu seinen persönlichen Zielen passt", "Interessen": "es ihn interessiert", "Vorhaben": "es sein Vorhaben ist",
    "Passt zu Zielen und Interessen des Ortes": "der Ort zu seinen Zielen und Interessen passt", "Eigeninitiative": "er lieber selbst etwas anstößt",
    "Interessantes Objekt": "das Objekt interessant ist", "Risikobereitschaft": "er Risiken eingeht",
}
NEG = {"Nacht": "es dunkel ist", "Wetter": "das Wetter schlecht ist", "Wiederholung": "er das zuletzt oft getan hat", "Gleiche Art wie zuletzt": "es dasselbe wie zuletzt wäre",
       "Zuletzt gescheitert": "es zuletzt gescheitert ist", "Weg": "der Weg weit ist", "Gesperrt": "es gesperrt ist", "Zu oft gewartet": "er schon oft gewartet hat",
       "Schon genug dabei": "er schon genug dabei hat", "Erschöpfung": "er erschöpft ist", "Spannung": "zwischen ihnen Spannung liegt"}


def _num(v: float) -> str:
    return f"{v:+.1f}".replace(".", ",")


def clean_label(label: str) -> str:
    return re.sub(r"\s*\(ca\. [^)]*\)\s*$", "", label).strip()


def explain(name: str, chosen: dict[str, Any] | None, options: list[dict[str, Any]], goal: dict[str, Any] | None, goal_why: str | None,
            intent: str = "", fallback: bool = False) -> str:
    """`chosen`/`options`: Optionen wie im Protokoll ({id, label, score, factors: [[Name, Wert]]})."""
    if fallback or chosen is None:
        return f"{name} fand keine verwertbare Entscheidung und wartet kurz."
    factors = [(n, v) for n, v in chosen["factors"] if n != "Grundneigung"]
    pos = sorted((f for f in factors if f[1] > 0), key=lambda f: -f[1])[:3]
    neg = sorted((f for f in factors if f[1] < 0 and f[0] in NEG), key=lambda f: f[1])[:1]
    parts = []
    for n, v in pos:
        base = PHRASE.get(n, n)
        if n == "Ziel" and goal:
            base = f"es sein Ziel «{goal['text']}» voranbringt" + (f" ({goal_why})" if goal_why else "")
        parts.append(f"{base} ({_num(v)})")
    text = f"{name} entscheidet sich für «{clean_label(chosen['label'])}»"
    text += (", weil " + _join(parts)) if parts else ", weil nichts Besseres anlag"
    if neg:
        text += f", obwohl {NEG[neg[0][0]]} ({_num(neg[0][1])})"
    text += "."
    best = max(options, key=lambda o: o["score"], default=None)
    if best and best["id"] != chosen["id"] and best["score"] > chosen["score"]:
        text += f" Die bestbewertete Option war «{clean_label(best['label'])}» ({best['score']:.1f} gegen {chosen['score']:.1f}); der Agent hat anders gewählt."
    if intent:
        text += f" Vom Agenten genannter Zweck: „{intent}“."
    return text


def _join(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " und " + parts[-1]


def group_factors(factors: list[list[Any]]) -> dict[str, float]:
    """Faktoren je Gruppe (Schlüssel aus der Spezifikation) zusammengefasst, für Balken in der Oberfläche."""
    out: dict[str, float] = {}
    for n, v in factors:
        k = FACTOR_KEYS.get(n, "base")
        out[k] = round(out.get(k, 0.0) + v, 1)
    return out


__all__ = ["explain", "group_factors", "KEY_LABELS", "clean_label"]
