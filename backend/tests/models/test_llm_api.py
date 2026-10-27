"""Modellverwaltung über die API (AP17c-3): Zustand, Bestätigungspflicht, Idempotenz, Download, Laufzeit, Probelauf, Betriebsart, Folgen für Zurücksetzen."""

import os

from on_their_own.simulation.runner import SimState

from .fakes import put_model
from .llmapi import DATA, FILE, MID, REPO, call, download, hub_with_model, llm_api, status, wait_for


def test_leerer_zustand(tmp_path):
    with llm_api(tmp_path) as c:
        s = status(c)
        assert s["mode"] == "external" and s["locked"] is False and s["installed"] == [] and s["transfer"] is None and s["probe"] is None
        assert s["runtime"]["installed"] is False and s["runtime"]["state"] == "stopped" and s["runtime"]["version"] is None
        assert s["base_url"] == "http://maintux:8080/v1" and s["sim_model"] == "qwen3.8-9b-uncensored" and s["sim_running"] is False and s["external_key_set"] is False
        assert "external_key" not in s and s["default_model"] is None


def test_download_braucht_bestaetigung_und_idempotency_key(tmp_path):
    with llm_api(tmp_path, hub_with_model()) as c:
        assert call(c, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE}).status_code == 400
        assert call(c, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE, "confirm": False}).status_code == 400
        assert call(c, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE, "confirm": True}, key=None).status_code == 400
        assert status(c)["transfer"] is None and not list((tmp_path / "models").glob("*"))


def test_download_vollstaendig(tmp_path):
    with llm_api(tmp_path, hub_with_model()) as c:
        s = download(c)
        assert s["transfer"]["phase"] == "done" and s["transfer"]["model_id"] == MID and s["transfer"]["total"] == len(DATA) and s["transfer"]["error"] is None
        [m] = s["installed"]
        assert m["id"] == MID and m["source"] == "tool" and m["repo"] == REPO and m["license"] == "Apache-2.0" and m["quant"] == "Q4_K_M" and m["size_bytes"] == len(DATA)
        assert m["running"] is False and m["is_default"] is False and m["probe"] is None
        assert (tmp_path / "models" / FILE).read_bytes() == DATA
        r = call(c, "DELETE", "/api/models/downloads/current")                             # beendete Meldung ausblenden
        assert r.status_code == 200 and r.json()["transfer"] is None


def test_download_zweimal_mit_demselben_schluessel_laedt_einmal(tmp_path):
    hub = hub_with_model()
    with llm_api(tmp_path, hub) as c:
        body = {"repo": REPO, "file": FILE, "confirm": True}
        a = call(c, "POST", "/api/models/downloads", body, key="schluessel-0001")
        b = call(c, "POST", "/api/models/downloads", body, key="schluessel-0001")
        assert a.status_code == b.status_code == 200 and b.headers.get("Idempotent-Replay") == "true"
        wait_for(c, lambda s: s["transfer"]["phase"] == "done", "fertig")
        assert sum(1 for r in hub.requests if r.url.host.startswith("cdn")) == 1


def test_zweiter_download_waehrend_des_ersten_ist_409(tmp_path):
    hub = hub_with_model()
    hub.delay_s = 0.2
    hub.add("Qwen/Other-GGUF", "Other-Q4_K_M.gguf", os.urandom(50_000))
    with llm_api(tmp_path, hub) as c:
        assert call(c, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE, "confirm": True}).status_code == 200
        r = call(c, "POST", "/api/models/downloads", {"repo": "Qwen/Other-GGUF", "file": "Other-Q4_K_M.gguf", "confirm": True})
        assert r.status_code == 409 and "Übertragung" in r.json()["detail"]
        call(c, "DELETE", "/api/models/downloads/current")
        wait_for(c, lambda s: s["transfer"]["phase"] == "cancelled", "abgebrochen")


def test_download_fehler_stehen_in_der_antwort(tmp_path):
    hub = hub_with_model()
    hub.gated.add("Meta/Locked-GGUF")
    with llm_api(tmp_path, hub) as c:
        r = call(c, "POST", "/api/models/downloads", {"repo": "Meta/Locked-GGUF", "file": "x-Q4_K_M.gguf", "confirm": True})
        assert r.status_code == 422 and "Anmeldung" in r.json()["detail"]
        r = call(c, "POST", "/api/models/downloads", {"repo": "../x", "file": FILE, "confirm": True})
        assert r.status_code == 422
        hub.repos[REPO][FILE].data = DATA[::-1]                                              # Quelle liefert andere Bytes: Prüfsumme schlägt an
        s = download(c)
        assert s["transfer"]["phase"] == "failed" and "Prüfsumme" in s["transfer"]["error"] and s["installed"] == []


def test_abbrechen_raeumt_die_teildatei_weg(tmp_path):
    hub = hub_with_model()
    hub.delay_s = 0.2
    with llm_api(tmp_path, hub) as c:
        call(c, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE, "confirm": True})
        wait_for(c, lambda s: s["transfer"]["phase"] == "downloading" and s["transfer"]["done"] > 0, "lädt")
        s = status(c)
        assert s["transfer"]["total"] == len(DATA) and 0 < s["transfer"]["done"] < len(DATA)
        assert call(c, "DELETE", "/api/models/downloads/current").status_code == 200
        s = wait_for(c, lambda s: s["transfer"]["phase"] == "cancelled", "abgebrochen")
        assert s["installed"] == [] and s["transfer"]["error"] is None and not list((tmp_path / "models").glob("*.part"))
        assert call(c, "DELETE", "/api/models/downloads/current").json()["transfer"] is None, "eine beendete Meldung wird ausgeblendet"


def test_loeschen_braucht_bestaetigung(tmp_path):
    with llm_api(tmp_path, hub_with_model()) as c:
        download(c)
        assert call(c, "DELETE", f"/api/models/installed/{MID}").status_code == 400
        assert (tmp_path / "models" / FILE).exists()
        r = call(c, "DELETE", f"/api/models/installed/{MID}?confirm=true")
        assert r.status_code == 200 and r.json()["installed"] == [] and not (tmp_path / "models" / FILE).exists()
        assert call(c, "DELETE", f"/api/models/installed/{MID}?confirm=true").status_code == 404


def test_modell_von_aussen_erscheint(tmp_path):
    put_model(tmp_path, "Mein-Modell-Q4_K_M")
    with llm_api(tmp_path) as c:
        [m] = status(c)["installed"]
        assert m["source"] == "extern" and m["repo"] is None and m["probe"] is None


# ---------- Betriebsart ----------

def test_betriebsart_extern_mit_adresse_und_schluessel(tmp_path):
    with llm_api(tmp_path) as c:
        r = call(c, "PUT", "/api/llm", {"mode": "external", "external_url": "http://thirdtux:8080/v1", "external_key": "geheim"})
        assert r.status_code == 200
        s = r.json()
        assert s["mode"] == "external" and s["external_url"] == "http://thirdtux:8080/v1" and s["external_key_set"] is True and "geheim" not in r.text
        assert c.sim.settings.llm_base_url == "http://thirdtux:8080/v1" and c.sim.settings.llm_api_key.get_secret_value() == "geheim"
        cfg = (tmp_path / "llm.json")
        assert cfg.exists() and oct(cfg.stat().st_mode & 0o777) == "0o600"
        assert call(c, "PUT", "/api/llm", {"mode": "external", "external_url": "ftp://x"}).status_code == 422


def test_betriebsart_wechsel_nur_bei_angehaltener_simulation(tmp_path):
    with llm_api(tmp_path) as c:
        c.sim.runner.state = SimState.RUNNING
        r = call(c, "PUT", "/api/llm", {"mode": "external", "external_url": "http://x/v1"})
        assert r.status_code == 409 and "Simulation läuft" in r.json()["detail"]
        assert status(c)["sim_running"] is True
        c.sim.runner.state = SimState.STOPPED


def test_feste_adresse_aus_der_umgebung(tmp_path):
    with llm_api(tmp_path, llm_base_url="http://maintux:8080/v1") as c:
        s = status(c)
        assert s["locked"] is True and s["mode"] == "external" and s["external_url"] == "http://maintux:8080/v1"
        r = call(c, "PUT", "/api/llm", {"mode": "builtin"})
        assert r.status_code == 409 and "SIM_LLM_BASE_URL" in r.json()["detail"]
        assert c.sim.settings.llm_base_url == "http://maintux:8080/v1" and not (tmp_path / "llm.json").exists()


def test_verbindungstest(tmp_path):
    with llm_api(tmp_path) as c:
        r = call(c, "POST", "/api/llm/test", {"url": "http://127.0.0.1:9/v1"}, key=None)           # lesender Test, kein Schlüssel nötig
        assert r.status_code == 200 and r.json()["reachable"] is False and r.json()["error"] and r.json()["url"] == "http://127.0.0.1:9/v1"
