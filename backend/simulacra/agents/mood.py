"""Stimmung: Wert −1 … +1 aus Bedürfnissen, jüngsten Erfolgen und Misserfolgen und dem Gesprächsverlauf, dazu ein Wort.
Sie ist ein Verhaltensfaktor (beeinflusst Bewertung und Ton), kein Gefühl im eigentlichen Sinn (§4)."""

from dataclasses import dataclass, field


@dataclass
class Mood:
    value: float
    word: str
    reasons: list[tuple[str, float]] = field(default_factory=list)       # (Grund, Beitrag)

    def to_dict(self) -> dict:
        return {"value": round(self.value, 2), "word": self.word, "reasons": [[n, round(v, 2)] for n, v in self.reasons]}


def compute(body_needs: dict[str, float], soft: dict[str, float], enabled: dict[str, bool], outcomes: list[str], talked_recently: bool) -> Mood:
    """`outcomes`: Ergebnisse der letzten Entscheidungen, neueste zuerst ('accepted' oder 'rejected')."""
    r: list[tuple[str, float]] = [("Grundstimmung", 0.45)]
    if enabled.get("hunger", True):
        r.append(("Hunger", -0.4 * max(0.0, body_needs["hunger"] - 40) / 60))
    if enabled.get("thirst", True):
        r.append(("Durst", -0.35 * max(0.0, body_needs["thirst"] - 40) / 60))
    if enabled.get("energy", True):
        r.append(("Müdigkeit", -0.45 * max(0.0, 60 - body_needs["energy"]) / 60))
    for key, label, w in (("social", "Einsamkeit", 0.3), ("calm", "Anspannung", 0.3), ("warmth", "Kälte", 0.25)):
        if enabled.get(key):
            r.append((label, -w * max(0.0, soft[key] - 40) / 60))
    recent = outcomes[:6]
    if recent:
        ok = sum(1 for o in recent if o == "accepted") / len(recent)
        r.append(("Erfolge und Misserfolge", 0.35 * (ok - 0.5) * 2))
    if talked_recently:
        r.append(("Gespräch", 0.1))
    r = [(n, v) for n, v in r if abs(v) >= 0.005]
    value = max(-1.0, min(1.0, sum(v for _, v in r)))
    worst = min(((n, v) for n, v in r if n != "Grundstimmung"), key=lambda x: x[1], default=("", 0.0))
    if value < -0.25:
        word = {"Hunger": "gereizt", "Durst": "gereizt", "Müdigkeit": "erschöpft", "Einsamkeit": "einsam", "Anspannung": "angespannt", "Kälte": "durchgefroren"}.get(worst[0], "gedrückt")
    elif value < 0.05:
        word = "etwas matt"
    elif value < 0.4:
        word = "ausgeglichen"
    else:
        word = "zufrieden"
    return Mood(value, word, r)
