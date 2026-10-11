"""REST der Spielstände: Bestätigungen, Idempotenz, Export/Import als Datei, Reset mit Sicherung, WebSocket-Snapshot nach dem Laden."""

import uuid

from api.conftest import api, hello, post, recv_until


def put(c, path, body=None):
    return c.put(path, json=body, headers={"Idempotency-Key": str(uuid.uuid4())})


async def test_save_list_load_delete_flow(sim):
    with api(sim) as c:
        assert c.get("/api/saves").json() == []
        post(c, "/api/sim/step", {"n": 20})
        a = post(c, "/api/saves", {"name": "Erster", "description": "Test"})
        assert a.status_code == 200 and a.json()["kind"] == "manual" and a.json()["sim_label"].startswith("Tag 1")
        again = post(c, "/api/saves", {"name": "erster"})
        assert again.status_code == 409 and "gibt es schon" in again.json()["detail"]
        ok = post(c, "/api/saves", {"name": "Erster", "overwrite": True})
        assert ok.status_code == 200 and ok.json()["id"] == a.json()["id"]
        post(c, "/api/sim/step", {"n": 10})
        minute = c.get("/api/state").json()["clock"]["minute"]
        assert post(c, f"/api/saves/{a.json()['id']}/load", {}).status_code == 400                             # ohne Bestätigung nichts
        assert c.get("/api/state").json()["clock"]["minute"] == minute
        assert post(c, f"/api/saves/{a.json()['id']}/load", {"confirm": True}).status_code == 200
        assert c.get("/api/state").json()["clock"]["minute"] == a.json()["sim_minute"]
        kinds = sorted(s["kind"] for s in c.get("/api/saves").json())
        assert kinds == ["backup", "manual"]
        backup = next(s for s in c.get("/api/saves").json() if s["kind"] == "backup")
        assert c.delete(f"/api/saves/{backup['id']}", headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 400
        assert c.delete(f"/api/saves/{backup['id']}?confirm=true", headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 200
        assert [s["kind"] for s in c.get("/api/saves").json()] == ["manual"]
        assert post(c, "/api/saves/sav_gibtesnicht/load", {"confirm": True}).status_code == 404


async def test_idempotent_save_and_missing_key(sim):
    with api(sim) as c:
        assert c.post("/api/saves", json={"name": "X"}).status_code == 400
        key = str(uuid.uuid4())
        a = post(c, "/api/saves", {"name": "Einmal"}, key=key)
        b = post(c, "/api/saves", {"name": "Einmal"}, key=key)
        assert a.json() == b.json() and b.headers["Idempotent-Replay"] == "true" and len(c.get("/api/saves").json()) == 1


async def test_export_download_and_import_upload(sim):
    with api(sim) as c:
        post(c, "/api/sim/step", {"n": 15})
        s = post(c, "/api/saves", {"name": "Rundreise"}).json()
        r = c.get(f"/api/saves/{s['id']}/export")
        assert r.status_code == 200 and r.headers["content-type"] == "application/zip" and "simulacra-Rundreise.zip" in r.headers["content-disposition"]
        up = c.post("/api/saves/import", content=r.content, headers={"Idempotency-Key": str(uuid.uuid4()), "Content-Type": "application/zip"})
        assert up.status_code == 200 and up.json()["kind"] == "import" and up.json()["sim_minute"] == s["sim_minute"]
        bad = c.post("/api/saves/import", content=b"kaputt", headers={"Idempotency-Key": str(uuid.uuid4())})
        assert bad.status_code == 422 and "keine ZIP" in bad.json()["detail"]
        assert c.get("/api/saves/sav_nope/export").status_code == 404
        assert len(c.get("/api/saves").json()) == 2                                                             # das Fehlerhafte hat nichts angelegt


async def test_reset_over_the_api_backs_up_and_can_keep_profiles(sim):
    with api(sim) as c:
        await sim.params.patch([{"key": "profile.interests", "value": "Schach", "agent": "mira"}])
        post(c, "/api/sim/step", {"n": 10})
        assert post(c, "/api/sim/reset", {}).status_code == 400
        r = post(c, "/api/sim/reset", {"confirm": True, "keep_profiles": True}).json()
        assert r["backup"] and "saves" in r["backup"]
        assert [s["name"].split(" – ")[0] for s in c.get("/api/saves").json()] == ["Vor dem Zurücksetzen"]
        assert c.get("/api/params").json()["values"]["profile.interests"]["mira"] == "Schach"


async def test_all_browsers_get_a_fresh_snapshot_after_loading(sim):
    with api(sim) as c:
        post(c, "/api/sim/step", {"n": 5})
        s = post(c, "/api/saves", {"name": "Für den Browser"}).json()
        post(c, "/api/sim/step", {"n": 30})
        with c.websocket_connect("/ws") as ws:
            hello(ws)
            post(c, f"/api/saves/{s['id']}/load", {"confirm": True})
            got = recv_until(ws, lambda m: m["type"] == "snapshot")
            assert got[-1]["type"] == "snapshot" and got[-1]["state"]["clock"]["minute"] == s["sim_minute"]


def test_without_a_database_file_there_are_no_saves():
    with api() as c:
        assert c.get("/api/saves").json() == []
        assert post(c, "/api/saves", {"name": "X"}).status_code == 409
