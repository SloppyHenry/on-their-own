"""Zielsetzung und Planung per Modell: ein kurzfristiges Ziel mit prüfbarer Bedingung und einem Plan aus Schritten (1–8, Parameter).

Das Modell antwortet im JSON-Schema; jede Angabe wird gegen die Welt geprüft (Orte, Objektarten, Ressourcen, Personen müssen existieren, die Bedingung darf
nicht schon erfüllt sein, jeder Planschritt muss auf eine Aktionsart abbildbar sein). Unbrauchbares wird verworfen, nie übernommen.
"""

import json
import re
from dataclasses import dataclass
from typing import Any

from ..llm.client import LLMClient
from ..llm.providers import LLMError
from ..world import clock, object_kinds
from ..world.engine import WorldEngine
from . import prompts
from .goals import CONDITION_TYPES, PLAN_KINDS, Goal, GoalStore
from .phrases import RES_DE
from .relations import RelationStore, describe
from .store import AgentStore


@dataclass
class GoalParams:
    enabled: bool = True
    horizon: int = 5                 # höchstens so viele Planschritte (1–8)
    retry_minutes: int = 30          # Mindestabstand zwischen zwei Versuchen
    stale_minutes: int = 180         # so lange darf ein Ziel ohne Fortschritt bleiben (skaliert mit der Zielpersistenz)
    max_replans: int = 2
    max_failures: int = 3            # abgelehnte oder gescheiterte Planschritte in Folge, dann Neuplanung


@dataclass
class GoalJob:
    agent_id: str
    reason: str
    minute: int
    messages: list[dict[str, str]]
    previous: Goal | None = None


def schema(horizon: int) -> dict[str, Any]:
    cond = {"type": "object", "additionalProperties": False, "required": ["type"], "properties": {
        "type": {"type": "string", "enum": list(CONDITION_TYPES)}, "kind": {"type": "string"}, "location": {"type": "string"}, "resource": {"type": "string"},
        "amount": {"type": "integer", "minimum": 1, "maximum": 20}, "person": {"type": "string"}, "topic": {"type": "string"}, "min_stage": {"type": "integer", "minimum": 1, "maximum": 4}}}
    step = {"type": "object", "additionalProperties": False, "required": ["step", "kind"], "properties": {
        "step": {"type": "string"}, "kind": {"type": "string", "enum": list(PLAN_KINDS)}, "target": {"type": "string"}}}
    return {"type": "object", "additionalProperties": False, "required": ["text", "condition", "plan"], "properties": {
        "text": {"type": "string"}, "condition": cond, "plan": {"type": "array", "minItems": 1, "maxItems": horizon, "items": step}}}


class GoalPlanner:
    def __init__(self, engine: WorldEngine, goals: GoalStore, memory, agents: AgentStore, relations: RelationStore, client: LLMClient | None, params: GoalParams | None = None):
        self.engine, self.goals, self.memory, self.agents, self.relations, self.client = engine, goals, memory, agents, relations, client
        self.params = params or GoalParams()
        self.last_try: dict[str, int] = {}

    # --- Wann? --------------------------------------------------------------------------------------------
    def due(self, agent_id: str, minute: int, busy: bool) -> str | None:
        if not self.params.enabled or self.client is None or busy:
            return None
        if self.goals.active_short(agent_id) is not None:
            return None
        if minute - self.last_try.get(agent_id, -10**6) < self.params.retry_minutes:
            return None
        return "kein aktives Ziel"

    # --- Vorbereitung ----------------------------------------------------------------------------------------
    def _facts(self, agent_id: str) -> dict[str, Any]:
        st, know = self.engine.state, self.memory.know
        locs = [l for l in st.locations.values() if not l.props.get("fallback") and agent_id in l.discovered_by]
        unknown = [l for l in st.locations.values() if not l.props.get("fallback") and agent_id not in l.discovered_by]
        return {"places": locs, "unknown": unknown, "objects": know.objects(agent_id)[:14],
                "others": [a for a in st.agents() if a.id != agent_id], "blueprints": self.engine.blueprints}

    def prepare(self, agent_id: str, reason: str, previous: Goal | None = None) -> GoalJob | None:
        model, st, minute = self.agents.get(agent_id), self.engine.state, self.engine.minute
        body = st.agent(agent_id)
        if model is None or body is None:
            return None
        f = self._facts(agent_id)
        longs = [g.text for g in self.goals.long_goals(agent_id)] or model.profile.goals
        recent = [g for g in self.goals.list(agent_id, kind="short", limit=4) if g.state != "active"]
        lines = [f"Jetzt: {clock.fmt(minute)}. Du bist {st.locations[body.location_id].name}.", f"Deine langfristigen Ziele: {'; '.join(longs) or '–'}."]
        if recent:
            lines.append("Zuletzt: " + "; ".join(f"«{g.text}» ({'erreicht' if g.state == 'achieved' else 'aufgegeben: ' + g.reason})" for g in recent[:3]) + ".")
        if previous is not None:
            lines.append(f"Dein bisheriges Ziel «{previous.text}» ist festgefahren ({previous.reason}). Geh es anders an oder setze dir ein anderes.")
        mem = self.memory.recall_for_text(agent_id, " ".join(longs), minute)
        if mem:
            lines += ["Woran du dich erinnerst:", *[f"- {m}" for m in mem]]
        plans = [m.text for m in self.memory.store.recent(agent_id, kinds=("intention",), limit=5) if m.intention_state == "open" and not m.text.startswith("Mein Ziel:")]
        if plans:
            lines += ["Offene Vorhaben und Zusagen:", *[f"- {t}" for t in plans[:3]]]
        for a in f["others"]:
            d = describe(self.relations.get(agent_id, a.id), a.name)
            if d:
                lines.append(d)
        lines += ["", "Du kennst diese Orte: " + ", ".join(f"{l.name} [{l.id}]" for l in f["places"]) + ".",
                  "Noch unbekannt: " + (", ".join(f"{l.name} [{l.id}]" for l in f["unknown"][:3]) or "nichts") + ".",
                  "Gegenstände, die du kennst: " + ("; ".join(f"{o['name']}" for o in f["objects"]) or "–") + ".",
                  "Du kannst bauen: " + "; ".join(f"{bp['name']} (Art {bp['kind']})" for bp in f["blueprints"].values()) + ".",
                  "Personen: " + (", ".join(f"{a.name} [{a.id}]" for a in f["others"]) or "niemand") + ".", "",
                  "Setze dir EIN neues, konkretes Ziel für die nächsten Stunden, das zu deinen langfristigen Zielen, deiner Lage und deinen Erinnerungen passt. "
                  "Das Ziel muss in der Welt prüfbar sein. Wähle genau eine Bedingung:",
                  "- object_count: ein Gegenstand einer Art soll entstehen (kind = Art, optional location = Ortskennung)",
                  "- location_visited: ein Ort soll (erneut) besucht werden (location = Ortskennung)",
                  f"- has_resource: du trägst genug von etwas (resource: {', '.join(RES_DE)}; amount)",
                  "- talked_with: ein Gespräch mit einer Person (person = Kennung, optional topic = Stichwort)",
                  "- plant_stage: eine von dir gepflanzte Pflanze erreicht eine Wachstumsstufe (min_stage 1 bis 4)",
                  f"Dazu ein Plan aus 1 bis {self.params.horizon} Schritten (kind: {', '.join(PLAN_KINDS)}; optional target = Kennung von Ort, Gegenstand, Person oder Ressource). "
                  "\"text\": das Ziel in einem Satz in deinen Worten. Antworte nur mit dem JSON-Objekt."]
        return GoalJob(agent_id, reason, minute, [{"role": "system", "content": prompts.system_prompt(model)}, {"role": "user", "content": "\n".join(lines)}], previous)

    # --- Prüfung -----------------------------------------------------------------------------------------------
    def build_condition(self, spec: Any, agent_id: str, minute: int) -> tuple[dict[str, Any] | None, str]:
        if not isinstance(spec, dict) or spec.get("type") not in CONDITION_TYPES:
            return None, "Die Bedingung hat keine gültige Art."
        st, t = self.engine.state, spec["type"]
        loc = spec.get("location")
        if loc and loc not in st.locations:
            return None, f"Den Ort '{loc}' gibt es nicht."
        if t == "object_count":
            kinds = set(object_kinds.KINDS) | {bp["kind"] for bp in self.engine.blueprints.values()}
            if spec.get("kind") not in kinds:
                return None, f"Die Art '{spec.get('kind')}' gibt es nicht."
            have = sum(1 for o in st.all_objects() if o.kind == spec["kind"] and (not loc or o.location_id == loc) and o.holder is None)
            return {"type": t, "kind": spec["kind"], "location": loc or None, "min": have + 1}, ""
        if t == "location_visited":
            if not loc or st.locations[loc].props.get("fallback"):
                return None, "location_visited braucht einen echten Ort."
            r = st.conn.execute("SELECT visits FROM known_locations WHERE agent_id=? AND location_id=?", (agent_id, loc)).fetchone()
            return {"type": t, "location": loc, "min_visits": (r["visits"] if r else 0) + 1}, ""
        if t == "has_resource":
            amount = spec.get("amount")
            if spec.get("resource") not in RES_DE or not isinstance(amount, int) or not 1 <= amount <= 20:
                return None, "has_resource braucht eine bekannte Ressource und eine Menge von 1 bis 20."
            if st.agent(agent_id).inventory.get(spec["resource"], 0) >= amount:
                return None, "Du trägst das schon: das Ziel wäre sofort erfüllt."
            return {"type": t, "resource": spec["resource"], "amount": amount}, ""
        if t == "talked_with":
            if spec.get("person") not in {a.id for a in st.agents() if a.id != agent_id}:
                return None, "Diese Person gibt es nicht."
            return {"type": t, "person": spec["person"], "since": minute, "topic": str(spec.get("topic") or "")[:40] or None}, ""
        stage = spec.get("min_stage")
        if not isinstance(stage, int) or not 1 <= stage <= 4:
            return None, "min_stage muss zwischen 1 und 4 liegen."
        return {"type": t, "min_stage": stage}, ""

    def clean_plan(self, raw: Any) -> list[dict[str, Any]]:
        st, ids = self.engine.state, set()
        ids |= set(st.locations) | {o.id for o in st.all_objects()} | {a.id for a in st.agents()} | set(RES_DE) | set(self.engine.blueprints)
        steps = []
        for s in raw if isinstance(raw, list) else []:
            if isinstance(s, dict) and s.get("kind") in PLAN_KINDS and str(s.get("step", "")).strip():
                t = s.get("target")
                steps.append({"step": str(s["step"]).strip()[:120], "kind": s["kind"], "target": t if isinstance(t, str) and t in ids else None})
        return steps[: self.params.horizon]

    def apply(self, job: GoalJob, raw: str) -> tuple[Goal | None, str]:
        try:
            data = json.loads(raw)
            text = str(data["text"]).strip()
        except (ValueError, KeyError, TypeError):
            return None, "Das war kein gültiges JSON im vorgegebenen Format."
        cond, err = self.build_condition(data.get("condition"), job.agent_id, job.minute)
        if cond is None:
            return None, err
        plan = self.clean_plan(data.get("plan"))
        if not text or not plan:
            return None, "Das Ziel braucht einen Text und mindestens einen gültigen Planschritt."
        if job.previous is not None:
            self.goals.set_state(job.previous, "abandoned", job.previous.reason or "festgefahren", job.minute)
        parent = next(iter(self.goals.long_goals(job.agent_id)), None)
        g = self.goals.create(job.agent_id, "short", text[:200], job.minute, condition=cond, plan=plan, parent_id=parent.id if parent else None,
                              reason=("neu gesetzt: " + job.reason) if job.previous is None else "anderer Weg nach festgefahrenem Ziel", replaces=job.previous.id if job.previous else None)
        if job.previous is not None:
            g.replans = job.previous.replans + 1
            self.goals.save_progress(g)
        return g, ""

    async def run(self, agent_id: str, reason: str, previous: Goal | None = None) -> Goal | None:
        """Ziel setzen (oder neu planen): vorbereiten (DB), Modell fragen mit Korrekturschleife, prüfen und speichern (DB). Fehler stören nie."""
        db = self.engine.db
        job = await db.run(lambda: self.prepare(agent_id, reason, previous))
        self.last_try[agent_id] = self.engine.minute
        if job is None or self.client is None:
            return None
        messages, error = list(job.messages), ""
        for _ in range(2):
            try:
                res = await self.client.chat(messages, schema(self.params.horizon))
            except LLMError as e:
                error = f"Modell nicht erreichbar ({e.kind})"
                break
            goal, error = await db.run(lambda c=res.content: self.apply(job, c))
            if goal is not None:
                return goal
            messages = messages + [{"role": "assistant", "content": res.content[:300]}, {"role": "user", "content": prompts.correction_message(error)}]
        await db.run(lambda: self.engine.emit_event("agent.memory_skipped", [agent_id], None, {"text": "", "importance": 0, "reason": f"Zielsetzung verworfen: {error}"}))
        return None
