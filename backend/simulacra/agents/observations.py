"""Aus Ereignissen werden Beobachtungen je Agent: jeder erfährt nur, was er selbst wahrnehmen kann."""

import math
from typing import Any

from ..world import clock
from ..memory.models import Observed
from ..memory.importance import SHARED_KINDS
from ..world.models import AgentBody, Event
from ..world.state import WorldState
from .phrases import PHASE_DE, RES_DE, WEATHER_DE, loc_at, third_person
from .store import AgentStore

HEARING = 4.0            # wie in der Aktion `speak`
WITNESS_ACTIONS = {"use", "gather", "build", "plant", "water", "eat", "drink", "rest", "sleep", "take", "give", "inspect"}
Obs = tuple[str, str, str, int]  # (Agent, Art, Text, Wichtigkeit)


def _short_state(state: dict[str, Any]) -> str:
    parts = [f"{k}: {v}" for k, v in state.items() if v not in (None, "", [], {}, False)]
    return (", ".join(parts))[:140]


class ObservationCollector:
    def __init__(self, state: WorldState, store: AgentStore):
        self.state, self.store = state, store

    def ingest(self, events: list[Event], agent_ids: list[str]) -> list[Observed]:
        """Wandelt Ereignisse in Beobachtungen der KI-Agenten um, speichert sie im Kurzzeitpuffer und gibt sie zurück (Grundlage des Gedächtnisses)."""
        bodies = {a.id: a for a in self.state.agents()}
        out: list[Observed] = []
        for ev in events:
            for agent_id, kind, text, imp in self._observe(ev, bodies, set(agent_ids)):
                if agent_id in agent_ids:
                    self.store.add_observation(agent_id, ev.sim_minute, kind, text, imp, ev.seq)
                    persons = [p for p in dict.fromkeys([*ev.agents, *([ev.data["to"], ev.data["speaker"]] if ev.type == "agent.dialogue" else [])]) if p != agent_id and p in bodies]
                    out.append(Observed(agent_id=agent_id, kind=kind, text=text, importance=imp, minute=ev.sim_minute, event_seq=ev.seq,
                                        event_id=ev.event_id, location_id=ev.location_id, persons=persons, shared=bool(persons) and kind in SHARED_KINDS))
        return out

    # --- Regeln ---------------------------------------------------------------------------------
    @staticmethod
    def _at(bodies: dict[str, AgentBody], location_id: str | None, exclude: set[str]) -> list[str]:
        """Agenten, die sich an diesem Ort aufhalten und es deshalb mitbekommen."""
        return [a.id for a in bodies.values() if a.location_id == location_id and a.id not in exclude]

    def _observe(self, ev: Event, bodies: dict[str, AgentBody], ai: set[str]) -> list[Obs]:
        st, d, t = self.state, ev.data, ev.type
        who = ev.agents[0] if ev.agents else None
        name = bodies[who].name if who in bodies else (who or "")
        here = self._at(bodies, ev.location_id, set(ev.agents))
        loc = ev.location_id
        out: list[Obs] = []
        if t == "agent.arrived" and who:
            out.append((who, "arrived", f"Du bist angekommen: {d.get('label') or 'am Ziel'} ({loc_at(st, loc)}).", 3))
        elif t == "agent.location_changed" and who:
            to_l, from_l = st.locations.get(d["to_location"]), st.locations.get(d["from_location"])
            for w in self._at(bodies, d["to_location"], {who}):
                if to_l and not to_l.props.get("fallback"):
                    out.append((w, "seen", f"{name} kommt {loc_at(st, d['to_location'])} dazu.", 3))
            for w in self._at(bodies, d["from_location"], {who}):
                if from_l and not from_l.props.get("fallback"):
                    out.append((w, "seen", f"{name} verlässt {from_l.name}.", 3))
        elif t == "agent.location_discovered" and who:
            out.append((who, "discovery", f"Du lernst einen neuen Ort kennen: {st.locations[d['location']].name}.", 6))
        elif t == "agent.action_started" and who and d.get("action") in WITNESS_ACTIONS:
            txt = third_person(st, name, d["action"], d.get("params", {}))
            out += [(w, "seen", txt + ".", 2) for w in here]
        elif t == "agent.dialogue":
            sp, to = d["speaker"], d["to"]
            quote = d["text"]
            out.append((sp, "said", f"Du sagst zu {bodies[to].name}: «{quote}»", 5))
            out.append((to, "heard", f"{bodies[sp].name} sagt zu dir: «{quote}»", 6))
            spb = bodies[sp]
            for w in bodies.values():
                if w.id not in (sp, to) and (w.location_id == spb.location_id or math.dist(w.pos, spb.pos) <= HEARING):
                    out.append((w.id, "overheard", f"{bodies[sp].name} sagt zu {bodies[to].name}: «{quote}»", 4))
        elif t == "agent.inspected" and who:
            if "node" in d:
                out.append((who, "inspect", f"Du prüfst die Quelle für {RES_DE.get(d['resource'], d['resource'])}: etwa {d['amount']} vorhanden"
                            + (f", Werkzeug nötig: {d['requires_tool']}" if d.get("requires_tool") else "") + ".", 3))
            else:
                o = d["object"]
                extra = _short_state(o.get("state", {}))
                out.append((who, "inspect", f"Du siehst dir {o['name']} genauer an" + (f" ({extra})" if extra else "") + ".", 3))
        elif t == "agent.read" and who:
            items = [i["text"] if isinstance(i, dict) else str(i) for i in d.get("content", [])][:4]
            out.append((who, "read", f"Du liest bei {d['name']}: " + ("; ".join(items) if items else "nichts Neues") + ".", 4))
        elif t == "agent.ate" and who:
            out.append((who, "body", "Du hast etwas gegessen.", 2))
        elif t == "agent.drank" and who:
            out.append((who, "body", "Du hast etwas getrunken.", 2))
        elif t == "agent.slept" and who:
            out.append((who, "body", "Du hast geschlafen und fühlst dich erholt.", 3))
        elif t == "agent.rested" and who:
            out.append((who, "body", "Du hast dich ausgeruht.", 2))
        elif t == "agent.fished" and who:
            out.append((who, "result", "Du hast einen Fisch gefangen." if d["caught"] else "Diesmal hat nichts angebissen.", 3))
        elif t == "agent.inventory_changed" and who:
            res = RES_DE.get(d["resource"], d["resource"])
            out.append((who, "inventory", f"Du hast jetzt {d['qty']}× {res}." if d["delta"] > 0 else f"Du hast {res} verbraucht ({d['qty']} übrig).", 2))
        elif t in ("agent.item_taken", "agent.item_dropped") and who:
            verb = ("nimmst", "nimmt") if t == "agent.item_taken" else ("legst", "legst")
            nm = d["object"]["name"]
            out.append((who, "inventory", f"Du {verb[0]} {nm}" + ("" if t == "agent.item_taken" else " ab") + ".", 3))
        elif t == "agent.item_given" and len(ev.agents) == 2:
            giver, taker = ev.agents
            what = d["object"]["name"] if "object" in d else f"{d['amount']}× {RES_DE.get(d['resource'], d['resource'])}"
            out.append((giver, "gift", f"Du gibst {bodies[taker].name} {what}.", 4))
            out.append((taker, "gift", f"{bodies[giver].name} gibt dir {what}.", 6))
        elif t == "world.object_created":
            o, cause = d["object"], d.get("cause", "")
            if o["holder"] is None and o["kind"] != "construction_site":
                if who:
                    out.append((who, "result", f"Du hast {o['name']} " + {"build_done": "fertiggestellt", "plant": "eingepflanzt"}.get(cause, "geschaffen") + ".", 5))
                out += [(w, "seen", f"Neu {loc_at(st, loc)}: {o['name']}.", 3) for w in self._at(bodies, loc, set(ev.agents))]
        elif t == "world.object_changed" and d.get("change") == "grew":
            out += [(w, "seen", f"{d['name']} ist ein Stück gewachsen.", 2) for w in self._at(bodies, loc, set())]
        elif t == "world.object_discovered" and who:
            out.append((who, "discovery", f"Du entdeckst etwas: {d['object']['name']}.", 6))
        elif t in ("agent.action_failed", "agent.action_rejected") and who:
            out.append((who, "failure", f"Das ging nicht: {d.get('text', '')}", 3))
        elif t == "agent.action_interrupted" and who:
            out.append((who, "failure", f"Du wurdest unterbrochen ({d.get('reason', '')}).", 3))
        elif t == "world.weather_changed":
            out += [(a, "world", f"Das Wetter ändert sich: {WEATHER_DE.get(d['to'], d['to'])}.", 3) for a in bodies]
        elif t == "world.phase_changed":
            out += [(a, "world", f"Es ist jetzt {PHASE_DE[d['phase']]}.", 2) for a in bodies]
        elif t == "world.day_started":
            out += [(a, "world", f"Ein neuer Tag beginnt ({d['weekday']}).", 3) for a in bodies]
        elif t == "agent.conversation_ended":
            for p in d["participants"]:
                other = next((bodies[x].name for x in d["participants"] if x != p and x in bodies), "")
                out.append((p, "talk", f"Das Gespräch mit {other} ist zu Ende ({d['reason_text']}).", 3))
        return out
