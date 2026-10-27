"""Schreibt die Fixture für den Abgleich von Bild und Kacheln im Frontend (`frontend/src/world/dorf/erzeugt.test.ts`): backend/.venv/bin/python -m tests.generator.make_fixture"""

import json
from pathlib import Path

from on_their_own.generator.generate import dumps, new_world

OUT = Path(__file__).parents[3] / "frontend/src/world/dorf/fixtures/dorf-seed-12.json"


def fixture() -> dict:
    w, _ = new_world(12)
    return {"tiles": w["tiles"], "look": w["look"], "size": w["size"], "links": w["links"]}


if __name__ == "__main__":
    OUT.write_text(dumps(fixture()))
    print("geschrieben:", OUT)
