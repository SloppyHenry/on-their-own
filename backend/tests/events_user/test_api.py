"""REST der freien Eingabe: Idempotenz, Fehlerfälle, Verlauf, geplante Ereignisse."""

import uuid

from api.conftest import api, post


def parse(c, text, **kw):
    return post(c, "/api/inject/parse", {"text": text, **kw})


def test_parse_confirm_roundtrip_changes_the_world_and_reports_the_events():
    with api() as c:
        c.sim.inject.rate = 100
        p = parse(c, "Heute beginnt es zu regnen.").json()
        assert p["status"] == "ready" and p["source"] == "rule" and p["ops"][0]["op"] == "set_weather" and "Regen" in p["preview"][0]
        assert c.get("/api/state").json()["weather"]["kind"] != "rain"                                  # Vorschlag ändert nichts
        d = post(c, "/api/inject/confirm", {"proposal_id": p["id"]}).json()
        assert d["status"] == "executed" and d["event_seqs"] and d["executed"] == c.sim.engine.minute
        assert c.get("/api/state").json()["weather"]["kind"] == "rain"
        types = [e["type"] for e in c.get("/api/events?limit=50").json()["items"]]
        assert "simulation.event_injected" in types and "world.weather_changed" in types


def test_mutating_calls_need_an_idempotency_key_and_replays_do_nothing_twice():
    with api() as c:
        c.sim.inject.rate = 100
        assert c.post("/api/inject/parse", json={"text": "Heute regnet es."}).status_code == 400
        key = str(uuid.uuid4())
        a = post(c, "/api/inject/parse", {"text": "Mira erfährt, dass der Brunnen tief ist."}, key=key)
        b = post(c, "/api/inject/parse", {"text": "Mira erfährt, dass der Brunnen tief ist."}, key=key)
        assert a.json() == b.json() and b.headers["Idempotent-Replay"] == "true"
        assert len(c.get("/api/inject/history").json()) == 1                                           # nur eine Eingabe entstanden
        k2 = str(uuid.uuid4())
        pid = a.json()["id"]
        first = post(c, "/api/inject/confirm", {"proposal_id": pid}, key=k2)
        again = post(c, "/api/inject/confirm", {"proposal_id": pid}, key=k2)
        assert first.json() == again.json() and len([e for e in c.get("/api/events?type_prefix=agent.informed").json()["items"]]) == 1
        assert post(c, "/api/inject/confirm", {"proposal_id": pid}).status_code == 409                  # mit neuem Schlüssel: schon ausgeführt


def test_errors_have_clear_messages():
    with api() as c:
        c.sim.inject.rate = 2
        empty = parse(c, "")
        assert empty.status_code == 422 and "leer" in empty.json()["detail"]
        r = parse(c, "x" * 1001)
        assert r.status_code == 422 and "zu lang" in r.json()["detail"]
        c.sim.inject._recent.clear()
        assert post(c, "/api/inject/confirm", {"proposal_id": "inj_gibtesnicht"}).status_code == 404
        c.sim.inject._recent.clear()
        parse(c, "Heute regnet es."); parse(c, "Heute regnet es.")
        r = parse(c, "Heute regnet es.")
        assert r.status_code == 429 and "höchstens 2" in r.json()["detail"]


def test_unclear_and_rejected_inputs_leave_the_world_alone_and_show_in_the_history():
    with api() as c:
        c.sim.inject.rate = 100
        before = c.get("/api/state").json()["objects"]
        a = parse(c, "Mira erhält eine Einladung zu einem Fest.").json()
        assert a["status"] == "needs_clarification" and a["clarification"]["options"]
        r = post(c, "/api/inject/confirm", {"proposal_id": a["id"]})
        assert r.status_code == 409
        b = parse(c, "Bewege Alex zum See").json()
        assert b["status"] == "rejected" and "Eingriffsmodus" in b["reason"]
        assert c.get("/api/state").json()["objects"] == before
        hist = c.get("/api/inject/history").json()
        assert [h["status"] for h in hist] == ["rejected", "needs_clarification"] and hist[0]["text"] == "Bewege Alex zum See"


def test_scheduled_events_are_listed_and_can_be_cancelled():
    with api() as c:
        c.sim.inject.rate = 100
        p = parse(c, "Am zentralen Platz findet morgen ein Markt statt.").json()
        assert p["status"] == "needs_confirmation"
        post(c, "/api/inject/confirm", {"proposal_id": p["id"]})
        [s] = c.get("/api/scheduled").json()
        assert s["text"].startswith("Markt") and s["minute"] > c.sim.engine.minute
        r = c.delete(f"/api/scheduled/{s['id']}", headers={"Idempotency-Key": str(uuid.uuid4())})
        assert r.status_code == 200 and c.get("/api/scheduled").json() == []
        assert c.delete(f"/api/scheduled/{s['id']}").status_code == 404


def test_proposals_with_a_chosen_time_are_planned_instead_of_executed_now():
    with api() as c:
        c.sim.inject.rate = 100
        at = c.sim.engine.minute + 90
        p = parse(c, "Heute beginnt es zu regnen.", at=at).json()
        assert p["status"] == "needs_confirmation" and p["ops"][0]["op"] == "schedule" and p["ops"][0]["at"] == at
        post(c, "/api/inject/confirm", {"proposal_id": p["id"]})
        assert c.get("/api/state").json()["weather"]["kind"] != "rain"
        c.sim.engine.advance(91)
        c.sim.inject.on_tick(c.sim.engine.minute)
        assert c.sim.engine.state.weather()["kind"] == "rain"
