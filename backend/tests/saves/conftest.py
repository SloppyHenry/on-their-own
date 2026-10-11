import json
import sqlite3
from pathlib import Path

import pytest
from agents.conftest import with_goals

from simulacra.config import Settings
from simulacra.llm.providers import FakeProvider
from simulacra.simulation.builder import Simulation


def wait_one_minute(messages, schema, params):
    return json.dumps({"option_id": "other", "intent": "kurz warten", "utterance": "", "importance": 3, "other_action": "wait", "other_params": {"minutes": 1}})


def file_sim(path: Path, fn=wait_one_minute) -> Simulation:
    sim = Simulation.create(Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0), path, FakeProvider(fn=with_goals(fn)))
    sim.store.ensure_all()
    return sim


@pytest.fixture
def sim(tmp_path):
    s = file_sim(tmp_path / "live.db")
    yield s
    s.close()


def dump(path: Path) -> dict[str, list]:
    """Alle Tabellen (ohne die Hilfstabellen der Volltextsuche) mit Inhalt, zum Vergleichen zweier Datenbanken."""
    c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'memories_fts%' ORDER BY name")]
        return {t: [tuple(r) for r in c.execute(f"SELECT * FROM {t} ORDER BY 1, 2")] for t in tables}
    finally:
        c.close()
