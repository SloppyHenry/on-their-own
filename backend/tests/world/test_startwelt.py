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
    kinds = [d[0] for d in look["decor"]]                                                   # Deko plus Dinge (AP15) mit ihren Sprites
    for p in look["place"].values():
        kinds += [p.get("sprite")] * (1 + len(p.get("more", [])))
    assert sum(k in ("tree", "treeF", "treeB", "pine") for k in kinds) == 13 + 95 + 52   # alle Bäume aus A
    assert kinds.count("boat") == 1 and kinds.count("house") == 1 and kinds.count("lamp") == 3
    for k, n in {"mailbox": 1, "sign": 1, "scare": 1, "barrel": 2, "sun": 3, "tomato": 3, "reed": 5, "rock": 4, "treeF": 2}.items():
        assert kinds.count(k) == n, k


def test_dinge_aus_der_deko_sind_echt(welt):
    objs, nodes = {o["id"]: o for o in welt["objects"]}, {n["id"]: n for n in welt["resource_nodes"]}
    kinds = sorted(o["kind"] for o in objs.values() if o["kind"] in ("lantern", "mailbox", "signpost", "scarecrow", "boat", "cat", "floor_lamp", "candle", "armchair", "wardrobe", "crate"))
    assert kinds == sorted(["lantern"] * 3 + ["mailbox", "signpost", "scarecrow", "boat", "cat", "floor_lamp", "floor_lamp", "candle", "armchair", "wardrobe", "crate", "crate"])
    assert {nodes[i]["label"] for i in ("tomatoes", "sunflowers", "rain_barrels", "reeds", "apple_trees", "field_rocks")} == {"Tomaten", "Sonnenblumen", "Regentonnen", "Schilf", "Apfelbäume", "Steine"}
    assert nodes["rain_barrels"]["location_id"] == "garden" and nodes["rain_barrels"]["regen_weather"] == "rain,storm"
    assert nodes["reeds"]["location_id"] == "lake" and objs["boat"]["tile"] and objs["scarecrow"]["tile"]
    inner = [d[0].split(":")[0] for d in welt["look"]["interior"]["decor"]]
    assert not {"katze", "stehlampe", "kerze", "sessel", "schrank", "kiste"} & set(inner)          # jetzt Dinge, keine Deko mehr
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
