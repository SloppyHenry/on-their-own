"""Nebenfiguren (vereinfacht, offen gekennzeichnet): sichtbare Figuren mit einfachem Regelverhalten, ohne eigenes Gedächtnis und ohne Ziele.

Sie gehen zwischen Orten, können angesprochen werden und antworten mit kurzen Sätzen des Sprachmodells aus ihrer Beschreibung. Sie sind **keine** KI-Agenten:
kein Profil, kein Gedächtnis, keine Entscheidungen, keine Persönlichkeit; sie bleiben für die Dauer ihres Aufenthalts und gehen dann.
"""

import random
import re
from typing import Any

from ..llm.providers import LLMError
from ..world.extend import _free_tile_in, add_agent

REPLY_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["text"], "properties": {"text": {"type": "string"}}}
MOVE_EVERY = 45                    # Minuten zwischen zwei Wegen


def slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")).strip("_")
    return "npc_" + (s or "figur")[:20]


class Npcs:
    def __init__(self, sim):
        self.sim = sim
        self.present = bool(self.active())            # Nebenfiguren da? (spart den Weg über den DB-Thread, solange keine existieren)

    @property
    def conn(self):
        return self.sim.engine.state.conn

    def active(self) -> list[dict[str, Any]]:
        return [dict(r) for r in self.conn.execute("SELECT * FROM npcs ORDER BY agent_id")]

    def spawn(self, ctx, name: str, description: str, location: str | None, stay: int, inject_id: str | None) -> str:
        base, n = slug(name), 1
        nid = base
        while ctx.state.agent(nid) is not None:
            n += 1
            nid = f"{base}_{n}"
        loc = location or "square"
        x, y = _free_tile_in(ctx, loc)
        add_agent(ctx, nid, name, [x, y], needs={"energy": 90, "hunger": 10, "thirst": 10})
        self.present = True
        self.conn.execute("INSERT INTO npcs(agent_id, description, stay_until, last_move, inject_id) VALUES(?,?,?,?,?)", (nid, description or name, ctx.minute + stay, ctx.minute, inject_id))
        return nid

    # --- Verhalten (auf dem DB-Thread, einmal je Tick) ---------------------------------------------------------
    def tick(self, minute: int) -> list:
        events: list = []
        eng = self.sim.engine
        for n in self.active():
            body = eng.state.agent(n["agent_id"])
            if body is None:
                self.conn.execute("DELETE FROM npcs WHERE agent_id=?", (n["agent_id"],))
                continue
            if minute % 60 == 0:                                            # Bedürfnisse zurücksetzen: Nebenfiguren verhungern nicht
                body.needs = {"energy": 90.0, "hunger": 10.0, "thirst": 10.0}
                eng.state.save_agent(body)
            if minute >= n["stay_until"]:
                events += self.leave(n["agent_id"], body.name)
            elif body.action is None and minute - n["last_move"] >= MOVE_EVERY and not self.sim.convs.active_for(n["agent_id"]):
                rng = random.Random(f"{n['agent_id']}:{minute}")
                places = [l.id for l in eng.state.locations.values() if not l.props.get("fallback") and not l.id.startswith("house.") and l.id != body.location_id]
                if places:
                    target = rng.choice(places)
                    res = eng.propose(n["agent_id"], "move_to", {"target": target})
                    events += res.events
                    self.conn.execute("UPDATE npcs SET last_move=? WHERE agent_id=?", (minute, n["agent_id"]))
        return events

    def leave(self, nid: str, name: str) -> list:
        """Die Figur zieht weiter: Körper und Eintrag werden entfernt (Nebenfiguren haben kein Gedächtnis, das erhalten bleiben müsste)."""
        eng = self.sim.engine
        ev = eng.emit_event("world.npc_acted", [nid], eng.state.agent(nid).location_id, {"npc": nid, "what": f"{name} zieht weiter."})
        for t in ("inventory", "agents_body"):
            self.conn.execute(f"DELETE FROM {t} WHERE {'agent_id' if t == 'inventory' else 'id'}=?", (nid,))
        self.conn.execute("DELETE FROM npcs WHERE agent_id=?", (nid,))
        return [ev]

    # --- Antworten (async, Modellaufruf) --------------------------------------------------------------------------
    async def respond(self) -> None:
        """Wer eine Nebenfigur angesprochen hat, bekommt eine kurze Antwort. Fehler des Modells stören nie."""
        eng, db = self.sim.engine, self.sim.engine.db
        jobs = await db.run(self._pending_replies)
        for nid, partner, lines, desc, name in jobs:
            text = await self._reply(name, desc, lines)
            if text:
                await db.run(lambda n=nid, p=partner, t=text: self._say(n, p, t))

    def _pending_replies(self) -> list[tuple[str, str, list[str], str, str]]:
        out = []
        for n in self.active():
            view = self.sim.convs.view_for(n["agent_id"])
            body = self.sim.engine.state.agent(n["agent_id"])
            if view and view.get("awaiting_reply") and body is not None and body.action is None:
                out.append((n["agent_id"], view["partner"], view["lines"], n["description"], body.name))
        return out

    async def _reply(self, name: str, desc: str, lines: list[str]) -> str:
        system = (f"Du bist {name}, eine Nebenfigur in einem kleinen Dorf. Beschreibung: {desc}. Du antwortest in einem Satz oder zwei kurzen Sätzen auf Deutsch, "
                  "in der Ich-Form, in deiner Art. Du erwähnst nie, dass du eine Figur in einer Simulation bist. Antworte nur mit dem JSON-Objekt.")
        user = "Bisheriges Gespräch:\n" + "\n".join(lines[-6:]) + "\n\nWas sagst du?"
        try:
            res = await self.sim.client.chat([{"role": "system", "content": system}, {"role": "user", "content": user}], REPLY_SCHEMA)
            import json
            return str(json.loads(res.content).get("text", "")).strip()[:300]
        except (LLMError, ValueError, TypeError):
            return ""

    def _say(self, nid: str, partner: str, text: str) -> None:
        self.sim.convs.note_intent(nid, partner)
        res = self.sim.engine.propose(nid, "speak", {"to": partner, "text": text})
        if res.ok:
            self.sim.runner._after_tick(res.events)
