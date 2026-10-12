"""§17 Nr. 4: Aktionen verändern den Weltzustand tatsächlich – je registrierter Aktion ein Zustandsvergleich vorher/nachher.

Der Wächter am Ende sorgt dafür, dass jede neue Aktion im Katalog hier einen Nachweis bekommen muss.
"""

import pytest
from world.conftest import ok, put, stock

from simulacra.world.actions import REGISTRY
from simulacra.world.models import WorldObject

COVERED: set[str] = set()


def covers(action):
    COVERED.add(action)
    return lambda fn: fn


def needs(eng, agent, **vals):
    with eng.db.transaction():
        a = eng.state.agent(agent)
        a.needs.update(vals)
        eng.state.save_agent(a)


@covers("move_to")
def test_k04_move_to_aendert_position_und_ort(eng):
    before = eng.state.agent("alex")
    ok(eng, "alex", "move_to", target="lake")
    after = eng.state.agent("alex")
    assert (after.x, after.y) != (before.x, before.y) and after.location_id == "lake" != before.location_id


@covers("wait")
def test_k04_wait_laesst_die_zeit_vergehen(eng):
    t0 = eng.minute
    ok(eng, "alex", "wait", minutes=7)
    assert eng.minute - t0 >= 7 and eng.state.agent("alex").action is None


@covers("inspect")
def test_k04_inspect_macht_verborgenes_fuer_den_untersuchenden_bekannt(eng):
    put(eng, "alex", 8, 25)
    with eng.db.transaction():
        eng.state.save_object(WorldObject(id="stone_1", kind="item", name="Stein", location_id="forest", x=8, y=25), new=True)
    assert not eng.state.obj("old_key").visible_to("alex")
    ok(eng, "alex", "inspect", object_id="stone_1")
    assert eng.state.obj("old_key").visible_to("alex") and not eng.state.obj("old_key").visible_to("mira")


@covers("take")
def test_k04_take_legt_den_gegenstand_ins_inventar(eng):
    put(eng, "alex", 21, 7)
    assert eng.state.obj("axe").holder is None
    ok(eng, "alex", "take", object_id="axe")
    assert eng.state.obj("axe").holder == "alex" and eng.state.obj("axe").x is None


@covers("drop")
def test_k04_drop_legt_den_gegenstand_an_die_stelle(eng):
    put(eng, "alex", 21, 7)
    ok(eng, "alex", "take", object_id="axe")
    put(eng, "alex", 24, 8)
    ok(eng, "alex", "drop", object_id="axe")
    o = eng.state.obj("axe")
    assert o.holder is None and (o.x, o.y) == (24, 8)


@covers("give")
def test_k04_give_wechselt_den_besitzer(eng):
    put(eng, "alex", 21, 7)
    put(eng, "mira", 22, 7)
    stock(eng, "alex", wood=3)
    ok(eng, "alex", "give", to="mira", resource="wood", amount=2)
    assert eng.state.agent("alex").inventory["wood"] == 1 and eng.state.agent("mira").inventory["wood"] == 2


@covers("use")
def test_k04_use_aendert_den_objektzustand(eng):
    put(eng, "alex", 25, 13)
    stock(eng, "alex", wood=1)
    assert not eng.state.obj("fireplace").state.get("lit")
    ok(eng, "alex", "use", object_id="fireplace", mode="light")
    assert eng.state.obj("fireplace").state["lit"] and not eng.state.agent("alex").inventory.get("wood")


@covers("gather")
def test_k04_gather_leert_die_quelle_und_fuellt_das_inventar(eng):
    put(eng, "alex", 24, 6)
    before = eng.state.node("woodpile").amount
    ok(eng, "alex", "gather", resource="wood", amount=2)
    assert eng.state.node("woodpile").amount == before - 2 and eng.state.agent("alex").inventory == {"wood": 2}


@covers("plant")
def test_k04_plant_legt_eine_pflanze_an(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=2)
    plants = lambda: [o for o in eng.state.all_objects() if o.kind == "plant"]  # noqa: E731
    n = len(plants())
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    assert len(plants()) == n + 1 and eng.state.agent("alex").inventory["seeds"] == 1


@covers("water")
def test_k04_water_giesst_die_pflanze(eng):
    put(eng, "alex", 32, 8)
    stock(eng, "alex", seeds=1)
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    pid = next(o.id for o in eng.state.all_objects() if o.kind == "plant")
    assert eng.state.obj(pid).state.get("watered_at") is None
    ok(eng, "alex", "water", object_id=pid)
    assert eng.state.obj(pid).state["watered_at"] is not None


@covers("build")
def test_k04_build_verbraucht_material_und_erzeugt_ein_objekt(eng):
    put(eng, "alex", 36, 13)
    stock(eng, "alex", wood=5)
    n = len(eng.state.all_objects())
    ok(eng, "alex", "build", blueprint="bench")
    assert eng.state.agent("alex").inventory == {"wood": 2}
    assert any(o.kind == "bench" and o.created_by == "alex" for o in eng.state.all_objects()) and len(eng.state.all_objects()) == n + 1


@covers("eat")
def test_k04_eat_senkt_hunger_und_vorrat(eng):
    needs(eng, "alex", hunger=80)
    put(eng, "alex", 11, 12)
    before = eng.state.node("pantry").amount
    ok(eng, "alex", "eat")
    assert eng.state.agent("alex").needs["hunger"] < 80 and eng.state.node("pantry").amount == before - 1


@covers("drink")
def test_k04_drink_senkt_durst(eng):
    needs(eng, "alex", thirst=80)
    put(eng, "alex", 20, 13)
    stock(eng, "alex", water=1)
    ok(eng, "alex", "drink")
    assert eng.state.agent("alex").needs["thirst"] < 80 and not eng.state.agent("alex").inventory.get("water")


@covers("rest")
def test_k04_rest_gibt_energie(eng):
    needs(eng, "alex", energy=40)
    put(eng, "alex", 8, 25)
    ok(eng, "alex", "rest", minutes=20)
    assert eng.state.agent("alex").needs["energy"] > 40


@covers("sleep")
def test_k04_sleep_fuellt_die_energie(eng):
    needs(eng, "alex", energy=20)
    put(eng, "alex", 7, 7)
    ok(eng, "alex", "sleep")
    assert eng.state.agent("alex").needs["energy"] == 100


@covers("speak")
async def test_k04_speak_beginnt_ein_gespraech_das_der_andere_hoert(sim):
    eng = sim.engine
    put(eng, "alex", 20, 13)
    put(eng, "mira", 21, 13)
    assert sim.convs.between("alex", "mira") is None
    assert eng.propose("alex", "speak", {"to": "mira", "text": "Guten Morgen, Mira!"}).ok
    await sim.runner.step(1)
    c = sim.convs.between("alex", "mira")
    assert c is not None and any(t["text"] == "Guten Morgen, Mira!" for t in c.turns)
    heard = sim.engine.state.conn.execute("SELECT text FROM observations WHERE agent_id='mira'").fetchall()
    assert any("Guten Morgen" in r["text"] for r in heard)                                # Miras Wahrnehmung enthält den Satz


@pytest.fixture
def eng(sim):
    return sim.engine


def test_k04_jede_registrierte_aktion_hat_einen_nachweis():
    assert set(REGISTRY) == COVERED, f"ohne Nachweis: {sorted(set(REGISTRY) - COVERED)}"
