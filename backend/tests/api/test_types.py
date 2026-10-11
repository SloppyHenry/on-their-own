import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from simulacra.api.schema_export import build_schema, ts_extra
from simulacra.events import models as event_models
from simulacra.events.types import CATEGORIES, REGISTRY

ROOT = Path(__file__).resolve().parents[3]
TYPES = ROOT / "frontend" / "src" / "types"


def test_committed_schema_is_current():
    fresh = json.dumps(build_schema(), indent=1, ensure_ascii=False, sort_keys=True) + "\n"
    assert (TYPES / "schema.json").read_text() == fresh, "scripts/gen_types.sh ausführen"


@pytest.mark.skipif(not (ROOT / "frontend" / "node_modules" / ".bin" / "json2ts").exists() or shutil.which("node") is None, reason="Node/json2ts nicht installiert")
def test_generated_typescript_is_current():
    r = subprocess.run([str(ROOT / "scripts" / "gen_types.sh"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr


def test_every_event_type_has_a_data_model_and_a_typescript_type():
    ts = (TYPES / "generated.ts").read_text()
    interfaces = set(re.findall(r"^export interface (\w+)", ts, re.M))
    mapped = dict(re.findall(r'^  "([a-z_.]+)": ([A-Za-z<>, ]+);', ts, re.M))
    categories = dict(re.findall(r'^  "([a-z_.]+)": "(\w+)",', ts, re.M))
    for name, t in REGISTRY.items():
        assert name in mapped and name in categories, name
        assert categories[name] == t.category and t.category in CATEGORIES
        if t.model is event_models.Loose:
            assert mapped[name] == "Record<string, unknown>"
        else:
            assert t.model.__name__ in interfaces and mapped[name] == t.model.__name__, name
    assert set(mapped) == set(REGISTRY)


def test_api_and_websocket_types_exist():
    ts = (TYPES / "generated.ts").read_text()
    for name in ("StateSnapshot", "AgentDetail", "LocationDetail", "EventOut", "EventsPage", "EventDetail", "SimCommandResult", "WsHello", "WsSnapshot", "WsEvent",
                 "WsEvents", "WsResync", "WsPing", "WsPong", "WsResyncRequired", "StepRequest", "ResetRequest", "SpeedRequest"):
        assert re.search(rf"^export interface {name}\b", ts, re.M), name
    assert "from: number[]" in ts                      # Alias `from` kommt richtig an
    assert ts_extra().strip() in ts
