"""Stimmen der Figuren (AP17d): in der Welt gespeichert, wandern mit dem Spielstand, bleiben beim Zurücksetzen nur mit den Profilen, nie im Prompt."""

from fastapi.testclient import TestClient

from simulacra.api.app import create_app
from simulacra.world.voices import set_voice, voices

ALEX = {"base": 250, "timbre": "rau", "speed": 1.1, "size": 1.05, "lively": 0.7, "breath": 0.1, "vib": 5, "style": "plappern"}


def test_set_voice_over_the_api_shows_in_the_snapshot_and_as_system_event(sim):
    with TestClient(create_app(sim, settings=sim.settings)) as c:
        assert c.get("/api/state").json()["voices"] == {}
        r = c.put("/api/agents/alex/voice", json={"voice": ALEX}, headers={"Idempotency-Key": "stimme-alex-0001"})
        assert r.status_code == 200, r.text
        assert c.get("/api/state").json()["voices"] == {"alex": ALEX}
        ev = c.get("/api/events", params={"type": "simulation.voice_changed"}).json()["items"]
        assert len(ev) == 1 and ev[0]["category"] == "system" and ev[0]["agents"] == [] and ev[0]["data"] == {"agent": "alex", "voice": ALEX}
        assert c.put("/api/agents/alex/voice", json={"voice": None}, headers={"Idempotency-Key": "stimme-alex-0002"}).status_code == 200
        assert c.get("/api/state").json()["voices"] == {}


def test_bad_values_unknown_figures_and_missing_key_are_refused(sim):
    with TestClient(create_app(sim, settings=sim.settings)) as c:
        assert c.put("/api/agents/alex/voice", json={"voice": {**ALEX, "base": 2000}}, headers={"Idempotency-Key": "stimme-x-0001"}).status_code == 422
        assert c.put("/api/agents/alex/voice", json={"voice": {**ALEX, "timbre": "laut"}}, headers={"Idempotency-Key": "stimme-x-0002"}).status_code == 422
        assert c.put("/api/agents/niemand/voice", json={"voice": ALEX}, headers={"Idempotency-Key": "stimme-x-0003"}).status_code == 404
        assert c.put("/api/agents/alex/voice", json={"voice": ALEX}).status_code in (400, 422, 428)
        assert c.get("/api/state").json()["voices"] == {}


async def test_voices_travel_with_the_save(sim):
    await sim.engine.db.run(lambda: set_voice(sim.engine, "mira", {**ALEX, "base": 230}))
    entry = await sim.engine.db.run(lambda: sim.saves.create("mit Stimme"))
    await sim.engine.db.run(lambda: set_voice(sim.engine, "mira", None))
    await sim.load_save(entry["id"])
    assert await sim.engine.db.run(lambda: voices(sim.engine.state)) == {"mira": {**ALEX, "base": 230}}


async def test_reset_keeps_voices_only_with_the_profiles(sim):
    await sim.engine.db.run(lambda: set_voice(sim.engine, "alex", ALEX))
    await sim.reset(keep_profiles=True)
    assert await sim.engine.db.run(lambda: voices(sim.engine.state)) == {"alex": ALEX}
    await sim.reset(keep_profiles=False)
    assert await sim.engine.db.run(lambda: voices(sim.engine.state)) == {}


async def test_the_residents_never_hear_about_their_voice(sim):
    seen: list[str] = []
    inner = sim.provider.fn

    def record(messages, schema, params):
        seen.append(str(messages))
        return inner(messages, schema, params)
    sim.provider.fn = record
    await sim.engine.db.run(lambda: set_voice(sim.engine, "alex", ALEX))
    await sim.runner.step(3)
    prompts = " ".join(seen)
    assert seen and "timbre" not in prompts and "plappern" not in prompts and "rau" not in prompts.split()
    obs = await sim.engine.db.run(lambda: [r["text"] for r in sim.engine.state.conn.execute("SELECT text FROM observations")])
    assert not any("Stimme" in t or "voice" in t for t in obs)
