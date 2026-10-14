"""Grundneigung, Tageszeit und Wetter, Profil (Interessen, Abneigungen), Wiederholung, Fehlschläge, Weg."""

import re

from ..context import AgentContext
from ..model import Personality
from ..perception import Perception
from . import Env, Factors, add

BASE = {"speak": 28, "reply": 46, "end_talk": 16, "accept": 40, "decline": 18, "give": 22, "move": 24, "explore": 30,
        "inspect": 12, "take": 18, "gather": 28, "build": 30, "plant": 34, "water": 32, "harvest": 42, "eat": 22, "drink": 22,
        "rest": 18, "sleep": 14, "to_bed": 14, "wait": 8, "read": 22, "write": 14, "fish": 28, "cook": 30, "light": 18, "extinguish": 8,
        "unlock": 24, "lock": 6, "resume": 36, "search": 20,
        "row": 20, "post": 16, "collect": 52, "fix": 30, "pet": 22, "store": 10, "retrieve": 14, "light_errand": 20}
LIGHT_KINDS = ("lantern", "candle", "floor_lamp")
OUTDOOR_MOVES = {"move", "explore"}
SOCIAL = {"speak", "reply", "accept", "give", "search"}
STOP = {"einen", "eine", "einem", "einer", "eines", "dass", "sich", "auch", "noch", "oder", "aber", "dann", "wenn", "über", "unter", "mehr",
        "sehr", "ganz", "jetzt", "etwas", "kurz", "kosten", "braucht", "richtung", "gehen", "genauer", "ansehen", "nehmen", "dich", "dir",
        "mich", "ihre", "ihrer", "seine", "seiner", "wird", "wurde", "haben", "sind", "sein", "nach", "vor", "bei", "durch", "alle", "viel"}
THEME_WORDS = {"bau": "craft", "holz": "craft", "werkz": "craft", "hand": "craft", "bleib": "craft", "schaff": "craft", "wald": "nature",
               "natur": "nature", "garte": "garden", "pflanz": "plants", "versor": "garden", "ernte": "garden", "see": "water",
               "wasser": "water", "gemein": "social", "gesch": "social", "gespr": "social", "freund": "social", "ruhe": "calm", "still": "calm"}


def tokens(text: str) -> set[str]:
    return {w[:4] for w in re.findall(r"[a-zäöüß]{4,}", text.lower()) if w not in STOP}


def agent_themes(goals: list[str], interests: list[str]) -> dict[str, int]:
    """Themen aus Zielen (Gewicht 10) und Interessen (Gewicht 5); verbindet Ziele mit Orten (`props.themes`)."""
    out: dict[str, int] = {}
    for text, weight in ((" ".join(goals).lower(), 10), (" ".join(interests).lower(), 5)):
        for stem, theme in THEME_WORDS.items():
            if stem in text:
                out[theme] = max(out.get(theme, 0), weight)
    return out


def option_key(action: str, params: dict) -> str:
    return action + ":" + ",".join(f"{k}={v}" for k, v in sorted(params.items()) if k != "text")


def base(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = [("Grundneigung", float(BASE.get(o.kind, 15)))]
    if o.kind == "gather":
        held = p.body.inventory.get(o.params.get("resource", ""), 0)
        add(f, "Schon genug dabei", -min(24.0, 7.0 * held))
    if o.eta and o.kind in OUTDOOR_MOVES | {"move"}:
        add(f, "Weg", -min(15.0, 0.25 * o.eta))
    return f


def time_weather(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = []
    night = p.phase == "night"
    if night and o.kind in OUTDOOR_MOVES | {"gather", "build", "plant", "water", "row"} and not env.indoors_target:
        add(f, "Nacht", -18 * (1 - 0.5 * max(0.0, pers.f("risk_taking"))))
    if o.meta.get("object_kind") in LIGHT_KINDS:                        # Licht: abends an, tagsüber aus (niemand schaltet es sonst)
        dark = p.phase in ("dusk", "night")
        if o.kind in ("light", "light_errand"):
            add(f, "Dunkelheit" if dark else "Es ist hell", 16.0 if dark else -12.0)
        elif o.kind == "extinguish":
            add(f, "Es ist hell" if not dark else "Dunkelheit", 12.0 if not dark else -10.0)
    if p.weather in ("Regen", "Sturm", "Schnee") and (o.kind in OUTDOOR_MOVES or o.kind in ("gather", "build", "plant", "row")) and not env.indoors_target:
        add(f, "Wetter", -12 * (1 - 0.5 * max(0.0, pers.f("risk_taking"))))
    return f


def profile(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    """Interessen, Abneigungen und Schlagwortvergleich mit Profilzielen und dem Vorhaben (Textebene); echte Ziele wirken über `Ziel`."""
    f: Factors = []
    words = tokens(o.label + " " + " ".join(str(v) for v in o.params.values()))
    prof = p.agent.profile
    add(f, "Persönliche Ziele", min(20.0, 10.0 * len(words & tokens(" ".join(prof.goals)))))
    add(f, "Interessen", min(10.0, 5.0 * len(words & tokens(" ".join(prof.interests)))))
    add(f, "Abneigungen", -min(16.0, 8.0 * len(words & tokens(" ".join(prof.dislikes)))))
    if p.plan_next:
        add(f, "Vorhaben", min(24.0, 12.0 * len(words & tokens(p.plan_next))))
    themes = agent_themes(prof.goals, prof.interests)
    if env.place_themes and themes and o.kind not in SOCIAL | {"wait", "rest", "sleep", "to_bed", "eat", "drink"}:
        add(f, "Passt zu Zielen und Interessen des Ortes", min(18.0, float(sum(themes.get(t, 0) for t in env.place_themes) * 0.8)))
    return f


def repetition(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = []
    recent = env.recent
    same = sum(1 for r in recent[:6] if option_key(r["action"], r["params"]) == o.key)
    add(f, "Wiederholung", -min(3, same) * env.tuning.repetition_penalty)
    if recent and recent[0]["action"] == o.action and o.action not in ("move_to",):
        add(f, "Gleiche Art wie zuletzt", -4)
    if o.kind == "wait" and sum(1 for r in recent[:4] if r["action"] == "wait") >= 2:
        add(f, "Zu oft gewartet", -10)
    until = ctx.locks.get(o.key)
    if until is not None and until > p.minute:
        add(f, "Gesperrt", -100)                      # Sperre nach wiederholter gleicher Aktion (Schutz), siehe guards.py
    return f


def failure(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    """Was zuletzt abgelehnt wurde oder scheiterte, wird abgewertet (je jünger und je öfter, desto stärker)."""
    f: Factors = []
    hits = [x for x in ctx.failures[:8] if option_key(x["action"], x["params"]) == o.key and p.minute - x["sim_minute"] <= 240]
    if hits:
        add(f, "Zuletzt gescheitert", -min(40.0, 14.0 * len(hits)))
    return f
