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

from ..agents.conversation import ConversationManager
from ..agents.observations import ObservationCollector
from ..agents.planner import Decision, Planner
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


class SimulationRunner:
    def __init__(self, engine: WorldEngine, store: AgentStore, convs: ConversationManager, collector: ObservationCollector,
                 planner: Planner, limiter: DecisionLimiter | None = None, tick_delay_s: float = 0.0):
        self.engine, self.store, self.convs, self.collector, self.planner = engine, store, convs, collector, planner
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
        if not await self._decisions(force):
            return 0                                     # Pause mitten im Schritt: kein Tick, der Schritt wird später vollständig wiederholt
        events = await self.engine.tick_async()
        extra = await self.engine.db.run(lambda: self._after_tick(events))
        self.stats.ticks += 1
        return 1

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
            if body is not None and body.action is None:
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
        if dec.action == "speak" and dec.params.get("to"):
            self.convs.note_intent(aid, dec.params["to"], end=bool(opt and opt.meta.get("end")), proposal=dec.proposal if dec.status == "valid" else "",
                                   respond=(opt.meta.get("respond", "") if opt else ""))
        if dec.plan_next:
            self.store.set_plan(aid, dec.plan_next)
        decision_id = self.store.log_decision({
            "sim_minute": dec.minute, "agent_id": aid, "status": dec.status, "options": [o.to_dict() for o in dec.options], "chosen": dec.chosen_id,
            "action": dec.action, "params": dec.params, "intent": dec.intent, "importance": dec.importance, "utterance": dec.utterance,
            "plan_next": dec.plan_next, "attempts": dec.attempts, "latency_ms": dec.latency_ms, "prompt_tokens": dec.prompt_tokens,
            "completion_tokens": dec.completion_tokens, "error": dec.error})
        shown = {"decision_id": decision_id, "status": dec.status, "chosen": dec.chosen_id, "action": dec.action, "params": dec.params,
                 "intent": dec.intent, "importance": dec.importance, "attempts": dec.attempts, "latency_ms": dec.latency_ms,
                 "options": [{"id": o.id, "kind": o.kind, "label": o.label, "score": o.score} for o in dec.options],
                 "factors": [[n, v] for n, v in (dec.chosen.factors if dec.chosen else [])]}
        decision_event = eng.emit_event("agent.decision", [aid], loc, shown)
        res = eng.propose(aid, dec.action, dec.params, parent_seq=decision_event.seq)
        seq = next((e.seq for e in res.events if e.type in ("agent.action_started", "agent.action_rejected")), None)
        self.store.set_decision_outcome(decision_id, "accepted" if res.ok else "rejected", res.rejected.text if res.rejected else None, seq)
        self.store.mark_decided(aid)
        self._set_status(aid, self._status_of(aid))
        self.collector.ingest(res.events, self.store.ai_agent_ids())
        return res

    def _after_tick(self, events: list[Event]) -> list[Event]:
        extra: list[Event] = []
        for ev in events:
            if ev.type == "agent.dialogue":
                extra += self.convs.on_dialogue(ev)
        extra += self.convs.expire(self.engine.minute)
        self.collector.ingest(events + extra, self.store.ai_agent_ids())
        for aid in self.store.ai_agent_ids():
            self._set_status(aid, self._status_of(aid))
        return extra

    def _status_of(self, aid: str) -> str:
        body = self.engine.state.agent(aid)
        a = body.action if body else None
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
