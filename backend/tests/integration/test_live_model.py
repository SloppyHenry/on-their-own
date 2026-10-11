"""Lauf gegen das echte Modell auf maintux. Nicht im Standardlauf; Aufruf:

    cd backend && .venv/bin/python -m pytest -m integration -s
Optional: SIM_INTEGRATION_TICKS (Standard 200).
"""

import os

import pytest

from simulacra.config import Settings
from simulacra.llm.providers import OpenAICompatProvider
from simulacra.simulation.builder import Simulation

pytestmark = pytest.mark.integration


async def test_two_agents_act_for_n_ticks_with_the_real_model(tmp_path):
    ticks = int(os.environ.get("SIM_INTEGRATION_TICKS", "200"))
    settings = Settings()
    prov = OpenAICompatProvider(settings.llm_base_url, settings.llm_api_key.get_secret_value() if settings.llm_api_key else None)
    try:
        models = await prov.models()
    except Exception as e:                                          # noqa: BLE001
        pytest.skip(f"Modell nicht erreichbar: {e}")
    assert settings.llm_model in models, models
    sim = Simulation.create(settings, tmp_path / "live.db")
    dialogues, locations = [], {"alex": set(), "mira": set()}
    sim.engine.bus.listeners.append(lambda evs: dialogues.extend(e for e in evs if e.type == "agent.dialogue"))
    sim.engine.bus.listeners.append(lambda evs: [locations[e.agents[0]].add(e.location_id) for e in evs if e.type == "agent.location_changed"])
    await sim.runner.start(ticks=ticks)
    await sim.runner.wait_finished()
    st = sim.runner.stats.summary()
    print("\n", st, "\n", sim.client.metrics.summary(), "\n Gespräche:", len(dialogues), "Orte:", {k: sorted(v) for k, v in locations.items()})
    assert st["valid_ratio"] >= 0.9, st                              # Abnahme AP02: mindestens 90 % gültig ohne Rückfall
    assert all(len(v) >= 2 for v in locations.values()), locations   # beide Agenten bewegen sich zwischen Orten
    assert set(st["by_action"]) - {"move_to", "wait"}, st            # und tun mehr als gehen und warten
    rows = sim.store.decisions(limit=1000)
    assert all(r["options"] and r["outcome"] for r in rows)         # Protokoll mit Optionen, Wahl und Ergebnis
    sim.close()
