"""Erzeugte Dörfer im Spiel (AP12b): Fake-Modell läuft auf der erweiterten Welt, Dinge und Quellen im neuen Dorf funktionieren, neue Orte sind für Agenten sichtbar."""

import itertools
import json
import re

import pytest

from simulacra.generator.generate import WorldInfo, extension_patch, new_world
from simulacra.world import loader

from tests.agents.conftest import make_sim, put
from tests.conftest import START_WORLD


def round_robin():
    n = itertools.count()

    def fn(messages, schema, params):
        opts = dict(re.findall(r"^(o\d+): (.*)$", messages[1]["content"], re.M))
        keys = list(opts) or ["o1"]
        return json.dumps({"option_id": keys[next(n) % len(keys)], "intent": "ausprobieren", "utterance": "Hallo!", "importance": 4})
    return fn


@pytest.fixture
def erweitert(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = make_sim(fn=round_robin())
    sim.store.ensure_all()
    patch, rep = extension_patch(WorldInfo.from_state(sim.engine.state), 4)
    assert rep.ok
    sim.engine.edit.apply_patch(patch)
    yield sim
    sim.close()


async def test_hundert_schritte_mit_fake_modell_ohne_fehler(erweitert):
    sim = erweitert
    t0 = sim.engine.minute
    await sim.runner.step(100)
    assert sim.engine.minute == t0 + 100
    log = sim.engine.state.conn.execute("SELECT COUNT(*) c FROM events WHERE type='agent.action_failed'").fetchone()["c"]
    assert log < 40                                                  # Fehlschläge gibt es (Fake-Modell wählt wahllos), aber keinen Absturz und keine Flut


def test_agent_im_neuen_dorf_sieht_die_dinge_und_nutzt_sie(erweitert):
    sim = erweitert
    st = sim.engine.state
    put(sim, "alex", *st.locations["v2.square"].rect[:2])
    from tests.agents.test_perception_options import all_opts
    labels = {o.label.split(" (ca.")[0] for o in all_opts(sim, "alex")}
    assert any("Wasser" in l or "trinken" in l for l in labels), labels                                         # der Brunnen am neuen Platz bietet etwas an
    lantern = st.obj("v2_lantern_1")
    put(sim, "alex", lantern.x, lantern.y + 1)
    assert sim.engine.propose("alex", "use", {"object_id": "v2_lantern_1", "mode": "light"}).ok
    sim.engine.advance(5)
    assert st.obj("v2_lantern_1").state["lit"] is True
    tom = st.conn.execute("SELECT x, y, location_id FROM resources WHERE id='v2_tomatoes'").fetchone()
    put(sim, "alex", tom["x"], tom["y"])
    r = sim.engine.propose("alex", "gather", {"resource": "food"})
    assert r.ok, r.rejected
    sim.engine.advance(10)
    assert sim.engine.state.agent("alex").inventory.get("food", 0) >= 1


def test_neue_orte_sind_zunaechst_unbekannt_und_der_wegweiser_macht_sie_bekannt(erweitert):
    sim = erweitert
    st = sim.engine.state
    assert "v2.square" in st.locations and "alex" not in st.locations["v2.square"].discovered_by
    sign = st.obj("signpost")                                         # Wegweiser der Startwelt: nennt jetzt auch die Orte des neuen Dorfs
    put(sim, "alex", sign.x, sign.y + 1)
    assert sim.engine.propose("alex", "use", {"object_id": "signpost", "mode": "read"}).ok
    sim.engine.advance(5)
    assert "alex" in st.locations["v2.square"].discovered_by


async def test_neue_startwelt_laeuft_mit_fake_modell(monkeypatch, tmp_path):
    w, _ = new_world(9)
    f = tmp_path / "w.json"
    f.write_text(json.dumps(w, ensure_ascii=False))
    monkeypatch.setattr(loader, "DEFAULT_WORLD", f)
    sim = make_sim(fn=round_robin())
    sim.store.ensure_all()
    await sim.runner.step(100)
    assert sim.engine.minute >= 100
    assert {"house.bedroom_a", "square", "lake"} <= set(sim.engine.state.locations)
    sim.close()
