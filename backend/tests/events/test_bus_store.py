import asyncio
import re
import threading

import pytest

from on_their_own.db.connection import Database
from on_their_own.events import types as et
from on_their_own.events.bus import OVERFLOW, EventBus
from on_their_own.events.schema import to_out
from on_their_own.events.store import EventStore
from on_their_own.events.ulid import new_event_id
from on_their_own.world.engine import WorldEngine
from on_their_own.world.models import Event


@pytest.fixture
def eng():
    return WorldEngine.create(Database(":memory:"))


def collect(eng):
    got: list[Event] = []
    eng.bus.listeners.append(got.extend)
    return got


# --- Verteilung erst nach dem Commit -------------------------------------------------------------------------

def test_events_reach_listeners_after_commit_and_match_storage(eng):
    got = collect(eng)
    eng.propose("alex", "wait", {"minutes": 2})
    eng.advance(2)
    stored = EventStore(eng.state.conn).fetch(limit=1000)
    assert [e.seq for e in got] == [e.seq for e in stored] and len(got) == 2


def test_nothing_is_published_while_the_transaction_is_open(eng):
    got, seen_inside = collect(eng), []
    with eng.db.transaction():
        eng.propose("alex", "wait", {"minutes": 2})
        seen_inside.append(len(got))                        # noch nichts verteilt: äußere Transaktion läuft
        eng.set_weather("rain", 60)
        seen_inside.append(len(got))
    assert seen_inside == [0, 0] and len(got) == 2          # erst nach dem Commit, in Reihenfolge
    assert [e.seq for e in got] == sorted(e.seq for e in got)


def test_rolled_back_operation_is_neither_stored_nor_published(eng):
    got = collect(eng)
    before = EventStore(eng.state.conn).last_seq()

    class Boom(Exception):
        pass

    with pytest.raises(Boom):
        with eng.db.transaction():
            eng.propose("alex", "wait", {"minutes": 2})
            raise Boom
    assert got == [] and EventStore(eng.state.conn).last_seq() == before


def test_failing_engine_operation_publishes_nothing(eng, monkeypatch):
    got = collect(eng)
    monkeypatch.setattr(eng.state, "save_agent", lambda a: (_ for _ in ()).throw(RuntimeError("kaputt")))
    with pytest.raises(RuntimeError):
        eng.propose("alex", "wait", {"minutes": 2})
    assert got == [] and EventStore(eng.state.conn).last_seq() == 0


# --- Reihenfolge und Lückenlosigkeit --------------------------------------------------------------------------------

def test_seq_is_gapless_and_ids_are_unique_ulids(eng):
    eng.propose("alex", "move_to", {"target": "lake"})
    eng.propose("mira", "move_to", {"target": "garden"})
    eng.advance(120)
    rows = EventStore(eng.state.conn).fetch(limit=5000)
    assert [e.seq for e in rows] == list(range(1, len(rows) + 1))
    ids = [e.event_id for e in rows]
    assert len(set(ids)) == len(ids) and all(re.fullmatch(r"evt_[0-9A-HJKMNP-TV-Z]{26}", i) for i in ids)


def test_concurrent_writers_keep_seq_gapless_and_published_in_order(tmp_path):
    eng = WorldEngine.create(Database(tmp_path / "w.db"))
    got = collect(eng)

    def worker(n):
        for i in range(25):
            eng.set_weather("rain" if i % 2 else "clear", 30 + n)

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    stored = [e.seq for e in EventStore(eng.state.conn).fetch(limit=5000)]
    assert stored == list(range(1, 101)) and [e.seq for e in got] == stored


async def test_async_subscription_gets_batches_and_resets_after_overflow(eng):
    sub = eng.bus.subscribe(max_backlog=6)
    eng.set_weather("rain", 30)                                  # 1 Ereignis
    first = await asyncio.wait_for(sub.get(), 1)
    assert [e.type for e in first] == ["world.weather_changed"]
    for _ in range(8):
        eng.set_weather("clear", 30)
    await asyncio.sleep(0.05)
    assert sub.overflowed and (await asyncio.wait_for(sub.get(), 1)) is OVERFLOW
    eng.set_weather("rain", 30)
    await asyncio.sleep(0.05)
    assert sub._queue.empty()                                    # läuft über: nimmt nichts mehr an, bis zurückgesetzt
    sub.reset()
    eng.set_weather("clear", 30)
    assert len(await asyncio.wait_for(sub.get(), 1)) == 1
    sub.close()
    eng.set_weather("rain", 30)                                  # nach dem Schließen kein Zustellversuch mehr
    await asyncio.sleep(0.02)


async def test_subscription_from_other_thread_publish(eng):
    sub = eng.bus.subscribe()
    await asyncio.get_running_loop().run_in_executor(None, lambda: eng.set_weather("rain", 30))
    batch = await asyncio.wait_for(sub.get(), 1)
    assert batch[0].category == "world"


# --- Registry --------------------------------------------------------------------------------------------------------------

def test_every_type_has_model_category_and_description():
    assert len(et.REGISTRY) >= 50
    for name, t in et.REGISTRY.items():
        assert t.category in et.CATEGORIES and t.description and re.fullmatch(r"(agent|world|simulation)\.[a-z_]+", name), name
        assert hasattr(t.model, "model_json_schema")
    assert {t.name for t in et.REGISTRY.values() if t.planned} == set()          # seit AP08 ist nichts mehr nur vorgesehen


def test_strict_mode_rejects_unknown_types_and_fields(eng):
    assert et.STRICT
    with pytest.raises(ValueError):
        eng.emit_event("agent.erfunden")
    with pytest.raises(Exception):
        eng.emit_event("agent.rested", ["alex"], data={"energy": 1.0, "zusatz": 1})
    assert EventStore(eng.state.conn).last_seq() == 0              # beides wurde zurückgerollt


def test_category_and_visibility_rules():
    assert et.category_of("agent.dialogue") == "dialogue" and et.category_of("agent.decision") == "planning" and et.category_of("simulation.paused") == "system"
    assert et.visibility_of("agent.walking", ["alex"]) == "public"
    assert et.visibility_of("agent.dialogue", ["mira", "alex"]) == "agents:alex,mira"
    assert et.visibility_of("agent.decision", ["alex"]) == "agents:alex"
    assert et.visibility_of("simulation.started", []) == "system"


def test_events_carry_category_and_visibility_in_the_database(eng):
    eng.set_weather("rain", 30)
    eng.emit_event("agent.rested", ["alex"], data={"energy": 5.0})
    rows = eng.state.conn.execute("SELECT type, category, visibility FROM events ORDER BY seq").fetchall()
    assert [tuple(r) for r in rows] == [("world.weather_changed", "world", "public"), ("agent.rested", "world", "public")]


# --- Speicher ------------------------------------------------------------------------------------------------------------------

def make_history(eng):
    eng.propose("alex", "move_to", {"target": "kitchen_tap"})
    eng.propose("mira", "wait", {"minutes": 3})
    eng.set_weather("rain", 90)
    eng.advance(40)


def test_fetch_filters(eng):
    make_history(eng)
    s = EventStore(eng.state.conn)
    allv = s.fetch(limit=5000)
    assert s.fetch(type="agent.walking") and all(e.type == "agent.walking" for e in s.fetch(type="agent.walking"))
    assert {e.type for e in s.fetch(type_prefix="world.")} <= {t for t in et.REGISTRY if t.startswith("world.")}
    assert all("alex" in e.agents for e in s.fetch(agent="alex")) and s.fetch(agent="alex")
    assert {e.category for e in s.fetch(category="system")} <= {"system"}
    assert all(e.location_id == "house.kitchen" for e in s.fetch(location="house.kitchen"))
    assert [e.seq for e in s.fetch(after_seq=allv[2].seq, limit=3)] == [allv[3].seq, allv[4].seq, allv[5].seq]
    assert [e.seq for e in s.fetch(before_seq=allv[5].seq, order="desc", limit=2)] == [allv[4].seq, allv[3].seq]
    assert s.fetch(type_prefix="a%") == [] and s.fetch(type="agent.moved'; DROP TABLE events;--") == []     # Sonderzeichen sind harmlos
    assert len(s.fetch(limit=5)) == 5


def test_causal_chain_decision_to_action_to_effects(eng):
    ev = eng.emit_event("agent.rested", ["alex"], data={"energy": 1.0})
    res = eng.propose("alex", "wait", {"minutes": 1}, parent_seq=ev.seq)
    started = next(e for e in res.events if e.type == "agent.action_started")
    assert started.parent_seq == ev.seq and started.caused_by == ev.event_id
    eng.advance(1)
    done = next(e for e in EventStore(eng.state.conn).fetch(type="agent.action_completed"))
    assert done.parent_seq == started.seq and done.caused_by == started.event_id
    s = EventStore(eng.state.conn)
    assert [e.seq for e in s.chain(done.seq)] == [ev.seq, started.seq]
    assert [e.seq for e in s.children(ev.seq)] == [started.seq]
    assert s.get(done.event_id).seq == done.seq and s.get(str(done.seq)).event_id == done.event_id and s.get("evt_gibtesnicht") is None


def test_movement_effects_point_back_to_their_action(eng):
    res = eng.propose("alex", "move_to", {"target": "kitchen_tap"})
    started = res.events[0]
    eng.advance(30)
    effects = EventStore(eng.state.conn).fetch(type_prefix="agent.", after_seq=started.seq)
    walk = [e for e in effects if e.type in ("agent.walking", "agent.location_changed", "agent.arrived")]
    assert {e.type for e in walk} >= {"agent.walking", "agent.arrived"} and all(e.parent_seq == started.seq for e in walk)


def test_hourly_world_time_event(eng):
    eng.advance(125)
    times = EventStore(eng.state.conn).fetch(type="world.time")
    assert [e.data["time"] for e in times] == ["08:00", "09:00"] and times[0].category == "system"


def test_to_out_has_the_documented_shape(eng):
    eng.propose("alex", "wait", {"minutes": 1})
    out = to_out(EventStore(eng.state.conn).fetch()[0]).model_dump()
    assert set(out) == {"id", "seq", "ts", "sim_time", "type", "category", "agents", "location", "data", "caused_by", "visibility"}
    assert out["sim_time"] == {"day": 1, "minute": 420, "total": 420} and out["id"].startswith("evt_")
    assert new_event_id() != new_event_id()
