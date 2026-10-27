import httpx
from fastapi.testclient import TestClient

from on_their_own import app as app_module
from on_their_own.config import Settings, get_settings


def _client(monkeypatch, handler, tmp_path):
    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(
        app_module.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw)
    )
    app = app_module.create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        llm_api_key_file=tmp_path / "none", data_dir=tmp_path
    )
    return TestClient(app)


def test_health_llm_reachable(monkeypatch, tmp_path):
    def handler(request):
        return httpx.Response(200, json={"data": [{"id": "qwen3.8-9b-uncensored"}, {"id": "x"}]})

    body = _client(monkeypatch, handler, tmp_path).get("/api/health").json()
    assert body["status"] == "ok"
    assert body["llm"]["reachable"] is True
    assert body["llm"]["models"] == ["qwen3.8-9b-uncensored", "x"]
    assert body["llm"]["model_available"] is True


def test_health_llm_unreachable(monkeypatch, tmp_path):
    def handler(request):
        raise httpx.ConnectError("keine Verbindung")

    resp = _client(monkeypatch, handler, tmp_path).get("/api/health")
    assert resp.status_code == 200
    llm = resp.json()["llm"]
    assert llm["reachable"] is False
    assert "ConnectError" in llm["error"]
    assert llm["models"] == []


def test_health_llm_unauthorized(monkeypatch, tmp_path):
    def handler(request):
        return httpx.Response(401, json={"error": "unauthorized"})

    llm = _client(monkeypatch, handler, tmp_path).get("/api/health").json()["llm"]
    assert llm["reachable"] is False
    assert "401" in llm["error"]


def test_health_sends_bearer_key(monkeypatch, tmp_path):
    seen = {}

    def handler(request):
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"data": []})

    monkeypatch.setenv("SIM_LLM_API_KEY", "abc")
    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(
        app_module.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw)
    )
    app = app_module.create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(data_dir=tmp_path)
    TestClient(app).get("/api/health")
    assert seen["auth"] == "Bearer abc"
