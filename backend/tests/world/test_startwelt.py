"""Die Startwelt nach Mockup A (AP14): Grundriss aus dem Bild, Haus innen als eigener Bereich hinter der Haustür.

Alle anderen Welt-Tests laufen auf der festen Testwelt (siehe tests/conftest.py); hier wird die echte Startwelt geladen."""

import pytest

from simulacra.db.connection import Database
from simulacra.world import loader
from simulacra.world.engine import WorldEngine
from simulacra.world.pathfinding import Pathfinder

START_WORLD = loader.DATA_DIR / "world_default.json"


from .conftest import ok, put


@pytest.fixture
def welt():
    return loader.load_world_file(START_WORLD)


@pytest.fixture
def start(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    return WorldEngine.create(Database(":memory:"))


def test_grundriss_wie_mockup_a(welt):
    look = welt["look"]
    assert look["style"] == "mockup-a" and welt["size"] == [51, 19]
    kinds = [d[0] for d in look["decor"]]
    assert sum(k in ("tree", "treeF", "treeB", "pine") for k in kinds) == 13 + 95 + 52   # alle Bäume aus A
    assert kinds.count("boat") == 1 and kinds.count("house") == 1 and kinds.count("lamp") == 3
    ids = {l["id"] for l in welt["locations"]}
    assert {"house.bedroom_a", "house.bedroom_b", "house.workshop", "house.kitchen", "house.living", "garden", "square", "lake", "forest", "paths"} <= ids
    assert not {"well_garden", "bench_garden", "door_back"} & {o["id"] for o in welt["objects"]}   # A hat einen Brunnen und eine Bank


def test_haustuer_ist_ein_uebergang_ins_innere(welt):
    (out, inn), = welt["links"]
    g = loader.grid_from_world(welt)
    assert g.walkable(*out) and g.walkable(*inn) and g.adjacent(tuple(out), tuple(inn))
    p = Pathfinder(g).find(tuple(welt["agents"][0]["tile"]), (28, 6))         # Garten → Zimmer Alex
    assert p is not None and p[p.index(tuple(out)) + 1] == tuple(inn)


def test_jeder_ort_und_jedes_ding_ist_von_beiden_startplaetzen_erreichbar(start):
    st = start.state
    for a in ("alex", "mira"):
        for target in [l for l in st.locations if not st.locations[l].props.get("fallback")] + [o.id for o in st.all_objects() if not o.hidden] + [n.id for n in st.all_nodes()]:
            res = start.propose(a, "move_to", {"target": target})
            assert res.ok, (a, target, res.rejected)
            with start.db.transaction():
                body = st.agent(a)
                body.action = None
                st.save_agent(body)


def test_alex_geht_durch_die_haustuer_ins_zimmer_und_wieder_hinaus(start):
    st = start.state
    ok(start, "alex", "move_to", target="house.bedroom_a")
    a = st.agent("alex")
    assert a.location_id == "house.bedroom_a" and a.x >= 26
    ok(start, "alex", "move_to", target="garden")
    assert st.agent("alex").location_id == "garden"


def test_drinnen_und_draussen_hoeren_sich_nicht(start):
    put(start, "mira", 42, 14)                  # drinnen direkt hinter der Tür
    put(start, "alex", 7, 11)                   # draußen direkt vor der Tür
    res = start.propose("alex", "speak", {"to": "mira", "text": "Hallo?"})
    assert not res.ok
