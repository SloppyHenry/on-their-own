"""Parameter-API: Schema, Änderungen mit Idempotenz, Ablehnung, Persistenz, Zurücksetzen und Systemstatus."""

import uuid

from api.conftest import api, post

from on_their_own.config import Settings
from on_their_own.simulation.builder import Simulation


def patch(c, changes, key=None):
    return c.patch("/api/params", json={"changes": changes}, headers={"Idempotency-Key": key or str(uuid.uuid4())})


def test_schema_describes_every_parameter_for_the_ui():
    with api() as c:
        s = c.get("/api/params/schema").json()
        keys = {p["key"] for p in s["specs"]}
        assert {"exploration", "memory.reflection_threshold", "world.scarcity", "llm.temperature", "sim.speed", "mode"} <= keys
        assert {g["id"] for g in s["groups"]} >= {"autonomy", "personality", "memory", "world", "llm", "sim", "mode"}
        p = next(p for p in s["specs"] if p["key"] == "world.scarcity")
        assert (p["min"], p["max"], p["step"], p["effect"]) == (0, 100, 1, "immediate") and p["label"] and p["help"]
        assert next(p for p in s["specs"] if p["key"] == "llm.model")["locked"]


def test_values_come_from_the_consumers_and_changes_report_a_status_each():
    with api() as c:
        v = c.get("/api/params").json()
        assert v["agents"] == ["alex", "mira"] and v["values"]["world.scarcity"] == 0 and v["changed"] == []
        assert v["values"]["personality.curiosity"] == {"alex": 70, "mira": 55}
        r = patch(c, [{"key": "world.scarcity", "value": 40}, {"key": "memory.reflection_threshold", "value": 120}, {"key": "personality.curiosity", "value": 20, "agent": "mira"},
                      {"key": "world.scarcity", "value": 500}, {"key": "llm.model", "value": "x"}, {"key": "nichts", "value": 1}, {"key": "personality.curiosity", "value": 5}])
        assert r.status_code == 200
        res = {(x["key"], x["agent"], x["new"]): x for x in r.json()["results"]}
        assert res[("world.scarcity", None, 40)]["status"] == "applied"
        assert res[("memory.reflection_threshold", None, 120)]["status"] == "pending_next_decision"
        assert res[("personality.curiosity", "mira", 20)]["status"] == "pending_next_decision"
        assert "zwischen 0 und 100" in res[("world.scarcity", None, 500)]["reason"] and res[("world.scarcity", None, 500)]["status"] == "rejected"
        assert "neue Simulation" in res[("llm.model", None, "x")]["reason"]
        assert "Unbekannter" in res[("nichts", None, 1)]["reason"] and "Agentenkennung" in res[("personality.curiosity", None, 5)]["reason"]
        now = r.json()["values"]
        assert now["values"]["world.scarcity"] == 40 and now["values"]["personality.curiosity"]["mira"] == 20 and set(now["changed"]) == {"world.scarcity", "memory.reflection_threshold", "personality.curiosity"}
        assert c.sim.engine.state.rules.resource_scarcity == 0.64                       # wirklich in der Welt angekommen
        ev = [e for e in c.sim.engine.events_since(0) if e.type == "simulation.parameter_changed"]
        assert {e.data["key"] for e in ev} == {"world.scarcity", "memory.reflection_threshold", "personality.curiosity"}
        assert next(e for e in ev if e.data["key"] == "world.scarcity").data["old"] == 0


def test_a_patch_needs_an_idempotency_key_and_is_not_applied_twice():
    with api() as c:
        assert c.patch("/api/params", json={"changes": [{"key": "world.scarcity", "value": 10}]}).status_code == 400
        key = str(uuid.uuid4())
        a = patch(c, [{"key": "world.scarcity", "value": 10}], key)
        b = patch(c, [{"key": "world.scarcity", "value": 10}], key)
        assert a.json() == b.json() and b.headers["Idempotent-Replay"] == "true"
        assert len([e for e in c.sim.engine.events_since(0) if e.type == "simulation.parameter_changed"]) == 1
        assert patch(c, [{"key": "world.scarcity", "value": 20}], key).status_code == 409
        assert patch(c, []).status_code == 422


def test_reset_one_parameter_a_group_or_everything():
    with api() as c:
        patch(c, [{"key": "world.scarcity", "value": 40}, {"key": "world.build_cost", "value": 200}, {"key": "exploration", "value": 90}])
        r = post(c, "/api/params/reset", {"keys": ["world.scarcity"]}).json()
        assert r["values"]["values"]["world.scarcity"] == 0 and r["values"]["values"]["world.build_cost"] == 200
        r = post(c, "/api/params/reset", {"group": "world"}).json()
        assert r["values"]["values"]["world.build_cost"] == 100 and r["values"]["values"]["exploration"] == 90
        r = post(c, "/api/params/reset").json()
        assert r["values"]["changed"] == [] and c.sim.autonomy.shifts["curiosity"] == 0


def test_changes_survive_a_restart_and_a_world_reset(tmp_path):
    s = Settings(llm_api_key_file="/nonexistent")
    sim = Simulation.create(s, tmp_path / "live.db")
    sim.store.ensure_all()
    with api(sim) as c:
        patch(c, [{"key": "world.scarcity", "value": 60}, {"key": "exploration", "value": 80}, {"key": "personality.risk_taking", "value": 10, "agent": "alex"}, {"key": "needs.hunger.rate", "value": 150}])
    sim2 = Simulation.create(s, tmp_path / "live.db")                                   # Neustart mit derselben Datenbank
    sim2.store.ensure_all()
    sim2.params.restore(sim2.params.export())
    v = sim2.params.values()
    assert (v["world.scarcity"], v["exploration"], v["needs.hunger.rate"], v["personality.risk_taking"]["alex"]) == (60, 80, 150, 10)
    assert sim2.engine.state.rules.resource_scarcity == 0.46
    import asyncio
    asyncio.run(sim2.reset())                                                           # neue Welt: die Einstellungen bleiben
    v = sim2.params.values()
    assert (v["world.scarcity"], v["exploration"], v["needs.hunger.rate"]) == (60, 80, 150) and sim2.autonomy.shifts["curiosity"] == 30
    assert sim2.engine.state.rules.resource_scarcity == 0.46
    sim2.close()


def test_reset_with_a_model_choice():
    with api() as c:
        assert post(c, "/api/sim/reset", {"confirm": True, "model": "anderes-modell"}).status_code == 200
        assert c.sim.client.params.model == "anderes-modell"


def test_status_reports_model_and_load():
    with api() as c:
        s = c.get("/api/status").json()
        assert s["model"]["model"] and s["model"]["reachable"] is None and s["model"]["queue"] == 0
        assert s["load"]["state"] == "stopped" and s["load"]["speed_level"] in ("max", "custom") and s["load"]["actions_ok"] == 0
        post(c, "/api/sim/step", {"n": 3})
        s = c.get("/api/status").json()
        assert s["model"]["calls"] > 0 and s["model"]["reachable"] is True and s["model"]["avg_response_s"] is not None
        assert s["load"]["actions_ok"] + s["load"]["actions_failed"] == c.sim.runner.stats.decisions > 0


def test_speed_levels_are_half_one_two_four_and_max():
    with api() as c:
        for level, delay in (("0.5x", 2.0), ("1x", 1.0), ("2x", 0.5), ("4x", 0.25), ("max", 0.0)):
            r = post(c, "/api/sim/speed", {"level": level}).json()
            assert (r["speed_level"], r["tick_delay_s"]) == (level, delay)
            assert c.get("/api/params").json()["values"]["sim.speed"] == level
        assert post(c, "/api/sim/speed", {"level": "fast"}).status_code == 422
