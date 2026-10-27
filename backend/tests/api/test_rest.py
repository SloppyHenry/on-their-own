import re

import pytest

from agents.conftest import make_sim
from on_their_own.config import Settings
from on_their_own.llm.providers import FakeProvider
from on_their_own.simulation.builder import Simulation

from .conftest import api, minute, post, wait_one_minute


def test_state_snapshot_is_complete_and_consistent():
    with api() as c:
        post(c, "/api/sim/step", {"n": 3})
        s = c.get("/api/state").json()
        eng = c.sim.engine
        assert s["seq"] == eng.events_since(0, 100000)[-1].seq and s["clock"]["minute"] == eng.minute == 423
        assert s["world_name"] == "Dorf am See" and {a["id"] for a in s["agents"]} == {"alex", "mira"}
        m = s["map"]
        assert (m["width"], m["height"]) == (64, 40) and len(m["rows"]) == 40 and all(len(r) == 64 for r in m["rows"])
        assert set("".join(m["rows"])) <= set(m["legend"]) and m["legend"]["~"] == "water"
        assert s["tile_types"]["water"] == {"char": "~", "walkable": False, "cost": 0, "color": "#3f6fa8", "label": "Wasser"}
        assert {l["id"] for l in s["locations"]} >= {"lake", "garden", "house.kitchen"} and len(s["objects"]) == 32 and len(s["resources"]) == 11
        alex = next(a for a in s["agents"] if a["id"] == "alex")
        assert alex["profile"]["name"] == "Alex" and alex["words"]["hunger"] and alex["status"] == "idle" and alex["action"] is None
        assert s["simulation"]["state"] == "stopped" and s["simulation"]["stats"]["decisions"] >= 2 and s["weather"]["kind"] == "clear"


def test_map_encoding_gives_unknown_chars_to_tile_types_without_one():
    with api() as c:
        c.sim.engine.edit.add_tile_type("moos", walkable=True, cost=3)            # ohne Kartenzeichen
        c.sim.engine.edit.paint_rect(1, 1, 1, 1, "moos")
        s = c.get("/api/state").json()
        ch = s["tile_types"]["moos"]["char"]
        assert ch and s["map"]["legend"][ch] == "moos" and s["map"]["rows"][1][1] == ch and ch not in ".,_#~T+s"


def test_events_listing_and_filters_and_validation():
    with api() as c:
        post(c, "/api/sim/step", {"n": 5})
        page = c.get("/api/events", params={"limit": 1000}).json()
        items = page["items"]
        assert items[0]["seq"] == 1 and page["last_seq"] == items[-1]["seq"]
        e = items[0]
        assert re.fullmatch(r"evt_[0-9A-Z]{26}", e["id"]) and set(e) == {"id", "seq", "ts", "sim_time", "type", "category", "agents", "location", "data", "caused_by", "visibility"}
        assert {i["category"] for i in c.get("/api/events", params={"category": "planning"}).json()["items"]} == {"planning"}
        assert {i["type"] for i in c.get("/api/events", params={"type": "agent.decision"}).json()["items"]} == {"agent.decision"}
        assert all(i["type"].startswith("agent.action") for i in c.get("/api/events", params={"type_prefix": "agent.action"}).json()["items"])
        assert all("mira" in i["agents"] for i in c.get("/api/events", params={"agent": "mira"}).json()["items"])
        assert [i["seq"] for i in c.get("/api/events", params={"after_seq": 3, "limit": 2}).json()["items"]] == [4, 5]
        assert [i["seq"] for i in c.get("/api/events", params={"before_seq": 4, "order": "desc"}).json()["items"]] == [3, 2, 1]
        for bad in ({"limit": 0}, {"limit": 5000}, {"category": "unfug"}, {"after_seq": -1}, {"order": "sideways"}, {"agent": "a b"}, {"type": "x" * 100}):
            assert c.get("/api/events", params=bad).status_code == 422, bad


def test_event_detail_shows_cause_chain_and_consequences():
    with api() as c:
        post(c, "/api/sim/step", {"n": 3})
        done = c.get("/api/events", params={"type": "agent.action_completed"}).json()["items"][0]
        d = c.get(f"/api/events/{done['id']}").json()
        assert d["event"]["id"] == done["id"] and [x["type"] for x in d["chain"]] == ["agent.decision", "agent.action_started"]
        assert d["chain"][1]["caused_by"] == d["chain"][0]["id"] and d["event"]["caused_by"] == d["chain"][1]["id"]
        dec = d["chain"][0]
        assert c.get(f"/api/events/{dec['seq']}").json()["consequences"][0]["type"] == "agent.action_started"      # per Sequenznummer
        assert dec["data"]["options"] and dec["data"]["chosen"] and dec["category"] == "planning" and dec["visibility"].startswith("agents:")
        assert c.get("/api/events/evt_" + "0" * 26).status_code == 404 and c.get("/api/events/99999").status_code == 404
        assert c.get("/api/events/ungueltig!").status_code == 422


def test_agent_and_location_details():
    with api() as c:
        post(c, "/api/sim/step", {"n": 2})
        a = c.get("/api/agents/alex").json()
        assert a["profile_full"]["name"] == "Alex" and a["personality"]["curiosity"] == 70 and a["mood"]
        assert a["decisions"] and a["decisions"][0]["options"] and a["observations"] is not None and a["conversation"] is None
        loc = c.get("/api/locations/house.bedroom_a").json()
        assert {o["id"] for o in loc["objects"]} >= {"bed_alex"} and loc["location"]["name"] == "Zimmer Alex"
        assert isinstance(loc["recent_events"], list)
        assert c.get("/api/agents/niemand").status_code == 404 and c.get("/api/locations/nirgends").status_code == 404
        assert c.get("/api/agents/..%2Fetc").status_code in (404, 422)


def test_health_includes_simulation_status():
    with api() as c:
        h = c.get("/api/health").json()
        assert h["simulation"]["state"] == "stopped" and h["status"] == "ok"


def test_step_start_pause_resume_flow():
    with api() as c:
        r = post(c, "/api/sim/step", {"n": 4}).json()
        assert r == {"state": "stopped", "minute": 424, "steps": 4, "tick_delay_s": 0.0, "speed_level": "max", "backup": None}
        assert post(c, "/api/sim/start", {"ticks": 3}).json()["state"] == "running"
        import time
        for _ in range(100):
            if c.get("/api/state").json()["simulation"]["state"] == "stopped":
                break
            time.sleep(0.05)
        assert minute(c) == 427                                                        # „stopped“ steht schon, bevor das Ereignis geschrieben ist
        post(c, "/api/sim/speed", {"tick_delay_s": 0.05})
        post(c, "/api/sim/start")
        time.sleep(0.2)
        assert post(c, "/api/sim/pause").json()["state"] == "paused"
        m = c.sim.engine.minute
        time.sleep(0.2)
        assert c.sim.engine.minute == m
        assert post(c, "/api/sim/step").json()["steps"] == 1 and c.sim.engine.minute == m + 1
        assert post(c, "/api/sim/resume").json()["state"] == "running"
        post(c, "/api/sim/pause")
        types = [i["type"] for i in c.get("/api/events", params={"type_prefix": "simulation."}).json()["items"]]
        assert types.count("simulation.paused") == 2 and "simulation.resumed" in types and "simulation.started" in types and "simulation.stepped" in types


def test_step_is_refused_while_running():
    with api(llm_max_concurrent=1) as c:
        c.sim.runner.set_speed(0.05)
        post(c, "/api/sim/start")
        r = post(c, "/api/sim/step")
        assert r.status_code == 409 and "pausiert" in r.json()["detail"]
        post(c, "/api/sim/pause")


def test_speed_levels_and_validation():
    with api() as c:
        assert post(c, "/api/sim/speed", {"level": "0.5x"}).json()["tick_delay_s"] == 2.0
        r = post(c, "/api/sim/speed", {"tick_delay_s": 0.7}).json()
        assert r["speed_level"] == "custom" and c.sim.runner.tick_delay_s == 0.7
        assert post(c, "/api/sim/speed", {"level": "4x"}).json()["speed_level"] == "4x"
        assert post(c, "/api/sim/speed", {}).status_code == 422 and post(c, "/api/sim/speed", {"level": "4x", "tick_delay_s": 1}).status_code == 422
        assert post(c, "/api/sim/speed", {"level": "warp"}).status_code == 422 and post(c, "/api/sim/speed", {"tick_delay_s": -1}).status_code == 422
        ev = c.get("/api/events", params={"type": "simulation.speed_changed"}).json()["items"]
        assert [e["data"]["level"] for e in ev] == ["0.5x", "custom", "4x"]
        assert post(c, "/api/sim/step", {"n": 0}).status_code == 422 and post(c, "/api/sim/step", {"n": 51}).status_code == 422


def test_reset_needs_confirmation_and_keeps_a_backup(tmp_path):
    sim = Simulation.create(Settings(llm_api_key_file="/nonexistent"), tmp_path / "live.db", FakeProvider(fn=wait_one_minute))
    with api(sim) as c:
        post(c, "/api/sim/step", {"n": 5})
        r = post(c, "/api/sim/reset", {})
        assert r.status_code == 400 and "Bestätigung" in r.json()["detail"] and c.sim.engine.minute == 425
        assert post(c, "/api/sim/reset", {"confirm": False}).status_code == 400
        ok = post(c, "/api/sim/reset", {"confirm": True}).json()
        assert ok["minute"] == 420 and ok["backup"] and (tmp_path / "saves").exists()
        s = c.get("/api/state").json()
        assert s["clock"]["minute"] == 420 and s["seq"] == 1                            # neue Welt, Protokoll beginnt neu (erstes: simulation.reset)
        assert c.get("/api/events").json()["items"][0]["type"] == "simulation.reset"
        from on_their_own.db.connection import Database
        assert Database(ok["backup"]).conn.execute("SELECT minute FROM clock").fetchone()[0] == 425
