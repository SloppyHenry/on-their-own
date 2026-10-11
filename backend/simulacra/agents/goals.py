"""Ziele: langfristig (aus dem Profil) und kurzfristig (konkret, **prüfbar gegen den Weltzustand**, nicht gegen Modelltext), mit Plan und Fortschritt.

Ob ein kurzfristiges Ziel erreicht ist, entscheidet die Welt: eine Erfüllungsbedingung aus fünf festen Arten wird gegen den Zustand ausgewertet.
Ziele werden als Absichts-Erinnerungen gespiegelt (AP05) und überleben so Neustarts; Änderungen melden `agent.goal_changed`.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any

from ..events.ulid import new_ulid
from ..world.engine import WorldEngine

CONDITION_TYPES = ("object_count", "location_visited", "has_resource", "talked_with", "plant_stage")
PLAN_KINDS = ("move", "explore", "gather", "build", "plant", "water", "harvest", "speak", "give", "inspect", "read", "eat", "drink", "rest", "sleep", "resume", "take", "fish", "cook")
MIRROR_PREFIX = "Mein Ziel:"


@dataclass
class Goal:
    id: str
    agent_id: str
    kind: str                                   # long | short
    text: str
    state: str = "active"                       # active | paused | achieved | abandoned
    condition: dict[str, Any] | None = None
    plan: list[dict[str, Any]] = field(default_factory=list)
    plan_step: int = 0
    progress: float = 0.0
    created: int = 0
    updated: int = 0
    last_progress: int = 0
    failures: int = 0
    replans: int = 0
    parent_id: str | None = None
    reason: str = ""
    memory_id: str | None = None

    @property
    def step(self) -> dict[str, Any] | None:
        return self.plan[self.plan_step] if self.plan_step < len(self.plan) else None


def _goal(r) -> Goal:
    return Goal(r["id"], r["agent_id"], r["kind"], r["text"], r["state"], json.loads(r["condition"]) if r["condition"] else None, json.loads(r["plan"]),
                r["plan_step"], r["progress"], r["created"], r["updated"], r["last_progress"], r["failures"], r["replans"], r["parent_id"], r["reason"], r["memory_id"])


class GoalStore:
    def __init__(self, engine: WorldEngine, memory=None):
        self.engine, self.memory = engine, memory          # `memory`: MemorySystem (Spiegelung als Absicht), optional

    @property
    def conn(self):
        return self.engine.state.conn

    # --- Lesen -------------------------------------------------------------------------------------
    def get(self, agent_id: str, goal_id: str) -> Goal | None:
        r = self.conn.execute("SELECT * FROM goals WHERE agent_id=? AND id=?", (agent_id, goal_id)).fetchone()
        return _goal(r) if r else None

    def list(self, agent_id: str, *, kind: str | None = None, state: str | None = None, limit: int = 50) -> list[Goal]:
        q, args = "SELECT * FROM goals WHERE agent_id=?", [agent_id]
        for col, val in (("kind", kind), ("state", state)):
            if val:
                q += f" AND {col}=?"
                args.append(val)
        return [_goal(r) for r in self.conn.execute(q + " ORDER BY created DESC, rowid DESC LIMIT ?", args + [limit]).fetchall()]

    def active_short(self, agent_id: str) -> Goal | None:
        return next(iter(self.list(agent_id, kind="short", state="active", limit=1)), None)

    def long_goals(self, agent_id: str) -> list[Goal]:
        return self.list(agent_id, kind="long", state="active")

    # --- Schreiben ---------------------------------------------------------------------------------
    def _emit(self, g: Goal, old: str | None, reason: str, replaced: str | None = None) -> None:
        self.engine.emit_event("agent.goal_changed", [g.agent_id], None, {"goal_id": g.id, "kind": g.kind, "text": g.text, "old": old, "new": g.state, "reason": reason,
                                                                        "progress": round(g.progress, 2), "replaced": replaced})

    def ensure_long(self, agent_id: str, texts: list[str], minute: int) -> None:
        """Langfristige Ziele aus dem Profil, einmalig."""
        have = {g.text for g in self.list(agent_id, kind="long", limit=100)}
        for t in texts:
            if t and t not in have:
                self.create(agent_id, "long", t, minute, reason="aus dem Profil")

    def sync_long(self, agent_id: str, texts: list[str], minute: int) -> None:
        """Gleicht die langfristigen Ziele mit den (geänderten) Zielen des Profils ab: Entfernte werden aufgegeben, neue angelegt."""
        wanted = {t.strip() for t in texts if t.strip()}
        for g in self.long_goals(agent_id):
            if g.text not in wanted:
                self.set_state(g, "abandoned", "aus dem Profil entfernt", minute)
        self.ensure_long(agent_id, sorted(wanted, key=texts.index) if all(w in texts for w in wanted) else list(wanted), minute)

    def create(self, agent_id: str, kind: str, text: str, minute: int, *, condition: dict | None = None, plan: list[dict] | None = None, parent_id: str | None = None,
               reason: str = "", replaces: str | None = None) -> Goal:
        gid = "goal_" + new_ulid()
        self.conn.execute("INSERT INTO goals(id, agent_id, kind, text, condition, plan, created, updated, last_progress, parent_id, reason) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                          (gid, agent_id, kind, text, json.dumps(condition) if condition else None, json.dumps(plan or [], ensure_ascii=False), minute, minute, minute, parent_id, reason))
        g = self.get(agent_id, gid)
        assert g is not None
        if self.memory is not None and kind == "short":
            m = self.memory.writer.remember(agent_id, "intention", f"{MIRROR_PREFIX} {text}", 6, minute, force=True, intention_state="open", extra_keywords=["ziel"])
            if m:
                self.conn.execute("UPDATE goals SET memory_id=? WHERE id=?", (m.id, gid))
                g.memory_id = m.id
        self._emit(g, None, reason or "neu gesetzt", replaced=replaces)
        return g

    def set_state(self, g: Goal, state: str, reason: str, minute: int) -> Goal:
        old, g.state, g.updated, g.reason = g.state, state, minute, reason
        if state == "achieved":
            g.progress = 1.0
        self.conn.execute("UPDATE goals SET state=?, updated=?, reason=?, progress=? WHERE id=?", (state, minute, reason, g.progress, g.id))
        if self.memory is not None and g.memory_id and state in ("achieved", "abandoned", "paused"):
            self.memory.store.set_intention(g.agent_id, g.memory_id, "done" if state == "achieved" else "dropped")
        self._emit(g, old, reason)
        return g

    def save_progress(self, g: Goal) -> None:
        self.conn.execute("UPDATE goals SET plan=?, plan_step=?, progress=?, updated=?, last_progress=?, failures=?, replans=? WHERE id=?",
                          (json.dumps(g.plan, ensure_ascii=False), g.plan_step, g.progress, g.updated, g.last_progress, g.failures, g.replans, g.id))

    # --- Auswertung gegen den Weltzustand -------------------------------------------------------------
    def check(self, g: Goal) -> tuple[bool, float]:
        """(erfüllt?, Teilfortschritt 0–1) der Erfüllungsbedingung gegen den aktuellen Zustand."""
        c, st, aid = g.condition, self.engine.state, g.agent_id
        if not c:
            return False, 0.0
        t = c.get("type")
        if t == "object_count":
            n = sum(1 for o in st.all_objects() if o.kind == c["kind"] and (not c.get("location") or o.location_id == c["location"]) and o.holder is None)
            return n >= c["min"], min(1.0, n / c["min"]) if c["min"] else 1.0
        if t == "location_visited":
            r = self.conn.execute("SELECT visits FROM known_locations WHERE agent_id=? AND location_id=?", (aid, c["location"])).fetchone()
            visits = r["visits"] if r else 0
            return visits >= c["min_visits"], min(1.0, visits / c["min_visits"])
        if t == "has_resource":
            have = (st.agent(aid).inventory.get(c["resource"], 0)) if st.agent(aid) else 0
            return have >= c["amount"], min(1.0, have / c["amount"])
        if t == "talked_with":
            for r in self.conn.execute("SELECT turns FROM conversations WHERE status='ended' AND last_minute>=? AND participants LIKE ?", (c["since"], f'%"{c["person"]}"%')).fetchall():
                turns = json.loads(r["turns"])
                if len(turns) >= 2 and aid in {x["speaker"] for x in turns} and (not c.get("topic") or re.search(re.escape(c["topic"][:5]), " ".join(x["text"] for x in turns), re.I)):
                    return True, 1.0
            return False, 0.0
        if t == "plant_stage":
            best = max((o.state.get("stage", 0) for o in st.all_objects() if o.kind == "plant" and o.created_by == aid and o.created_at >= g.created), default=-1)
            return best >= c["min_stage"], max(0.0, min(1.0, (best + 1) / (c["min_stage"] + 1)))
        return False, 0.0

    def evaluate(self, agent_id: str, minute: int) -> Goal | None:
        """Prüft das aktive kurzfristige Ziel; erfüllt: Zustand `achieved`. Gibt das geänderte Ziel zurück."""
        g = self.active_short(agent_id)
        if g is None:
            return None
        done, part = self.check(g)
        plan_part = g.plan_step / len(g.plan) if g.plan else 0.0
        progress = max(part, plan_part * 0.9)
        if progress > g.progress + 0.001:
            g.progress, g.last_progress, g.updated = progress, minute, minute
            self.save_progress(g)
        if done:
            return self.set_state(g, "achieved", "Bedingung in der Welt erfüllt", minute)
        return None

    # --- Plan: Schritte und Fehlschläge -----------------------------------------------------------------
    def on_action(self, agent_id: str, kind: str, params: dict[str, Any], ok: bool, minute: int) -> None:
        """Eine gewählte Aktion rückt den Plan vor (wenn sie zum Schritt passt) oder zählt als Fehlschlag."""
        g = self.active_short(agent_id)
        step = g.step if g else None
        if g is None or step is None or not _matches(step, kind, params):
            return
        if ok:
            g.plan_step, g.failures, g.last_progress, g.updated = g.plan_step + 1, 0, minute, minute
        else:
            g.failures, g.updated = g.failures + 1, minute
        self.save_progress(g)


def _matches(step: dict[str, Any], kind: str, params: dict[str, Any]) -> bool:
    if step.get("kind") != kind and not (step.get("kind") == "move" and kind in ("explore", "search")):
        return False
    target = step.get("target")
    if not target:
        return True
    return target in {str(v) for v in params.values()}
