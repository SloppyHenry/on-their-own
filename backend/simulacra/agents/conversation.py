"""Gespräche zwischen Agenten: Zustand, Vorschläge und Abbruchregeln.

Ein Gespräch entsteht, wenn jemand `speak` wählt (Zustand `opening`), wird mit dem ersten Beitrag `active`
und endet bei: Höchstzahl Beiträge, Stille, Entfernung, Wiederholung oder Verabschiedung.
"""

import json
import math
import re
from dataclasses import dataclass, field
from typing import Any

from ..world.engine import WorldEngine
from ..world.models import Event
from .store import AgentStore

HEARING = 4.0
SILENCE_MINUTES = 30
SIMILARITY_END = 0.8
REASONS = {"max_turns": "es war genug gesagt", "timeout": "niemand hat mehr geantwortet", "left": "einer ist weggegangen",
           "repetition": "es wiederholte sich nur noch", "farewell": "man hat sich verabschiedet"}


@dataclass
class Conversation:
    id: int
    participants: list[str]
    location_id: str | None
    started_at: int
    last_minute: int
    status: str
    turns: list[dict[str, Any]] = field(default_factory=list)
    proposal: dict[str, Any] | None = None
    pending_end: str | None = None
    end_reason: str | None = None

    def partner_of(self, agent_id: str) -> str:
        return next(p for p in self.participants if p != agent_id)


def _words(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower()))


def similar(a: str, b: str) -> float:
    wa, wb = _words(a), _words(b)
    return len(wa & wb) / len(wa | wb) if wa and wb else 0.0


class ConversationManager:
    def __init__(self, engine: WorldEngine, store: AgentStore, max_turns: int = 8):
        self.engine, self.store, self.max_turns = engine, store, max_turns

    @property
    def conn(self):
        return self.engine.state.conn

    def _row(self, r) -> Conversation:
        return Conversation(r["id"], json.loads(r["participants"]), r["location_id"], r["started_at"], r["last_minute"], r["status"],
                            json.loads(r["turns"]), json.loads(r["proposal"]) if r["proposal"] else None, r["pending_end"], r["end_reason"])

    def _save(self, c: Conversation) -> None:
        self.conn.execute("UPDATE conversations SET last_minute=?, status=?, end_reason=?, turns=?, proposal=?, pending_end=? WHERE id=?",
                          (c.last_minute, c.status, c.end_reason, json.dumps(c.turns, ensure_ascii=False),
                           json.dumps(c.proposal, ensure_ascii=False) if c.proposal else None, c.pending_end, c.id))

    def between(self, a: str, b: str) -> Conversation | None:
        key = json.dumps(sorted([a, b]))
        r = self.conn.execute("SELECT * FROM conversations WHERE participants=? AND status IN ('opening','active') ORDER BY id DESC LIMIT 1", (key,)).fetchone()
        return self._row(r) if r else None

    def active_for(self, agent_id: str) -> Conversation | None:
        for r in self.conn.execute("SELECT * FROM conversations WHERE status IN ('opening','active') ORDER BY id DESC"):
            if agent_id in json.loads(r["participants"]):
                return self._row(r)
        return None

    def _begin(self, a: str, b: str) -> Conversation:
        minute, body = self.engine.minute, self.engine.state.agent(a)
        cur = self.conn.execute("INSERT INTO conversations(participants, location_id, started_at, last_minute, status) VALUES(?,?,?,?, 'opening')",
                                (json.dumps(sorted([a, b])), body.location_id, minute, minute))
        return Conversation(cur.lastrowid, sorted([a, b]), body.location_id, minute, minute, "opening")

    # --- Entscheidungszeitpunkt: was der Sprecher mit seinem Beitrag vorhat ---------------------------
    def note_intent(self, speaker: str, partner: str, *, end: bool = False, proposal: str = "", respond: str = "") -> None:
        c = self.between(speaker, partner) or self._begin(speaker, partner)
        if end:
            c.pending_end = speaker
        if proposal.strip():
            c.proposal = {"by": speaker, "text": proposal.strip()[:200], "minute": self.engine.minute, "status": "queued", "response": None}
        if respond and c.proposal and c.proposal["by"] != speaker and c.proposal["status"] == "open":
            c.proposal["response"] = {"by": speaker, "value": respond}
        self._save(c)

    # --- Beitrag ist angekommen -----------------------------------------------------------------------
    def on_dialogue(self, ev: Event) -> list[Event]:
        sp, to, text = ev.data["speaker"], ev.data["to"], ev.data["text"]
        out: list[Event] = []
        c = self.between(sp, to)
        if c is None:
            c = self._begin(sp, to)
        if c.status == "opening":
            c.status = "active"
            out.append(self.engine.emit_event("conversation.started", c.participants, c.location_id, {"conversation": c.id, "by": sp}))
        previous = [t["text"] for t in c.turns if t["speaker"] == sp][-2:]
        repeated = any(similar(text, p) >= SIMILARITY_END for p in previous)
        c.turns.append({"speaker": sp, "text": text, "minute": ev.sim_minute})
        c.last_minute = ev.sim_minute
        p = c.proposal
        if p and p["status"] == "queued" and p["by"] == sp:
            p["status"] = "open"
        elif p and p["status"] == "open" and p.get("response") and p["response"]["by"] == sp:
            p["status"] = "accepted" if p["response"]["value"] == "accept" else "declined"
            out.append(self.engine.emit_event(f"conversation.proposal_{p['status']}", c.participants, c.location_id,
                                              {"conversation": c.id, "proposal": p["text"], "by": p["by"], "answered_by": sp}))
            if p["status"] == "accepted":
                for a in c.participants:
                    self.store.set_plan(a, p["text"])
        reason = "farewell" if c.pending_end == sp else "repetition" if repeated else "max_turns" if len(c.turns) >= self.max_turns else None
        if reason:
            out.append(self._end(c, reason))
        else:
            self._save(c)
        return out

    def _end(self, c: Conversation, reason: str) -> Event:
        c.status, c.end_reason = "ended", reason
        self._save(c)
        return self.engine.emit_event("conversation.ended", c.participants, c.location_id,
                                      {"conversation": c.id, "reason": reason, "reason_text": REASONS[reason], "turns": len(c.turns),
                                       "participants": c.participants})

    def expire(self, minute: int) -> list[Event]:
        """Beendet Gespräche nach Stille oder wenn sich die Teilnehmer entfernt haben."""
        out = []
        for r in self.conn.execute("SELECT * FROM conversations WHERE status IN ('opening','active')").fetchall():
            c = self._row(r)
            a, b = (self.engine.state.agent(x) for x in c.participants)
            if a is None or b is None:
                continue
            apart = a.location_id != b.location_id and math.dist(a.pos, b.pos) > HEARING
            if apart and c.status == "active":
                out.append(self._end(c, "left"))
            elif minute - c.last_minute > SILENCE_MINUTES:
                if c.status == "opening":              # nie ein Wort gewechselt: still verwerfen
                    c.status, c.end_reason = "ended", "timeout"
                    self._save(c)
                else:
                    out.append(self._end(c, "timeout"))
        return out

    # --- Sicht eines Agenten ---------------------------------------------------------------------------
    def view_for(self, agent_id: str, n_turns: int = 6) -> dict[str, Any] | None:
        c = self.active_for(agent_id)
        if c is None:
            return None
        names = {x: self.engine.state.agent(x).name for x in c.participants}
        partner = c.partner_of(agent_id)
        p = c.proposal if c.proposal and c.proposal["status"] == "open" else None
        return {"id": c.id, "partner": partner, "partner_name": names[partner], "status": c.status, "turn_count": len(c.turns),
                "lines": [f"{names[t['speaker']]}: {t['text']}" for t in c.turns[-n_turns:]],
                "awaiting_reply": bool(c.turns) and c.turns[-1]["speaker"] != agent_id,
                "open_proposal": {"by": p["by"], "by_name": names[p["by"]], "text": p["text"]} if p else None,
                "own_proposal_open": bool(p and p["by"] == agent_id)}
