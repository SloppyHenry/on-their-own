"""Erweiterbarkeit der laufenden Welt: Kachelarten, Kacheln, Karte, Orte, Agenten, Objekte, Quellen."""

import sqlite3

import pytest

from simulacra.db.connection import Database
from simulacra.world.engine import WorldEngine
from simulacra.world.extend import WorldEditError

from .conftest import ok, put, reject, stock, types


def err(code):
    return pytest.raises(WorldEditError, match=".")


def code_of(fn, *a, **kw):
    with pytest.raises(WorldEditError) as e:
        fn(*a, **kw)
    return e.value.code


def snap(eng):
    s = eng.state.snapshot()
    return s, eng.state.conn.execute("SELECT COUNT(*) FROM events").fetchone()[0], eng.state.get_meta("obj_counter")


# --- Kachelarten ---------------------------------------------------------------------------------

def test_new_tile_type_is_data_and_usable(eng):
    r = eng.edit.add_tile_type("cobble", walkable=True, cost=1, char="o", color="#888888", label="Pflaster")
    assert types(r.events) == ["world.tile_type_added"]
    assert "cobble" in eng.state.tile_types and eng.state.snapshot()["tile_types"]["cobble"]["char"] == "o"
    before = eng.state.pathfinder.find((20, 17), (30, 18))
    eng.edit.paint_rect(21, 17, 9, 1, "cobble")
    assert eng.state.grid.cost(25, 17) == 1
    after = eng.state.pathfinder.find((20, 17), (30, 18))
    assert sum(eng.state.grid.cost(*t) for t in after) < sum(eng.state.grid.cost(*t) for t in before)


def test_unwalkable_tile_type_blocks_walking(eng):
    eng.edit.add_tile_type("lava", walkable=False, color="#ff4400")
    eng.edit.paint_rect(20, 20, 1, 1, "lava")
    assert not eng.state.grid.walkable(20, 20)
    reject(eng, "alex", "move_to", "not_reachable", tile=[20, 20])


def test_tile_type_validation(eng):
    f = eng.edit.add_tile_type
    assert code_of(f, "Bad Id", walkable=True) == "invalid"
    assert code_of(f, "ok_id", walkable=True, cost=0) == "invalid"
    assert code_of(f, "ok_id", walkable=True, cost=99) == "invalid"
    assert code_of(f, "ok_id", walkable="ja") == "invalid"
    assert code_of(f, "ok_id", walkable=True, char="ab") == "invalid"
    assert code_of(f, "ok_id", walkable=True, char=" ") == "invalid"
    assert code_of(f, "ok_id", walkable=True, color="rot") == "invalid"
    assert code_of(f, "ok_id", walkable=True, char=".") == "exists"          # Zeichen von Gras
    assert code_of(f, "grass", walkable=False) == "exists"                    # andere Werte für bestehende Art
    assert f("grass", walkable=True, cost=2).events == []                     # gleiche Definition: ohne Wirkung


# --- Kacheln und Karte -----------------------------------------------------------------------------

def test_set_tiles_updates_grid_db_and_emits_one_event(eng):
    r = eng.edit.set_tiles([(30, 20, "sand"), (31, 20, "sand"), (31, 20, "water")])   # letzte Angabe gewinnt
    assert eng.state.grid.tile(30, 20) == "sand" and eng.state.grid.tile(31, 20) == "water"
    assert eng.state.conn.execute("SELECT type FROM tiles WHERE x=31 AND y=20").fetchone()[0] == "water"
    assert types(r.events) == ["world.tiles_changed"] and r.events[0].data["count"] == 2
    assert eng.edit.set_tiles([(30, 20, "sand")]).events == []                         # keine Änderung


def test_set_tiles_rejections_are_atomic(eng):
    before = snap(eng)
    assert code_of(eng.edit.set_tiles, [(30, 20, "sand"), (9999, 0, "sand")]) == "out_of_bounds"
    assert code_of(eng.edit.set_tiles, [(30, 20, "sand"), (31, 20, "magma")]) == "unknown"
    assert code_of(eng.edit.set_tiles, [(30, 20, "sand"), (7, 7, "water")]) == "blocked"       # Alex steht dort
    assert code_of(eng.edit.set_tiles, [(6, 6, "wall")]) == "blocked"                           # Bett
    assert code_of(eng.edit.set_tiles, [(25, 6, "tree")]) == "blocked"                          # Quelle
    assert code_of(eng.edit.set_tiles, ["x"]) == "invalid"
    assert snap(eng) == before and eng.state.grid.tile(30, 20) == "grass"


def test_closing_and_reopening_the_pier_changes_reachability(eng):
    eng.edit.set_tiles([(49, 28, "water")])
    reject(eng, "alex", "move_to", "not_reachable", target="fishing_spot")
    eng.edit.set_tiles([(49, 28, "floor")])
    ok(eng, "alex", "move_to", target="fishing_spot")


def test_extend_map_keeps_coordinates_and_new_area_can_be_connected(eng):
    r = eng.edit.extend_map(80, 48)
    assert r.events[0].data == {"from": [64, 40], "to": [80, 48], "fill": "grass"}
    g = eng.state.grid
    assert (g.width, g.height) == (80, 48) and g.tile(20, 17) == "path" and g.tile(70, 44) == "grass"
    assert eng.state.location_at(70, 44) == "paths"                                # Rückfallort deckt neue Fläche ab
    eng.edit.add_agent("jonas", "Jonas", [70, 36])
    reject(eng, "jonas", "move_to", "not_reachable", target="lake")                 # Baumgürtel am alten Rand trennt
    eng.edit.paint_rect(62, 36, 2, 1, "grass")                                       # Durchgang öffnen (y=36: Land, nicht See)
    ok(eng, "jonas", "move_to", target="lake")
    assert eng.state.agent("jonas").location_id == "lake"


def test_extend_map_rejections(eng):
    before = snap(eng)
    assert code_of(eng.edit.extend_map, 60, 40) == "invalid"       # nur wachsen
    assert code_of(eng.edit.extend_map, 64, 40) == "invalid"
    assert code_of(eng.edit.extend_map, 300, 300) == "limit"
    assert code_of(eng.edit.extend_map, 70, 45, "magma") == "unknown"
    assert snap(eng) == before and eng.state.grid.width == 64


# --- Orte -------------------------------------------------------------------------------------------

def test_new_location_claims_tiles_and_reassigns_inhabitants(eng):
    put(eng, "alex", 38, 23)
    r = eng.edit.add_location("nook", "Leseecke", [37, 21, 3, 3], props={"quiet": True})
    assert r.events[0].data["reassigned"]["objects"] >= 1 and r.events[0].data["reassigned"]["agents"] == 1
    assert eng.state.obj("board_square").location_id == "nook" and eng.state.agent("alex").location_id == "nook"
    assert eng.state.location_at(38, 22) == "nook" and eng.state.location_at(33, 25) == "square"
    ok(eng, "mira", "move_to", target="nook")
    assert eng.state.agent("mira").location_id == "nook" and "mira" in eng.state.locations["nook"].discovered_by


def test_location_without_claim_leaves_existing_tiles(eng):
    r = eng.edit.add_location("annex", "Anbau", [37, 21, 3, 3], claim=False)
    assert r.events[0].data["reassigned"] == {"objects": 0, "resources": 0, "agents": 0}
    assert eng.state.obj("board_square").location_id == "square"


def test_location_validation_and_update(eng):
    before = snap(eng)
    f = eng.edit.add_location
    assert code_of(f, "garden", "Doppelt", [1, 1, 2, 2]) == "exists"
    assert code_of(f, "board_square", "Kollision", [1, 1, 2, 2]) == "exists"     # gemeinsamer ID-Raum
    assert code_of(f, "Bad Id", "x", [1, 1, 2, 2]) == "invalid"
    assert code_of(f, "ok_ort", " ", [1, 1, 2, 2]) == "invalid"
    assert code_of(f, "ok_ort", "x", [60, 38, 9, 9]) == "out_of_bounds"
    assert code_of(f, "ok_ort", "x", [1, 1, 0, 2]) == "out_of_bounds"
    assert code_of(f, "ok_ort", "x", [1, 1, 2, 2], entrances=[[999, 1]]) == "out_of_bounds"
    assert snap(eng) == before
    eng.edit.add_location("nook", "Ecke", [37, 21, 3, 3], props={"a": 1, "b": 2})
    eng.edit.update_location("nook", name="Leseecke", props={"a": None, "c": 3})
    loc = eng.state.locations["nook"]
    assert loc.name == "Leseecke" and loc.props == {"b": 2, "c": 3}
    assert code_of(eng.edit.update_location, "nirgends", name="x") == "unknown"


# --- Agenten ----------------------------------------------------------------------------------------

def test_added_agent_uses_the_same_interface_as_any_other(eng):
    r = eng.edit.add_agent("jonas", "Jonas", [20, 18], capacity=6, needs={"energy": 60})
    assert types(r.events) == ["world.agent_added"]
    a = eng.state.agent("jonas")
    assert a.capacity == 6 and a.needs["energy"] == 60 and a.needs["hunger"] == 25 and a.location_id == "paths"
    assert [x.id for x in eng.state.agents()] == ["alex", "jonas", "mira"]
    ok(eng, "jonas", "move_to", target="seed_box")
    ok(eng, "jonas", "gather", resource="seeds", amount=1)
    assert eng.state.agent("jonas").inventory == {"seeds": 1}
    put(eng, "alex", 25, 9)
    ok(eng, "alex", "speak", to="jonas", text="Hallo Jonas!")
    eng.advance(5)                                       # der Tick bezieht den neuen Agenten ein
    assert eng.state.agent("jonas").needs["hunger"] > 25


def test_agent_validation(eng):
    f = eng.edit.add_agent
    assert code_of(f, "alex", "Zweiter Alex", [20, 18]) == "exists"
    assert code_of(f, "garden", "Garten", [20, 18]) == "exists"
    assert code_of(f, "x", "X", [20, 18]) == "invalid"
    assert code_of(f, "jonas", "Jonas", [4, 4]) == "blocked"                 # Wand
    assert code_of(f, "jonas", "Jonas", [5000, 4]) == "out_of_bounds"
    assert code_of(f, "jonas", "Jonas", [20, 18], capacity=99) == "invalid"
    assert code_of(f, "jonas", "", [20, 18]) == "invalid"
    assert len(eng.state.agents()) == 2


# --- Objekte und Quellen ------------------------------------------------------------------------------

def test_spawn_object_variants(eng):
    o = eng.edit.spawn_object("map", "Alte Karte", tile=[20, 19], state={"text": "X"}).value
    assert (o.x, o.y, o.location_id) == (20, 19, "paths") and o.id.startswith("map_")
    o2 = eng.edit.spawn_object("note", "Zettel", location_id="house.kitchen", id_="zettel_eins").value
    assert o2.location_id == "house.kitchen" and eng.state.grid.walkable(o2.x, o2.y)
    assert (o2.x, o2.y) not in {(10, 15), (12, 12), (6, 12)}                     # nicht auf Hahn, Kammer, Herd
    o3 = eng.edit.spawn_object("key", "Schlüssel", holder="mira").value
    assert o3.holder == "mira" and [x.id for x in eng.state.objects_held("mira")] == [o3.id]
    o4 = eng.edit.spawn_object("item", "Geheimnis", tile=[20, 20], hidden=True, known_by=["alex"]).value
    assert o4.visible_to("alex") and not o4.visible_to("mira")


def test_spawned_blocking_object_changes_paths(eng):
    eng.edit.spawn_object("fence", "Zaun", tile=[20, 20])
    assert (20, 20) in eng.state.grid.blocked


def test_spawn_object_rejections_leave_no_trace(eng):
    before = snap(eng)
    f = eng.edit.spawn_object
    assert code_of(f, "zauberstab", "Stab", tile=[20, 19]) == "unknown"
    assert code_of(f, "map", "Karte", tile=[20, 19], state={"bogus": 1}) == "invalid"     # falsches Zustandsfeld
    assert code_of(f, "map", "Karte", tile=[0, 0]) == "blocked"                           # Baum
    assert code_of(f, "map", "Karte") == "invalid"
    assert code_of(f, "map", "Karte", tile=[20, 19], holder="alex") == "invalid"
    assert code_of(f, "map", "Karte", holder="niemand") == "unknown"
    assert code_of(f, "map", "Karte", tile=[20, 19], owner="niemand") == "unknown"
    assert code_of(f, "map", "Karte", tile=[20, 19], id_="axe") == "exists"
    assert code_of(f, "map", "Karte", location_id="paths") == "unknown"                   # zu unbestimmt
    assert snap(eng) == before                                                            # auch der ID-Zähler


def test_spawn_respects_limits(eng):
    from simulacra.world.rules import WorldRules
    eng.set_rules(WorldRules(max_objects=eng.state.object_count()))
    assert code_of(eng.edit.spawn_object, "map", "Karte", tile=[20, 19]) == "limit"
    stock(eng, "alex", wood=10)
    assert code_of(eng.edit.spawn_object, "key", "Schlüssel", holder="alex") == "limit"   # Tragkraft


def test_remove_object(eng):
    ev = eng.edit.remove_object("axe", cause="verschwunden").events
    assert ev[0].type == "world.object_removed" and ev[0].data["cause"] == "verschwunden" and eng.state.obj("axe") is None
    assert code_of(eng.edit.remove_object, "axe") == "unknown"


def test_new_resource_node_works_with_gather(eng):
    eng.edit.add_resource_node("clay_pit", [8, 25], "clay", 5, 5, regen_per_hour=0.5, gather_minutes=4)
    assert eng.state.node("clay_pit").location_id == "forest"
    put(eng, "alex", 8, 25)
    ok(eng, "alex", "gather", resource="clay", amount=2)
    assert eng.state.agent("alex").inventory == {"clay": 2}
    f = eng.edit.add_resource_node
    assert code_of(f, "x2", [8, 26], "clay", 9, 5) == "invalid"
    assert code_of(f, "x3", [58, 28], "clay", 1, 5) == "blocked"                   # Wasser
    assert code_of(f, "x4", [8, 26], "clay", 1, 5, location_id="lake") == "invalid"
    assert code_of(f, "clay_pit", [8, 26], "clay", 1, 5) == "exists"


# --- Patches ---------------------------------------------------------------------------------------------

PATCH = {
    "id": "2026-pavillon", "description": "Pavillon am Platz",
    "tile_types": {"marble": {"char": "m", "walkable": True, "cost": 1, "color": "#eeeeee", "label": "Marmor"}},
    "extend_map": {"width": 70, "height": 44},
    "tiles": [{"rect": [41, 21, 3, 3], "type": "marble"}, {"at": [20, 30], "rows": ["m.m", " m "]}],
    "locations": [{"id": "pavilion", "name": "Pavillon", "rect": [41, 21, 3, 3]}],
    "objects": [{"id": "pavilion_bench", "kind": "bench", "name": "Pavillonbank", "tile": [42, 22]}],
    "resource_nodes": [{"id": "pavilion_well", "tile": [41, 21], "resource": "water", "amount": 999, "cap": 999}],
    "agents": [{"id": "jonas", "name": "Jonas", "tile": [43, 23]}],
}


def test_patch_applies_everything_once(eng):
    eng.edit.set_tiles([(20, 31, "sand")])
    r = eng.edit.apply_patch(PATCH)
    assert r.value == {"tile_types": 1, "extend_map": 1, "tiles": 13, "locations": 1, "objects": 1, "resource_nodes": 1, "agents": 1}
    assert types(r.events)[-1] == "world.patch_applied"
    g = eng.state.grid
    assert (g.width, g.height) == (70, 44) and g.tile(42, 22) == "marble" and g.tile(21, 30) == "grass" and g.tile(20, 31) == "sand"
    assert g.tile(20, 30) == "marble" and g.tile(22, 30) == "marble" and g.tile(21, 31) == "marble"      # ' ' lässt Kachel unverändert
    assert eng.state.obj("pavilion_bench").location_id == "pavilion" and eng.state.agent("jonas").location_id == "pavilion"
    assert eng.edit.applied_patches()[0]["id"] == "2026-pavillon"
    assert code_of(eng.edit.apply_patch, PATCH) == "exists"                 # nicht doppelt


def test_patch_is_all_or_nothing(eng):
    bad = {**PATCH, "id": "kaputt", "objects": [{"kind": "zauberstab", "name": "Stab", "tile": [42, 22]}]}
    before = snap(eng)
    assert code_of(eng.edit.apply_patch, bad) == "unknown"
    assert snap(eng) == before
    assert "marble" not in eng.state.tile_types and eng.state.grid.width == 64 and eng.edit.applied_patches() == []
    assert "pavilion" not in eng.state.locations and eng.state.agent("jonas") is None
    assert eng.edit.apply_patch({**PATCH, "id": "korrigiert"}).value["agents"] == 1       # danach geht es


def test_patch_shape_validation(eng):
    assert code_of(eng.edit.apply_patch, {}) == "invalid"
    assert code_of(eng.edit.apply_patch, {"id": "p", "tiel": []}) == "invalid"             # Tippfehler im Abschnitt
    assert code_of(eng.edit.apply_patch, {"id": "p", "locations": [{"name": "ohne id", "rect": [1, 1, 1, 1]}]}) == "invalid"
    assert code_of(eng.edit.apply_patch, {"id": "p", "tiles": [{"foo": 1}]}) == "invalid"
    assert code_of(eng.edit.apply_patch, {"id": "p", "tiles": [{"at": [1, 1], "rows": ["Q"]}]}) == "unknown"
    assert eng.edit.applied_patches() == []


def test_everything_survives_restart(tmp_path):
    path = tmp_path / "live.db"
    eng = WorldEngine.create(Database(path))
    eng.edit.apply_patch(PATCH)
    eng.edit.add_resource_node("clay_pit", [8, 25], "clay", 5, 5)
    eng.advance(10)
    snapshot = eng.state.snapshot()
    eng.db.close()
    eng2 = WorldEngine(Database(path))
    assert eng2.state.snapshot() == snapshot
    g = eng2.state.grid
    assert (g.width, g.height) == (70, 44) and eng2.state.tile_types["marble"].char == "m" and "pavilion" in eng2.state.locations
    assert eng2.edit.applied_patches()[0]["id"] == "2026-pavillon"
    assert code_of(eng2.edit.apply_patch, PATCH) == "exists"
    ok(eng2, "jonas", "move_to", target="lake")


# --- Alte Spielstände ---------------------------------------------------------------------------------------

def test_unknown_object_kind_from_old_save_is_tolerated(eng):
    with eng.db.transaction() as c:
        c.execute("INSERT INTO objects(id,kind,name,location_id,x,y,state) VALUES('stab_1','zauberstab','Zauberstab','paths',20,19,'{\"mana\":3}')")
    eng.state.reload_caches()
    assert eng.state.obj("stab_1").state == {"mana": 3}
    assert (20, 19) not in eng.state.grid.blocked
    put(eng, "alex", 20, 18)
    ok(eng, "alex", "inspect", object_id="stab_1")
    reject(eng, "alex", "use", "invalid_target", object_id="stab_1", mode="zaubern")
    eng.advance(50)                                                        # Tick, Wachstum, Bedürfnisse laufen weiter


def test_database_from_before_tile_types_is_migrated(tmp_path):
    path = tmp_path / "alt.db"
    eng = WorldEngine.create(Database(path))
    eng.db.close()
    raw = sqlite3.connect(path)                         # Zustand vor Migration 002 nachstellen
    raw.executescript("DROP TABLE tile_types; DROP TABLE agent_profiles; DROP TABLE agent_runtime; DROP TABLE observations; "
                     "DROP TABLE conversations; DROP TABLE decisions; DROP TABLE idempotency; "
                     "DROP TABLE memories_fts; DROP TABLE memories; DROP TABLE retrievals; DROP TABLE known_objects; DROP TABLE known_locations; DROP TABLE memory_state; "
                     "DROP TABLE goals; DROP TABLE agent_needs; DROP TABLE relations; DROP TABLE relation_log; DROP TABLE failed_actions; DROP TABLE action_locks; "
                     "DROP INDEX events_event_id; DROP INDEX events_category; DROP INDEX events_location; DROP INDEX events_parent; "
                     "ALTER TABLE events DROP COLUMN event_id; ALTER TABLE events DROP COLUMN category; ALTER TABLE events DROP COLUMN visibility; "
                     "PRAGMA user_version = 1;")
    raw.commit()
    raw.close()
    db = Database(path)
    assert db.schema_version() >= 2
    eng2 = WorldEngine(db)
    assert set(eng2.state.tile_types) >= {"grass", "path", "floor", "wall", "water", "tree", "door", "sand"}
    ok(eng2, "alex", "move_to", target="lake")
