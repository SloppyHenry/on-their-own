from on_their_own.world.loader import grid_from_world, load_world_file
from on_their_own.world.pathfinding import Pathfinder


def grid():
    return grid_from_world(load_world_file())


def test_house_to_lake_path_is_connected_and_open():
    g = grid()
    p = Pathfinder(g).find((7, 7), (52, 28))
    assert p and p[-1] == (52, 28)
    prev = (7, 7)
    for t in p:
        assert abs(t[0] - prev[0]) + abs(t[1] - prev[1]) == 1 and g.is_open(*t)
        prev = t


def test_path_goes_around_water():
    g = grid()
    p = Pathfinder(g).find((46, 22), (46, 34))   # Westufer nord -> süd, Wasser liegt östlich
    assert p and all(g.tile(*t) != "water" for t in p)
    assert all(t[0] <= 52 for t in p)


def test_prefers_paths_over_grass():
    g = grid()
    cost = lambda path: sum(g.cost(*t) for t in path)
    via = Pathfinder(g).find((20, 17), (20, 25))
    assert cost(via) == 8  # gerader Weg über Pfadkacheln


def test_unreachable_goal_and_blocked_goal():
    g = grid()
    pf = Pathfinder(g)
    assert pf.find((7, 7), (0, 0)) is None          # Baum
    g.set_blocked({(20, 20)})
    assert pf.find((7, 7), (20, 20)) is None


def test_enclosed_target_is_unreachable():
    g = grid()
    ring = {(33, 8), (35, 8), (34, 7), (34, 9)}
    g.set_blocked(ring)
    assert Pathfinder(g).find((7, 7), (34, 8)) is None


def test_forbidden_tiles_are_not_entered():
    g = grid()
    banned = {(20, y) for y in range(17, 26)}
    g.set_forbidden(banned)
    p = Pathfinder(g).find((7, 7), (33, 25))
    assert p and not banned & set(p)     # Umweg über den Garten statt über den Vorplatz


def test_cache_invalidated_when_world_changes():
    g = grid()
    pf = Pathfinder(g)
    first = pf.find((20, 17), (20, 25))
    assert pf.find((20, 17), (20, 25)) is first   # aus dem Cache
    g.set_blocked({first[3]})
    second = pf.find((20, 17), (20, 25))
    assert second != first and first[3] not in second


def test_start_equals_goal():
    assert Pathfinder(grid()).find((7, 7), (7, 7)) == []


def _small(rows: list[str]):
    from on_their_own.world.grid import Grid, TileType
    types = {"g": TileType("g", True, 1, "."), "w": TileType("w", False, 0, "#")}
    return Grid.from_rows(rows, types)


def test_uebergang_verbindet_getrennte_bereiche():
    g = _small(["...#...", "...#...", "...#..."])
    assert Pathfinder(g).find((0, 1), (6, 1)) is None
    g.set_links([[[2, 0], [4, 2]]])
    p = Pathfinder(g).find((0, 1), (6, 1))
    assert p is not None and (2, 0) in p and (4, 2) in p
    assert p[p.index((2, 0)) + 1] == (4, 2)                 # direkt durch den Übergang
    assert g.adjacent((2, 0), (4, 2)) and g.adjacent((4, 2), (2, 0))


def test_uebergang_nur_wenn_kuerzer():
    g = _small([".......", ".......", "......."])
    g.set_links([[[0, 0], [6, 2]]])
    assert len(Pathfinder(g).find((0, 0), (6, 2))) == 1      # Abkürzung
    assert len(Pathfinder(g).find((1, 1), (3, 1))) == 2      # ohne Umweg über den Übergang


def test_uebergang_ungueltig_in_weltdatei():
    import pytest
    from on_their_own.db.connection import Database
    from on_their_own.world.loader import load_world_file, seed_world
    w = load_world_file()
    w["links"] = [[[0, 0], [1, 1]]]                          # Ecke ist Wald, nicht begehbar
    with pytest.raises(ValueError):
        seed_world(Database(":memory:"), w)
