"""Schreibt die Gestaltungen erzeugter Welten für die Bilder im Statusbericht (frontend/e2e/bilder-generator.spec.ts): backend/.venv/bin/python -m tests.generator.make_bilder"""

import json
from pathlib import Path

from simulacra.generator.generate import WorldInfo, dumps, extension_patch, new_world
from simulacra.world import look as lk

OUT = Path(__file__).parents[3] / "frontend/e2e/fixtures/generiert"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for seed in (7, 12, 31, 58):
        w, _ = new_world(seed)
        (OUT / f"seed-{seed}.json").write_text(dumps({"name": w["name"], "look": w["look"]}))
    w, _ = new_world(12)
    patch, _ = extension_patch(WorldInfo.from_world_file(w), 5)
    (OUT / "erweitert.json").write_text(dumps({"name": w["name"] + " mit " + patch["description"], "look": lk.merge(w["look"], patch["look"])}))
    print("geschrieben:", sorted(p.name for p in OUT.iterdir()))
