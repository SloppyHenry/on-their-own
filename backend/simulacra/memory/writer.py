"""Schreibpfad: Beobachtungen, Entscheidungen und Gespräche werden zu Erinnerungen. Kein Modellaufruf; die Wichtigkeit kommt aus Regeln und der
Einschätzung des Agenten. Unter der Schwelle bleibt etwas nur im Kurzzeitpuffer (Beobachtungen)."""

import json
from typing import Any

from ..world.engine import WorldEngine
from ..world.models import Event
from . import importance as imp
from . import keywords as kw
from .knowledge import KnowledgeStore
from .models import Memory, Observed
from .params import MemoryParams
from .store import MemoryStore

DEDUPE_MINUTES = 30
QUOTE = 90


def _cut(text: str, n: int = QUOTE) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


class MemoryWriter:
    def __init__(self, engine: WorldEngine, mem: MemoryStore, know: KnowledgeStore, params: MemoryParams):
        self.engine, self.mem, self.know, self.params = engine, mem, know, params

    # --- Hilfen --------------------------------------------------------------------------------
    def _name(self, agent_id: str) -> str:
        a = self.engine.state.agent(agent_id)
        return a.name if a else agent_id

    def _loc_name(self, location_id: str | None) -> str:
        loc = self.engine.state.locations.get(location_id) if location_id else None
        return loc.name if loc else ""

    def _keywords(self, text: str, location_id: str | None, persons: list[str], extra: list[str] | None = None) -> list[str]:
        names = [self._name(p) for p in persons]
        return kw.build(text, [*(extra or []), location_id or "", self._loc_name(location_id), *persons, *names])

    def _emit(self, m: Memory, caused_by: int | None = None) -> None:
        self.engine.emit_event("agent.memory_created", [m.agent_id], m.location_id,
                               {"memory_id": m.id, "kind": m.kind, "text": m.text, "importance": m.importance, "location": m.location_id, "persons": m.persons,
                                "shared": m.shared, "source_event_id": m.source_event_id, "source_memory_ids": m.source_memory_ids}, parent_seq=caused_by)

    def _skipped(self, agent_id: str, text: str, importance: int, reason: str, location_id: str | None) -> None:
        if self.params.debug_skips:
            self.engine.emit_event("agent.memory_skipped", [agent_id], location_id, {"text": text, "importance": importance, "reason": reason})

    def _duplicate(self, agent_id: str, text: str, minute: int) -> bool:
        return any(m.text == text and minute - m.sim_created <= DEDUPE_MINUTES for m in self.mem.recent(agent_id, limit=6))

    def remember(self, agent_id: str, kind: str, text: str, importance: int, minute: int, *, location_id: str | None = None, persons: list[str] | None = None,
                 shared: bool = False, source_event_id: str | None = None, source_memory_ids: list[str] | None = None, extra_keywords: list[str] | None = None,
                 caused_by: int | None = None, force: bool = False, **intention) -> Memory | None:
        """Speichert, wenn die Wichtigkeit die Schwelle erreicht (oder `force`). Gibt die Erinnerung zurück oder None."""
        persons = persons or []
        if not force and importance < self.params.store_threshold:
            self._skipped(agent_id, text, importance, "unter der Schwelle", location_id)
            return None
        if self._duplicate(agent_id, text, minute):
            return None
        m = self.mem.add(agent_id, kind, text, importance, minute, keywords=self._keywords(text, location_id, persons, extra_keywords), persons=persons,
                         location_id=location_id, shared=shared, source_event_id=source_event_id, source_memory_ids=source_memory_ids, **intention)
        if kind not in ("reflection", "summary"):
            self.know.add_importance(agent_id, importance)
        self._emit(m, caused_by)
        return m

    # --- Beobachtungen ---------------------------------------------------------------------------------
    def process(self, observed: list[Observed], decision_importance: dict[str, int] | None = None) -> list[Memory]:
        out: list[Memory] = []
        for o in observed:
            if o.kind == "discovery" and o.location_id:
                self.know.note_location(o.agent_id, o.location_id, o.minute)
            if o.kind in imp.SKIP_KINDS:
                continue
            value = imp.blend(o, (decision_importance or {}).get(o.agent_id))
            if o.persons and not self.mem.related(o.agent_id, o.persons[:1], None, 1):
                value = min(10, value + 2)                              # erste Begegnung mit dieser Person
            m = self.remember(o.agent_id, imp.memory_kind(o.kind), imp.first_person(o.text), value, o.minute, location_id=o.location_id, persons=o.persons,
                              shared=o.shared, source_event_id=o.event_id)
            if m:
                out.append(m)
        return out

    # --- Entscheidungen -------------------------------------------------------------------------------------
    def from_decision(self, agent_id: str, action: str, intent: str, importance: int, minute: int, location_id: str | None, *, accepted: bool,
                      reason: str | None, params: dict[str, Any], decision_seq: int | None = None) -> Memory | None:
        """Was sich der Agent vorgenommen hat, in seinen eigenen Worten; Gespräche fassen wir je Gespräch zusammen."""
        if action == "speak" or not intent.strip():
            return None
        text = f"Ich habe mir vorgenommen: {_cut(intent.strip().rstrip('.'), 140)}." if accepted else \
               f"Es hat nicht geklappt: {_cut(intent.strip().rstrip('.'), 100)} ({_cut(reason or 'abgelehnt', 80)})."
        extra = [action, *[str(v) for k, v in params.items() if k in ("target", "object_id", "seedbed_id", "site_id", "resource", "blueprint") and isinstance(v, str)]]
        return self.remember(agent_id, "episode", text, importance if accepted else max(importance, 4), minute, location_id=location_id, extra_keywords=extra,
                             caused_by=decision_seq)

    def set_intention(self, agent_id: str, plan: str, minute: int, location_id: str | None, current_intent: str = "") -> Memory | None:
        """Neues Vorhaben (`plan_next`). Ein vorheriges offenes Vorhaben gilt als erledigt, wenn es zur aktuellen Absicht passt, sonst als aufgegeben."""
        plan = plan.strip().rstrip(".")
        if not plan:
            return None
        new_words = set(kw.tokens(plan))
        for old in self.mem.recent(agent_id, kinds=("intention",), limit=10):
            if old.intention_state != "open":
                continue
            old_words = set(kw.tokens(old.text))
            if old_words and len(old_words & new_words) / len(old_words | new_words) >= 0.6:
                return None                                              # dasselbe Vorhaben, anders formuliert
            done = bool(old_words & set(kw.tokens(current_intent))) and len(old_words & set(kw.tokens(current_intent))) >= 2
            self.mem.set_intention(agent_id, old.id, "done" if done else "dropped")
        return self.remember(agent_id, "intention", f"Ich habe vor: {_cut(plan, 140)}.", 5, minute, location_id=location_id, force=True, intention_state="open")

    # --- Gespräche --------------------------------------------------------------------------------------------
    def conversation_ended(self, ev: Event, ai_ids: list[str]) -> list[Memory]:
        """Je Teilnehmer eine Erinnerung aus der eigenen Sicht (nicht jeder Satz)."""
        d = ev.data
        row = self.engine.state.conn.execute("SELECT turns, proposal, location_id FROM conversations WHERE id=?", (d["conversation"],)).fetchone()
        if row is None:
            return []
        turns = json.loads(row["turns"])
        proposal = json.loads(row["proposal"]) if row["proposal"] else None
        out: list[Memory] = []
        for p in d["participants"]:
            if p not in ai_ids:
                continue
            other = next((x for x in d["participants"] if x != p), "")
            mine = [t["text"] for t in turns if t["speaker"] == p]
            theirs = [t["text"] for t in turns if t["speaker"] == other]
            parts = [f"Ich habe mit {self._name(other)} gesprochen ({len(turns)} Beiträge)."]
            if theirs:
                parts.append(f"{self._name(other)} sagte: «{_cut(theirs[-1])}»")
            if mine:
                parts.append(f"Ich sagte: «{_cut(mine[0])}»")
            if proposal and proposal.get("status") == "accepted":
                parts.append(f"Wir haben vereinbart: {_cut(proposal['text'], 80)}")
            value = min(10, 5 + (len(turns) >= 4) + (bool(proposal and proposal.get("status") == "accepted")))
            m = self.remember(p, "relation", " ".join(parts), value, ev.sim_minute, location_id=row["location_id"], persons=[other], shared=True,
                              source_event_id=ev.event_id, caused_by=ev.seq)
            if m:
                out.append(m)
        return out
