"""AP18h-a3: Takt der eigenen Figur – Anhalten, wenn ich dran bin, Autopilot nach der Frist, Antwortfrist in echter Zeit, Schalter-API."""

import json
import time

import pytest
from agents.conftest import make_sim, put

from simulacra.simulation import mitleben
from simulacra.simulation.runner import SimState
from tests.api.conftest import api, post
from tests.player.test_handeln import leben


def put_takt(c, **body):
    r = c.put("/api/player/takt", json=body, headers={"Idempotency-Key": f"k-{time.monotonic_ns()}"})
    assert r.status_code == 200, r.text
    return r.json()


def test_switches_roundtrip_and_snapshot():
    sim = leben(make_sim())
    with api(sim) as c:
        assert c.get("/api/player/takt").json()["hold"] is False
        out = put_takt(c, hold=True, auto=True, auto_minutes=7)
        assert (out["hold"], out["auto"], out["auto_minutes"]) == (True, True, 7)
        snap = c.get("/api/state").json()
        assert (snap["player"], snap["player_hold"], snap["player_auto"], snap["player_auto_minutes"]) == ("alex", True, True, 7)
        types = [e["type"] for e in c.get("/api/events?limit=50").json()["items"]]
        assert "simulation.player_takt" in types
        assert c.put("/api/player/takt", json={"auto_minutes": 0}, headers={"Idempotency-Key": "abcdefgh1"}).status_code == 422


def test_takt_needs_a_figure():
    sim = make_sim()
    sim.store.ensure_all()
    with api(sim) as c:
        assert c.put("/api/player/takt", json={"hold": True}, headers={"Idempotency-Key": "abcdefgh2"}).status_code == 409


async def test_autopilot_after_timeout_and_input_switches_back():
    sim = leben(make_sim())
    st = sim.engine.state
    mitleben.settings(st)
    st.set_meta(mitleben.AUTO_KEY, True)
    st.set_meta(mitleben.AUTO_MIN_KEY, 1)
    assert "alex" not in sim.store.thinking_ids()
    sim.runner.takt.last_input = time.monotonic() - 61               # eine Minute ohne Eingabe
    await sim.runner.step()
    assert mitleben.autopilot_on(st) and "alex" in sim.store.thinking_ids()
    with api(sim) as c:
        assert post(c, "/api/player/takeover", None).status_code == 200
        assert not mitleben.autopilot_on(st) and "alex" not in sim.store.thinking_ids()


async def test_hold_pauses_when_addressed_and_say_resumes():
    sim = leben(make_sim())
    put(sim, "alex", 20, 13)
    put(sim, "mira", 21, 13)
    sim.engine.state.set_meta(mitleben.HOLD_KEY, True)
    with api(sim) as c:
        await sim.runner.start()
        for _ in range(400):                                          # Mira entscheidet selbst; irgendwann spricht sie Alex an oder beendet etwas, das ihn betrifft
            await __import__("asyncio").sleep(0.02)
            if sim.runner.state == SimState.PAUSED:
                break
        assert sim.runner.state == SimState.PAUSED and sim.runner.takt.waiting
        assert mitleben.waiting_on(sim.engine.state)
        r = post(c, "/api/player/act", {"action": "wait", "params": {}})
        assert r.status_code == 200
        assert sim.runner.state == SimState.RUNNING and not sim.runner.takt.waiting
        await sim.runner.stop()


def test_reply_deadline_is_real_time(monkeypatch):
    sim = leben(make_sim())
    st = sim.engine.state
    c = type("C", (), {"id": 1, "participants": ["alex", "mira"], "last_minute": 5})()
    t = sim.runner.takt
    assert t.protects(c, st) is True                                  # frisch gesprochen: noch Zeit
    monkeypatch.setattr(mitleben, "REPLY_SECONDS", 0)
    assert t.protects(c, st) is False                                 # Frist um
    c.participants = ["mira", "kim"]
    assert t.protects(c, st) is False                                 # ohne den Menschen gilt die Stille wie immer


def test_no_hint_words_in_events_for_agents():
    sim = leben(make_sim())
    with api(sim) as c:
        put_takt(c, hold=True)
        rows = sim.engine.state.conn.execute("SELECT agents FROM events WHERE type='simulation.player_takt'").fetchall()
        assert rows and all(json.loads(r["agents"]) == [] for r in rows)   # Systemereignis ohne Agenten: nie in einem Prompt


def test_change_figure_needs_confirm_and_leben():
    sim = leben(make_sim())
    with api(sim) as c:
        h = {"Idempotency-Key": "figure-1234"}
        assert c.put("/api/player/figure", json={"agent": "mira"}, headers=h).status_code == 400
        assert c.put("/api/player/figure", json={"agent": "niemand", "confirm": True}, headers={"Idempotency-Key": "figure-2345"}).status_code == 404
        r = c.put("/api/player/figure", json={"agent": "mira", "confirm": True}, headers={"Idempotency-Key": "figure-3456"})
        assert r.status_code == 200 and r.json()["player"] == "mira"
        assert "alex" in sim.store.thinking_ids() and "mira" not in sim.store.thinking_ids()      # die alte Figur ist ein normaler Bewohner
        from simulacra.world import spielart
        spielart.set_mode(sim.engine.state, "gott")
        assert c.put("/api/player/figure", json={"agent": "alex", "confirm": True}, headers={"Idempotency-Key": "figure-4567"}).status_code == 409
