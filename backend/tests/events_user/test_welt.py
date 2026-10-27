"""Ereignisse von allein (AP18i): Häufigkeit, deterministischer Takt, Bedingungen, Abstand, Ausführung über die Operationen der Ereigniseingabe, kein Urheber im Wissen der Bewohner."""

import json

import pytest
from agents.conftest import make_sim

from on_their_own.agents.schema import META_RE
from on_their_own.events_user.welt import CATALOG, FREQUENCIES, Weltereignisse
from on_their_own.world import loader
from tests.conftest import START_WORLD

DAY = 1440


@pytest.fixture
def sim(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    s = make_sim()
    s.store.ensure_all()
    yield s
    s.close()


def scan(sim, frequency, days=20, weather=None, phase_minutes=None):
    """Alle Zeitpunkte, an denen `due` etwas liefert, bei gleichbleibendem Wetter (so hängt die Zählung nur vom Takt ab)."""
    w = sim.inject.welt
    w.frequency = frequency
    if weather:
        sim.engine.state.set_weather(weather, 0, 10**9)
    return [(m, e["id"]) for m in range(0, days * DAY, 60) if (e := w.due(m)) is not None]


def test_frequency_decides_whether_anything_happens(sim):
    assert sim.inject.welt.frequency == "manchmal" and sim.params.get("world.events") == "manchmal"
    aus, selten, manchmal, oft = (len(scan(sim, f, weather="clear")) for f in ("aus", "selten", "manchmal", "oft"))
    assert aus == 0 and oft > manchmal > selten > 0
    assert FREQUENCIES["aus"] == 0 and set(FREQUENCIES) == {"aus", "selten", "manchmal", "oft"}


def test_same_seed_same_events_and_other_seed_differs(sim):
    a = scan(sim, "oft")
    assert a and a == scan(sim, "oft")
    sim.engine.state.set_meta("seed", 99999)
    assert scan(sim, "oft") != a


def test_conditions_are_respected(sim):
    cat = {e["id"]: e for e in json.loads(CATALOG.read_text(encoding="utf-8"))["ereignisse"]}
    from on_their_own.world import clock
    for weather in ("clear", "storm", "rain", "fog"):
        for minute, eid in scan(sim, "oft", days=12, weather=weather):
            cond = cat[eid].get("wenn", {})
            assert weather in cond.get("wetter", [weather]) and clock.phase(minute) in cond.get("phase", [clock.phase(minute)]), (eid, weather, minute)
    assert not [1 for _, eid in scan(sim, "oft", days=12, weather="storm") if eid in ("gewitter", "reiche_ernte", "nachtfrost")]       # bei Sturm weder noch ein Gewitter noch Sonnenernte


def test_minimum_distance_between_the_same_event(sim):
    w = sim.inject.welt
    w.frequency = "oft"
    sim.engine.state.set_weather("cloudy", 0, 10**9)
    first = next((m, e) for m in range(0, 20 * DAY, 60) if (e := w.due(m)) is not None and e["id"] == "gewitter")
    sim.engine.state.set_meta("weltereignisse", {"gewitter": first[0]})
    again = [m for m in range(first[0], first[0] + 3 * DAY, 60) if (e := w.due(m)) is not None and e["id"] == "gewitter"]
    assert again == []


def fire(sim, eid, minute=12 * 60):
    """Lässt genau dieses Ereignis jetzt geschehen (über denselben Weg wie der Takt) und gibt die Ereignisse zurück."""
    w = sim.inject.welt
    cat = next(e for e in w.catalog if e["id"] == eid)
    w.due = lambda m: cat                                                          # der Takt hat es ausgewählt; Ausführung und Wissensverteilung sind das Echte
    sim.engine.state.conn.execute("UPDATE clock SET minute=?", (minute,))
    return w.tick(minute)


def test_event_runs_through_the_injection_operations_and_agents_learn_of_it(sim):
    sim.planner.mode.mode = "creator"                                              # auch im Schöpfer-Modus nennt kein Wissen einen Urheber
    events = fire(sim, "gewitter")
    types = [e.type for e in events]
    assert types[0] == "world.nature_event" and "world.weather_changed" in types and types.count("agent.informed") == len(sim.store.profile_ids())
    assert sim.engine.state.weather()["kind"] == "storm"
    for e in events:
        if e.type == "agent.informed":
            assert e.data["kind"] == "situation" and not e.data["sender"] and not META_RE.findall(e.data["content"]) and "Schöpfer" not in e.data["content"]
        if e.type == "world.nature_event":
            assert e.agents == [] and e.data["id"] == "gewitter"
    assert sim.engine.state.get_meta("weltereignisse")["gewitter"] == 12 * 60


def test_the_witnesses_remember_it_like_the_weather(sim):
    fire(sim, "fuchs", minute=5 * 60)
    # die Erinnerung entsteht im Lauf über die normale Beobachtungskette (agent.informed); hier genügt die Zustellung an genau die Zeugen
    informed = sim.engine.state.conn.execute("SELECT agents, data FROM events WHERE type='agent.informed'").fetchall()
    assert len(informed) == len(sim.store.profile_ids()) and all("Fuchs" in json.loads(r["data"])["content"] for r in informed)


def test_nobody_outside_means_nothing_happens(sim):
    st = sim.engine.state
    for a in st.agents():
        a.location_id = "house.kitchen"
        st.save_agent(a)
    assert fire(sim, "sternschnuppen", minute=23 * 60) == []                        # ohne Zeugen geschieht es nicht
    assert st.get_meta("weltereignisse") in (None, {})


def test_missing_places_exclude_events(sim):
    st = sim.engine.state
    w = sim.inject.welt
    w.frequency = "oft"
    st.set_weather("rain", 0, 10**9)
    ids = {eid for _, eid in scan(sim, "oft", days=15, weather="rain")}
    assert "pilze" in ids
    for loc in [l for l in st.locations.values() if l.id.startswith("forest")]:
        st.locations.pop(loc.id)
    assert "pilze" not in {eid for _, eid in scan(sim, "oft", days=15, weather="rain")}
    assert isinstance(Weltereignisse(sim).catalog, list)
