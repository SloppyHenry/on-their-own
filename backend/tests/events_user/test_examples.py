"""Die elf Beispielsätze aus §10 des Auftrags: Operationen, Weltzustand danach und Wissensstände (§17 Nr. 10 und 11)."""

import pytest

from simulacra.events_user.lexicon import Lexicon
from simulacra.events_user.rules import Ctx, parse

from .conftest import memories, objects, say


def parsed(sim, text):
    st = sim.engine.state
    return parse(text, Ctx(Lexicon.build(st, sim.store.profile_ids()), st.minute, {a.id: a.location_id for a in st.agents()}))


# --- Regelparser: alle elf Sätze erkannt, ohne das Sprachmodell zu fragen ----------------------------------------------
EXPECTED = {
    "Heute beginnt es zu regnen.": ("set_weather", {"weather": "rain"}),
    "Im Wald wird ein unbekannter Gegenstand entdeckt.": ("spawn_object", {"location": "forest", "name": "Unbekannter Gegenstand"}),
    "Alex findet eine alte Karte im Haus.": ("spawn_object", {"kind": "map", "known_by": ["alex"], "hidden": True}),
    "Mira erhält eine Einladung zu einem Fest.": ("message", {"recipients": ["mira"], "invite": True}),
    "Ein Fremder zieht in das Dorf.": ("spawn_npc", {"name": "Fremder", "location": "square"}),
    "Im Garten taucht ein verletztes Tier auf.": ("spawn_npc", {"location": "garden"}),
    "Der Strom im Haus fällt aus.": ("change_object", {"kind": "stove", "changes": {"powered": False}}),
    "Beide entdecken eine verschlossene Tür.": ("situation", {"agents": ["alex", "mira"], "object_kind": "door", "object_state": {"locked": True}}),
    "Für die nächsten drei Tage sind die Ressourcen knapp.": ("change_resource", {"duration_minutes": 4320, "factor": 0.3}),
    "Mira erfährt, dass Alex gestern allein am See war.": ("inform", {"recipients": ["mira"]}),
    "Am zentralen Platz findet morgen ein Markt statt.": ("schedule", {"duration_minutes": 480}),
}


@pytest.mark.parametrize("text", list(EXPECTED))
def test_the_rule_parser_recognizes_every_example_sentence(sim, text):
    p = parsed(sim, text)
    assert p is not None, text
    op, fields = EXPECTED[text]
    assert p.ops[0]["op"] == op and all(p.ops[0].get(k) == v for k, v in fields.items()), p.ops


def test_unclear_inputs_are_not_guessed(sim):
    pronoun = parsed(sim, "Er findet etwas.")
    assert pronoun.ops == [] and pronoun.clarify.field == "subject" and [o["value"] for o in pronoun.clarify.options] == ["Alex", "Mira"]
    assert parsed(sim, "Mach irgendwas Spannendes") is None


def test_variants_in_german(sim):
    assert parsed(sim, "Es regnet für zwei Stunden.").ops[0]["duration_minutes"] == 120
    assert parsed(sim, "Ein Sturm zieht auf.").ops[0]["weather"] == "storm"
    assert parsed(sim, "Mira hört, dass Alex den Schlüssel gefunden hat.").ops[0]["op"] == "inform"
    assert parsed(sim, "Holz ist die nächsten zwei Tage reichlich vorhanden.").ops[0] | {} == {"op": "change_resource", "resource": "wood", "location": None, "factor": 1.6, "duration_minutes": 2880}
    assert parsed(sim, "Morgen um 18 Uhr regnet es.").ops[0]["op"] == "schedule"


# --- Ausführung: sichtbare Wirkung in Welt und Wissen --------------------------------------------------------------------
async def test_rain_changes_the_weather_for_everyone(sim):
    _, done = await say(sim, "Heute beginnt es zu regnen.")
    assert done["status"] == "executed" and sim.engine.state.weather()["kind"] == "rain"
    types = [e.type for e in sim.engine.events_since(0, 1000)]
    assert "world.weather_changed" in types and "simulation.event_injected" in types


async def test_an_unknown_object_appears_in_the_forest_for_everyone(sim):
    await say(sim, "Im Wald wird ein unbekannter Gegenstand entdeckt.")
    [o] = objects(sim, "Unbekannter Gegenstand")
    assert o.location_id == "forest" and not o.hidden


async def test_alex_finds_a_map_that_mira_does_not_know(sim):
    p, done = await say(sim, "Alex findet eine alte Karte im Haus.")
    [o] = objects(sim, "Alte Karte")
    assert o.kind == "map" and o.location_id.startswith("house.") and o.hidden and o.known_by == ["alex"]
    st = sim.engine.state
    assert o.visible_to("alex") and not o.visible_to("mira")
    assert any("Alte Karte" in t for t in memories(sim, "alex")) and not any("Alte Karte" in t for t in memories(sim, "mira"))
    assert done["event_seqs"]


async def test_mira_receives_an_invitation_only_after_naming_the_time(sim):
    p = await sim.inject.parse("Mira erhält eine Einladung zu einem Fest.")
    assert p["status"] == "needs_clarification" and "wann" in p["clarification"]["question"] and memories(sim, "mira") == []      # nichts ohne Rückfrage
    p = await sim.inject.parse("", answer_to=p["id"], answer="morgen um 18 Uhr")
    assert p["status"] == "ready"
    done = await sim.engine.db.run(lambda: sim.inject.confirm(p["id"]))
    texts = memories(sim, "mira")
    assert any("Einladung" in t and "Tag 2, 18:00" in t for t in texts) and memories(sim, "alex") == []
    assert any(m.kind == "intention" and m.intention_state == "open" for m in sim.memory.store.list("mira", limit=50)[0])      # eine offene Absicht
    assert done["status"] == "executed"


async def test_a_stranger_moves_in_as_a_simple_visible_figure_without_memory(sim):
    p, done = await say(sim, "Ein Fremder zieht in das Dorf.")
    assert p["status"] == "needs_confirmation" and "ohne eigenes Gedächtnis" in p["preview"][0]       # Nebenfiguren sind offen gekennzeichnet, Vorschau Pflicht
    assert done is None
    done = await sim.engine.db.run(lambda: sim.inject.confirm(p["id"]))
    npc = sim.engine.state.agent("npc_fremder")
    assert npc is not None and npc.location_id == "square"
    assert "npc_fremder" not in sim.store.profile_ids()                                                  # kein Profil, kein Gedächtnis, keine Entscheidungen


async def test_an_injured_animal_appears_in_the_garden(sim):
    p = await sim.inject.parse("Im Garten taucht ein verletztes Tier auf.")
    await sim.engine.db.run(lambda: sim.inject.confirm(p["id"]))
    [npc] = sim.inject.npcs.active()
    assert sim.engine.state.agent(npc["agent_id"]).location_id == "garden" and "Verletztes Tier" in sim.engine.state.agent(npc["agent_id"]).name


async def test_power_cut_stops_the_stove_and_everybody_in_the_house_notices(sim):
    _, done = await say(sim, "Der Strom im Haus fällt aus.")
    assert done["status"] == "executed"
    [stove] = [o for o in sim.engine.state.all_objects() if o.kind == "stove"]
    assert stove.state["powered"] is False
    assert any("Strom" in t for t in memories(sim, "alex")) and any("Strom" in t for t in memories(sim, "mira"))
    from world.conftest import put, stock, reject
    put(sim.engine, "alex", *next(iter([(stove.x + 1, stove.y)])))
    stock(sim.engine, "alex", food=1, wood=1)
    reject(sim.engine, "alex", "use", "forbidden_by_rules", object_id=stove.id, mode="cook")


async def test_both_discover_a_locked_door_and_both_perceive_it(sim):
    _, done = await say(sim, "Beide entdecken eine verschlossene Tür.")
    doors = objects(sim, "Verschlossene Tür")
    assert len(doors) == 1 and doors[0].state["locked"] is True and done["status"] == "executed"
    assert any("verschlossene Tür" in t for t in memories(sim, "alex")) and any("verschlossene Tür" in t for t in memories(sim, "mira"))


async def test_scarcity_for_three_days_applies_now_and_ends_by_itself(sim):
    wood = lambda: sim.engine.state.node("forest_wood").amount                                          # noqa: E731
    before = wood()
    _, done = await say(sim, "Für die nächsten drei Tage sind die Ressourcen knapp.")
    assert wood() == pytest.approx(before * 0.3) and sim.engine.state.node("forest_wood").cap == pytest.approx(12.0)
    sim.engine.advance(2 * 1440)
    for _ in range(2 * 1440 + 5):
        sim.inject.on_tick(sim.engine.minute)
        sim.engine.tick()
        if sim.engine.minute >= 420 + 3 * 1440 + 1:
            break
    assert sim.engine.state.node("forest_wood").cap == pytest.approx(40.0)                              # zurückgenommen, mit Protokolleintrag
    assert any(e.type == "simulation.effect_ended" for e in sim.engine.events_since(0, 100000))


async def test_only_mira_learns_what_happened_at_the_lake(sim):
    _, done = await say(sim, "Mira erfährt, dass Alex gestern allein am See war.")
    assert done["status"] == "executed"
    assert any("allein am See" in t for t in memories(sim, "mira")) and memories(sim, "alex") == []
    from simulacra.memory.retrieval import Situation
    for who, expect in (("mira", True), ("alex", False)):                                              # auch der Abruf findet bei Alex nichts
        rec = sim.memory.retriever.recall(who, Situation(minute=500, location_id="lake", location_name="See", persons=["alex"], person_names=["Alex"]), log=False)
        assert any("allein am See" in s.memory.text for s in rec.items) is expect
    informed = [e for e in sim.engine.events_since(0, 1000) if e.type == "agent.informed"]
    assert [e.agents for e in informed] == [["mira"]] and informed[0].visibility == "agents:mira"      # das Ereignis selbst nennt nur die Empfängerin


async def test_a_market_tomorrow_is_scheduled_appears_then_and_ends(sim):
    p, _ = await say(sim, "Am zentralen Platz findet morgen ein Markt statt.")
    assert p["status"] == "needs_confirmation"
    await sim.engine.db.run(lambda: sim.inject.confirm(p["id"]))
    assert objects(sim, "Marktstand") == [] and len(sim.inject.scheduled()) == 1                      # noch nicht
    at = 1440 + 600
    while sim.engine.minute < at:
        sim.engine.tick()
        sim.inject.on_tick(sim.engine.minute)
    assert len(objects(sim, "Marktstand")) == 2 and all(o.location_id == "square" for o in objects(sim, "Marktstand"))
    while sim.engine.minute < at + 481:
        sim.engine.tick()
        sim.inject.on_tick(sim.engine.minute)
    assert objects(sim, "Marktstand") == [] and sim.inject.scheduled() == []
    fired = [e.data["text"] for e in sim.engine.events_since(0, 100000) if e.type in ("simulation.event_fired", "simulation.effect_ended")]
    assert any("Markt" in t for t in fired)
