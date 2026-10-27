import pytest

from .conftest import ok, put, reject, stock, types


def test_inspect_object_node_and_held(eng):
    put(eng, "alex", 22, 7)  # Werkstatt
    e = ok(eng, "alex", "inspect", object_id="axe")
    assert e[-2].type == "agent.inspected" and e[-2].data["object"]["kind"] == "axe"
    e = ok(eng, "alex", "inspect", object_id="woodpile")
    assert [x for x in e if x.type == "agent.inspected"][0].data["amount"] == 6
    reject(eng, "alex", "inspect", "not_here", object_id="well_garden")
    reject(eng, "alex", "inspect", "invalid_target", object_id="nichts")
    reject(eng, "alex", "inspect", "invalid_target")


def test_inspect_reveals_hidden_object_only_for_the_inspector(eng):
    put(eng, "alex", 9, 26)
    assert eng.state.obj("old_key").visible_to("alex") is False
    reject(eng, "alex", "take", "invalid_target", object_id="old_key")        # unbekannt
    put(eng, "alex", 8, 25)
    # Untersuchen irgendeines Objekts am Ort deckt Verborgenes in Reichweite auf; im Wald liegt nur die Quelle, also ein Stein dazu
    from on_their_own.world.models import WorldObject
    with eng.db.transaction():
        eng.state.save_object(WorldObject(id="stone_1", kind="item", name="Stein", location_id="forest", x=8, y=25), new=True)
    events = ok(eng, "alex", "inspect", object_id="stone_1")
    assert "world.object_discovered" in types(events)
    assert eng.state.obj("old_key").visible_to("alex")
    assert not eng.state.obj("old_key").visible_to("mira")      # Mira weiß nichts davon
    put(eng, "mira", 9, 26)
    reject(eng, "mira", "take", "invalid_target", object_id="old_key")
    ok(eng, "alex", "take", object_id="old_key")
    assert [o.id for o in eng.state.objects_held("alex")] == ["old_key"]


def test_take_and_drop_move_object_between_world_and_inventory(eng):
    put(eng, "alex", 21, 7)
    ok(eng, "alex", "take", object_id="axe")
    o = eng.state.obj("axe")
    assert o.holder == "alex" and o.location_id is None and o.x is None
    assert eng.state.inv_load(eng.state.agent("alex")) == 1
    put(eng, "alex", 24, 8)
    ok(eng, "alex", "drop", object_id="axe")
    o = eng.state.obj("axe")
    assert o.holder is None and (o.x, o.y) == (24, 8) and o.location_id == "house.workshop"
    reject(eng, "alex", "drop", "invalid_target", object_id="axe")


def test_take_rejections(eng):
    put(eng, "alex", 21, 7)
    reject(eng, "alex", "take", "forbidden_by_rules", object_id="workbench")     # nicht tragbar
    reject(eng, "alex", "take", "not_here", object_id="well_garden")
    stock(eng, "alex", wood=10)
    reject(eng, "alex", "take", "capacity", object_id="axe")


def test_two_agents_cannot_take_the_same_item(eng):
    put(eng, "alex", 21, 7)
    put(eng, "mira", 21, 8)
    ok(eng, "alex", "take", object_id="axe")
    reject(eng, "mira", "take", "not_here", object_id="axe")


def test_give_object_and_resource(eng):
    put(eng, "alex", 21, 7)
    put(eng, "mira", 22, 7)
    ok(eng, "alex", "take", object_id="axe")
    ok(eng, "alex", "give", to="mira", object_id="axe")
    assert eng.state.obj("axe").holder == "mira"
    stock(eng, "alex", wood=3)
    ok(eng, "alex", "give", to="mira", resource="wood", amount=2)
    assert eng.state.agent("alex").inventory["wood"] == 1 and eng.state.agent("mira").inventory["wood"] == 2
    reject(eng, "alex", "give", "missing_resource", to="mira", resource="wood", amount=5)
    reject(eng, "alex", "give", "invalid_target", to="alex", resource="wood")
    reject(eng, "alex", "give", "invalid_target", to="mira", object_id="pickaxe")      # nicht getragen
    put(eng, "mira", 30, 25)
    reject(eng, "alex", "give", "not_here", to="mira", resource="wood")


def test_give_respects_receiver_capacity(eng):
    put(eng, "alex", 21, 7)
    put(eng, "mira", 22, 7)
    stock(eng, "alex", wood=3)
    stock(eng, "mira", stone=9)
    reject(eng, "alex", "give", "capacity", to="mira", resource="wood", amount=2)


def test_use_unknown_mode_and_hidden_state(eng):
    put(eng, "alex", 20, 13)
    reject(eng, "alex", "use", "invalid_target", object_id="table_living", mode="sleep")
    reject(eng, "alex", "use", "invalid_target", object_id="fireplace", mode="tanzen")


def test_lock_and_unlock_doors(eng):
    put(eng, "alex", 20, 15)
    ok(eng, "alex", "use", object_id="door_front", mode="lock")
    assert eng.state.obj("door_front").state["locked"] and (20, 16) in eng.state.grid.blocked
    reject(eng, "alex", "use", "invalid_target", object_id="door_front", mode="lock")
    ok(eng, "alex", "use", object_id="door_front", mode="unlock")
    assert (20, 16) not in eng.state.grid.blocked


def test_door_with_key_requirement(eng):
    put(eng, "alex", 20, 15)
    with eng.db.transaction():
        d = eng.state.obj("door_front")
        d.state.update(locked=True, needs_key=True)
        eng.state.save_object(d)
    reject(eng, "alex", "use", "locked", object_id="door_front", mode="unlock")
    with eng.db.transaction():
        k = eng.state.obj("old_key")
        k.holder, k.location_id, k.x, k.y, k.hidden = "alex", None, None, None, False
        eng.state.save_object(k)
    ok(eng, "alex", "use", object_id="door_front", mode="unlock")
    assert not eng.state.obj("door_front").state["locked"]


def test_fireplace_needs_wood_and_toggles(eng):
    put(eng, "alex", 25, 13)
    reject(eng, "alex", "use", "missing_resource", object_id="fireplace", mode="light")
    stock(eng, "alex", wood=2)
    ok(eng, "alex", "use", object_id="fireplace", mode="light")
    assert eng.state.obj("fireplace").state["lit"] and eng.state.agent("alex").inventory["wood"] == 1
    reject(eng, "alex", "use", "invalid_target", object_id="fireplace", mode="light")
    ok(eng, "alex", "use", object_id="fireplace", mode="extinguish")
    assert not eng.state.obj("fireplace").state["lit"]


def test_cook_creates_meal_and_eat_uses_it(eng):
    put(eng, "alex", 7, 12)
    reject(eng, "alex", "use", "missing_resource", object_id="stove", mode="cook")
    stock(eng, "alex", food=1, wood=1)
    events = ok(eng, "alex", "use", object_id="stove", mode="cook")
    assert "world.object_created" in types(events)
    a = eng.state.agent("alex")
    assert not a.inventory and [o.kind for o in eng.state.objects_held("alex")] == ["meal"]
    with eng.db.transaction():
        a.needs["hunger"] = 90
        eng.state.save_agent(a)
    ok(eng, "alex", "eat")
    assert eng.state.agent("alex").needs["hunger"] == pytest.approx(30, abs=1) and not eng.state.objects_held("alex")


def test_board_write_and_read(eng):
    put(eng, "alex", 37, 22)
    reject(eng, "alex", "use", "invalid_target", object_id="board_square", mode="write")           # Text fehlt
    reject(eng, "alex", "use", "invalid_target", object_id="board_square", mode="write", text="x" * 301)
    ok(eng, "alex", "use", object_id="board_square", mode="write", text="Markt am Samstag!")
    notes = eng.state.obj("board_square").state["notes"]
    assert notes[-1]["text"] == "Markt am Samstag!" and notes[-1]["by"] == "alex"
    events = ok(eng, "alex", "use", object_id="board_square", mode="read")
    read = [e for e in events if e.type == "agent.read"][0]
    assert len(read.data["content"]) == 2


def test_board_capacity(eng):
    put(eng, "alex", 37, 22)
    with eng.db.transaction():
        b = eng.state.obj("board_square")
        b.state["notes"] = [{"by": "x", "at": 0, "text": str(i)} for i in range(20)]
        eng.state.save_object(b)
    reject(eng, "alex", "use", "capacity", object_id="board_square", mode="write", text="zu viel")


def test_fishing_is_deterministic_and_respects_capacity(eng):
    put(eng, "alex", 52, 28)
    stock(eng, "alex", wood=10)
    reject(eng, "alex", "use", "capacity", object_id="fishing_spot", mode="fish")
    stock(eng, "alex", wood=0)
    events = ok(eng, "alex", "use", object_id="fishing_spot", mode="fish")
    fished = [e for e in events if e.type == "agent.fished"][0]
    assert fished.data["caught"] == (eng.state.agent("alex").inventory.get("food", 0) == 1)


def test_book_shelf_read_reports_titles(eng):
    put(eng, "mira", 24, 12)
    events = ok(eng, "mira", "use", object_id="bookshelf", mode="read")
    assert "Pilzkunde" in [e for e in events if e.type == "agent.read"][0].data["content"]
