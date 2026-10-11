"""Bedürfnisse: was eine Option stillt. Ausgeschaltete Bedürfnisse wirken nicht."""

from ..context import AgentContext
from ..model import Personality
from ..perception import Perception
from . import Env, Factors, add
from .core import OUTDOOR_MOVES, SOCIAL


def relief(o, p: Perception, pers: Personality, ctx: AgentContext, env: Env) -> Factors:
    f: Factors = []
    needs, night = p.body.needs, p.phase == "night"
    e, h, t = needs["energy"], needs["hunger"], needs["thirst"]
    if ctx.on("energy"):
        if o.kind == "sleep":
            add(f, "Müdigkeit", 45 * max(0.0, (40 - e) / 40) + (20 if night and e < 85 else 0) - (25 if not night and e >= 30 else 0))
        if o.kind == "rest":
            add(f, "Müdigkeit", 20 * max(0.0, (60 - e) / 60))
        if e < 15 and o.kind not in ("sleep", "rest", "eat", "drink"):
            add(f, "Erschöpfung", -15)
    food = o.kind in ("eat", "cook", "harvest", "fish") or (o.kind == "gather" and o.params.get("resource") == "food")
    water = o.kind == "drink" or (o.kind == "gather" and o.params.get("resource") == "water")
    if ctx.on("hunger") and (o.kind == "eat" or food):
        add(f, "Hunger", min(45.0, max(0.0, (h - 55) * 1.4)) * (1.0 if o.kind == "eat" else 0.4) - (25 if o.kind == "eat" and h < 30 else 0))
    if ctx.on("thirst") and (o.kind == "drink" or water):
        add(f, "Durst", min(45.0, max(0.0, (t - 55) * 1.4)) * (1.0 if o.kind == "drink" else 0.4) - (25 if o.kind == "drink" and t < 30 else 0))
    soc, calm, warm = ctx.soft["social"], ctx.soft["calm"], ctx.soft["warmth"]
    if ctx.on("social"):
        if o.kind in SOCIAL:
            add(f, "Bedürfnis Geselligkeit", 22 * max(0.0, soc - 35) / 65)
        elif o.kind in ("rest", "sleep", "wait", "read", "fish") and soc > 70:
            add(f, "Bedürfnis Geselligkeit", -8 * (soc - 70) / 30)
    if ctx.on("calm"):
        calming = o.kind in ("rest", "wait", "sleep", "read", "fish")
        if calming or (o.kind in OUTDOOR_MOVES and "calm" in (env.place_themes or [])):
            add(f, "Bedürfnis Ruhe", 18 * max(0.0, calm - 35) / 65)
        elif o.kind in ("speak", "reply") and calm > 65:
            add(f, "Bedürfnis Ruhe", -14 * (calm - 65) / 35)
    if ctx.on("warmth") and warm > 40:
        if env.indoors_target and (o.kind in ("move", "light", "rest", "sleep", "cook")):
            add(f, "Wärme", 20 * (warm - 40) / 60)
        elif o.kind in OUTDOOR_MOVES | {"gather", "build"} and not env.indoors_target:
            add(f, "Wärme", -14 * (warm - 40) / 60)
    return f
