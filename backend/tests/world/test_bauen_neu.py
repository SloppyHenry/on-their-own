"""Mehr Bauvorlagen (AP18g): Weg, Beet, Baum, Laterne, Brunnen. Jede ändert Kacheln und Objekte **und** die Gestaltung (`look`), damit die Darstellung sie zeichnet; Bild und Kacheln stimmen überein."""

import copy
import json

import pytest

from simulacra.db.connection import Database
from simulacra.world import loader
from simulacra.world.engine import WorldEngine

from .conftest import ok, put, reject, stock
from .test_startwelt import START_WORLD

T = 16


@pytest.fixture
def start(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    return WorldEngine.create(Database(":memory:"))


def look(eng):
    return eng.state.get_meta("look")


def region(eng):
    return look(eng)["regions"][0]


def spot(eng):
    """Eine Wiesenkachel draußen, auf der man bauen kann, und eine Nachbarkachel daneben."""
    g = eng.state.grid
    for y in range(6, g.height - 3):
        for x in range(3, 19):
            if all(g.tile(x + i, y) == "grass" for i in range(3)) and eng.state.location_at(x, y) == eng.state.location_at(x + 2, y) and not eng.state.location_at(x, y).startswith("house"):
                return x, y
    raise AssertionError("keine freie Wiese gefunden")


def test_weg_aendert_kachel_und_darstellung(start):
    x, y = spot(start)
    put(start, "alex", x, y)
    stock(start, "alex", stone=3)
    n = len(region(start)["shapes"]["paths"])
    events = ok(start, "alex", "build", blueprint="path", at=[x + 1, y])
    assert start.state.grid.tile(x + 1, y) == "path" and start.state.grid.walkable(x + 1, y)
    assert not [o for o in start.state.all_objects() if o.kind == "path"]                               # ein Weg ist Boden, kein Ding
    paths = region(start)["shapes"]["paths"]
    fx, fy = region(start)["frame"]
    assert len(paths) == n + 1 and paths[-1] == [[(x + 1) * T - fx, y * T - fy + 8], [(x + 1) * T - fx + T, y * T - fy + 8]]
    added = [e for e in events if e.type == "world.look_added"]
    assert len(added) == 1 and added[0].data["region"] == "dorf" and added[0].data["paths"] == [paths[-1]]
    assert start.state.agent("alex").inventory.get("stone", 0) == 2                                      # ein Stein je Feld


def test_baum_blockiert_die_kachel_und_steht_in_der_deko(start):
    x, y = spot(start)
    put(start, "alex", x, y)
    stock(start, "alex", seeds=2)
    ok(start, "alex", "build", blueprint="tree", at=[x + 1, y])
    assert start.state.grid.tile(x + 1, y) == "tree" and not start.state.grid.walkable(x + 1, y)
    fx, fy = region(start)["frame"]
    assert ["tree", (x + 1) * T - fx + 8, (y + 1) * T - fy - 2, ((x + 1) * 7 + y * 3) % 7] in region(start)["decor"]


def test_baum_nie_unter_den_fuessen_des_bauenden(start):
    x, y = spot(start)
    put(start, "alex", x, y)
    stock(start, "alex", seeds=2)
    reject(start, "alex", "build", "invalid_target", blueprint="tree", at=[x, y])


def test_beet_ist_ein_objekt_und_ein_beet_im_bild(start):
    x, y = spot(start)
    put(start, "alex", x, y)
    stock(start, "alex", seeds=3)
    ok(start, "alex", "build", blueprint="bed", at=[x + 1, y])
    bed = next(o for o in start.state.all_objects() if o.kind == "seedbed" and (o.x, o.y) == (x + 1, y))
    g = region(start)["shapes"]["gardens"][-1]
    fx, fy = region(start)["frame"]
    assert (g["x0"], g["y0"], g["x1"], g["y1"]) == ((x + 1) * T - fx, y * T - fy, (x + 1) * T - fx + T, y * T - fy + T) and len(g["beds"]) == 1
    stock(start, "alex", seeds=1)
    assert start.state.obj(bed.id).kind == "seedbed"


def test_laterne_und_brunnen_haben_eine_bildstelle(start):
    x, y = spot(start)
    put(start, "alex", x, y)
    stock(start, "alex", wood=4, stone=10)
    ok(start, "alex", "build", blueprint="lantern", at=[x + 1, y])
    lamp = next(o for o in start.state.all_objects() if o.kind == "lantern" and (o.x, o.y) == (x + 1, y))
    r = region(start)
    assert r["place"][lamp.id]["sprite"] == "lamp" and r["lights"][-1][1] == r["place"][lamp.id]["at"][1] - 20
    ok(start, "alex", "build", blueprint="well", at=[x + 2, y])
    well = next(o for o in start.state.all_objects() if o.kind == "well" and (o.x, o.y) == (x + 2, y))
    assert look(start)["regions"][0]["place"][well.id]["sprite"] == "well"


def test_kosten_und_ablehnungen(start):
    x, y = spot(start)
    put(start, "alex", x, y)
    reject(start, "alex", "build", "missing_resource", blueprint="path")
    stock(start, "alex", stone=1, seeds=1)
    reject(start, "alex", "build", "not_here", blueprint="path", at=[x, y + 100])                         # zu weit
    ok(start, "alex", "build", blueprint="path", at=[x + 1, y])
    reject(start, "alex", "build", "missing_resource", blueprint="path")
    stock(start, "alex", stone=1)
    reject(start, "alex", "build", "invalid_target", blueprint="path", at=[x + 1, y])                   # liegt schon ein Weg


def test_ohne_gestaltung_aendern_sich_nur_die_kacheln(monkeypatch):
    world = json.loads(START_WORLD.read_text())
    world = copy.deepcopy(world)
    world.pop("look", None)
    eng = WorldEngine.create(Database(":memory:"), world=world)
    g = eng.state.grid
    x, y = next((x, y) for y in range(6, g.height - 3) for x in range(3, 19) if g.tile(x, y) == "grass" and g.tile(x + 1, y) == "grass" and not eng.state.location_at(x, y).startswith("house"))
    put(eng, "alex", x, y)
    stock(eng, "alex", stone=1)
    events = ok(eng, "alex", "build", blueprint="path", at=[x + 1, y])
    assert eng.state.grid.tile(x + 1, y) == "path" and not [e for e in events if e.type == "world.look_added"] and eng.state.get_meta("look") is None
