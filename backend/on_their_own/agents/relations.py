"""Beziehungen: je Richtung getrennt Vertrauen, Sympathie, Spannung, Vertrautheit (0–100), gemeinsame Erlebnisse und offene Konflikte.

Änderungen nur durch Ereignisse mit festen Regeln und durch Beziehungsreflexion (kleine, begrenzte Schritte, mit Quellen). Kein Zielzustand,
keine Drehbuchvorgabe (§4): die Werte beeinflussen nur Bewertung und Gesprächston. Alles wird mit Grund protokolliert.
"""

import json
from dataclasses import dataclass, field
from typing import Any

from ..world.engine import WorldEngine
from ..world.models import Event

METRICS = ("trust", "sympathy", "tension", "familiarity")
LABELS = {"trust": "Vertrauen", "sympathy": "Sympathie", "tension": "Spannung", "familiarity": "Vertrautheit"}
DAILY_CAP = 8.0          # so viel kann eine Kennzahl pro Simulationstag durch Regeln höchstens steigen (verhindert „Hochzüchten“)
REFLECTION_STEP = 2.0     # größter Schritt je Kennzahl durch eine Reflexion
DEFAULTS = {"trust": 50.0, "sympathy": 50.0, "tension": 10.0, "familiarity": 30.0}


@dataclass
class Relation:
    agent_id: str
    other_id: str
    trust: float = 50.0
    sympathy: float = 50.0
    tension: float = 10.0
    familiarity: float = 30.0
    shared: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)

    def values(self) -> dict[str, float]:
        return {m: round(getattr(self, m), 1) for m in METRICS}


class RelationStore:
    def __init__(self, engine: WorldEngine):
        self.engine = engine

    @property
    def conn(self):
        return self.engine.state.conn

    def get(self, agent_id: str, other_id: str) -> Relation:
        self.conn.execute("INSERT OR IGNORE INTO relations(agent_id, other_id) VALUES(?,?)", (agent_id, other_id))
        r = self.conn.execute("SELECT * FROM relations WHERE agent_id=? AND other_id=?", (agent_id, other_id)).fetchone()
        return Relation(agent_id, other_id, r["trust"], r["sympathy"], r["tension"], r["familiarity"], json.loads(r["shared"]), json.loads(r["conflicts"]))

    def set_start(self, agent_id: str, other_id: str, values: dict[str, float]) -> None:
        """Startwerte einer Beziehung (neue Simulation): wie von Anfang an, ohne Protokolleintrag und ohne Ereignis."""
        self.get(agent_id, other_id)
        for m in METRICS:
            if m in values:
                self.conn.execute(f"UPDATE relations SET {m}=? WHERE agent_id=? AND other_id=?", (max(0.0, min(100.0, float(values[m]))), agent_id, other_id))

    def all_of(self, agent_id: str) -> list[Relation]:
        return [self.get(agent_id, o["other_id"]) for o in self.conn.execute("SELECT other_id FROM relations WHERE agent_id=? ORDER BY other_id", (agent_id,)).fetchall()]

    def log(self, agent_id: str, other_id: str, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT sim_minute, deltas, reason, source, event_seq FROM relation_log WHERE agent_id=? AND other_id=? ORDER BY id DESC LIMIT ?",
                                 (agent_id, other_id, limit)).fetchall()
        return [dict(r) | {"deltas": json.loads(r["deltas"])} for r in rows]

    def _gained_today(self, agent_id: str, other_id: str, minute: int) -> dict[str, float]:
        gained = {m: 0.0 for m in METRICS}
        for r in self.conn.execute("SELECT deltas FROM relation_log WHERE agent_id=? AND other_id=? AND source='rule' AND sim_minute>?", (agent_id, other_id, minute - 1440)):
            for m, v in json.loads(r["deltas"]).items():
                if v > 0:
                    gained[m] += v
        return gained

    def adjust(self, agent_id: str, other_id: str, deltas: dict[str, float], reason: str, minute: int, *, source: str = "rule", event_seq: int | None = None,
               shared: str | None = None, conflict: str | None = None, resolve_conflicts: bool = False) -> Relation:
        """Wendet begrenzte Änderungen an, protokolliert sie und meldet `agent.relation_changed`."""
        rel = self.get(agent_id, other_id)
        gained = self._gained_today(agent_id, other_id, minute) if source == "rule" else {}
        applied: dict[str, float] = {}
        for m, d in deltas.items():
            if m not in METRICS or not d:
                continue
            if source == "reflection":
                d = max(-REFLECTION_STEP, min(REFLECTION_STEP, d))
            elif d > 0:
                d = min(d, max(0.0, DAILY_CAP - gained.get(m, 0.0)))
            new = max(0.0, min(100.0, getattr(rel, m) + d))
            if round(new - getattr(rel, m), 2):
                applied[m] = round(new - getattr(rel, m), 2)
                setattr(rel, m, new)
        if shared:
            rel.shared = [shared[:120], *rel.shared][:10]
        if conflict:
            rel.conflicts = [c for c in [conflict[:120], *rel.conflicts] if c][:3]
        if resolve_conflicts:
            rel.conflicts = []
        if not applied and not shared and not conflict and not resolve_conflicts:
            return rel
        self.conn.execute("UPDATE relations SET trust=?, sympathy=?, tension=?, familiarity=?, shared=?, conflicts=?, updated=? WHERE agent_id=? AND other_id=?",
                          (rel.trust, rel.sympathy, rel.tension, rel.familiarity, json.dumps(rel.shared, ensure_ascii=False), json.dumps(rel.conflicts, ensure_ascii=False),
                           minute, agent_id, other_id))
        if applied:
            self.conn.execute("INSERT INTO relation_log(agent_id, other_id, sim_minute, deltas, reason, source, event_seq) VALUES(?,?,?,?,?,?,?)",
                              (agent_id, other_id, minute, json.dumps(applied), reason, source, event_seq))
            self.engine.emit_event("agent.relation_changed", [agent_id], None, {"other": other_id, "deltas": applied, "values": rel.values(), "reason": reason, "source": source},
                                   parent_seq=event_seq)
        return rel

    def relax(self, agent_id: str, minute: int) -> None:
        """Spannung klingt langsam ab (einmal je Simulationsstunde)."""
        for r in self.all_of(agent_id):
            if r.tension > DEFAULTS["tension"] + 0.5:
                self.conn.execute("UPDATE relations SET tension=MAX(?, tension-1), updated=? WHERE agent_id=? AND other_id=?", (DEFAULTS["tension"], minute, agent_id, r.other_id))

    # --- Regeln aus Ereignissen ---------------------------------------------------------------------------
    def on_events(self, events: list[Event], ai_ids: list[str]) -> None:
        for ev in events:
            d, name = ev.data, (lambda x: (self.engine.state.agent(x).name if self.engine.state.agent(x) else x))
            if ev.type in ("agent.proposal_accepted", "agent.proposal_declined"):
                by, ans, text = d["by"], d["answered_by"], d.get("proposal", "")
                if ev.type == "agent.proposal_accepted":
                    if by in ai_ids:
                        self.adjust(by, ans, {"trust": 3, "sympathy": 3, "familiarity": 2, "tension": -2}, f"{name(ans)} hat meinen Vorschlag angenommen", ev.sim_minute,
                                    event_seq=ev.seq, shared=f"Vorschlag angenommen: {text}", resolve_conflicts=True)
                    if ans in ai_ids:
                        self.adjust(ans, by, {"trust": 2, "sympathy": 2, "familiarity": 2}, f"Ich habe den Vorschlag von {name(by)} angenommen", ev.sim_minute,
                                    event_seq=ev.seq, shared=f"Gemeinsam vereinbart: {text}")
                else:
                    if by in ai_ids:
                        self.adjust(by, ans, {"sympathy": -2, "tension": 3, "trust": -1}, f"{name(ans)} hat meinen Vorschlag abgelehnt", ev.sim_minute, event_seq=ev.seq,
                                    conflict=f"Vorschlag abgelehnt: {text}")
                    if ans in ai_ids:
                        self.adjust(ans, by, {"tension": 1}, f"Ich habe den Vorschlag von {name(by)} abgelehnt", ev.sim_minute, event_seq=ev.seq)
            elif ev.type == "agent.item_given" and d.get("from") != d.get("to"):
                giver, taker = d["from"], d["to"]
                if taker in ai_ids:
                    self.adjust(taker, giver, {"trust": 3, "sympathy": 3, "familiarity": 1, "tension": -2}, f"{name(giver)} hat mir etwas gegeben", ev.sim_minute, event_seq=ev.seq,
                                shared=f"{name(giver)} hat mir geholfen", resolve_conflicts=True)
                if giver in ai_ids:
                    self.adjust(giver, taker, {"sympathy": 1, "familiarity": 1}, f"Ich habe {name(taker)} etwas gegeben", ev.sim_minute, event_seq=ev.seq)
            elif ev.type == "agent.conversation_ended":
                reason, parts = d["reason"], d["participants"]
                for p in (x for x in parts if x in ai_ids):
                    other = next(x for x in parts if x != p)
                    if d["turns"] < 2:
                        continue
                    if reason in ("farewell", "max_turns"):
                        self.adjust(p, other, {"familiarity": 2, "sympathy": 1}, f"Gespräch mit {name(other)}", ev.sim_minute, event_seq=ev.seq, shared=f"Gespräch ({d['turns']} Beiträge)")
                    elif reason == "repetition":
                        self.adjust(p, other, {"sympathy": -1, "tension": 1}, f"Das Gespräch mit {name(other)} drehte sich im Kreis", ev.sim_minute, event_seq=ev.seq)


def describe(rel: Relation, other_name: str) -> str:
    """Kurzer Satz für den Prompt; nur auffällige Werte werden genannt."""
    bits = []
    if rel.trust >= 65:
        bits.append(f"du vertraust {other_name}")
    elif rel.trust <= 35:
        bits.append(f"du misstraust {other_name}")
    if rel.sympathy >= 65:
        bits.append(f"du magst {other_name}")
    elif rel.sympathy <= 35:
        bits.append(f"{other_name} ist dir unsympathisch")
    if rel.tension >= 40:
        bits.append("zwischen euch liegt Spannung")
    if rel.familiarity >= 70:
        bits.append("ihr kennt euch gut")
    elif rel.familiarity <= 25:
        bits.append("ihr kennt euch kaum")
    if rel.conflicts:
        bits.append(f"offen ist noch: {rel.conflicts[0]}")
    return f"Verhältnis zu {other_name}: " + ", ".join(bits) + "." if bits else ""
