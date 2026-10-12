"""§17 Nr. 15: ungültige Modellantworten beschädigen den Weltzustand nicht.

Das Fake-LLM liefert über viele Entscheidungen hinweg nur Unbrauchbares: leeren Text, kein JSON, falsche Typen, erfundene
Optionen, unmögliche oder gefährliche Aktionen, riesige Texte, Steuerzeichen, Befehle zum Ausführen, Netzfehler. Danach wird
der Weltzustand auf Integrität geprüft und es darf nichts davon in der Welt angekommen sein.
"""

import itertools
import json
from pathlib import Path

from simulacra.events.store import EventStore
from simulacra.llm.providers import LLMError

from agents.conftest import make_sim

SENTINEL = Path("/tmp/simulacra_k15_darf_nicht_entstehen")


def garbage():
    shell = f"import os; os.system('touch {SENTINEL}')"
    answers = [
        "", "kein json", "{", "[]", "null", '{"option_id": 7}',
        json.dumps({"option_id": "o99", "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "rm -rf /", "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "move_to", "other_params": {"tile": [-5, 99999]}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "give", "other_params": {"to": "mira", "resource": "wood", "amount": 10**9}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "take", "other_params": {"object_id": "../../etc/passwd"}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "build", "other_params": {"blueprint": {"$ne": 1}}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "speak", "other_params": {"to": "mira", "text": "x" * 20000}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "speak", "other_params": {"to": "mira", "text": "Ich rede mit mir selbst"}, "intent": "x", "utterance": "", "importance": 5}),   # Sprecher = Partner
        json.dumps({"option_id": "other", "other_action": "speak", "other_params": {"to": 7, "text": "Hallo"}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "speak", "other_params": {"to": ["alex", "mira"], "text": "Hallo"}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "other", "other_action": "speak", "other_params": {"to": "npc_gibtesnicht", "text": "Hallo"}, "intent": "x", "utterance": "", "importance": 5}),
        json.dumps({"option_id": "o1", "intent": shell, "utterance": f"```python\n{shell}\n```", "importance": "zehn"}),
        json.dumps({"option_id": "o1", "intent": "\x00\x1b[2J‮", "utterance": "", "importance": 99}),
        "x" * 200_000,
        json.dumps({"a": {"b": {"c": [[[[[[[[[[1]]]]]]]]]]}}}),
        LLMError("timeout", "Zeitüberschreitung (Test)"),
        LLMError("network", "Verbindung abgebrochen (Test)"),
    ]
    it = itertools.cycle(answers)
    return lambda messages, schema, params: next(it)


def integrity(sim) -> list[str]:
    st, conn, problems = sim.engine.state, sim.engine.state.conn, []
    if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        problems.append("integrity_check")
    if conn.execute("PRAGMA foreign_key_check").fetchall():
        problems.append("foreign_key_check")
    g, agents = st.grid, {a.id: a for a in st.agents()}
    for a in agents.values():
        if not (g.in_bounds(a.x, a.y) and g.is_open(a.x, a.y)) or st.location_at(a.x, a.y) != a.location_id:
            problems.append(f"{a.id} steht ungültig bei {a.x},{a.y}")
        if any(not isinstance(q, int) or q < 0 for q in a.inventory.values()) or st.inv_load(a) > a.capacity:
            problems.append(f"{a.id}: Inventar {a.inventory}")
        if any(not 0 <= v <= 100 for v in a.needs.values()):
            problems.append(f"{a.id}: Bedürfnisse {a.needs}")
    for o in st.all_objects():
        if o.holder is not None and o.holder not in agents:
            problems.append(f"{o.id}: Besitzer {o.holder}")
        if o.holder is None and o.x is not None and not g.in_bounds(o.x, o.y):
            problems.append(f"{o.id}: außerhalb")
    for n in st.all_nodes():
        if not 0 <= n.amount <= max(n.cap, 999):
            problems.append(f"{n.id}: Menge {n.amount}")
    seqs = [e.seq for e in EventStore(conn).fetch(limit=100000)]
    if seqs != list(range(1, len(seqs) + 1)):
        problems.append("Ereignisfolge mit Lücken")
    return problems


async def test_k15_serie_kaputter_antworten_laesst_die_welt_unbeschaedigt():
    SENTINEL.unlink(missing_ok=True)
    sim = make_sim(fn=garbage())
    sim.store.ensure_all()
    before = {a.id: (a.inventory, sorted(o.id for o in sim.engine.state.objects_held(a.id))) for a in sim.engine.state.agents()}
    objects_before = {o.id for o in sim.engine.state.all_objects()}
    await sim.runner.step(300)
    st = sim.runner.stats
    assert st.decisions >= 100 and st.fallback >= 30                                      # ein Drittel gar nicht lesbar (Rückfall) …
    assert st.rejected >= st.valid                                                        # … der Rest formal gültig, aber von der Welt abgelehnt
    assert integrity(sim) == []                                                           # und die Welt ist heil
    rows = sim.engine.state.conn.execute("SELECT status, action, outcome FROM decisions").fetchall()
    assert all(r["action"] == "wait" for r in rows if r["status"] == "fallback")         # Rückfall ist immer harmloses Warten
    assert {r["action"] for r in rows if r["outcome"] == "accepted"} == {"wait"}          # angenommen wurde nie etwas anderes als Warten
    after = {a.id: (a.inventory, sorted(o.id for o in sim.engine.state.objects_held(a.id))) for a in sim.engine.state.agents()}
    assert after == before and {o.id for o in sim.engine.state.all_objects()} == objects_before
    assert not SENTINEL.exists()                                                          # Modelltext wird nie ausgeführt
    guards = [e for e in sim.engine.events_since(0, 100000) if e.type == "agent.guard_triggered" and e.data["guard"] == "ruhemodus"]
    assert guards                                                                         # Serie unbrauchbarer Antworten → Ruhemodus
    sim.close()
