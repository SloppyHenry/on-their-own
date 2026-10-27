import pytest

from on_their_own.world.rules import WorldRules

from .conftest import ok, put, reject, run, stock, types


def test_build_consumes_resources_shows_site_then_creates_object(eng):
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=5)
    assert eng.propose("alex", "build", {"blueprint": "bench"}).ok
    assert eng.state.agent("alex").inventory == {"wood": 2}                # Kosten sofort bezahlt
    site = next(o for o in eng.state.all_objects() if o.kind == "construction_site")
    assert site.state["progress"] == 0 and site.state["total"] == 60
    eng.advance(30)
    assert eng.state.obj(site.id).state["progress"] == 30
    eng.advance(40)
    assert eng.state.obj(site.id) is None
    bench = next(o for o in eng.state.all_objects() if o.kind == "bench" and o.created_by == "alex")
    assert (bench.x, bench.y) == (site.x, site.y) and bench.location_id == "garden"
    assert eng.state.agent("alex").action is None


def test_build_rejections(eng):
    put(eng, "alex", 36, 13)
    reject(eng, "alex", "build", "invalid_target", blueprint="raumschiff")
    reject(eng, "alex", "build", "missing_resource", blueprint="bench")
    stock(eng, "alex", wood=4)
    reject(eng, "alex", "build", "not_here", blueprint="bench", at=[1, 1])          # zu weit weg
    put(eng, "alex", 36, 14)
    reject(eng, "alex", "build", "invalid_target", blueprint="bench", at=[36, 16])  # liegt schon außerhalb des Gartens
    put(eng, "alex", 36, 13)
    reject(eng, "alex", "build", "not_here", blueprint="bench", at=[30, 5])         # zu weit
    reject(eng, "alex", "build", "not_here", blueprint="birdhouse")                 # Werkbank fehlt
    reject(eng, "alex", "build", "not_here", blueprint="pier_extension")            # nicht am See
    put(eng, "alex", 20, 13)
    reject(eng, "alex", "build", "forbidden_by_rules", blueprint="bench")           # nicht im Haus


def test_occupied_tile_rejected_and_explicit_tile_works(eng):
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=6)
    ok(eng, "alex", "build", blueprint="bench", at=[37, 13])
    reject(eng, "alex", "build", "invalid_target", blueprint="bench", at=[37, 13])
    assert any(o.kind == "bench" and (o.x, o.y) == (37, 13) for o in eng.state.all_objects())


def test_workbench_blueprint_in_workshop(eng):
    put(eng, "alex", 21, 7)
    stock(eng, "alex", wood=2)
    reject(eng, "alex", "build", "forbidden_by_rules", blueprint="birdhouse")       # outdoor: nicht im Haus


def test_storm_blocks_outdoor_building(eng):
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=3)
    eng.set_weather("storm", 600)
    reject(eng, "alex", "build", "forbidden_by_rules", blueprint="bench")


def test_costs_and_duration_scale_with_rules(eng):
    eng.set_rules(WorldRules(build_cost_mult=2.0, build_duration_mult=0.5))
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=5)
    reject(eng, "alex", "build", "missing_resource", blueprint="bench")             # kostet jetzt 6
    stock(eng, "alex", wood=6)
    t0 = eng.minute
    ok(eng, "alex", "build", blueprint="bench")
    assert eng.minute - t0 == 30 and not eng.state.agent("alex").inventory


def test_max_objects_limit(eng):
    eng.set_rules(WorldRules(max_objects=eng.state.object_count()))
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=3)
    reject(eng, "alex", "build", "forbidden_by_rules", blueprint="bench")
    assert eng.state.agent("alex").inventory == {"wood": 3}                          # nichts verbraucht


def test_blocking_objects_change_paths(eng):
    put(eng, "alex", 36, 11)
    stock(eng, "alex", wood=2)
    before = eng.state.pathfinder.find((36, 12), (36, 14))
    ok(eng, "alex", "build", blueprint="fence", at=[36, 13])
    assert (36, 13) in eng.state.grid.blocked
    after = eng.state.pathfinder.find((36, 12), (36, 14))
    assert (36, 13) not in after and len(after) > len(before)


def test_pier_extension_turns_water_into_floor(eng):
    put(eng, "alex", 52, 28)
    stock(eng, "alex", wood=4)
    assert eng.state.grid.tile(53, 28) == "water"
    ok(eng, "alex", "build", blueprint="pier_extension", at=[53, 28])
    assert eng.state.grid.tile(53, 28) == "floor" and eng.state.grid.walkable(53, 28)
    row = eng.state.conn.execute("SELECT type FROM tiles WHERE x=53 AND y=28").fetchone()
    assert row["type"] == "floor"
    ok(eng, "mira", "move_to", tile=[53, 28])
    assert eng.state.agent("mira").pos == (53, 28)
    put(eng, "alex", 52, 28)
    stock(eng, "alex", wood=4)
    reject(eng, "alex", "build", "invalid_target", blueprint="pier_extension", at=[55, 28])    # kein Anschluss


def test_interrupted_site_can_be_resumed(eng):
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=3)
    assert eng.propose("alex", "build", {"blueprint": "bench"}).ok
    eng.advance(20)
    ev = eng.interrupt("alex", "Hunger")
    assert "agent.action_interrupted" in types(ev)
    site = next(o for o in eng.state.all_objects() if o.kind == "construction_site")
    assert site.state["progress"] == 20
    res, events = run(eng, "alex", "build", site_id=site.id)
    assert res.ok and eng.state.obj(site.id) is None
    assert any(o.kind == "bench" for o in eng.state.all_objects())
    assert eng.state.agent("alex").inventory == {}                                  # nicht doppelt bezahlt


def test_resume_needs_site_here(eng):
    reject(eng, "alex", "build", "invalid_target", site_id="site_99")
