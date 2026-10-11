"""Simulationsschleife: Entscheidungen der freien Agenten, dann ein Tick; Start, Pause, Fortsetzen, Einzelschritt, Stopp.

Die Zeit wartet auf Entscheidungen: ein Schritt endet erst, wenn alle fälligen Entscheidungen getroffen sind.
Eine Pause lässt eine laufende Modellanfrage zu Ende laufen und hält danach an (nie mitten in einer Entscheidung).
"""

import asyncio
import time
from collections import Counter
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from ..agents.autonomy import Autonomy
from ..agents.conversation import ConversationManager
from ..agents.observations import ObservationCollector
from ..agents.planner import Decision, Planner
from ..memory.system import MemorySystem
from ..agents.store import AgentStore
from ..world.engine import WorldEngine
from ..world.models import Event, ProposeResult
from .limits import DecisionLimiter


class SimState(StrEnum):
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    STEPPING = "stepping"


@dataclass
class RunStats:
    started_monotonic: float = field(default_factory=time.monotonic)
    decisions: int = 0
    valid: int = 0
    fallback: int = 0
    rejected: int = 0
    ticks: int = 0
    by_action: Counter = field(default_factory=Counter)

    def summary(self) -> dict[str, Any]:
        minutes = max(1e-9, (time.monotonic() - self.started_monotonic) / 60)
        return {"decisions": self.decisions, "valid": self.valid, "fallback": self.fallback, "rejected_by_world": self.rejected, "ticks": self.ticks,
                "valid_ratio": round(self.valid / self.decisions, 3) if self.decisions else None,
                "decisions_per_minute": round(self.decisions / minutes, 2), "by_action": dict(self.by_action)}


REFLECT_MAX_POSTPONE = 20            # Schritte, die eine Reflexion höchstens warten muss, wenn ständig Agenten entscheiden


class SimulationRunner:
    def __init__(self, engine: WorldEngine, store: AgentStore, convs: ConversationManager, collector: ObservationCollector,
                 planner: Planner, memory: MemorySystem, autonomy: Autonomy, limiter: DecisionLimiter | None = None, tick_delay_s: float = 0.0):
        self.engine, self.store, self.convs, self.collector, self.planner = engine, store, convs, collector, planner
        self.memory = memory
        self.autonomy = autonomy
        self.limiter = limiter or DecisionLimiter()
        self.tick_delay_s = tick_delay_s
        self.state = SimState.STOPPED
        self.stats = RunStats()
        self.decision_listeners: list[Callable[[Decision, ProposeResult], Any]] = []
        self._gate, self._idle = asyncio.Event(), asyncio.Event()
        self._idle.set()
        self._task: asyncio.Task | None = None
        self._stop_req = False
        self._step_lock = asyncio.Lock()
        self._rotation = 0
        self._postponed: dict[str, int] = {}
        self.minutes_per_tick = 1                       # Geschwindigkeit des Tageszyklus: so viele Simulationsminuten je Schritt (AP07)
        self.waits_for_decisions = True                 # an: die Zeit wartet auf die Entscheidungen; aus: sie läuft weiter, Entscheidungen kommen später
        self.decision_interval = 1                      # Mindestabstand zwischen Entscheidungen eines Agenten in Simulationsminuten
        self.power_save = False                         # Energiesparen: Pause ohne verbundenen Browser, begrenzte Entscheidungen, keine Reflexion am Tag
        self._bg: asyncio.Task | None = None

    # --- Steuerbefehle ----------------------------------------------------------------------------
    async def start(self, ticks: int | None = None) -> None:
        """Startet die Schleife (optional für eine feste Zahl Ticks, danach Zustand `stopped`)."""
        if self.state in (SimState.RUNNING, SimState.STEPPING):
            return
        await self.engine.db.run(self.store.ensure_all)
        self._stop_req = False
        self._gate.set()
        was_paused = self.state == SimState.PAUSED
        self.state = SimState.RUNNING
        await self._announce("simulation.resumed" if was_paused else "simulation.started")
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(ticks))

    async def pause(self) -> None:
        if self.state != SimState.RUNNING:
            return
        self._gate.clear()
        await self._idle.wait()                        # laufende Entscheidung läuft zu Ende
        await self._join_background()
        self.state = SimState.PAUSED
        await self._announce("simulation.paused")

    async def resume(self) -> None:
        if self.state == SimState.PAUSED:
            await self.start()

    async def step(self, n: int = 1) -> int:
        """Genau n Schritte (je: fällige Entscheidungen, dann ein Tick); nur im Zustand gestoppt oder pausiert."""
        if self.state not in (SimState.STOPPED, SimState.PAUSED):
            raise RuntimeError("Einzelschritt nur im Zustand gestoppt oder pausiert")
        previous = self.state
        async with self._step_lock:
            await self.engine.db.run(self.store.ensure_all)
            self.state = SimState.STEPPING
            done = 0
            try:
                for _ in range(n):
                    done += await self._step(force=True)
            finally:
                self.state = previous
            await self.engine.db.run(lambda: self.engine.emit_event("simulation.stepped", data={"n": done, "minute": self.engine.minute}))
        return done

    async def stop(self) -> None:
        if self.state == SimState.STOPPED and (self._task is None or self._task.done()):
            return
        self._stop_req = True
        self._gate.set()
        if self._task is not None:
            await self._task
        await self._join_background()
        self.state = SimState.STOPPED
        await self._announce("simulation.stopped")

    async def wait_finished(self) -> None:
        if self._task is not None:
            await self._task

    def set_speed(self, tick_delay_s: float) -> None:
        self.tick_delay_s = max(0.0, tick_delay_s)

    # --- Schleife -------------------------------------------------------------------------------------
    async def _loop(self, ticks: int | None) -> None:
        done = 0
        try:
            while True:
                self._idle.set()
                await self._gate.wait()
                self._idle.clear()
                if self._stop_req or (ticks is not None and done >= ticks):
                    break
                if self.power_save and not self.engine.bus._subs:       # niemand schaut zu: nichts tun, bis ein Browser verbunden ist
                    await asyncio.sleep(1.0)
                    continue
                async with self._step_lock:
                    done += await self._step(force=False)
                if self.tick_delay_s:
                    await asyncio.sleep(self.tick_delay_s)
        finally:
            self._idle.set()
            if ticks is not None and not self._stop_req:
                self.state = SimState.STOPPED
                await self._announce("simulation.stopped")

    async def _step(self, force: bool) -> int:
        if self.waits_for_decisions or force:
            if not await self._decisions(force):
                return 0                                 # Pause mitten im Schritt: kein Tick, der Schritt wird später vollständig wiederholt
        elif self._bg is None or self._bg.done():
            self._bg = asyncio.create_task(self._decisions(True))     # Zeit läuft weiter, Entscheidungen kommen, wenn das Modell fertig ist
        events: list[Event] = []
        for _ in range(self.minutes_per_tick):
            tick = await self.engine.tick_async()
            extra = await self.engine.db.run(lambda t=tick: self._after_tick(t))
            events += tick + extra
        await self._housekeeping(events, force)
        self.stats.ticks += 1
        return 1

    async def _join_background(self) -> None:
        if self._bg is not None and not self._bg.done():
            await self._bg
        self._bg = None

    async def _housekeeping(self, events: list[Event], force: bool) -> None:
        """Gedächtnispflege einmal je Tag; Reflexionen mit niedriger Priorität: nur wenn kein Agent auf eine Entscheidung wartet (oder lange aufgeschoben)."""
        db, mem = self.engine.db, self.memory
        if any(e.type == "world.day_started" for e in events):
            await db.run(lambda: [mem.maintenance.run(a, self.engine.minute) for a in self.store.ai_agent_ids()])
        if not force and not self._gate.is_set():
            return
        waiting = bool(await db.run(self._due_agents))
        due = await db.run(lambda: [(a, r) for a in self.store.ai_agent_ids() if (r := mem.reflector.due(a, self.engine.minute))])
        for aid, reason in due:
            self._postponed[aid] = self._postponed.get(aid, 0) + 1
            if waiting and self._postponed[aid] < REFLECT_MAX_POSTPONE:
                continue
            self._postponed[aid] = 0
            await mem.reflector.run(aid, reason)
        await self.autonomy.housekeeping(self.engine.minute, waiting)

    async def _decisions(self, force: bool) -> bool:
        ids = await self.engine.db.run(self._due_agents)
        if ids:
            self._rotation += 1
            k = self._rotation % len(ids)
            ids = ids[k:] + ids[:k]                      # wechselnde Reihenfolge: keiner wird bevorzugt
        for aid in ids:
            if not force and not self._gate.is_set():
                return False
            await self._decide(aid)
        return True

    def _due_agents(self) -> list[str]:
        out = []
        for aid in self.store.ai_agent_ids():
            body = self.engine.state.agent(aid)
            if body is None or body.action is not None or self.autonomy.guards.resting(aid, self.engine.minute):
                continue
            last = self.store.get(aid).last_decision_minute
            if self.decision_interval > 1 and last is not None and self.engine.minute - last < self.decision_interval:
                continue                                  # Mindestabstand zwischen zwei Entscheidungen (Parameter)
            out.append(aid)
        return out

    async def _decide(self, aid: str) -> None:
        await self.limiter.acquire(aid)
        db = self.engine.db
        prep = await db.run(lambda: self._prepare(aid))
        dec = await self.planner.ask(prep)
        res = await db.run(lambda: self._apply(dec))
        self.stats.decisions += 1
        self.stats.valid += dec.status == "valid"
        self.stats.fallback += dec.status == "fallback"
        self.stats.rejected += not res.ok
        self.stats.by_action[dec.action] += 1
        for cb in self.decision_listeners:
            cb(dec, res)

    # --- Arbeit auf dem DB-Thread -----------------------------------------------------------------------
    def _prepare(self, aid: str):
        self._set_status(aid, "deciding")
        return self.planner.prepare(aid)

    def _apply(self, dec: Decision) -> ProposeResult:
        eng, aid = self.engine, dec.agent_id
        loc = eng.state.agent(aid).location_id
        if dec.status == "fallback":
            eng.emit_event("agent.decision_failed", [aid], loc, {"reason": dec.error, "attempts": dec.attempts})
        opt = dec.chosen
        if dec.action == "speak" and isinstance(dec.params.get("to"), str):
            ref = dec.params["to"].strip().lower()                 # das Modell schreibt gelegentlich „Alex“ statt „alex“: immer die Kennung verwenden
            partner = next((a for a in eng.state.agents() if a.id.lower() == ref or a.name.lower() == ref), None)
            if partner is not None:
                dec.params["to"] = partner.id
        if dec.action == "speak" and dec.params.get("to"):
            self.convs.note_intent(aid, dec.params["to"], end=bool(opt and opt.meta.get("end")), proposal=dec.proposal if dec.status == "valid" else "",
                                   respond=(opt.meta.get("respond", "") if opt else ""))
        if dec.plan_next:
            self.store.set_plan(aid, dec.plan_next)
        ctx = dec.extra.get("ctx")
        trace = self.autonomy.trace(dec, ctx) if ctx is not None else {}
        decision_id = self.store.log_decision({
            "sim_minute": dec.minute, "agent_id": aid, "status": dec.status, "options": [o.to_dict() for o in dec.options], "chosen": dec.chosen_id,
            "action": dec.action, "params": dec.params, "intent": dec.intent, "importance": dec.importance, "utterance": dec.utterance,
            "plan_next": dec.plan_next, "attempts": dec.attempts, "latency_ms": dec.latency_ms, "prompt_tokens": dec.prompt_tokens,
            "completion_tokens": dec.completion_tokens, "error": dec.error, "goal_id": (trace.get("goal") or {}).get("id"), "trace": trace or None})
        shown = {"decision_id": decision_id, "status": dec.status, "chosen": dec.chosen_id, "action": dec.action, "params": dec.params,
                 "intent": dec.intent, "importance": dec.importance, "attempts": dec.attempts, "latency_ms": dec.latency_ms,
                 "options": [{"id": o.id, "kind": o.kind, "label": o.label, "score": o.score} for o in dec.options],
                 "factors": [[n, v] for n, v in (dec.chosen.factors if dec.chosen else [])], "why": trace.get("why", ""), "rank": trace.get("rank"),
                 "goal": (trace.get("goal") or {}).get("text"), "retrieval_id": dec.extra.get("retrieval_id")}
        decision_event = eng.emit_event("agent.decision", [aid], loc, shown)
        res = eng.propose(aid, dec.action, dec.params, parent_seq=decision_event.seq)
        seq = next((e.seq for e in res.events if e.type in ("agent.action_started", "agent.action_rejected")), None)
        self.store.set_decision_outcome(decision_id, "accepted" if res.ok else "rejected", res.rejected.text if res.rejected else None, seq)
        if trace:
            trace["outcome"] = {"ok": res.ok, "code": str(getattr(res.rejected.code, "value", res.rejected.code)) if res.rejected else None, "text": res.rejected.text if res.rejected else None}
            self.store.set_decision_trace(decision_id, trace)
        self.autonomy.after_decision(dec, res, self.engine.minute, decision_event.seq, trace or {})
        self.store.mark_decided(aid)
        self._set_status(aid, self._status_of(aid))
        self._remember(res.events, dec, decision_id, decision_event.seq, res)
        return res

    def _remember(self, events: list[Event], dec: Decision | None = None, decision_id: int | None = None, decision_seq: int | None = None, res: ProposeResult | None = None) -> None:
        """Beobachtungen aufnehmen und daraus Erinnerungen schreiben (bei einer Entscheidung mit deren Wichtigkeit und Absicht)."""
        ai = self.store.ai_agent_ids()
        mem, observed = self.memory, self.collector.ingest(events, self.store.ai_agent_ids())
        valid = dec is not None and dec.status == "valid"
        if dec is not None and decision_id is not None and dec.extra.get("retrieval_id"):
            mem.know.link_decision(dec.agent_id, dec.extra["retrieval_id"], decision_id)
        mem.writer.process(observed, {dec.agent_id: dec.importance} if valid else None)
        if valid and dec is not None and res is not None:
            loc = self.engine.state.agent(dec.agent_id).location_id
            mem.writer.from_decision(dec.agent_id, dec.action, dec.intent, dec.importance, self.engine.minute, loc, accepted=res.ok,
                                     reason=res.rejected.text if res.rejected else None, params=dec.params, decision_seq=decision_seq)
            if dec.plan_next:
                mem.writer.set_intention(dec.agent_id, dec.plan_next, self.engine.minute, loc, dec.intent)
        for ev in events:
            if ev.type == "agent.conversation_ended":
                mem.writer.conversation_ended(ev, ai)

    def _after_tick(self, events: list[Event]) -> list[Event]:
        extra: list[Event] = []
        for ev in events:
            if ev.type == "agent.dialogue":
                extra += self.convs.on_dialogue(ev)
        extra += self.convs.expire(self.engine.minute)
        self._remember(events + extra)
        self.autonomy.after_tick(events + extra, self.engine.minute)
        for aid in self.store.ai_agent_ids():
            self._set_status(aid, self._status_of(aid))
        return extra

    def _status_of(self, aid: str) -> str:
        body = self.engine.state.agent(aid)
        a = body.action if body else None
        if self.autonomy.guards.resting(aid, self.engine.minute):
            return "resting_mode"
        return ("idle" if a is None else "sleeping" if a.type == "sleep" or a.data.get("mode") == "sleep" else "talking" if a.type == "speak"
                else "resting_mode" if a.type == "recover" else "acting")

    def _set_status(self, aid: str, new: str) -> None:
        old = self.store.get(aid).status
        if old != new:
            self.store.set_status(aid, new)
            self.engine.emit_event("agent.status_changed", [aid], self.engine.state.agent(aid).location_id, {"old": old, "new": new})

    # --- Veröffentlichen ----------------------------------------------------------------------------------
    async def _announce(self, type_: str) -> None:
        await self.engine.db.run(lambda: self.engine.emit_event(type_, data={"minute": self.engine.minute}))
