import threading
import uuid

from .conftest import api, post


def test_same_key_twice_executes_once_and_replays_the_answer():
    with api() as c:
        key = str(uuid.uuid4())
        first = post(c, "/api/sim/step", {"n": 2}, key=key)
        second = post(c, "/api/sim/step", {"n": 2}, key=key)
        assert first.status_code == second.status_code == 200 and first.json() == second.json()
        assert c.sim.engine.minute == 422                                  # nur zwei Ticks, nicht vier
        assert "idempotent-replay" not in first.headers and second.headers["Idempotent-Replay"] == "true"
        assert len([e for e in c.get("/api/events", params={"type": "simulation.stepped"}).json()["items"]]) == 1


def test_new_key_executes_again():
    with api() as c:
        post(c, "/api/sim/step"), post(c, "/api/sim/step")
        assert c.sim.engine.minute == 422


def test_same_key_with_different_content_or_path_is_a_conflict():
    with api() as c:
        key = str(uuid.uuid4())
        assert post(c, "/api/sim/step", {"n": 1}, key=key).status_code == 200
        r = post(c, "/api/sim/step", {"n": 2}, key=key)
        assert r.status_code == 409 and "andere Anfrage" in r.json()["detail"]
        assert post(c, "/api/sim/speed", {"level": "4x"}, key=key).status_code == 409
        assert c.sim.engine.minute == 421


def test_missing_or_bad_key_is_rejected_and_nothing_runs():
    with api() as c:
        assert post(c, "/api/sim/step", {"n": 1}, key=None).status_code == 400
        assert post(c, "/api/sim/step", {"n": 1}, key="kurz").status_code == 400
        assert post(c, "/api/sim/step", {"n": 1}, key="x" * 200).status_code == 400
        assert "Idempotency-Key" in post(c, "/api/sim/pause", key=None).json()["detail"]
        assert c.sim.engine.minute == 420


def test_simultaneous_duplicates_run_once():
    with api() as c:
        key, codes = str(uuid.uuid4()), []

        def go():
            codes.append(post(c, "/api/sim/step", {"n": 3}, key=key).status_code)

        threads = [threading.Thread(target=go) for _ in range(5)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        assert codes == [200] * 5 and c.sim.engine.minute == 423


def test_errors_are_not_cached_so_a_retry_can_succeed():
    with api() as c:
        c.sim.runner.set_speed(0.05)
        post(c, "/api/sim/start")
        key = str(uuid.uuid4())
        assert post(c, "/api/sim/step", key=key).status_code == 409           # läuft gerade
        post(c, "/api/sim/pause")
        assert post(c, "/api/sim/step", key=key).status_code == 200            # derselbe Schlüssel, jetzt erlaubt


def test_reset_replay_does_not_reset_twice():
    with api() as c:
        post(c, "/api/sim/step", {"n": 3})
        key = str(uuid.uuid4())
        assert post(c, "/api/sim/reset", {"confirm": True}, key=key).status_code == 200
        post(c, "/api/sim/step", {"n": 2})
        assert post(c, "/api/sim/reset", {"confirm": True}, key=key).headers["Idempotent-Replay"] == "true"
        assert c.sim.engine.minute == 422                                        # der zweite Aufruf hat die Welt nicht noch einmal zurückgesetzt


def test_old_entries_expire():
    import time
    with api() as c:
        key = str(uuid.uuid4())
        post(c, "/api/sim/step", {"n": 1}, key=key)
        with c.sim.db.transaction() as conn:
            conn.execute("UPDATE idempotency SET created_at = ?", (time.time() - 25 * 3600,))
        assert post(c, "/api/sim/step", {"n": 1}, key=key).headers.get("Idempotent-Replay") is None
        assert c.sim.engine.minute == 422
