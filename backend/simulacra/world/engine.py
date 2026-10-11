"""Welt-Engine: einzige Instanz, die den Weltzustand ändert.

`propose` prüft einen Aktionsvorschlag und startet ihn oder lehnt ihn begründet ab;
`tick` lässt eine Simulationsminute vergehen (laufende Aktionen, Bedürfnisse, Wachstum, Wetter).
Jede Operation ist genau eine Transaktion: entweder alle Änderungen samt Ereignissen oder keine.
"""

import json
import logging
from typing import Any

from ..db.connection import Database
from ..events.bus import EventBus
from ..events.store import EventStore
from . import clock, extend, patches, weather
from .actions import REGISTRY
from .actions.base import Ctx, rej
from .loader import load_blueprints, seed_world
from .models import (Accepted, ActiveAction, AgentBody, Event, ProposeResult, RejectCode, Rejected)
from .rules import WorldRules
from .state import WorldState

log = logging.getLogger(__name__)
RECOVER = "recover"  # interne Aktion: Zeitverlust nach fehlgeschlagener Aktion


class WorldEditor:
    """Erweiterungen der laufenden Welt (siehe extend.py); jede Operation ist eine Transaktion mit Ereignis."""

    def __init__(self, engine: "WorldEngine"):
        self._e = engine

    def _do(self, fn, *args, **kw) -> extend.EditResult:
        out: dict[str, Any] = {}
        events = self._e._run(lambda ctx: out.update(value=fn(ctx, *args, **kw)))
        return extend.EditResult(events, out.get("value"))

    def add_tile_type(self, id_: str, **kw): return self._do(extend.add_tile_type, id_, **kw)
    def set_tiles(self, changes, cause: str = "edit"): return self._do(extend.set_tiles, changes, cause)
    def paint_rect(self, x: int, y: int, w: int, h: int, tile_type: str):
        return self._do(extend.set_tiles, [(x + i, y + j, tile_type) for j in range(h) for i in range(w)])
    def extend_map(self, width: int, height: int, fill: str = "grass"): return self._do(extend.extend_map, width, height, fill)
    def add_location(self, id_: str, name: str, rect, **kw): return self._do(extend.add_location, id_, name, rect, **kw)
    def update_location(self, id_: str, **kw): return self._do(extend.update_location, id_, **kw)
    def add_agent(self, id_: str, name: str, tile, **kw): return self._do(extend.add_agent, id_, name, tile, **kw)
    def spawn_object(self, kind: str, name: str, **kw): return self._do(extend.spawn_object, kind, name, **kw)
    def remove_object(self, object_id: str, cause: str = "removed"): return self._do(extend.remove_object, object_id, cause)
    def add_resource_node(self, id_: str, tile, resource: str, amount: float, cap: float, **kw):
        return self._do(extend.add_resource_node, id_, tile, resource, amount, cap, **kw)
    def apply_patch(self, patch: dict): return self._do(patches.apply_patch, patch)
    def applied_patches(self) -> list[dict]: return self._e.state.get_meta("patches", [])


class WorldEngine:
    def __init__(self, db: Database, blueprints: dict[str, dict[str, Any]] | None = None):
        self.db = db
        self.state = WorldState(db)
        self.blueprints = blueprints or load_blueprints()
        self.edit = WorldEditor(self)
        self.bus = EventBus()

    # --- Aufbau ------------------------------------------------------------------------
    @classmethod
    def create(cls, db: Database, world: dict | None = None, seed: int = 1) -> "WorldEngine":
        """Engine mit frischer Startwelt (Datenbank muss leer sein) oder mit vorhandenem Zustand."""
        eng = cls(db)
        if not eng.state.is_seeded():
            eng.state = seed_world(db, world, seed)
        return eng

    @property
    def minute(self) -> int:
        return self.state.minute

    # --- Transaktionsrahmen --------------------------------------------------------------
    def _run(self, fn) -> list[Event]:
        """Führt `fn(ctx)` in einer Transaktion aus; bei Fehlern wird alles verworfen, auch die Caches."""
        try:
            with self.db.transaction():
                ctx = Ctx(self, self.state.minute)
                result = fn(ctx)
                if ctx.events:
                    events = list(ctx.events)
                    self.db.on_commit(lambda: self.bus.publish(events))    # verteilt wird erst nach dem Commit
                return ctx.events if result is None else result
        except BaseException:
            self.state.reload_caches()
            raise

    # --- Vorschläge ----------------------------------------------------------------------
    def propose(self, actor_id: str, action: str, params: dict[str, Any] | None = None, parent_seq: int | None = None) -> ProposeResult:
        params = dict(params or {})
        out: dict[str, Any] = {}

        def work(ctx: Ctx) -> None:
            ctx.default_parent = parent_seq
            actor = self.state.agent(actor_id)
            if actor is None:
                out["rejected"] = rej(RejectCode.INVALID_TARGET, f"Es gibt keinen Agenten '{actor_id}'.")
                return
            handler = REGISTRY.get(action)
            if actor.action is not None:
                res: Accepted | Rejected = rej(RejectCode.BUSY, f"{actor.name} ist noch mit '{actor.action.type}' beschäftigt.")
            elif handler is None:
                res = rej(RejectCode.INVALID_TARGET, f"Unbekannte Aktion '{action}'.")
            else:
                res = handler.validate(ctx, actor, params)
            if isinstance(res, Rejected):
                out["rejected"] = res
                ev = ctx.emit("agent.action_rejected", [actor_id], actor.location_id,
                              {"action": action, "params": params, "code": res.code.value, "text": res.text})
                self._log(ctx, actor_id, action, params, "rejected", res.code.value, res.text, ev.seq)
                if res.code != RejectCode.BUSY:
                    self._penalize(ctx, actor)
                    self.state.save_agent(actor)
                return
            duration = None if res.duration is None else max(1, int(res.duration))
            act = ActiveAction(type=action, params=params, started_at=ctx.minute,
                               ends_at=None if duration is None else ctx.minute + duration, data=res.data)
            actor.action = act
            handler.start(ctx, actor, act)
            ev = ctx.emit("agent.action_started", [actor_id], actor.location_id,
                          {"action": action, "params": params, "ends_at": act.ends_at})
            act.data["event_seq"] = ev.seq                      # Folgeereignisse dieser Aktion verweisen darauf (caused_by)
            self._log(ctx, actor_id, action, params, "accepted", None, None, ev.seq)
            self.state.save_agent(actor)
            out["ends_at"] = act.ends_at

        events = self._run(work)
        rejected = out.get("rejected")
        return ProposeResult(ok=rejected is None, rejected=rejected, events=events, ends_at=out.get("ends_at"))

    def interrupt(self, actor_id: str, reason: str = "unterbrochen") -> list[Event]:
        def work(ctx: Ctx) -> None:
            actor = self.state.agent(actor_id)
            if actor is None or actor.action is None:
                return
            act, actor.action = actor.action, None
            ev = ctx.emit("agent.action_interrupted", [actor_id], actor.location_id, {"action": act.type, "reason": reason})
            self._log(ctx, actor_id, act.type, act.params, "interrupted", None, reason, ev.seq)
            self.state.save_agent(actor)
        return self._run(work)

    def set_rules(self, rules: WorldRules, announce: bool = True) -> list[Event]:
        """Übernimmt neue Weltregeln sofort (Obergrenzen werden angewandt, Sperren neu berechnet). `announce=False`: der Aufrufer meldet die Änderung selbst."""
        old = self.state.rules

        def work(ctx: Ctx) -> None:
            self.state.save_rules(rules)
            ratio = rules.resource_scarcity / old.resource_scarcity if old.resource_scarcity else 1.0
            for n in self.state.all_nodes():
                if n.cap < 900:
                    cap = n.cap * rules.resource_scarcity * rules.resource_availability
                    amount = min(cap, n.amount * ratio) if abs(ratio - 1.0) > 1e-9 else min(cap, n.amount)       # Knappheit skaliert den Bestand sofort
                    if abs(amount - n.amount) > 1e-9:
                        self.state.set_node_amount(n.id, amount)
            self.state.refresh_forbidden()
            if announce:
                ctx.emit("simulation.parameter_changed", data={"group": "world_rules", "rules": rules.model_dump()})
        return self._run(work)

    def set_weather(self, kind: str, duration_minutes: int, cause: str = "event") -> list[Event]:
        if kind not in weather.KINDS:
            raise ValueError(f"unbekanntes Wetter: {kind}")

        def work(ctx: Ctx) -> None:
            old = self.state.weather()
            self.state.set_weather(kind, ctx.minute, ctx.minute + max(1, duration_minutes))
            ctx.emit("world.weather_changed", data={"from": old["kind"], "to": kind, "until": ctx.minute + duration_minutes, "cause": cause})
        return self._run(work)

    # --- Zeitfortschritt -------------------------------------------------------------------
    def tick(self) -> list[Event]:
        def work(ctx: Ctx) -> None:
            prev = ctx.minute
            ctx.minute = prev + 1
            self.state.set_minute(ctx.minute)
            self._time_events(ctx, prev)
            if ctx.minute % 60 == 0:
                ctx.emit("world.time", data={**{k: v for k, v in clock.snapshot(ctx.minute).items() if k in ("day", "phase", "daylight", "time")}})
            self._weather(ctx)
            for actor in self.state.agents():
                self._step_agent(ctx, actor)
            self._grow_plants(ctx)
            if ctx.minute % 60 == 0:
                self._regen(ctx)
        return self._run(work)

    def advance(self, minutes: int) -> list[Event]:
        events: list[Event] = []
        for _ in range(minutes):
            events += self.tick()
        return events

    async def propose_async(self, actor_id: str, action: str, params: dict[str, Any] | None = None) -> ProposeResult:
        return await self.db.run(lambda: self.propose(actor_id, action, params))

    async def tick_async(self) -> list[Event]:
        return await self.db.run(self.tick)

    # --- Bestandteile des Ticks --------------------------------------------------------------
    def _time_events(self, ctx: Ctx, prev: int) -> None:
        if clock.phase(prev) != clock.phase(ctx.minute):
            ctx.emit("world.phase_changed", data={"phase": clock.phase(ctx.minute), "time": clock.fmt(ctx.minute)})
        if clock.minute_of_day(ctx.minute) == 0:
            ctx.emit("world.day_started", data={"day": clock.day_of(ctx.minute), "weekday": clock.weekday(ctx.minute)})

    def _weather(self, ctx: Ctx) -> None:
        w = self.state.weather()
        if ctx.minute >= w["until"]:
            kind, duration = weather.next_weather(self.state.get_meta("seed"), ctx.minute, w["kind"])
            self.state.set_weather(kind, ctx.minute, ctx.minute + duration)
            ctx.emit("world.weather_changed", data={"from": w["kind"], "to": kind, "until": ctx.minute + duration, "cause": "nature"})

    def _step_agent(self, ctx: Ctx, actor: AgentBody) -> None:
        sleeping = False
        act = actor.action
        ctx.default_parent = act.data.get("event_seq") if act is not None else None
        if act is not None:
            sleeping = act.type == "sleep" or (act.type == "use" and act.data.get("mode") == "sleep")
            if act.type == RECOVER:
                if ctx.minute >= (act.ends_at or 0):
                    actor.action = None
            else:
                handler = REGISTRY[act.type]
                handler.step(ctx, actor, act)
                if act.data.get("failed"):
                    code, text = act.data["failed"]
                    self._fail(ctx, actor, act, code, text)
                elif act.data.get("done") or (act.ends_at is not None and ctx.minute >= act.ends_at):
                    res = handler.finish(ctx, actor, act)
                    if isinstance(res, Rejected):
                        self._fail(ctx, actor, act, res.code.value, res.text)
                    else:
                        actor.action = None
                        ev = ctx.emit("agent.action_completed", [actor.id], actor.location_id, {"action": act.type, "params": act.params})
                        self._log(ctx, actor.id, act.type, act.params, "completed", None, None, ev.seq)
        ctx.default_parent = None
        self._decay_needs(ctx, actor, sleeping)
        self.state.save_agent(actor)

    def _fail(self, ctx: Ctx, actor: AgentBody, act: ActiveAction, code: str, text: str) -> None:
        actor.action = None
        ev = ctx.emit("agent.action_failed", [actor.id], actor.location_id, {"action": act.type, "params": act.params, "code": code, "text": text})
        self._log(ctx, actor.id, act.type, act.params, "failed", code, text, ev.seq)
        self._penalize(ctx, actor)

    def _penalize(self, ctx: Ctx, actor: AgentBody) -> None:
        r = ctx.rules
        if r.failure_penalty == "time" and actor.action is None:
            actor.action = ActiveAction(type=RECOVER, started_at=ctx.minute, ends_at=ctx.minute + r.failure_penalty_minutes)
        elif r.failure_penalty == "energy":
            actor.needs["energy"] = max(0.0, actor.needs.get("energy", 0) - 2.0)

    def _decay_needs(self, ctx: Ctx, actor: AgentBody, sleeping: bool) -> None:
        r = ctx.rules
        if not r.needs_enabled:
            return
        n = actor.needs
        factor = 0.5 if sleeping else 1.0
        if not sleeping:
            n["energy"] = max(0.0, n["energy"] - r.energy_decay_per_hour / 60)
        n["hunger"] = min(100.0, n["hunger"] + factor * r.hunger_rise_per_hour / 60)
        n["thirst"] = min(100.0, n["thirst"] + factor * r.thirst_rise_per_hour / 60)

    def _grow_plants(self, ctx: Ctx) -> None:
        raining = self.state.weather()["kind"] in weather.WATERS_PLANTS
        stage_minutes = int(ctx.rules.plant_hours_per_stage * 60)
        for r in self.state.conn.execute("SELECT id FROM objects WHERE kind='plant'").fetchall():
            o = self.state.obj(r["id"])
            s = o.state
            if raining:
                s["watered_at"] = ctx.minute
            wet = s["watered_at"] is not None and ctx.minute - s["watered_at"] <= 720
            if wet and s["stage"] < 4:
                s["growth_minutes"] += 1
                if s["growth_minutes"] >= stage_minutes:
                    s["growth_minutes"] = 0
                    s["stage"] += 1
                    self.state.save_object(o)
                    ctx.emit("world.object_changed", [], o.location_id, {**ctx.object_data(o), "change": "grew"})
                    continue
            self.state.save_object(o)

    def _regen(self, ctx: Ctx) -> None:
        scarcity = ctx.rules.resource_scarcity
        for n in self.state.all_nodes():
            if n.regen_per_hour <= 0 or n.cap >= 900:
                continue
            cap = n.cap * scarcity * ctx.rules.resource_availability
            new = min(cap, n.amount + n.regen_per_hour * scarcity)
            if new > n.amount:
                self.state.set_node_amount(n.id, new)
                if int(new) != int(n.amount):
                    ctx.emit("world.resource_changed", [], n.location_id, {"node": n.id, "resource": n.resource, "amount": new, "cause": "regrowth"})

    def _log(self, ctx: Ctx, actor: str, action: str, params: dict, outcome: str, code: str | None, text: str | None, seq: int | None) -> None:
        self.state.conn.execute(
            "INSERT INTO action_log(sim_minute, actor, action, params, outcome, code, text, event_seq) VALUES (?,?,?,?,?,?,?,?)",
            (ctx.minute, actor, action, json.dumps(params, ensure_ascii=False), outcome, code, text, seq))

    def check(self, actor_id: str, action: str, params: dict[str, Any] | None = None) -> Accepted | Rejected:
        """Trockenprüfung: Wäre dieser Vorschlag jetzt gültig? Ändert nichts und schreibt kein Ereignis."""
        actor, handler = self.state.agent(actor_id), REGISTRY.get(action)
        if actor is None or handler is None:
            return rej(RejectCode.INVALID_TARGET, "Unbekannter Agent oder unbekannte Aktion.")
        if actor.action is not None:
            return rej(RejectCode.BUSY, "Der Agent ist beschäftigt.")
        return handler.validate(Ctx(self, self.state.minute), actor, dict(params or {}))

    def emit_event(self, type_: str, agents: list[str] | None = None, location_id: str | None = None,
                   data: dict[str, Any] | None = None, parent_seq: int | None = None) -> Event:
        """Systemereignis außerhalb von Aktionen (z. B. Entscheidung gescheitert, Simulation pausiert)."""
        def work(ctx: Ctx) -> None:
            ctx.emit(type_, agents, location_id, data, parent_seq)
        return self._run(work)[0]

    # --- Abfragen ------------------------------------------------------------------------------
    def action_history(self, actor_id: str, limit: int = 20) -> list[dict[str, Any]]:
        cur = self.state.conn.execute("SELECT * FROM action_log WHERE actor=? ORDER BY id DESC LIMIT ?", (actor_id, limit))
        return [dict(r) | {"params": json.loads(r["params"])} for r in cur]

    def events_since(self, seq: int = 0, limit: int = 1000):
        return EventStore(self.state.conn).fetch(after_seq=seq, limit=limit)
