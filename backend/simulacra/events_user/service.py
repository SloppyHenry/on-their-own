"""Ereignis-Controller (§10.1): Text → Regelparser → (Sprachmodell) → Prüfung → Rückfrage/Vorschau → Ausführung. Jede Eingabe steht mit Status in `inject_log`."""

import json
import re
import time
import uuid
from collections import deque
from typing import Any

from ..events.models_user import EventInjected  # noqa: F401  (Modell für die Ereignisdaten)
from ..world import clock
from ..world.extend import WorldEditError
from . import apply as applier
from . import interpret as llm
from . import times, validate
from .lexicon import Lexicon
from .npc import Npcs
from .rules import Clarify, Ctx, Parsed, parse as rule_parse
from .scheduler import Scheduler
from .schema import MAX_TEXT, parse_ops

RATE_PER_MINUTE = 10                # Eingaben je Minute (Echtzeit)


class InjectError(Exception):
    def __init__(self, status: int, text: str):
        super().__init__(text)
        self.status, self.text = status, text


class InjectService:
    def __init__(self, sim):
        self.sim = sim
        self.npcs = Npcs(sim)
        sim.npcs = self.npcs
        self._recent: deque[float] = deque()
        self.rate = RATE_PER_MINUTE

    @property
    def conn(self):
        return self.sim.engine.state.conn

    @property
    def mode(self) -> str:
        return self.sim.planner.mode.mode

    @property
    def sched(self) -> Scheduler:
        return Scheduler(self.conn)

    # --- Kontext (DB-Thread) ---------------------------------------------------------------------------------------
    def _lex(self) -> Lexicon:
        return Lexicon.build(self.sim.engine.state, self.sim.store.ai_agent_ids())

    def _env(self, lex: Lexicon) -> validate.Env:
        st = self.sim.engine.state
        return validate.Env(st, lex, st.minute, self.mode, self.sched.count_pending(), len(self.npcs.active()))

    def _context(self, text: str):
        st = self.sim.engine.state
        lex = self._lex()
        where = {a.id: a.location_id for a in st.agents()}
        parsed = rule_parse(text, Ctx(lex, st.minute, where))
        return lex, where, st.minute, parsed

    # --- Eingabe ------------------------------------------------------------------------------------------------------
    def _limit(self, text: str) -> str:
        text = (text or "").strip()
        if not text:
            raise InjectError(422, "Die Eingabe ist leer.")
        if len(text) > MAX_TEXT:
            raise InjectError(422, f"Die Eingabe ist zu lang ({len(text)} von höchstens {MAX_TEXT} Zeichen).")
        now = time.monotonic()
        while self._recent and self._recent[0] < now - 60:
            self._recent.popleft()
        if len(self._recent) >= self.rate:
            raise InjectError(429, f"Zu viele Eingaben: höchstens {self.rate} je Minute.")
        self._recent.append(now)
        return text

    async def parse(self, text: str, agents: list[str] | None = None, at: int | None = None, answer_to: str | None = None, answer: Any = None) -> dict[str, Any]:
        db = self.sim.engine.db
        if answer_to:
            res = await db.run(lambda: self._answer(answer_to, answer))
            return await self.parse(res, agents, at) if isinstance(res, str) else res          # freie Rückfrage: mit der Antwort neu verstehen
        text = self._limit(text)
        lex, where, now, parsed = await db.run(lambda: self._context(text))
        source, clarify, raw = "rule", parsed.clarify if parsed else None, [dict(o) for o in parsed.ops] if parsed else []
        if parsed is None:
            source = "llm"
            got = await llm.interpret(self.sim, text, lex, where, now, self.mode, agents or [])
            if got is None:
                return await db.run(lambda: self._record(text, "rejected", source, [], reason="Das habe ich nicht verstanden, und das Sprachmodell hat nicht geantwortet.", agents=agents, at=at))
            raw, question, conf = got
            if not raw or conf < 0.5:
                q = question or "Das ist mir zu unklar. Was genau soll passieren, wo und für wen?"
                return await db.run(lambda: self._record(text, "needs_clarification", source, raw, clarify=Clarify(q, [], 0, "", True), agents=agents, at=at))
        if at is not None and raw:
            if any(o.get("op") in ("move_agent", "suggest_goal", "temp_param") for o in raw):
                return await db.run(lambda: self._record(text, "rejected", source, raw, reason="Anweisungen an Agenten lassen sich nicht für später planen.", agents=agents, at=at))
            if not (len(raw) == 1 and raw[0].get("op") == "schedule"):
                raw = [{"op": "schedule", "at": at, "ops": raw, "label": text[:80]}]
        return await db.run(lambda: self._evaluate(self._record(text, "ready", source, raw, agents=agents, at=at), raw, clarify))

    # --- Antwort auf eine Rückfrage --------------------------------------------------------------------------------------
    def _answer(self, pid: str, value: Any) -> dict[str, Any] | str:
        row = self._row(pid)
        if row["status"] != "needs_clarification":
            raise InjectError(409, "Diese Eingabe wartet auf keine Antwort.")
        cl = json.loads(row["clarification"] or "null")
        raw = json.loads(row["ops"])
        if cl["field"] == "subject":                                           # „Er findet etwas“ + Antwort „Alex“ → „Alex findet etwas“
            self.conn.execute("UPDATE inject_log SET status='cancelled' WHERE id=?", (pid,))
            return re.sub(r"^(er|sie)\b", str(value), row["text"], count=1, flags=re.I)
        if not raw or cl is None or not cl.get("field"):
            # freie Rückfrage des Modells: die Antwort ergänzt den Text, die Eingabe wird neu verstanden
            self.conn.execute("UPDATE inject_log SET status='cancelled' WHERE id=?", (pid,))
            return f"{row['text']} {value}".strip()[:MAX_TEXT]
        field, idx = cl["field"], cl["op"]
        if field in ("when", "at") and isinstance(value, str):
            moment = times.moment(value, self.sim.engine.minute, (18, 0) if field == "when" else (10, 0))
            if moment is None:
                return self._set_clarify(pid, raw, Clarify("Das konnte ich nicht als Zeitpunkt lesen. Zum Beispiel „morgen um 18 Uhr“.", cl["options"], idx, field, True))
            value = moment
        op = raw[idx]
        if field == "location" and op.get("op") == "schedule":
            for inner in op["ops"]:
                inner["location"] = value
        else:
            op[field] = value
        return self._evaluate(row, raw, None)

    def _set_clarify(self, pid: str, raw: list[dict[str, Any]], cl: Clarify) -> dict[str, Any]:
        self.conn.execute("UPDATE inject_log SET status='needs_clarification', ops=?, clarification=?, preview='[]' WHERE id=?", (json.dumps(raw, ensure_ascii=False), json.dumps(cl.__dict__, ensure_ascii=False), pid))
        return self.get(pid)

    # --- Prüfen --------------------------------------------------------------------------------------------------------
    def _evaluate(self, row: dict[str, Any], raw: list[dict[str, Any]], clarify: Clarify | None) -> dict[str, Any]:
        pid = row["id"]
        if clarify is not None:
            return self._set_clarify(pid, raw, clarify)
        if not raw:
            return self._finish(pid, "rejected", raw, reason="Daraus konnte ich kein Ereignis machen.")
        try:
            checked = validate.check(self._env(self._lex()), raw)
        except validate.NeedsAnswer as e:
            return self._set_clarify(pid, raw, e.clarify)
        except validate.Reject as e:
            return self._finish(pid, "rejected", raw, reason=e.text)
        ops = [o.model_dump(mode="json", exclude_none=True) for o in checked.ops]
        # Was das Sprachmodell gedeutet hat, wird nie ungesehen ausgeführt: immer erst die Vorschau
        status = "needs_confirmation" if checked.needs_confirmation or row["source"] == "llm" else "ready"
        self.conn.execute("UPDATE inject_log SET status=?, ops=?, preview=?, clarification=NULL, reason='' WHERE id=?", (status, json.dumps(ops, ensure_ascii=False), json.dumps(checked.preview, ensure_ascii=False), pid))
        return self.get(pid)

    def _finish(self, pid: str, status: str, raw: list[dict[str, Any]], reason: str = "") -> dict[str, Any]:
        self.conn.execute("UPDATE inject_log SET status=?, ops=?, reason=?, clarification=NULL WHERE id=?", (status, json.dumps(raw, ensure_ascii=False, default=str), reason, pid))
        return self.get(pid)

    def _record(self, text: str, status: str, source: str, raw: list, *, reason: str = "", clarify: Clarify | None = None, agents: list[str] | None = None, at: int | None = None) -> dict[str, Any]:
        pid = "inj_" + uuid.uuid4().hex[:10]
        self.conn.execute("INSERT INTO inject_log(id, text, status, source, ops, reason, clarification, mode, agents, at_minute, created) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                          (pid, text, status, source, json.dumps(raw, ensure_ascii=False, default=str), reason, json.dumps(clarify.__dict__, ensure_ascii=False) if clarify else None,
                           self.mode, json.dumps(agents or []), at, self.sim.engine.minute))
        return self.get(pid)

    # --- Lesen -----------------------------------------------------------------------------------------------------------
    def _row(self, pid: str):
        r = self.conn.execute("SELECT * FROM inject_log WHERE id=?", (pid,)).fetchone()
        if r is None:
            raise InjectError(404, "Diese Eingabe gibt es nicht.")
        return r

    def get(self, pid: str) -> dict[str, Any]:
        r = self._row(pid)
        ops = json.loads(r["ops"])
        cl = json.loads(r["clarification"]) if r["clarification"] else None
        return {"id": r["id"], "text": r["text"], "status": r["status"], "source": r["source"], "ops": ops, "preview": json.loads(r["preview"]), "clarification": cl,
                "reason": r["reason"], "mode": r["mode"], "needs_confirmation": r["status"] == "needs_confirmation", "directive": any(o.get("op") in ("move_agent", "suggest_goal", "temp_param") for o in ops),
                "at_minute": r["at_minute"], "created": r["created"], "executed": r["executed"], "event_seqs": json.loads(r["event_seqs"])}

    def history(self, limit: int = 30) -> list[dict[str, Any]]:
        return [self.get(r["id"]) for r in self.conn.execute("SELECT id FROM inject_log ORDER BY rowid DESC LIMIT ?", (limit,))]

    # --- Ausführen ----------------------------------------------------------------------------------------------------------
    def confirm(self, pid: str) -> dict[str, Any]:
        """Bestätigten Vorschlag ausführen (DB-Thread). Wird vorher noch einmal gegen die aktuelle Welt geprüft."""
        r = self._row(pid)
        if r["status"] == "executed":
            raise InjectError(409, "Dieses Ereignis wurde schon ausgeführt.")
        if r["status"] not in ("ready", "needs_confirmation"):
            raise InjectError(409, f"Dieses Ereignis ist im Zustand „{r['status']}“ und lässt sich nicht ausführen.")
        raw = json.loads(r["ops"])
        try:
            checked = validate.check(self._env(self._lex()), raw)
        except validate.NeedsAnswer as e:
            return self._set_clarify(pid, raw, e.clarify)
        except validate.Reject as e:
            return self._finish(pid, "rejected", raw, reason=e.text)
        try:
            events = applier.execute(self.sim, checked.ops, pid, self.mode)
        except (WorldEditError, ValueError, KeyError) as e:
            return self._finish(pid, "rejected", raw, reason=getattr(e, "text", None) or str(e))
        injected = self.sim.engine.emit_event("simulation.event_injected", [], None, {"inject_id": pid, "text": r["text"], "source": r["source"], "mode": self.mode,
                                                                                     "directive": checked.directive, "summary": checked.preview, "ops": [o.model_dump(mode="json", exclude_none=True) for o in checked.ops]})
        events = [injected, *events]
        self.sim.runner._remember(events)
        self.conn.execute("UPDATE inject_log SET status='executed', executed=?, event_seqs=?, clarification=NULL WHERE id=?", (self.sim.engine.minute, json.dumps([e.seq for e in events]), pid))
        return self.get(pid)

    # --- Zeit: geplante Ereignisse und Rücknahmen, Nebenfiguren (je Tick auf dem DB-Thread) ----------------------------------------------
    def on_tick(self, minute: int) -> list:
        events: list = []
        sch = self.sched
        for s in sch.due(minute):
            sch.done(s["id"])
            try:
                events += self._fire(s)
            except (WorldEditError, ValueError, KeyError) as e:
                events.append(self.sim.engine.emit_event("simulation.event_fired", [], None, {"scheduled_id": s["id"], "kind": s["kind"], "text": f"{s['text'] or 'Geplantes Ereignis'}: nicht möglich ({getattr(e, 'text', None) or e})"}))
        events += self.npcs.tick(minute)
        return events

    def _fire(self, s: dict[str, Any]) -> list:
        eng = self.sim.engine
        if s["kind"] == "revert":
            eng._run(lambda ctx: applier.revert(self.sim, ctx, s["ops"][0]))
            return [eng.emit_event("simulation.effect_ended", [], None, {"what": s["ops"][0]["revert"], "text": s["text"]})]
        payload = s["ops"][0]
        ops = parse_ops(payload["ops"])
        events = applier.execute(self.sim, ops, s["inject_id"], self.mode)
        made = [e.data["object"]["id"] for e in events if e.type == "world.object_created" and e.data.get("cause") == "user_event"]
        if payload.get("duration_minutes") and made:
            self.sched.add(eng.minute + payload["duration_minutes"], "revert", [{"revert": "remove_objects", "ids": made}], f"{s['text'] or 'Die Veranstaltung'} ist vorbei", eng.minute, s["inject_id"])
        return [eng.emit_event("simulation.event_fired", [], None, {"scheduled_id": s["id"], "kind": "fire", "text": s["text"] or "Geplantes Ereignis"}), *events]

    def scheduled(self) -> list[dict[str, Any]]:
        return self.sched.pending("fire")


__all__ = ["InjectError", "InjectService", "clock", "Parsed"]
