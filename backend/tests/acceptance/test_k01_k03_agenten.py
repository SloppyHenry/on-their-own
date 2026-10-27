"""§17 Nr. 1–3: zwei Agenten in einer Welt, getrennte Gedächtnisse, eigenständige Aktionswahl."""

import ast
import re
from pathlib import Path

from agents.conftest import make_sim

from .conftest import ROOT, Server


def test_k01_zwei_agenten_existieren_gleichzeitig_in_derselben_welt(server: Server):
    snap = server.get("/api/state")
    agents = {a["id"]: a for a in snap["agents"]}
    assert set(agents) == {"alex", "mira"}
    w, h = snap["map"]["width"], snap["map"]["height"]
    for a in agents.values():
        assert 0 <= a["x"] < w and 0 <= a["y"] < h and a["location_id"]                 # beide haben eine Position in derselben Karte
    server.post("/api/sim/step", {"n": 5})
    after = {a["id"] for a in server.get("/api/state")["agents"]}
    assert after == {"alex", "mira"}                                                      # und bleiben es, während die Zeit läuft


async def test_k02_getrennte_gedaechtnisse():
    sim = make_sim()
    sim.store.ensure_all()
    sim.memory.writer.remember("alex", "fact", "Unter dem Apfelbaum liegt ein silberner Schlüssel.", 8, sim.engine.minute, force=True)
    sim.memory.writer.remember("mira", "fact", "Die Gießkanne steht hinter dem Schuppen.", 8, sim.engine.minute, force=True)
    await sim.runner.step(30)
    alex = {m.id for m in sim.memory.store.list("alex", limit=10000)[0]}
    mira = {m.id for m in sim.memory.store.list("mira", limit=10000)[0]}
    assert alex and mira and not alex & mira                                              # keine Erinnerung gehört beiden
    assert sim.memory.store.search("alex", "silberner OR Schlüssel", 20)                 # Alex findet sein Wissen …
    assert not sim.memory.store.search("mira", "silberner OR Schlüssel", 20)             # … Miras Abruf findet es nicht
    assert "silberner Schlüssel" not in " ".join(sim.memory.recall_for_text("mira", "silberner Schlüssel unter dem Apfelbaum", sim.engine.minute, 20))
    sim.close()


def test_k02_jede_gedaechtnisabfrage_filtert_nach_agent():
    """Code-Scan: jede Funktion mit SQL auf `memories` (außer der Beobachter-Statistik) bindet die Abfrage an `agent_id`."""
    pkg = ROOT / "backend" / "on_their_own"
    observer_only = {pkg / "stats" / "queries.py"}                                        # Statistik für den Beobachter, nie im Prompt
    sql = re.compile(r"(FROM|UPDATE|JOIN|INTO) memories\b")
    found = 0
    for path in pkg.rglob("*.py"):
        if path in observer_only or not sql.search(src := path.read_text()):
            continue
        for fn in ast.walk(ast.parse(src)):
            if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and sql.search(body := ast.get_source_segment(src, fn) or ""):
                inner = [n for n in ast.walk(fn) if n is not fn and isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
                if inner:
                    continue                                                              # die innere Funktion wird selbst geprüft
                found += 1
                writes = "INTO memories" in body                                          # Einfügen setzt den Besitzer selbst
                assert writes or "agent_id=?" in body or "agent_id = ?" in body, f"{path.relative_to(ROOT)}::{fn.name} fragt memories ohne agent_id ab"
    assert found >= 10


async def test_k03_beide_waehlen_eigenstaendig_mehrere_aktionsarten():
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    from e2e_server import make_fn                                                       # wählt reihum aus den angebotenen Optionen
    sim = make_sim(fn=make_fn())
    sim.store.ensure_all()
    await sim.runner.step(400)                                                            # kein Eingriff von außen, nur Zeit
    rows = sim.engine.state.conn.execute("SELECT agent_id, action, status FROM decisions").fetchall()
    by_agent: dict[str, set[str]] = {}
    for r in rows:
        by_agent.setdefault(r["agent_id"], set()).add(r["action"])
    assert set(by_agent) == {"alex", "mira"}
    assert all(len(kinds) >= 4 for kinds in by_agent.values()), by_agent
    assert not sim.engine.state.conn.execute("SELECT 1 FROM inject_log").fetchall()      # keine Benutzereingabe im Spiel
    sim.close()
