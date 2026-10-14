"""Die Startwelt als Datei ist in sich stimmig."""

import json
from collections import deque

from simulacra.world import object_kinds
from simulacra.world.loader import DEFAULT_WORLD, grid_from_world, load_blueprints, load_world_file


def test_size_and_legend():
    w = load_world_file()
    rows = w["tiles"]
    assert w["size"] == [64, 40] and len(rows) == 40 and all(len(r) == 64 for r in rows)
    assert set("".join(rows)) <= {t["char"] for t in w["tile_types"].values()}


def test_required_locations_exist():
    ids = {l["id"] for l in load_world_file()["locations"]}
    assert {"house.living", "house.kitchen", "house.bedroom_a", "house.bedroom_b", "house.workshop", "garden", "forest", "lake", "square", "paths"} <= ids


def test_objects_and_nodes_stand_on_walkable_tiles(eng):
    g = eng.state.grid
    for o in eng.state.all_objects():
        assert g.walkable(o.x, o.y), f"{o.id} steht auf {g.tile(o.x, o.y)}"
        assert o.location_id == eng.state.location_at(o.x, o.y)
    for n in eng.state.all_nodes():
        assert g.walkable(n.x, n.y), f"{n.id} steht auf {g.tile(n.x, n.y)}"
        assert n.location_id == eng.state.location_at(n.x, n.y), n.id


def test_all_kinds_and_blueprints_known(eng):
    for o in load_world_file()["objects"]:
        object_kinds.normalize_state(o["kind"], o.get("state", {}))
    for name, bp in load_blueprints().items():
        assert bp["kind"] in object_kinds.KINDS, name
        assert set(bp["cost"]) <= {"wood", "food", "water", "seeds", "stone", "reed"}


def test_every_place_reachable_from_both_bedrooms(eng):
    g = grid_from_world(load_world_file())
    for start in ((7, 7), (14, 7)):
        seen, q = {start}, deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + dx, y + dy)
                if p not in seen and g.walkable(*p):
                    seen.add(p)
                    q.append(p)
        for o in load_world_file()["objects"] + load_world_file()["resource_nodes"]:
            if not o.get("hidden"):
                assert tuple(o["tile"]) in seen, f"{o['id']} nicht erreichbar"


def test_tile_types_are_consistent():
    w = load_world_file()
    chars = [t["char"] for t in w["tile_types"].values()]
    assert len(chars) == len(set(chars))
    assert w["schema"] == 1 and json.loads(DEFAULT_WORLD.read_text())["name"]
    for name, t in w["tile_types"].items():
        assert isinstance(t["walkable"], bool) and (not t["walkable"] or t["cost"] >= 1), name
