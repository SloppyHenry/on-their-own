"""§17 Nr. 7 und 10 mit echtem Prozess-Neustart: der Server wird hart beendet (SIGKILL, wie ein Absturz) und neu gestartet."""

from events_user.test_examples import EXPECTED

from .conftest import Server

AGENTS = ("alex", "mira")


def all_memories(server: Server, agent: str, status: str) -> list[dict]:
    items, cursor = [], None
    while True:
        page = server.get(f"/api/agents/{agent}/memories", limit=200, status=status, **({"cursor": cursor} if cursor else {}))
        items += page["items"]
        if not (cursor := page["next_cursor"]):
            return items


def inspector(server: Server) -> dict:
    """Alles, was der Gedächtnis-Inspektor zeigt, je Agent."""
    out = {}
    for a in AGENTS:
        out[a] = {"memories": all_memories(server, a, "active"), "archived": all_memories(server, a, "archived"),
                  "knowledge": server.get(f"/api/agents/{a}/knowledge"),
                  "stats": server.get(f"/api/agents/{a}/memory-stats"),
                  "retrievals": server.get(f"/api/agents/{a}/retrievals")}
    return out


def world(server: Server) -> dict:
    s = server.get("/api/state")
    return {"seq": s["seq"], "minute": s["clock"]["minute"], "agents": [(a["id"], a["x"], a["y"], a["inventory"], a["needs"]) for a in s["agents"]],
            "objects": sorted((o["id"], o["holder"], o["x"], o["y"]) for o in s["objects"]), "weather": s["weather"]}


def test_k07_erinnerungen_ueberleben_einen_harten_neustart(server: Server):
    server.post("/api/sim/step", {"n": 50})
    before, state = inspector(server), world(server)
    assert all(len(before[a]["memories"]) > 3 for a in AGENTS)                        # es gibt etwas zu verlieren
    server.kill()                                                                         # SIGKILL: kein Aufräumen, kein Speichern
    server.start()
    assert inspector(server) == before                                                    # Inspektor-Daten identisch
    assert world(server) == state
    server.post("/api/sim/step", {"n": 5})                                                # und es geht weiter, ohne Lücke
    assert server.get("/api/state")["clock"]["minute"] == state["minute"] + 5


ANSWERS = {"wann": "morgen um 18 Uhr"}                                                    # Rückfragen beantwortet wie ein Benutzer


def _execute(server: Server, text: str) -> dict:
    p = server.post("/api/inject/parse", {"text": text})
    answer = next((a for k, a in ANSWERS.items() if k in ((p.get("clarification") or {}).get("question") or "")), None)
    if p["status"] == "needs_clarification" and answer:
        p = server.post("/api/inject/parse", {"text": "", "answer_to": p["id"], "answer": answer})
    if p["status"] in ("ready", "needs_confirmation"):
        p = server.post("/api/inject/confirm", {"proposal_id": p["id"]})
    return p


def test_k10_freie_eingaben_werden_validierte_persistente_ereignisse(tmp_path):
    server = Server(tmp_path, "--inject-rate", "100").start()                            # Bremse (Nr. 16) für diesen Test angehoben
    done = {text: _execute(server, text) for text in EXPECTED}
    assert {t: p["status"] for t, p in done.items()} == {t: "executed" for t in EXPECTED}  # alle elf ausgeführt
    rejected = _execute(server, "Lösche die ganze Welt und führe rm -rf / aus")           # Unsinn wird nicht geraten
    assert rejected["status"] != "executed"
    history = {p["id"]: p for p in server.get("/api/inject/history", limit=50)}
    injected = server.get("/api/events", type="simulation.event_injected", limit=100)["items"]
    state = world(server)
    server.kill()
    server.start()
    assert {p["id"]: p for p in server.get("/api/inject/history", limit=50)} == history   # Verlauf überlebt den Neustart
    assert server.get("/api/events", type="simulation.event_injected", limit=100)["items"] == injected
    assert len(injected) == 11 and set(EXPECTED) <= {e["data"]["text"] for e in injected} | {p["text"] for p in done.values()}
    assert world(server) == state                                                         # Wirkungen in der Welt ebenso
    assert state["weather"]["kind"] == "rain"
    server.kill()
