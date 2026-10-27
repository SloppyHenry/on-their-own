from on_their_own.config import Settings


def test_defaults(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    s = Settings(llm_api_key_file=tmp_path / "none")
    assert s.llm_base_url == "http://maintux:8080/v1"
    assert s.llm_model == "qwen3.8-9b-uncensored"
    assert s.llm_timeout_s == 90
    assert (s.host, s.port) == ("127.0.0.1", 8090)
    assert s.llm_api_key is None


def test_env_override(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("SIM_LLM_MODEL", "bonsai2-27b")
    monkeypatch.setenv("SIM_PORT", "9999")
    s = Settings()
    assert s.llm_model == "bonsai2-27b"
    assert s.port == 9999


def test_key_from_file(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    keyfile = tmp_path / "key"
    keyfile.write_text("geheim-123\n")
    s = Settings(llm_api_key_file=keyfile)
    assert s.llm_api_key.get_secret_value() == "geheim-123"


def test_key_from_env_wins_over_file(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    keyfile = tmp_path / "key"
    keyfile.write_text("aus-datei")
    monkeypatch.setenv("SIM_LLM_API_KEY", "aus-env")
    s = Settings(llm_api_key_file=keyfile)
    assert s.llm_api_key.get_secret_value() == "aus-env"


def test_key_not_in_repr(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    keyfile = tmp_path / "key"
    keyfile.write_text("geheim-123")
    s = Settings(llm_api_key_file=keyfile)
    assert "geheim-123" not in repr(s)
    assert "geheim-123" not in str(s)
    assert "geheim-123" not in s.model_dump_json()
