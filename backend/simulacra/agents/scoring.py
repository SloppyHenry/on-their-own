"""Bewertung der Optionen aus Persönlichkeit, Bedürfnissen, Tageszeit, Wetter, Zielen und Wiederholung.

Jede Punktzahl besteht aus benannten Faktoren; sie sind die nachvollziehbare Grundlage der Erklärung (§13).
"""

import random
from dataclasses import dataclass, field
from typing import Any

from .context import AgentContext
from .factors import Env, core, drive, needs, social
from .factors.core import agent_themes, tokens as _tokens  # noqa: F401  (agent_themes: von options/Tests genutzt)
from .model import Personality
from .perception import Perception

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


FACTORS = [core.base, core.time_weather, core.profile, core.repetition, core.failure, needs.relief, social.personality, social.relation, drive.goal,
           drive.exploration, drive.commitment]


def score_option(o: Option, p: Perception, pers: Personality, recent: list[dict[str, Any]], tuning: Tuning, indoors_target: bool,
                 place_themes: list[str] | None = None, ctx: AgentContext | None = None) -> None:
    """Punktzahl = Summe benannter Faktoren (Gruppen siehe `factors.FACTOR_KEYS`), plus kontrollierte Zufallskomponente (Spontaneität, fester Seed)."""
    ctx = ctx or p.ctx or AgentContext()
    env = Env(recent, tuning, indoors_target, place_themes)
    f: list[tuple[str, float]] = []
    for fn in FACTORS:
        f += fn(o, p, pers, ctx, env)
    o.factors = f
    if env.extra.get("goal_hits", {}).get(o.key):
        o.meta["goal_why"] = env.extra["goal_hits"][o.key]
    jitter = tuning.jitter * (1 + 1.5 * max(0.0, pers.f("spontaneity")))
    rng = random.Random(f"{ctx.seed}:{p.agent.id}:{p.minute}:{o.key}")
    o.score = round(max(0.0, min(100.0, sum(v for _, v in f) + rng.uniform(-jitter, jitter))), 1)


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
    body_needs, ctx = p.body.needs, p.ctx or AgentContext()
    must: list[tuple[str, ...]] = []
    if body_needs["hunger"] > 70 and ctx.on("hunger"):
        must.append(("eat", "cook", "harvest"))
    if body_needs["thirst"] > 70 and ctx.on("thirst"):
        must.append(("drink",))
    if body_needs["energy"] < 25 and ctx.on("energy"):
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
