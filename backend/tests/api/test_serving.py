"""AP10: Auslieferung des gebauten Frontends und optionaler Zugangsschutz."""

import pytest

from api.conftest import api


@pytest.fixture
def dist(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>On Their Own</title><div id=root></div>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path.parent / "geheim.txt").write_text("nicht ausliefern")
    return tmp_path


def test_frontend_is_served_with_cache_rules_and_spa_fallback(dist):
    with api(static_dir=dist) as c:
        r = c.get("/")
        assert r.status_code == 200 and "<div id=root>" in r.text and r.headers["cache-control"] == "no-cache"
        a = c.get("/assets/app-abc123.js")
        assert a.status_code == 200 and "immutable" in a.headers["cache-control"]
        assert c.get("/favicon.svg").headers["cache-control"] == "no-cache"
        assert "<div id=root>" in c.get("/irgendeine/ansicht").text          # Auffangpfad für die Oberfläche


def test_api_and_ws_paths_are_never_answered_with_the_page(dist):
    with api(static_dir=dist) as c:
        assert c.get("/api/health").json()["status"] == "ok"
        assert c.get("/api/gibt-es-nicht").status_code == 404 and "root" not in c.get("/api/gibt-es-nicht").text
        assert c.get("/api").status_code == 404
        assert c.get("/api/state").status_code == 200


@pytest.mark.parametrize("path", ["/../geheim.txt", "/%2e%2e/geheim.txt", "/assets/../../geheim.txt", "/%2e%2e%2fgeheim.txt"])
def test_path_traversal_does_not_leave_the_directory(dist, path):
    with api(static_dir=dist) as c:
        assert "nicht ausliefern" not in c.get(path).text


def test_missing_build_fails_loudly_at_startup(tmp_path):
    with pytest.raises(RuntimeError, match="npm run build"):
        with api(static_dir=tmp_path / "gibt-es-nicht"):
            pass


def test_without_static_dir_the_api_works_as_before():
    with api() as c:
        assert c.get("/").status_code == 404 and c.get("/api/state").status_code == 200


# --- Zugangsschutz -----------------------------------------------------------------------------------------------

TOKEN = "geheimes-heimnetz-token"


def test_no_token_means_open_access_and_status_says_so():
    with api() as c:
        assert c.get("/api/auth/status").json() == {"required": False, "authenticated": True}
        assert c.get("/api/state").status_code == 200


def test_with_token_api_and_websocket_need_login_but_health_and_page_stay_open(dist):
    with api(static_dir=dist, access_token=TOKEN) as c:
        assert c.get("/api/state").status_code == 401 and c.get("/api/state").json()["detail"] == "Anmeldung erforderlich."
        assert c.post("/api/sim/pause", headers={"Idempotency-Key": "x"}).status_code == 401
        assert c.get("/api/health").status_code == 200 and c.get("/").status_code == 200
        assert c.get("/api/auth/status").json() == {"required": True, "authenticated": False}
        with pytest.raises(Exception):
            with c.websocket_connect("/ws"):
                pass


def test_wrong_token_is_rejected_and_right_token_sets_a_cookie_that_works(dist):
    with api(static_dir=dist, access_token=TOKEN) as c:
        bad = c.post("/api/auth/login", json={"token": "falsch"})
        assert bad.status_code == 401 and "sim_access" not in c.cookies
        ok = c.post("/api/auth/login", json={"token": TOKEN})
        assert ok.json() == {"required": True, "authenticated": True}
        set_cookie = ok.headers["set-cookie"].lower()
        assert "httponly" in set_cookie and "samesite=strict" in set_cookie and TOKEN not in ok.headers["set-cookie"]
        assert c.get("/api/state").status_code == 200
        assert c.get("/api/auth/status").json()["authenticated"] is True
        with c.websocket_connect("/ws") as ws:
            ws.send_json({"type": "hello", "last_seq": None})
            assert ws.receive_json()["type"] == "snapshot"
        c.post("/api/auth/logout")
        assert c.get("/api/state").status_code == 401


def test_bearer_header_works_for_scripts(dist):
    with api(access_token=TOKEN) as c:
        assert c.get("/api/state", headers={"Authorization": f"Bearer {TOKEN}"}).status_code == 200
        assert c.get("/api/state", headers={"Authorization": "Bearer falsch"}).status_code == 401
        assert c.get("/api/state", headers={"Cookie": "sim_access=falsch"}).status_code == 401


def test_repeated_wrong_tokens_are_throttled(monkeypatch):
    monkeypatch.setattr("on_their_own.api.auth.FAIL_DELAY_S", 0.0)
    with api(access_token=TOKEN) as c:
        codes = [c.post("/api/auth/login", json={"token": f"x{i}"}).status_code for i in range(12)]
        assert codes[:10] == [401] * 10 and codes[10:] == [429, 429]
        assert c.post("/api/auth/login", json={"token": TOKEN}).status_code == 429          # auch das richtige Token wartet


def test_empty_token_setting_counts_as_no_protection():
    with api(access_token="") as c:
        assert c.get("/api/state").status_code == 200
