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

from simulacra.api.app import create_app  # noqa: E402
from simulacra.config import Settings  # noqa: E402
from simulacra.llm.providers import FakeProvider  # noqa: E402
from simulacra.simulation.builder import Simulation  # noqa: E402

LINES = ["Hallo, schön dich zu sehen!", "Wie war dein Morgen?", "Ich habe noch viel vor heute.", "Hast du Holz für mich übrig?", "Das Wetter ist angenehm."]


def make_fn():
    turn = itertools.count()
    talk = itertools.count()

    def fn(messages, schema, params):
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        keys = list(opts) or ["o1"]
        pick = next((k for k, v in opts.items() if "antworten" in v or "Gespräch beginnen" in v), None)
        oid = pick or keys[next(turn) % len(keys)]
        return json.dumps({"option_id": oid, "intent": "Test", "utterance": LINES[next(talk) % len(LINES)], "importance": 3}, ensure_ascii=False)

    return fn


def prepare(sim: Simulation) -> Simulation:
    sim.store.ensure_all()
    eng = sim.engine
    with eng.db.transaction():                       # Mira neben Alex in dessen Zimmer
        a = eng.state.agent("mira")
        a.x, a.y, a.location_id = 8, 7, eng.state.location_at(8, 7)
        eng.state.save_agent(a)
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
    args = ap.parse_args()
    sim = build(args.data_dir)
    uvicorn.run(create_app(sim, settings=sim.settings), host="127.0.0.1", port=args.port, log_level="warning")
