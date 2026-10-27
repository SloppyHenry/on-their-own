import pytest

from on_their_own.world import clock, weather

from .conftest import ok, reject, types


def test_1440_ticks_are_one_day(eng):
    t0 = eng.minute
    events = eng.advance(1440)
    assert eng.minute - t0 == 1440
    assert clock.day_of(eng.minute) == clock.day_of(t0) + 1
    assert types(events).count("world.day_started") == 1


def test_clock_snapshot_and_calendar():
    m = clock.at(3, 14, 30)
    s = clock.snapshot(m)
    assert (s["day"], s["time"], s["weekday"]) == (3, "14:30", "Mittwoch")
    assert clock.weekday(clock.at(8, 0)) == "Montag"


def test_daylight_curve():
    assert clock.daylight(clock.at(1, 2)) == 0
    assert clock.daylight(clock.at(1, 12)) == 1
    morning = [clock.daylight(clock.at(1, 5, m)) for m in range(0, 121, 10)]
    assert morning == sorted(morning) and 0 < morning[6] < 1
    evening = [clock.daylight(clock.at(1, 19, m)) for m in range(0, 121, 10)]
    assert evening == sorted(evening, reverse=True)
    assert [clock.phase(clock.at(1, h)) for h in (2, 6, 12, 20)] == ["night", "dawn", "day", "dusk"]


def test_phase_events_over_a_day(eng):
    phases = [e.data["phase"] for e in eng.advance(1440) if e.type == "world.phase_changed"]
    assert phases == ["dusk", "night", "dawn", "day"]  # Start 07:00 am Tag


def test_natural_weather_changes_deterministically(eng):
    ev = [e for e in eng.advance(3000) if e.type == "world.weather_changed"]
    assert ev and all(e.data["cause"] == "nature" for e in ev)
    kinds1 = [e.data["to"] for e in ev]
    from on_their_own.db.connection import Database
    from on_their_own.world.engine import WorldEngine
    eng2 = WorldEngine.create(Database(":memory:"))
    kinds2 = [e.data["to"] for e in eng2.advance(3000) if e.type == "world.weather_changed"]
    assert kinds1 == kinds2


def test_weather_duration_and_event_data(eng):
    eng.set_weather("rain", 90)
    w = eng.state.weather()
    assert w["kind"] == "rain" and w["until"] - w["since"] == 90
    events = eng.advance(90)
    ch = [e for e in events if e.type == "world.weather_changed"]
    assert ch and ch[0].data["from"] == "rain" and ch[0].data["cause"] == "nature"


def test_unknown_weather_rejected(eng):
    import pytest
    with pytest.raises(ValueError):
        eng.set_weather("meteoritenhagel", 10)


def test_every_weather_has_effects_defined():
    for k in weather.KINDS:
        assert k in weather.MOVE_MULT and k in weather._NEXT


async def test_committed_minute_is_readable_from_other_threads_while_ticking(tmp_path):
    """`committed_minute` braucht keine Datenbankverbindung: der Test-Thread liest, während der DB-Thread tickt."""
    import threading
    from on_their_own.db.connection import Database
    from on_their_own.world.engine import WorldEngine
    eng = WorldEngine.create(Database(tmp_path / "t.db"))
    start, seen, failures, stop = eng.committed_minute, [], [], threading.Event()

    def watch():
        while not stop.is_set():
            try:
                seen.append(eng.committed_minute)
            except Exception as exc:                                  # noqa: BLE001
                failures.append(exc)
    t = threading.Thread(target=watch)
    t.start()
    for _ in range(200):
        await eng.tick_async()
    stop.set()
    t.join()
    assert not failures and seen == sorted(seen) and eng.committed_minute == start + 200 == eng.minute
    eng.db.close()


def test_committed_minute_ignores_rolled_back_ticks(eng):
    before = eng.committed_minute
    with pytest.raises(RuntimeError):
        with eng.db.transaction():
            eng.state.set_minute(before + 5)
            assert eng.minute == before + 5 and eng.committed_minute == before    # uncommittet nur auf dem DB-Thread sichtbar
            raise RuntimeError("abbrechen")
    assert eng.committed_minute == before == eng.minute
    eng.tick()
    assert eng.committed_minute == before + 1
