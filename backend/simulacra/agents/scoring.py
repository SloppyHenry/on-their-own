"""Bewertung der Optionen aus Persönlichkeit, Bedürfnissen, Tageszeit, Wetter, Zielen und Wiederholung.

Jede Punktzahl besteht aus benannten Faktoren; sie sind die nachvollziehbare Grundlage der Erklärung (§13).
"""

import random
import re
from dataclasses import dataclass, field
from typing import Any

from .model import Personality
from .perception import Perception

BASE = {"speak": 28, "reply": 46, "end_talk": 16, "accept": 40, "decline": 18, "give": 22, "move": 24, "explore": 30,
        "inspect": 12, "take": 18, "gather": 28, "build": 30, "plant": 34, "water": 32, "harvest": 42, "eat": 22, "drink": 22,
        "rest": 18, "sleep": 14, "wait": 8, "read": 22, "write": 14, "fish": 28, "cook": 30, "light": 18, "extinguish": 8,
        "unlock": 24, "lock": 6, "resume": 36, "search": 20}
SOCIAL = {"speak", "reply", "accept", "give", "search"}
OUTDOOR_MOVES = {"move", "explore"}


@dataclass
class Option:
    kind: str
    label: str
    action: str
    params: dict[str, Any]
    utterance_key: str | None = None          # Parameter, in den die Äußerung des Modells kommt (z. B. "text")
    eta: int | None = None                    # geschätzte Minuten
    target_loc: str | None = None             # Zielort bei Wegen
    meta: dict[str, Any] = field(default_factory=dict)   # Gesprächsabsichten: end, respond, partner
    id: str = ""
    score: float = 0.0
    factors: list[tuple[str, float]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "kind": self.kind, "label": self.label, "action": self.action, "params": self.params, "eta": self.eta,
                "score": self.score, "factors": [[n, v] for n, v in self.factors]}

    @property
    def key(self) -> str:
        return self.action + ":" + ",".join(f"{k}={v}" for k, v in sorted(self.params.items()) if k not in ("text",))


@dataclass
class Tuning:
    top_k: int = 6
    per_kind_max: int = 2
    repetition_penalty: float = 14.0
    jitter: float = 2.0


STOP = {"einen", "eine", "einem", "einer", "eines", "dass", "sich", "auch", "noch", "oder", "aber", "dann", "wenn", "über", "unter", "mehr",
        "sehr", "ganz", "jetzt", "etwas", "kurz", "kosten", "braucht", "richtung", "gehen", "genauer", "ansehen", "nehmen", "dich", "dir",
        "mich", "ihre", "ihrer", "seine", "seiner", "wird", "wurde", "haben", "sind", "sein", "nach", "vor", "bei", "durch", "alle", "viel"}
INTERESTING = {"item", "map", "note", "key", "board", "bookshelf", "desk", "plant", "workbench"}
THEME_WORDS = {"bau": "craft", "holz": "craft", "werkz": "craft", "hand": "craft", "bleib": "craft", "schaff": "craft", "wald": "nature",
               "natur": "nature", "garte": "garden", "pflanz": "plants", "versor": "garden", "ernte": "garden", "see": "water",
               "wasser": "water", "gemein": "social", "gesch": "social", "gespr": "social", "freund": "social", "ruhe": "calm", "still": "calm"}


def _tokens(text: str) -> set[str]:
    return {w[:4] for w in re.findall(r"[a-zäöüß]{4,}", text.lower()) if w not in STOP}


def agent_themes(goals: list[str], interests: list[str]) -> dict[str, int]:
    """Themen aus Zielen (Gewicht 10) und Interessen (Gewicht 5); verbindet Ziele mit Orten (`props.themes`)."""
    out: dict[str, int] = {}
    for text, weight in ((" ".join(goals).lower(), 10), (" ".join(interests).lower(), 5)):
        for stem, theme in THEME_WORDS.items():
            if stem in text:
                out[theme] = max(out.get(theme, 0), weight)
    return out


def score_option(o: Option, p: Perception, pers: Personality, recent: list[dict[str, Any]], tuning: Tuning, indoors_target: bool,
                 place_themes: list[str] | None = None) -> None:
    f: list[tuple[str, float]] = [("Grundneigung", float(BASE.get(o.kind, 15)))]
    add = lambda name, v: f.append((name, round(v, 1))) if abs(v) >= 0.5 else None  # noqa: E731
    needs, night = p.body.needs, p.phase == "night"
    e, h, t = needs["energy"], needs["hunger"], needs["thirst"]
    # Persönlichkeit
    if o.kind in SOCIAL:
        add("Geselligkeit", 22 * pers.f("sociability"))
    if o.kind == "speak":
        add("Gesprächsinitiative", 14 * pers.f("conversation_initiative"))
    if o.kind == "end_talk":
        add("Geselligkeit", -12 * pers.f("sociability"))
        add("Konfliktbereitschaft", 6 * pers.f("conflict_readiness"))
        add("Gesprächslänge", 2.5 * p.conversation["turn_count"] if p.conversation else 0)
    if o.kind == "explore":
        add("Neugier", 25 * pers.f("curiosity"))
        add("Risikobereitschaft", 10 * pers.f("risk_taking"))
    if o.kind in ("inspect", "read", "take"):
        add("Neugier", 14 * pers.f("curiosity"))
    if o.kind == "inspect" and o.meta.get("object_kind") in INTERESTING:
        add("Interessantes Objekt", 8)
    if o.kind == "move":
        add("Neugier", 4 * pers.f("curiosity"))
    if o.kind == "give":
        add("Hilfsbereitschaft", 20 * pers.f("helpfulness"))
    if o.kind in ("water", "plant", "harvest", "gather", "build"):
        add("Hilfsbereitschaft", 5 * pers.f("helpfulness"))
        if any(x.in_hearing for x in p.people):
            add("Kooperation", 6 * pers.f("cooperation"))
    if o.kind == "accept":
        add("Annahmebereitschaft", 25 * pers.f("suggestion_acceptance"))
        add("Kooperation", 15 * pers.f("cooperation"))
    if o.kind == "decline":
        add("Annahmebereitschaft", -25 * pers.f("suggestion_acceptance"))
        add("Konfliktbereitschaft", 10 * pers.f("conflict_readiness"))
    if o.kind in ("rest", "sleep", "wait"):
        add("Ruhebedürfnis", 18 * pers.f("calm_need"))
    if o.kind in OUTDOOR_MOVES:
        add("Ruhebedürfnis", -6 * pers.f("calm_need"))
    if o.kind == "gather":
        held = p.body.inventory.get(o.params.get("resource", ""), 0)
        add("Schon genug dabei", -min(24.0, 7.0 * held))
    # Bedürfnisse
    if o.kind == "sleep":
        add("Müdigkeit", 45 * max(0.0, (40 - e) / 40) + (20 if night and e < 85 else 0) - (25 if not night and e >= 30 else 0))
    if o.kind == "rest":
        add("Müdigkeit", 20 * max(0.0, (60 - e) / 60))
    if e < 15 and o.kind not in ("sleep", "rest", "eat", "drink"):
        add("Erschöpfung", -15)
    food = o.kind in ("eat", "cook", "harvest", "fish") or (o.kind == "gather" and o.params.get("resource") == "food")
    water = o.kind == "drink" or (o.kind == "gather" and o.params.get("resource") == "water")
    if o.kind == "eat" or food:
        add("Hunger", min(45.0, max(0.0, (h - 55) * 1.4)) * (1.0 if o.kind == "eat" else 0.4) - (25 if o.kind == "eat" and h < 30 else 0))
    if o.kind == "drink" or water:
        add("Durst", min(45.0, max(0.0, (t - 55) * 1.4)) * (1.0 if o.kind == "drink" else 0.4) - (25 if o.kind == "drink" and t < 30 else 0))
    # Tageszeit und Wetter
    if night and o.kind in OUTDOOR_MOVES | {"gather", "build", "plant", "water"} and not indoors_target:
        add("Nacht", -18 * (1 - 0.5 * max(0.0, pers.f("risk_taking"))))
    if p.weather in ("Regen", "Sturm", "Schnee") and (o.kind in OUTDOOR_MOVES or o.kind in ("gather", "build", "plant")) and not indoors_target:
        add("Wetter", -12 * (1 - 0.5 * max(0.0, pers.f("risk_taking"))))
    # Ziele und Interessen (Schlagwortvergleich, AP06 ersetzt das durch echte Ziele)
    words = _tokens(o.label + " " + " ".join(str(v) for v in o.params.values()))
    prof = p.agent.profile
    goal = len(words & _tokens(" ".join(prof.goals)))
    add("Persönliche Ziele", min(20.0, 10.0 * goal))
    add("Interessen", min(10.0, 5.0 * len(words & _tokens(" ".join(prof.interests)))))
    add("Abneigungen", -min(16.0, 8.0 * len(words & _tokens(" ".join(prof.dislikes)))))
    if p.plan_next:
        add("Vorhaben", min(24.0, 12.0 * len(words & _tokens(p.plan_next))))
    themes = agent_themes(prof.goals, prof.interests)
    if place_themes and themes and o.kind not in SOCIAL | {"wait", "rest", "sleep", "eat", "drink"}:
        add("Passt zu Zielen und Interessen des Ortes", min(18.0, float(sum(themes.get(t, 0) for t in place_themes) * 0.8)))
    # Wiederholung
    same = sum(1 for r in recent[:6] if r["action"] + ":" + ",".join(f"{k}={v}" for k, v in sorted(r["params"].items()) if k != "text") == o.key)
    add("Wiederholung", -min(3, same) * tuning.repetition_penalty)
    if recent and recent[0]["action"] == o.action and o.action not in ("move_to",):
        add("Gleiche Art wie zuletzt", -4)
    if o.kind == "wait" and sum(1 for r in recent[:4] if r["action"] == "wait") >= 2:
        add("Zu oft gewartet", -10)
    # Weg und Aufwand
    if o.eta and o.kind in OUTDOOR_MOVES | {"move"}:
        add("Weg", -min(15.0, 0.25 * o.eta))
    o.factors = f
    rng = random.Random(f"{p.agent.id}:{p.minute}:{o.key}")
    o.score = round(max(0.0, min(100.0, sum(v for _, v in f) + rng.uniform(-tuning.jitter, tuning.jitter))), 1)


def select(options: list[Option], p: Perception, tuning: Tuning) -> list[Option]:
    """Beste Optionen mit Vielfalt (höchstens `per_kind_max` je Art) und Pflichtoptionen bei dringenden Bedürfnissen."""
    ranked = sorted(options, key=lambda o: o.score, reverse=True)
    chosen: list[Option] = []
    count: dict[str, int] = {}
    for o in ranked:
        limit = 1 if o.kind == "wait" else tuning.per_kind_max
        if count.get(o.kind, 0) < limit and len(chosen) < tuning.top_k:
            chosen.append(o)
            count[o.kind] = count.get(o.kind, 0) + 1
    needs = p.body.needs
    must: list[tuple[str, ...]] = []
    if needs["hunger"] > 70:
        must.append(("eat", "cook", "harvest"))
    if needs["thirst"] > 70:
        must.append(("drink",))
    if needs["energy"] < 25:
        must.append(("sleep", "rest"))
    if p.conversation and p.conversation["awaiting_reply"]:
        must += [("reply",), ("end_talk",)]
    if p.conversation and p.conversation["open_proposal"] and p.conversation["open_proposal"]["by"] != p.agent.id:
        must += [("accept",), ("decline",)]               # auf einen Vorschlag muss man ehrlich Ja oder Nein sagen können
    for kinds in must:
        if not any(c.kind in kinds for c in chosen):
            extra = next((o for o in ranked if o.kind in kinds), None)
            if extra is not None:
                if len(chosen) >= tuning.top_k:      # den schwächsten Eintrag verdrängen, der selbst keine Pflichtoption ist
                    keep = {k for ks in must for k in ks}
                    idx = next((i for i in range(len(chosen) - 1, -1, -1) if chosen[i].kind not in keep), len(chosen) - 1)
                    chosen = chosen[:idx] + chosen[idx + 1:]
                chosen = chosen + [extra]
    chosen.sort(key=lambda o: o.score, reverse=True)
    for i, o in enumerate(chosen, 1):
        o.id = f"o{i}"
    return chosen
