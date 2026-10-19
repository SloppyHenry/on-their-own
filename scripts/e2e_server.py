"""Backend für Browser-Tests: echte API und Welt, aber ein deterministisches Fake-LLM statt des Modells auf maintux.

Start: backend/.venv/bin/python scripts/e2e_server.py --port 8191 --data-dir /tmp/simulacra-e2e
Beide Agenten beginnen im selben Zimmer, wählen bevorzugt Gespräche und wandern sonst reihum durch die angebotenen Optionen.
"""
import argparse
import itertools
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import uvicorn  # noqa: E402

import e2e_models  # noqa: E402

from simulacra.api.app import create_app  # noqa: E402
from simulacra.config import Settings  # noqa: E402
from simulacra.llm.providers import FakeProvider  # noqa: E402
from simulacra.simulation.builder import Simulation  # noqa: E402

LINES = ["Hallo, schön dich zu sehen!", "Wie war dein Morgen?", "Ich habe noch viel vor heute.", "Hast du Holz für mich übrig?", "Das Wetter ist angenehm."]


def make_fn():
    turn = itertools.count()
    talk = itertools.count()

    def fn(messages, schema, params):
        if "condition" in (schema or {}).get("properties", {}):                      # Zielsetzung
            n = next(talk)
            places = [("garden", "Zum Garten gehen"), ("square", "Zum Platz gehen"), ("lake", "Zum See gehen")]
            loc, text = places[n % 3]
            return json.dumps({"text": f"{text} und sich umsehen", "condition": {"type": "location_visited", "location": loc}, "plan": [{"step": text, "kind": "move", "target": loc}]}, ensure_ascii=False)
        if "reflections" in (schema or {}).get("properties", {}):                     # Reflexionsaufruf
            return json.dumps({"reflections": [{"text": f"Ich merke, dass ich oft unterwegs bin (Muster {next(turn)}).", "importance": 6, "sources": [1, 2]}]}, ensure_ascii=False)
        props = (schema or {}).get("properties", {})
        if "clarification" in props:                                                   # Interpretation freier Eingaben (AP08)
            if "Eimer" in messages[1]["content"]:
                return json.dumps({"ops": [{"op": "spawn_object", "name": "Rostiger Eimer", "kind": "item", "location": "garden"}], "confidence": 0.9, "clarification": ""})
            return json.dumps({"ops": [], "confidence": 0.2, "clarification": "Was genau soll passieren, und wo?"})
        if set(props) == {"text"}:                                                     # Antwort einer Nebenfigur
            return json.dumps({"text": "Guten Tag! Ich bin nur auf der Durchreise."}, ensure_ascii=False)
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        keys = list(opts) or ["o1"]
        pick = next((k for k, v in opts.items() if "antworten" in v or "Gespräch beginnen" in v), None)
        oid = pick or keys[next(turn) % len(keys)]
        n = next(talk)
        return json.dumps({"option_id": oid, "intent": f"Aufgabe {n} erledigen", "utterance": LINES[n % len(LINES)], "importance": 5, "plan_next": f"Später Aufgabe {n + 1} angehen"}, ensure_ascii=False)

    return fn


def prepare(sim: Simulation) -> Simulation:
    sim.store.ensure_all()
    eng = sim.engine
    if eng.state.get_meta("e2e_prepared") or "house.bedroom_a" not in eng.state.locations:          # Neustart auf vorhandener Welt: nichts verändern (Abnahme Nr. 7); Dörfer nach Maß (AP17b) haben kein Heimhaus
        return sim
    with eng.db.transaction():                       # Ausgangslage der Browser-Tests: Alex und Mira nebeneinander in Alex' Zimmer
        rx, ry, _, _ = eng.state.locations["house.bedroom_a"].rect
        for aid, (x, y) in (("alex", (rx + 2, ry + 2)), ("mira", (rx + 3, ry + 2))):
            a = eng.state.agent(aid)
            if a is None:                            # Startwelt nur mit einem Bewohner (Assistent)
                continue
            a.x, a.y, a.location_id = x, y, eng.state.location_at(x, y)
            eng.state.save_agent(a)
        eng.state.set_meta("e2e_prepared", True)
    return sim


def build(data_dir: Path) -> Simulation:
    data_dir.mkdir(parents=True, exist_ok=True)
    original = Simulation.create.__func__
    Simulation.create = classmethod(lambda cls, *a, **k: prepare(original(cls, *a, **k)))   # auch nach „Zurücksetzen“ gleiche Ausgangslage
    settings = Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0, data_dir=data_dir)
    return Simulation.create(settings, data_dir / "e2e.db", FakeProvider(fn=make_fn()))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8191)
    ap.add_argument("--data-dir", type=Path, default=Path("/tmp/simulacra-e2e"))
    ap.add_argument("--world", type=Path, default=None, help="Weltdatei statt der Startwelt (z. B. von `cli world new`)")
    ap.add_argument("--inject-rate", type=int, default=None, help="Eingaben je Minute (nur Tests; Standard wie im Betrieb)")
    args = ap.parse_args()
    if args.world:
        from simulacra.world import loader
        loader.DEFAULT_WORLD = args.world
    sim = build(args.data_dir)
    if args.inject_rate:
        sim.inject.rate = args.inject_rate
    app = create_app(sim, settings=sim.settings)
    e2e_models.install(app)                          # Modellverwaltung (AP17c-4): kleine Dateien, falscher llama-server, feste Hardware; kein Netz

    @app.post("/api/e2e/propose")
    async def e2e_propose(body: dict):
        """Nur Testserver: eine Handlung direkt vorschlagen (z. B. Alex rudert), um Zustände im Bild zu prüfen."""
        res = await sim.engine.propose_async(body["agent"], body["action"], body.get("params") or {})
        return {"ok": res.ok, "rejected": res.rejected.model_dump() if res.rejected else None}

    @app.post("/api/e2e/place")
    async def e2e_place(body: dict):
        """Nur Testserver: eine Figur direkt auf eine Kachel setzen (wie `put` in den Backend-Tests)."""
        def work():
            with sim.engine.db.transaction():
                a = sim.engine.state.agent(body["agent"])
                a.x, a.y, a.location_id, a.action = body["x"], body["y"], sim.engine.state.location_at(body["x"], body["y"]), None
                sim.engine.state.save_agent(a)
        await sim.engine.db.run(work)
        return {"ok": True}

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
