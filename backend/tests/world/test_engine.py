import subprocess
import sys
from pathlib import Path

import pytest

from simulacra.db.connection import Database
from simulacra.world import actions
from simulacra.world.actions.base import Action
from simulacra.world.engine import WorldEngine
from simulacra.world.models import Accepted
from simulacra.world.rules import WorldRules

from .conftest import ok, put, reject, run, stock, types


def test_two_agents_exist_and_act_in_one_world(eng):
    ids = [a.id for a in eng.state.agents()]
    assert ids == ["alex", "mira"]
    assert eng.propose("alex", "move_to", {"target": "lake"}).ok
    assert eng.propose("mira", "move_to", {"target": "forest"}).ok
    for _ in range(200):
        eng.tick()
    assert eng.state.agent("alex").location_id == "lake" and eng.state.agent("mira").location_id == "forest"


def test_inventories_are_separate(eng):
    stock(eng, "alex", wood=3)
    assert eng.state.agent("mira").inventory == {}


def test_events_have_unique_increasing_ids_and_full_schema(eng):
    ok(eng, "alex", "move_to", target="garden")
    events = eng.events_since(0)
    seqs = [e.seq for e in events]
    assert seqs == sorted(set(seqs)) and len(seqs) > 5
    e = events[0]
    assert e.type and e.ts and isinstance(e.sim_minute, int) and isinstance(e.agents, list) and isinstance(e.data, dict)


def test_rejections_are_logged_with_code_and_text(eng):
    reject(eng, "alex", "gather", "not_here", resource="wood")
    hist = eng.action_history("alex")
    assert hist[0]["outcome"] == "rejected" and hist[0]["code"] == "not_here" and hist[0]["text"]
    assert "agent.action_rejected" in types(eng.events_since(0))


def test_completed_and_failed_actions_are_logged(eng):
    ok(eng, "alex", "wait", minutes=3)
    outcomes = [h["outcome"] for h in eng.action_history("alex")]
    assert outcomes[:2] == ["completed", "accepted"]


def test_failure_penalty_modes(eng):
    eng.set_rules(WorldRules(failure_penalty="none"))
    assert not eng.propose("alex", "teleport").ok
    assert eng.state.agent("alex").action is None                       # keine Folge
    eng.set_rules(WorldRules(failure_penalty="time", failure_penalty_minutes=5))
    assert not eng.propose("alex", "teleport").ok
    a = eng.state.agent("alex")
    assert a.action.type == "recover" and a.action.ends_at == eng.minute + 5
    eng.advance(5)
    assert eng.state.agent("alex").action is None
    eng.set_rules(WorldRules(failure_penalty="energy"))
    before = eng.state.agent("alex").needs["energy"]
    assert not eng.propose("alex", "teleport").ok
    assert eng.state.agent("alex").needs["energy"] == before - 2


def test_busy_rejection_has_no_extra_penalty(eng):
    assert eng.propose("alex", "wait", {"minutes": 30}).ok
    res = eng.propose("alex", "wait", {"minutes": 5})
    assert res.rejected.code.value == "busy" and eng.state.agent("alex").action.type == "wait"


def test_interrupt_frees_agent(eng):
    assert eng.propose("alex", "move_to", {"target": "lake"}).ok
    eng.advance(5)
    ev = eng.interrupt("alex", "dringendes Ereignis")
    assert ev[0].type == "agent.action_interrupted" and ev[0].data["reason"] == "dringendes Ereignis"
    assert eng.state.agent("alex").action is None
    assert eng.interrupt("alex") == []                                      # nichts mehr zu unterbrechen


def test_set_rules_emits_event_and_persists(eng):
    ev = eng.set_rules(WorldRules(resource_scarcity=0.5))
    assert ev[0].type == "simulation.parameter_changed"
    assert eng.state.rules.resource_scarcity == 0.5
    with pytest.raises(Exception):
        WorldRules(resource_scarcity=99)                                    # Grenzen werden erzwungen


# --- Atomarität (§17 Nr. 15) -----------------------------------------------------------------

class Exploding(Action):
    name = "explode"

    def validate(self, ctx, actor, params):
        return Accepted(duration=1)

    def finish(self, ctx, actor, act):
        ctx.inv_add(actor, "wood", 5)                  # Änderung ...
        ctx.state.set_node_amount("woodpile", 0)
        ctx.emit("agent.rested", [actor.id], data={"energy": 1.0})
        raise RuntimeError("Fehler mitten in der Ausführung")   # ... dann Absturz


def snapshot_state(eng):
    return eng.state.snapshot(), eng.state.conn.execute("SELECT COUNT(*) c FROM events").fetchone()["c"]


def test_exception_inside_action_leaves_no_partial_change(eng, monkeypatch):
    monkeypatch.setitem(actions.REGISTRY, "explode", Exploding())
    assert eng.propose("alex", "explode").ok
    before = snapshot_state(eng)
    with pytest.raises(RuntimeError):
        eng.tick()
    assert snapshot_state(eng) == before            # Uhr, Inventar, Quelle, Ereignisse: alles wie vorher
    assert eng.state.node("woodpile").amount == 6 and not eng.state.agent("alex").inventory
    assert eng.minute == before[0]["clock"]


def test_rollback_restores_caches(eng):
    put(eng, "alex", 20, 15)

    class LockThenFail(Exploding):
        name = "lockfail"

        def validate(self, ctx, actor, params):
            d = ctx.state.obj("door_front")
            d.state["locked"] = True
            ctx.state.save_object(d)
            assert (20, 16) in ctx.state.grid.blocked
            raise RuntimeError("nach Sperre")

    actions.REGISTRY["lockfail"] = LockThenFail()
    try:
        with pytest.raises(RuntimeError):
            eng.propose("alex", "lockfail")
    finally:
        del actions.REGISTRY["lockfail"]
    assert (20, 16) not in eng.state.grid.blocked and not eng.state.obj("door_front").state["locked"]


def test_invalid_model_like_input_never_changes_world(eng):
    """Unsinnige Vorschläge (wie von einem fehlerhaften Modell) werden abgelehnt, die Welt bleibt gleich."""
    before = eng.state.snapshot()
    junk = [("alex", "move_to", {"target": {"a": 1}}), ("alex", "take", {"object_id": ["x"]}), ("alex", "gather", {"resource": None}),
            ("alex", "build", {"blueprint": 5}), ("alex", "speak", {"to": 7, "text": []}), ("alex", "use", {}),
            ("alex", "give", {"to": "mira", "amount": -3, "resource": "wood"}), ("alex", "sleep", {"minutes": "lang"}),
            ("alex", "", {}), ("niemand", "wait", {})]
    for actor, action, params in junk:
        res = eng.propose(actor, action, params)
        assert not res.ok, (action, params)
        eng.advance(2)
    after = eng.state.snapshot()
    assert before["objects"] == after["objects"] and before["resources"] == after["resources"]
    assert [a["inventory"] for a in before["agents"]] == [a["inventory"] for a in after["agents"]]


# --- Neustart ---------------------------------------------------------------------------------

def test_state_survives_restart(tmp_path):
    path = tmp_path / "live.db"
    eng = WorldEngine.create(Database(path))
    ok(eng, "alex", "move_to", target="seed_box")
    ok(eng, "alex", "gather", resource="seeds", amount=2)
    ok(eng, "alex", "move_to", target="seedbed_1")
    ok(eng, "alex", "plant", seedbed_id="seedbed_1")
    eng.set_rules(WorldRules(resource_scarcity=0.7, movement_blocked_locations=["forest"]))
    eng.set_weather("rain", 300)
    assert eng.propose("mira", "move_to", {"target": "lake"}).ok
    eng.advance(10)
    snap = eng.state.snapshot()
    last_seq = eng.events_since(0)[-1].seq
    eng.db.close()

    eng2 = WorldEngine(Database(path))
    assert eng2.state.snapshot() == snap
    assert eng2.state.agent("mira").action.type == "move_to"              # laufende Aktion überlebt
    assert eng2.state.rules.movement_blocked_locations == ["forest"]
    assert (30, 20) not in eng2.state.grid.forbidden and any(eng2.state.location_at(*t) == "forest" for t in eng2.state.grid.forbidden)
    eng2.advance(100)
    assert eng2.state.agent("mira").location_id == "lake"
    assert eng2.events_since(0)[-1].seq > last_seq


def test_create_does_not_overwrite_existing_world(tmp_path):
    path = tmp_path / "live.db"
    eng = WorldEngine.create(Database(path))
    ok(eng, "alex", "wait", minutes=5)
    minute = eng.minute
    eng.db.close()
    eng2 = WorldEngine.create(Database(path))                              # lädt statt neu anzulegen
    assert eng2.minute == minute
    from simulacra.world.loader import seed_world
    with pytest.raises(RuntimeError):
        seed_world(eng2.db)


# --- Unabhängigkeit vom LLM ----------------------------------------------------------------------

def test_world_package_does_not_import_llm_or_network_code():
    code = ("import sys, simulacra.world.engine, simulacra.cli\n"
            "bad = [m for m in sys.modules if m.split('.')[0] in ('httpx','fastapi','requests','openai') or 'llm' in m]\n"
            "print(bad); sys.exit(1 if bad else 0)")
    root = Path(__file__).resolve().parents[2]
    r = subprocess.run([sys.executable, "-c", code], cwd=root, capture_output=True, text=True,
                       env={"PYTHONPATH": str(root)})
    assert r.returncode == 0, r.stdout + r.stderr


# --- Speak ------------------------------------------------------------------------------------------

def test_speak_requires_hearing_range(eng):
    put(eng, "alex", 20, 13)
    put(eng, "mira", 21, 13)
    ev = ok(eng, "alex", "speak", to="mira", text="Guten Morgen, Mira!")
    d = [e for e in ev if e.type == "agent.dialogue"][0]
    assert d.data == {"speaker": "alex", "to": "mira", "text": "Guten Morgen, Mira!"} and set(d.agents) == {"alex", "mira"}
    put(eng, "mira", 33, 25)
    reject(eng, "alex", "speak", "not_here", to="mira", text="Hallo?")
    put(eng, "mira", 24, 12)
    reject(eng, "alex", "speak", "invalid_target", to="mira", text="  ")
    reject(eng, "alex", "speak", "invalid_target", to="mira", text="x" * 501)
    reject(eng, "alex", "speak", "invalid_target", to="alex", text="Selbstgespräch")


def test_speak_within_four_tiles_across_locations(eng):
    put(eng, "alex", 14, 12)       # Küche
    put(eng, "mira", 16, 12)       # Wohnzimmer, 2 Kacheln entfernt
    assert eng.state.agent("alex").location_id != eng.state.agent("mira").location_id
    ok(eng, "alex", "speak", to="mira", text="Hörst du mich durch die Wand?")


def test_two_agents_both_can_use_different_things_simultaneously(eng):
    put(eng, "alex", 24, 6)
    put(eng, "mira", 25, 9)
    assert eng.propose("alex", "gather", {"resource": "wood", "amount": 2}).ok
    assert eng.propose("mira", "gather", {"resource": "seeds", "amount": 2}).ok
    eng.advance(10)
    assert eng.state.agent("alex").inventory == {"wood": 2} and eng.state.agent("mira").inventory == {"seeds": 2}


async def test_async_wrappers_run_on_the_single_writer_thread(tmp_path):
    import asyncio
    eng = WorldEngine.create(Database(tmp_path / "live.db"))
    results = await asyncio.gather(eng.propose_async("alex", "move_to", {"target": "garden"}),
                                   eng.propose_async("mira", "move_to", {"target": "square"}))
    assert all(r.ok for r in results)
    await asyncio.gather(*(eng.tick_async() for _ in range(60)))
    assert eng.minute == 420 + 60
    seqs = [e.seq for e in eng.events_since(0, 100000)]
    assert seqs == sorted(set(seqs))                                  # keine doppelten oder verdrehten IDs
    reader = eng.db.reader()                                          # paralleles Lesen im WAL-Modus
    assert reader.execute("SELECT minute FROM clock").fetchone()[0] == 480
