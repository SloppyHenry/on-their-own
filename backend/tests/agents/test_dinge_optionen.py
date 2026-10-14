"""Dinge im Dorf (AP15) aus Sicht der Agenten: Wahrnehmung, Optionen, Bewertung, Beobachtungen – auf der echten Startwelt."""

import pytest

from simulacra.agents.factors import Env, core
from simulacra.agents.observations import _short_state
from simulacra.agents.scoring import Tuning
from simulacra.world import loader

from tests.conftest import START_WORLD

from .conftest import make_sim, put
from .test_perception_options import all_opts, opts, percept


@pytest.fixture
def dorf(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    s = make_sim()
    s.store.ensure_all()
    yield s
    s.close()


def labels(sim, aid):
    return {o.label.split(" (ca.")[0]: o for o in all_opts(sim, aid)}


def test_post_for_the_neighbour_is_offered_and_noticed(dorf):
    put(dorf, "alex", 9, 11)                                          # vor dem Haus, am Briefkasten
    put(dorf, "mira", 10, 11)
    assert "Mira einen Brief schreiben und in den Briefkasten werfen" in labels(dorf, "alex")
    assert dict((o["id"], o["note"]) for o in percept(dorf, "mira").objects)["mailbox"] == "keine Post für dich"
    assert dorf.engine.propose("alex", "use", {"object_id": "mailbox", "mode": "post", "to": "mira", "text": "Komm heute Abend zum Steg!"}).ok
    dorf.engine.advance(10)
    assert dict((o["id"], o["note"]) for o in percept(dorf, "mira").objects)["mailbox"] == "Post für dich (1 Brief)"
    collect = [o for o in opts(dorf, "mira") if o.kind == "collect"]
    assert collect and collect[0].id == "o1"                         # Post holen steht ganz oben


def test_lanterns_are_lit_in_the_evening_and_put_out_by_day(dorf):
    put(dorf, "alex", 13, 13)                                          # am Platz, neben der Laterne
    o = labels(dorf, "alex")["Die Laterne anzünden"]
    assert o.params["object_id"] == "lantern_2" and o.meta["object_kind"] == "lantern"

    def light_factor():
        p = percept(dorf, "alex")
        return dict(core.time_weather(o, p, p.agent.personality, None, Env([], Tuning(), False, None)))
    assert light_factor() == {"Es ist hell": -12.0}                   # 07:00
    dorf.engine.advance(20 * 60 - dorf.engine.minute % 1440)           # 20:00, Dämmerung
    assert light_factor() == {"Dunkelheit": 16.0}


def test_named_sources_and_new_things_in_options(dorf):
    put(dorf, "mira", 7, 15)                                           # im Garten
    p = percept(dorf, "mira")
    assert {"Tomaten: Nahrung", "Sonnenblumen: Samen", "Regentonnen: Wasser"} <= {s["resource"] for s in p.sources}
    assert {"Tomaten – Nahrung sammeln (2×)", "Regentonnen – Wasser sammeln (2×)"} <= set(labels(dorf, "mira"))
    put(dorf, "alex", 17, 12)                                          # am Steg
    assert {"Mit dem Boot auf den See hinausrudern", "Vom Boot aus angeln", "Schilf – Schilf sammeln (2×)"} <= set(labels(dorf, "alex"))
    put(dorf, "alex", 40, 12)                                          # Wohnzimmer
    got = set(labels(dorf, "alex"))
    assert {"Sich in den Sessel setzen und ausruhen", "Die Kerze anzünden", "Die Stehlampe einschalten"} <= got


def test_containers_show_contents_and_offer_both_ways(dorf):
    put(dorf, "alex", 31, 5)                                           # Zimmer Alex, am Schrank
    from tests.world.conftest import stock
    stock(dorf.engine, "alex", wood=2)
    assert "2× Holz in Schrank legen" in labels(dorf, "alex")
    assert dorf.engine.propose("alex", "use", {"object_id": "wardrobe", "mode": "store", "resource": "wood", "amount": 2}).ok
    dorf.engine.advance(2)
    assert dict((o["id"], o["note"]) for o in percept(dorf, "alex").objects)["wardrobe"] == "darin: 2× Holz"
    assert "2× Holz aus Schrank nehmen" in labels(dorf, "alex")


def test_observations_and_private_state():
    assert _short_state({"letters": [{"text": "geheim"}], "spots": [[1, 2]], "lit": True}) == "lit: True"


def test_petting_the_cat_eases_loneliness(dorf):
    cat = dorf.engine.state.obj("cat")
    put(dorf, "mira", cat.x, cat.y)
    needs = dorf.autonomy.needs
    before = needs.get("mira")["social"]
    assert dorf.engine.propose("mira", "use", {"object_id": "cat", "mode": "pet"}).ok
    needs.tick(["mira"], dorf.engine.minute, set())
    alone = needs.params.social_rise_per_hour / 60
    assert needs.get("mira")["social"] == pytest.approx(max(0.0, before + alone - needs.params.social_relief_per_min_petting))
