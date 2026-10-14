"""Weltgenerator (AP12b): Determinismus, Gültigkeit über viele Seeds, Anwenden auf die Startwelt, wiederholtes Erweitern, alte Spielstände."""

import json

import pytest

from simulacra.db.connection import Database
from simulacra.generator.generate import GenerationError, WorldInfo, dumps, extension_patch, new_world
from simulacra.generator.validate import reachable
from simulacra.world import loader
from simulacra.world import look as lk
from simulacra.world.engine import WorldEngine

SEEDS = list(range(1, 25))


START = loader.DATA_DIR / "world_default.json"


@pytest.fixture
def start(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START)               # die echte Startwelt, nicht die feste Testwelt der Mechanik-Tests
    return WorldEngine.create(Database(":memory:"))


def open_reachable(eng, locs):
    st, pf = eng.state, eng.state.pathfinder
    a = st.agent("alex").pos
    bad = []
    for l in locs:
        x, y, w, h = l.rect
        if not any(st.grid.is_open(xx, yy) and pf.find(a, (xx, yy)) is not None for yy in range(y, y + h) for xx in range(x, x + w)):
            bad.append(l.id)
    return bad


def test_gleicher_seed_gleiches_ergebnis_anderer_seed_anderes():
    a, _ = new_world(7); b, _ = new_world(7); c, _ = new_world(8)
    assert dumps(a) == dumps(b) != dumps(c)
    info = WorldInfo.from_world_file(loader.load_world_file(START))
    p1, _ = extension_patch(info, 7); p2, _ = extension_patch(info, 7); p3, _ = extension_patch(info, 8)
    assert dumps(p1) == dumps(p2) != dumps(p3)


@pytest.mark.parametrize("seed", SEEDS)
def test_neue_startwelt_ist_gueltig_und_bespielbar(seed, tmp_path, monkeypatch):
    w, rep = new_world(seed)
    assert rep.ok, rep.errors
    f = tmp_path / "w.json"
    f.write_text(json.dumps(w, ensure_ascii=False))
    monkeypatch.setattr(loader, "DEFAULT_WORLD", f)
    eng = WorldEngine.create(Database(":memory:"))                   # lädt streng: bekannte Objektarten, Kacheln, Übergänge
    st = eng.state
    assert [l.id for l in st.locations.values() if l.props.get("fallback")] == ["paths"]
    assert {"house.bedroom_a", "house.kitchen", "square", "garden", "lake", "forest"} <= set(st.locations)           # Rollen wie die Startwelt
    assert not open_reachable(eng, [l for l in st.locations.values() if not l.props.get("fallback")])
    for _ in range(120):
        eng.tick()


@pytest.mark.parametrize("seed", SEEDS)
def test_erweiterung_der_startwelt_ist_gueltig_und_bespielbar(seed, start):
    info = WorldInfo.from_state(start.state)
    patch, rep = extension_patch(info, seed)
    assert rep.ok, rep.errors
    size = tuple(start.state.get_meta("size"))
    r = start.edit.apply_patch(patch)
    st = start.state
    assert r.value["locations"] >= 10 and r.value["links"] >= 3
    assert st.get_meta("size")[0] >= size[0] and st.get_meta("size")[1] > size[1]
    look = st.get_meta("look")
    assert [x["id"] for x in look["regions"]] == ["dorf", "v2"] and len(look["roads"]) == 1
    new = [l for l in st.locations.values() if l.id.startswith("v2")]
    assert new and not open_reachable(start, new)
    for _ in range(60):
        start.tick()


def test_bestand_wird_nie_ueberschrieben(start):
    st = start.state
    before = ([row[:] for row in st.grid.cells], {l.id: (l.rect, l.name) for l in st.locations.values()}, {o.id: (o.x, o.y) for o in st.all_objects()})
    patch, _ = extension_patch(WorldInfo.from_state(st), 3)
    start.edit.apply_patch(patch)
    h, w = len(before[0]), len(before[0][0])
    assert all(st.grid.cells[y][x] == before[0][y][x] for y in range(h) for x in range(w))
    assert all(st.locations[i].rect == r and st.locations[i].name == n for i, (r, n) in before[1].items())
    assert all((st.obj(i).x, st.obj(i).y) == p for i, p in before[2].items())


def test_auf_erzeugter_welt_aendert_die_landstrasse_nur_wildnis_und_wald(tmp_path, monkeypatch):
    w, _ = new_world(12)
    f = tmp_path / "w.json"
    f.write_text(json.dumps(w, ensure_ascii=False))
    monkeypatch.setattr(loader, "DEFAULT_WORLD", f)
    eng = WorldEngine.create(Database(":memory:"))
    st = eng.state
    chars = {k: t.char for k, t in st.tile_types.items()}
    before = ["".join(chars[c] for c in row) for row in st.grid.cells]
    patch, rep = extension_patch(WorldInfo.from_state(st), 5)
    assert rep.ok
    eng.edit.apply_patch(patch)
    after = ["".join(chars[c] for c in row) for row in st.grid.cells]
    changed = [(b, a) for rb, ra in zip(before, after) for b, a in zip(rb, ra) if b != a]
    assert changed and all(b in ".T" and a == "," for b, a in changed)          # nur Wildnis und Wald wurden zum Weg
    assert not open_reachable(eng, [l for l in st.locations.values() if l.id.startswith("v2")])


def test_zweites_und_drittes_dorf(start):
    for n, seed in ((2, 5), (3, 9)):
        patch, rep = extension_patch(WorldInfo.from_state(start.state), seed)
        assert rep.ok
        start.edit.apply_patch(patch)
        assert f"v{n}.square" in start.state.locations
    look = start.state.get_meta("look")
    assert [r["id"] for r in look["regions"]] == ["dorf", "v2", "v3"]
    assert not open_reachable(start, [l for l in start.state.locations.values() if l.id.startswith("v3")])


def test_erweiterung_auf_alten_spielstand_mit_look_version_1(start):
    from pathlib import Path
    v1 = json.loads((Path(__file__).parents[3] / "frontend/src/world/dorf/look-v1-startwelt.json").read_text())
    start.state.set_meta("look", v1)
    patch, rep = extension_patch(WorldInfo.from_state(start.state), 4)
    assert rep.ok
    r = start.edit.apply_patch(patch)
    assert r.events[-2].data["upgraded"] is True and lk.is_v2(start.state.get_meta("look"))


def test_karte_ist_begrenzt(start):
    info = WorldInfo.from_state(start.state)
    info.size = (250, 250)
    info.rows = ["." * 250 for _ in range(250)]
    with pytest.raises(GenerationError, match="256"):
        extension_patch(info, 1)


@pytest.mark.parametrize("mix", [{"house": 1}, {"house": 2, "shop": 1}, {"house": 3, "workshop": 1, "barn": 1, "stable": 1}, {"shop": 1, "workshop": 1}])
@pytest.mark.parametrize("lake", ["east", "south"])
def test_gebaeudemix_und_see(mix, lake, start):
    patch, rep = extension_patch(WorldInfo.from_state(start.state), 2, lake=lake, mix=mix)
    assert rep.ok, rep.errors
    start.edit.apply_patch(patch)
    houses = start.state.get_meta("look")["regions"][-1]["houses"]
    assert 1 <= len(houses) <= sum(mix.values())


def test_pruefung_erkennt_unerreichbares():
    w, _ = new_world(3)
    rows = [list(r) for r in w["tiles"]]
    (ax, ay), _inside = w["links"][0]
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):                       # Haustür zubauen
        rows[ay + dy][ax + dx] = "#"
    seen = reachable(["".join(r) for r in rows], w["links"], tuple(w["agents"][0]["tile"]), set())
    assert (ax, ay) not in seen


def test_fixture_fuer_den_bild_kachel_abgleich_ist_aktuell():
    from .make_fixture import OUT, fixture
    assert OUT.read_text() == dumps(fixture()), "Fixture veraltet: backend/.venv/bin/python -m tests.generator.make_fixture"
