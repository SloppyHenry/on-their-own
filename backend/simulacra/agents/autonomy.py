"""Autonomie als Ganzes (AP06): Bedürfnisse, Stimmung, Beziehungen, Ziele, Schutzmechanismen und Erklärung hinter einer Schnittstelle für den Agentenzyklus."""

import json
from typing import Any

from ..llm.client import LLMClient
from ..memory.system import MemorySystem
from ..world.engine import WorldEngine
from ..world.models import Event, ProposeResult
from . import mood as mood_mod
from .context import AgentContext
from .explain import explain, group_factors
from .goals import GoalStore
from .guards import Guards
from .needs import LABELS, NeedsStore, need_words
from .perception import Perception
from .plans import GoalParams, GoalPlanner
from .relations import RelationStore, describe
from .store import AgentStore

TALK_MEMORY_MINUTES = 60


class Autonomy:
    def __init__(self, engine: WorldEngine, agents: AgentStore, memory: MemorySystem, client: LLMClient | None):
        self.engine, self.agents, self.memory = engine, agents, memory
        self.needs = NeedsStore(engine)
        self.relations = RelationStore(engine)
        self.goals = GoalStore(engine, memory)
        self.guards = Guards(engine)
        self.planner = GoalPlanner(engine, self.goals, memory, agents, self.relations, client, GoalParams())
        self.abandoned_streak: dict[str, int] = {}
        self.seed = int(engine.state.get_meta("seed") or 1)

    @property
    def conn(self):
        return self.engine.state.conn

    # --- Kontext für die Bewertung ----------------------------------------------------------------------------
    def context(self, agent_id: str, minute: int) -> AgentContext:
        st = self.engine.state
        body, model = st.agent(agent_id), self.agents.get(agent_id)
        if model is not None:
            self.goals.ensure_long(agent_id, model.profile.goals, minute)
        soft = self.needs.get(agent_id)
        outcomes = [d["outcome"] for d in self.agents.decisions(agent_id, 8) if d["outcome"]]
        talked = self.conn.execute("SELECT 1 FROM conversations WHERE status='ended' AND last_minute>? AND participants LIKE ? LIMIT 1",
                                   (minute - TALK_MEMORY_MINUTES, f'%"{agent_id}"%')).fetchone() is not None
        enabled = self.needs.params.enabled
        mood = mood_mod.compute(body.needs, soft, enabled, outcomes, talked)
        return AgentContext(soft={k: soft[k] for k in ("social", "calm", "warmth")}, enabled=dict(enabled), mood=mood,
                            relations={a.id: self.relations.get(agent_id, a.id) for a in st.agents() if a.id != agent_id}, goal=self.goals.active_short(agent_id),
                            long_goals=self.goals.long_goals(agent_id), locks=self.guards.locks(agent_id, minute), failures=self.guards.failures(agent_id, 8),
                            critical=self.needs.critical(body.needs, soft), seed=self.seed)

    def status_lines(self, p: Perception, ctx: AgentContext) -> list[str]:
        """Zusätzliche Zeilen für den Prompt: Bedürfnisse, Ziel, Beziehung zu den Anwesenden. Ausgeschaltete Bedürfnisse fehlen ganz."""
        lines = []
        words = need_words(ctx.soft, ctx.enabled)
        if words:
            lines.append("Außerdem: " + ", ".join(words) + ".")
        g = ctx.goal
        if g is not None:
            step = g.step
            lines.append(f"Dein Ziel: {g.text}" + (f" (Schritt {g.plan_step + 1} von {len(g.plan)}: {step['step']})" if step else ""))
        urgent = [LABELS[k] for k in ctx.critical]
        if urgent:
            lines.append("Dringend: " + ", ".join(urgent) + ".")
        for person in p.people:
            rel = ctx.relations.get(person.id)
            if rel is not None and (d := describe(rel, person.name)):
                lines.append(d)
        return lines

    # --- Entscheidung ------------------------------------------------------------------------------------------------
    def trace(self, dec, ctx: AgentContext) -> dict[str, Any]:
        opts = [o.to_dict() for o in dec.options]
        chosen = next((o for o in opts if o["id"] == dec.chosen_id), None)
        order = sorted(opts, key=lambda o: -o["score"])
        rank = next((i + 1 for i, o in enumerate(order) if chosen and o["id"] == chosen["id"]), None)
        g = ctx.goal
        goal = {"id": g.id, "text": g.text, "step": g.step["step"] if g.step else None, "plan_step": g.plan_step, "plan_len": len(g.plan)} if g else None
        why_goal = dec.chosen.meta.get("goal_why") if dec.chosen else None
        name = self.engine.state.agent(dec.agent_id).name
        return {"why": explain(name, chosen, opts, goal, why_goal, dec.intent, fallback=dec.status == "fallback"), "rank": rank, "best": rank == 1 if rank else None,
                "goal": goal, "goal_why": why_goal, "retrieval_id": dec.extra.get("retrieval_id"), "mood": ctx.mood.to_dict(),
                "groups": group_factors(chosen["factors"]) if chosen else {}, "critical": ctx.critical}

    def after_decision(self, dec, res: ProposeResult, minute: int, decision_seq: int | None, trace: dict[str, Any]) -> None:
        aid = dec.agent_id
        kind = dec.chosen.kind if dec.chosen else dec.action
        if not res.ok and res.rejected is not None:
            self.guards.log_failure(aid, minute, dec.action, dec.params, str(getattr(res.rejected.code, "value", res.rejected.code)), res.rejected.text,
                                    {"location": self.engine.state.agent(aid).location_id, "goal": (trace.get("goal") or {}).get("text"), "decision_seq": decision_seq}, decision_seq)
        if dec.status == "valid":
            self.goals.on_action(aid, kind, dec.params, res.ok, minute)
            self.guards.check_repetition(aid, dec.chosen, minute, self.agents.recent_actions(aid, 8))
        if self.guards.note_decision(aid, dec.status):
            self.guards.start_rest(aid, minute, "mehrere unbrauchbare Antworten in Folge")

    # --- Takt ---------------------------------------------------------------------------------------------------------
    def after_tick(self, events: list[Event], minute: int) -> None:
        ai = self.agents.ai_agent_ids()
        talking = {a.id for a in self.engine.state.agents() if a.action is not None and a.action.type == "speak"}
        self.needs.tick(ai, minute, talking)
        self.relations.on_events(events, ai)
        self.guards.on_events(events)
        for ev in events:
            if ev.type == "agent.location_changed" and ev.agents and ev.agents[0] in ai:
                self.memory.know.note_location(ev.agents[0], ev.data["to_location"], ev.sim_minute, visit=True)
            elif ev.type == "agent.action_failed" and ev.agents and ev.agents[0] in ai:
                d = ev.data
                self.guards.log_failure(ev.agents[0], ev.sim_minute, d["action"], d.get("params", {}), d["code"], d["text"], {"location": ev.location_id}, ev.seq)
                self.goals.on_action(ev.agents[0], d["action"], d.get("params", {}), False, ev.sim_minute)
            elif ev.type == "world.time":
                for a in ai:
                    self.relations.relax(a, minute)
        for a in ai:
            self.goals.evaluate(a, minute)

    async def housekeeping(self, minute: int, waiting: bool) -> None:
        """Ziele setzen, festgefahrene Pläne auflösen (Neuplanung, Alternativziel, Ruhemodus); mit niedriger Priorität wie Reflexionen."""
        db, gp = self.engine.db, self.planner.params
        for aid in self.agents.ai_agent_ids():
            g = await db.run(lambda a=aid: self.goals.active_short(a))
            model = await db.run(lambda a=aid: self.agents.get(a))
            if g is not None and model is not None:
                stale = gp.stale_minutes * (0.6 + model.personality.persistence / 100)
                reason = f"{g.failures} Planschritte in Folge gescheitert" if g.failures >= gp.max_failures else \
                    f"kein Fortschritt seit {minute - g.last_progress} Minuten" if minute - g.last_progress > stale else ""
                if not reason or (waiting and g.failures < gp.max_failures):
                    continue
                g.reason = reason
                if g.replans >= gp.max_replans:
                    await db.run(lambda x=g: self.goals.set_state(x, "abandoned", reason, minute))
                    self.abandoned_streak[aid] = self.abandoned_streak.get(aid, 0) + 1
                    if self.abandoned_streak[aid] >= self.guards.params.abandon_limit:
                        self.abandoned_streak[aid] = 0
                        await db.run(lambda a=aid: self.guards.start_rest(a, minute, "mehrere Ziele hintereinander aufgegeben"))
                else:
                    new = await self.planner.run(aid, reason, previous=g)
                    if new is not None:
                        self.abandoned_streak[aid] = 0
            elif not waiting and (r := self.planner.due(aid, minute, busy=False)):
                if await self.planner.run(aid, r) is not None:
                    self.abandoned_streak[aid] = 0

    def explain_json(self, trace: dict[str, Any] | None) -> str | None:
        return json.dumps(trace, ensure_ascii=False) if trace else None
