"""Patch-Abschnitte `links` und `look` (AP12b): Gebiete und Landstraßen anhängen, Übergänge setzen, alte Form umwandeln."""

import json
from pathlib import Path

import pytest

from on_their_own.db.connection import Database
from on_their_own.world import loader
from on_their_own.world import look as lk
from on_their_own.world.engine import WorldEngine
from on_their_own.world.extend import WorldEditError

ROOT = Path(__file__).parents[3]
V1 = ROOT / "frontend/src/world/dorf/look-v1-startwelt.json"


@pytest.fixture
def eng(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", loader.DATA_DIR / "world_default.json")
    return WorldEngine.create(Database(":memory:"))


def region(rid="v2"):
    shapes = {k: [] for k in lk.SHAPE_LISTS}
    return {"id": rid, "frame": [0, 320], "bounds": {"left": 0, "right": 256, "top": 0, "bottom": 232}, "shapes": shapes, "decor": [], "lights": [], "place": {}, "houses": []}


def test_alte_form_wird_zur_heutigen_weltdatei():
    welt = json.loads((loader.DATA_DIR / "world_default.json").read_text())
    assert lk.upgrade_v1(json.loads(V1.read_text())) == welt["look"]               # gleiche Umwandlung wie im Frontend (normalizeLook)


def test_kopie_der_gestaltung_im_frontend_ist_aktuell():
    welt = json.loads((loader.DATA_DIR / "world_default.json").read_text())
    kopie = json.loads((ROOT / "frontend/src/world/dorf/look-v2-startwelt.json").read_text())
    assert kopie == welt["look"], "frontend/src/world/dorf/look-v2-startwelt.json veraltet: look aus world_default.json dorthin kopieren"


def test_gebiet_und_landstrasse_anhaengen(eng):
    r = eng.edit.apply_patch({"id": "p1", "look": {"regions": [region()], "roads": [[[200, 300], [200, 400]]]}})
    assert [e.type for e in r.events] == ["world.look_changed", "world.patch_applied"]
    look = eng.state.get_meta("look")
    assert [x["id"] for x in look["regions"]] == ["dorf", "v2"] and look["roads"] == [[[200, 300], [200, 400]]]


def test_gebiet_doppelt_oder_unvollstaendig_wird_abgelehnt_und_nichts_aendert_sich(eng):
    before = eng.state.get_meta("look")
    for look in ({"regions": [region("dorf")]}, {"regions": [{"id": "x"}]}, {"roads": [[[1, 2]]]}, {"foo": 1}):
        with pytest.raises(WorldEditError) as e:
            eng.edit.apply_patch({"id": "bad", "look": look})
        assert e.value.code == "invalid"
    assert eng.state.get_meta("look") == before and not eng.state.get_meta("patches")


def test_look_in_alter_form_wird_beim_anhaengen_umgewandelt(eng):
    eng.state.set_meta("look", json.loads(V1.read_text()))
    r = eng.edit.apply_patch({"id": "p2", "look": {"regions": [region()]}})
    assert r.events[0].data["upgraded"] is True
    assert lk.is_v2(eng.state.get_meta("look"))


def test_welt_ohne_look_lehnt_ab(eng):
    eng.state.set_meta("look", None)
    with pytest.raises(WorldEditError) as e:
        eng.edit.apply_patch({"id": "p3", "look": {"regions": [region()]}})
    assert e.value.code == "invalid"


def test_uebergang_verbindet_kacheln_fuer_die_wegsuche(eng):
    eng.edit.extend_map(60, 30)
    eng.edit.paint_rect(57, 27, 3, 3, "wall")                                     # ein Raum, rundum zu
    eng.edit.paint_rect(58, 28, 1, 1, "floor")
    eng.edit.paint_rect(55, 25, 1, 1, "floor")
    assert eng.state.pathfinder.find((55, 25), (58, 28)) is None
    r = eng.edit.apply_patch({"id": "tuer", "links": [[[55, 25], [58, 28]]]})
    assert [e.type for e in r.events] == ["world.links_added", "world.patch_applied"]
    assert eng.state.pathfinder.find((55, 25), (58, 28)) == [(58, 28)]
    assert eng.state.get_meta("links")[-1] == [[55, 25], [58, 28]]
    with pytest.raises(WorldEditError) as e:
        eng.edit.apply_patch({"id": "tuer2", "links": [[[57, 27], [58, 28]]]})     # (57, 27) ist Wand
    assert e.value.code == "blocked"


def test_quelle_mit_label_und_regenwetter_im_patch(eng):
    eng.edit.extend_map(60, 30)
    eng.edit.apply_patch({"id": "q", "resource_nodes": [{"id": "tonne_x", "tile": [55, 25], "resource": "water", "amount": 1, "cap": 4, "regen_per_hour": 1, "label": "Regentonnen", "regen_weather": "rain,storm"}]})
    n = eng.state.conn.execute("SELECT label, regen_weather FROM resources WHERE id='tonne_x'").fetchone()
    assert (n["label"], n["regen_weather"]) == ("Regentonnen", "rain,storm")
