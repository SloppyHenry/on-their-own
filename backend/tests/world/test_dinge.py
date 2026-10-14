"""Dinge im Dorf (AP15): Boot, Lichter, Briefkasten, Wegweiser, Vogelscheuche, Katze, Sessel, Ablagen, Korb, Regentonne."""

from simulacra.world import object_kinds
from simulacra.world.models import WorldObject

from .conftest import ok, put, reject, stock, types


def add(eng, oid, kind, x, y, name=None, **state):
    with eng.db.transaction():
        eng.state.save_object(WorldObject(id=oid, kind=kind, name=name or object_kinds.get(kind).label, location_id=eng.state.location_at(x, y),
                                          x=x, y=y, state=object_kinds.normalize_state(kind, state),
                                          portable=object_kinds.get(kind).portable), new=True)


def add_node(eng, nid, x, y, resource, amount, cap, regen, weather=None):
    with eng.db.transaction():
        eng.state.conn.execute("INSERT INTO resources(id,location_id,x,y,resource,amount,cap,regen_per_hour,requires_tool,gather_minutes,regen_weather) "
                               "VALUES(?,?,?,?,?,?,?,?,?,?,?)", (nid, eng.state.location_at(x, y), x, y, resource, amount, cap, regen, None, 2, weather))


def test_boat_rowing_and_fishing_one_person_at_a_time(eng):
    add(eng, "boat", "boat", 52, 29)
    put(eng, "alex", 52, 28)
    put(eng, "mira", 51, 28)
    e = ok(eng, "alex", "use", object_id="boat", mode="row", minutes=20)
    assert "agent.rowed" in types(e) and [x for x in e if x.type == "agent.rowed"][0].data["minutes"] == 20
    assert eng.propose("alex", "use", {"object_id": "boat", "mode": "row"}).ok
    reject(eng, "mira", "use", "busy", object_id="boat", mode="fish")             # Alex sitzt im Boot
    while eng.state.agent("alex").action is not None:
        eng.tick()
    e = ok(eng, "mira", "use", object_id="boat", mode="fish")
    assert "agent.fished" in types(e)
    reject(eng, "mira", "use", "invalid_target", object_id="boat", mode="row", minutes=200)


def test_lantern_lights_without_wood(eng):
    add(eng, "lantern_1", "lantern", 33, 23)
    put(eng, "alex", 33, 24)
    ok(eng, "alex", "use", object_id="lantern_1", mode="light")
    assert eng.state.obj("lantern_1").state["lit"] is True and not eng.state.agent("alex").inventory
    reject(eng, "alex", "use", "invalid_target", object_id="lantern_1", mode="light")
    ok(eng, "alex", "use", object_id="lantern_1", mode="extinguish")
    assert eng.state.obj("lantern_1").state["lit"] is False


def test_fireplace_still_needs_wood(eng):
    put(eng, "alex", 25, 13)
    reject(eng, "alex", "use", "missing_resource", object_id="fireplace", mode="light")


def test_mailbox_letters_are_private(eng):
    add(eng, "mailbox", "mailbox", 31, 24)
    put(eng, "alex", 31, 23)
    put(eng, "mira", 32, 23)
    reject(eng, "alex", "use", "invalid_target", object_id="mailbox", mode="post", to="alex", text="Hallo ich")
    reject(eng, "alex", "use", "invalid_target", object_id="mailbox", mode="post", to="mira")
    ok(eng, "alex", "use", object_id="mailbox", mode="post", to="mira", text="Treffen wir uns morgen am See?")
    reject(eng, "alex", "use", "invalid_target", object_id="mailbox", mode="collect")       # keine Post für Alex
    e = ok(eng, "mira", "use", object_id="mailbox", mode="collect")
    read = [x for x in e if x.type == "agent.read"][0]
    assert read.agents == ["mira"] and read.data["content"][0]["text"] == "Brief von Alex: Treffen wir uns morgen am See?"
    assert eng.state.obj("mailbox").state["letters"][0]["read"] is True
    reject(eng, "mira", "use", "invalid_target", object_id="mailbox", mode="collect")


def test_signpost_names_places_and_makes_them_known(eng):
    add(eng, "signpost", "signpost", 35, 27)
    put(eng, "alex", 35, 26)
    assert "alex" not in eng.state.locations["lake"].discovered_by
    e = ok(eng, "alex", "use", object_id="signpost", mode="read")
    content = [x for x in e if x.type == "agent.read"][0].data["content"]
    assert any(t.startswith("See: ") for t in content) and any(t.startswith("Wald: ") for t in content)
    assert not any(t.startswith("Zimmer") for t in content)                          # Räume im Haus nennt er nicht
    assert "alex" in eng.state.locations["lake"].discovered_by
    assert "agent.location_discovered" in types(e)


def test_storm_knocks_over_scarecrow_and_slows_the_garden(eng):
    add(eng, "scarecrow", "scarecrow", 38, 12)
    eng.set_weather("storm", 900)
    eng.advance(900)
    assert eng.state.obj("scarecrow").state["upright"] is False
    plant = {"stage": 1, "crop": "carrot", "planted_at": 0, "watered_at": None, "seedbed_id": "seedbed_1", "growth_minutes": 0}
    add(eng, "plant_a", "plant", 33, 8, name="Möhre", **plant)
    eng.set_weather("clear", 2000)
    with eng.db.transaction():
        o = eng.state.obj("plant_a")
        o.state["watered_at"] = eng.state.minute
        eng.state.save_object(o)
    eng.advance(100)
    assert 45 <= eng.state.obj("plant_a").state["growth_minutes"] <= 55            # halb so schnell
    put(eng, "alex", 38, 13)
    ok(eng, "alex", "use", object_id="scarecrow", mode="fix")
    assert eng.state.obj("scarecrow").state["upright"] is True
    reject(eng, "alex", "use", "invalid_target", object_id="scarecrow", mode="fix")
    before = eng.state.obj("plant_a").state["growth_minutes"]
    eng.advance(40)
    assert eng.state.obj("plant_a").state["growth_minutes"] - before == 40


def test_cat_wanders_by_day_sleeps_at_night_and_can_be_petted(eng):
    add(eng, "cat", "cat", 17, 12, spots=[[17, 12], [21, 12], [7, 12]])
    seen = set()
    for _ in range(8):                                                               # einen ganzen Tag lang alle drei Stunden
        eng.advance(180 - eng.state.minute % 180)
        c = eng.state.obj("cat")
        seen.add((c.x, c.y, c.location_id))
        m = eng.state.minute % 1440
        if m >= 22 * 60 or m < 6 * 60:
            assert (c.x, c.y) == (17, 12)
    assert {(21, 12, "house.living"), (7, 12, "house.kitchen")} <= seen
    c = eng.state.obj("cat")
    put(eng, "mira", c.x, c.y + 1 if c.location_id == "house.living" else c.y)
    e = ok(eng, "mira", "use", object_id="cat", mode="pet")
    assert [x for x in e if x.type == "agent.petted"][0].data["name"] == "Katze"


def test_armchair_is_a_seat(eng):
    add(eng, "armchair", "armchair", 18, 14)
    put(eng, "alex", 18, 13)
    assert "agent.rested" in types(ok(eng, "alex", "use", object_id="armchair", mode="sit", minutes=10))


def test_containers_hold_resources_and_items(eng):
    put(eng, "alex", 9, 6)
    stock(eng, "alex", wood=3)
    ok(eng, "alex", "use", object_id="chest_alex", mode="store", resource="wood", amount=2)
    assert eng.state.obj("chest_alex").state["goods"] == {"wood": 2} and eng.state.agent("alex").inventory == {"wood": 1}
    reject(eng, "alex", "use", "missing_resource", object_id="chest_alex", mode="store", resource="wood", amount=2)
    put(eng, "alex", 21, 7)
    ok(eng, "alex", "take", object_id="axe")
    put(eng, "alex", 9, 6)
    e = ok(eng, "alex", "use", object_id="chest_alex", mode="store", item="axe")
    assert [x for x in e if x.type == "agent.stored"][0].data["what"] == "Axt"
    assert eng.state.obj("axe").holder == "chest_alex" and eng.state.obj("chest_alex").state["contents"] == ["axe"]
    put(eng, "mira", 9, 7)
    reject(eng, "mira", "take", "not_here", object_id="axe")                         # liegt in der Truhe, nicht herum
    ok(eng, "mira", "use", object_id="chest_alex", mode="retrieve", item="axe")
    ok(eng, "mira", "use", object_id="chest_alex", mode="retrieve", resource="wood", amount=2)
    assert eng.state.obj("axe").holder == "mira" and eng.state.agent("mira").inventory == {"wood": 2}
    assert eng.state.obj("chest_alex").state == {"contents": [], "goods": {}}
    reject(eng, "mira", "use", "missing_resource", object_id="chest_alex", mode="retrieve", resource="wood", amount=1)


def test_reed_basket_gives_three_more_slots(eng):
    put(eng, "alex", 21, 7)
    stock(eng, "alex", reed=2)
    e = ok(eng, "alex", "build", blueprint="basket")
    basket = [x for x in e if x.type == "world.object_created" and x.data["object"]["kind"] == "basket"][0].data["object"]
    assert eng.state.obj(basket["id"]).portable and eng.state.obj(basket["id"]).state["extra_slots"] == 4
    from simulacra.world.actions.base import Ctx
    ctx = Ctx(eng, eng.state.minute)
    free = ctx.free_slots(eng.state.agent("alex"))
    put(eng, "alex", basket["x"], basket["y"])
    ok(eng, "alex", "take", object_id=basket["id"])
    assert ctx.free_slots(eng.state.agent("alex")) == free + 3


def test_rain_barrel_fills_only_in_rain(eng):
    add_node(eng, "barrel", 39, 13, "water", 0, 8, 2.0, "rain,storm")
    eng.set_weather("clear", 300)
    eng.advance(240)
    assert eng.state.node("barrel").amount == 0
    eng.set_weather("rain", 300)
    eng.advance(180)
    assert eng.state.node("barrel").amount >= 4
