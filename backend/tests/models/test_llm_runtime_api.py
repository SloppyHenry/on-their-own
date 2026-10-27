"""Modellverwaltung über die API (AP17c-3), Teil 2: Laufzeit, Probelauf, Folgen für Zurücksetzen, WebSocket, Endpunkt des Clients."""

import os

from fastapi.testclient import TestClient

from on_their_own.api.app import create_app
from on_their_own.simulation.runner import SimState

from .fakes import FakeHub, asset, install_fake_runtime, put_model, tar_with_server
from .llmapi import FILE, MID, REPO, call, llm_api, machine, status, wait_for


# ---------- Laufzeit ----------

def runtime_hub(tag="b100"):
    hub = FakeHub()
    data = tar_with_server()
    a = asset(f"llama-{tag}-bin-ubuntu-x64.tar.gz", data)
    hub.release_assets[a["name"]] = data
    hub.releases = [{"tag_name": tag, "assets": [a]}]
    return hub


def test_laufzeit_installieren(tmp_path):
    with llm_api(tmp_path, runtime_hub(), hw=machine("cpu")) as c:
        assert call(c, "POST", "/api/llm/runtime/install", {}).status_code == 400
        assert call(c, "POST", "/api/llm/runtime/install", {"confirm": True}).status_code == 200
        s = wait_for(c, lambda s: s["transfer"] and s["transfer"]["phase"] in ("done", "failed"), "Laufzeit eingerichtet")
        assert s["transfer"]["kind"] == "runtime" and s["transfer"]["phase"] == "done", s["transfer"]
        assert s["runtime"]["installed"] is True and (s["runtime"]["version"], s["runtime"]["kind"]) == ("b100", "cpu")


def test_modell_starten_stoppen_und_endpunkt(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m1")
    with llm_api(tmp_path) as c:
        assert status(c)["mode"] == "builtin"                                              # Laufzeit und Modell da, noch nichts gewählt
        assert call(c, "POST", "/api/llm/start", {"model_id": "gibt-es-nicht"}).status_code == 404
        assert call(c, "POST", "/api/llm/start", {"model_id": "m1"}).status_code == 200
        s = wait_for(c, lambda s: s["runtime"]["state"] == "running", "Modell läuft")
        assert s["runtime"]["model_id"] == "m1" and s["installed"][0]["running"] is True
        s0 = c.sim.settings
        assert s0.llm_builtin is True and s0.llm_base_url == f"http://127.0.0.1:{c.app.state.models_service.runtime.port}/v1" and s0.llm_api_key is None
        assert s["base_url"] == s0.llm_base_url
        h = c.get("/api/health").json()["llm"]
        assert h["base_url"] != "" and "reachable" in h
        r = call(c, "POST", "/api/llm/stop")
        assert r.status_code == 200 and r.json()["runtime"]["state"] == "stopped"


def test_wechsel_des_modells_nur_bei_angehaltener_simulation(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m1")
    with llm_api(tmp_path) as c:
        c.sim.runner.state = SimState.RUNNING
        assert call(c, "POST", "/api/llm/start", {"model_id": "m1"}).status_code == 409
        assert call(c, "POST", "/api/llm/stop").status_code == 409
        assert call(c, "POST", "/api/models/installed/m1/probe").status_code == 409
        c.sim.runner.state = SimState.STOPPED


def test_start_ohne_laufzeit_und_im_externen_modus(tmp_path):
    put_model(tmp_path, "m1")
    with llm_api(tmp_path) as c:
        r = call(c, "PUT", "/api/llm", {"mode": "builtin"})
        assert r.status_code == 200
        r = call(c, "POST", "/api/llm/start", {"model_id": "m1"})
        assert r.status_code == 409 and "Laufzeit" in r.json()["detail"]
        call(c, "PUT", "/api/llm", {"mode": "external", "external_url": "http://x/v1"})
        assert call(c, "POST", "/api/llm/start", {"model_id": "m1"}).status_code == 409


def test_absturz_beim_start_steht_im_zustand(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "kaputt", "crash")
    with llm_api(tmp_path) as c:
        call(c, "POST", "/api/llm/start", {"model_id": "kaputt"})
        s = wait_for(c, lambda s: s["runtime"]["state"] == "failed", "Start gescheitert")
        assert "Modell kaputt" in s["runtime"]["error"] and s["runtime"]["model_id"] == "kaputt"


def test_standardmodell_fuer_neue_simulationen(tmp_path):
    put_model(tmp_path, "m1")
    with llm_api(tmp_path) as c:
        assert call(c, "PUT", "/api/llm/default", {"model_id": "nein"}).status_code == 404
        s = call(c, "PUT", "/api/llm/default", {"model_id": "m1"}).json()
        assert s["default_model"] == "m1" and s["installed"][0]["is_default"] is True
        call(c, "DELETE", "/api/models/installed/m1?confirm=true")
        assert status(c)["default_model"] is None


# ---------- Probelauf ----------

def test_probelauf(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "gut")
    with llm_api(tmp_path) as c:
        assert call(c, "POST", "/api/models/installed/nein/probe").status_code == 404
        assert call(c, "POST", "/api/models/installed/gut/probe").status_code == 200
        s = wait_for(c, lambda s: s["probe"] and s["probe"]["phase"] in ("done", "failed"), "Probelauf fertig")
        p = s["probe"]
        assert p["phase"] == "done" and p["step"] == 10 and p["error"] is None
        assert p["result"]["valid"] == 10 and p["result"]["seal"] == "checked" and p["result"]["seal_label"] == "geprüft" and p["result"]["tokens_per_s"] == 42.0
        assert s["installed"][0]["probe"]["seal"] == "checked" and s["installed"][0]["running"] is True
        assert "Prozessor" in (p["result"]["hardware"] or "") or p["result"]["hardware"]
        assert (tmp_path / "models" / "probes.json").exists()


def test_probelauf_ungeeignet_und_loeschen_entfernt_das_siegel(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "schlecht", "bad")
    with llm_api(tmp_path) as c:
        call(c, "POST", "/api/models/installed/schlecht/probe")
        s = wait_for(c, lambda s: s["probe"] and s["probe"]["phase"] in ("done", "failed"), "fertig")
        assert s["probe"]["result"]["seal"] == "unfit" and s["probe"]["result"]["valid_pct"] == 50.0 and s["installed"][0]["probe"]["seal_label"] == "ungeeignet"
        call(c, "DELETE", "/api/models/installed/schlecht?confirm=true")
        assert not (tmp_path / "models" / "probes.json").read_text().strip("{} \n")


def test_probelauf_kehrt_zum_modell_der_simulation_zurueck(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "simmodell")
    put_model(tmp_path, "pruefling")
    with llm_api(tmp_path) as c:
        c.sim.settings.llm_model = "simmodell"
        call(c, "POST", "/api/llm/start", {"model_id": "simmodell"})
        wait_for(c, lambda s: s["runtime"]["state"] == "running", "läuft")
        call(c, "POST", "/api/models/installed/pruefling/probe")
        wait_for(c, lambda s: s["probe"] and s["probe"]["phase"] == "done", "geprüft")
        s = wait_for(c, lambda s: s["runtime"]["state"] == "running" and s["runtime"]["model_id"] == "simmodell", "Modell der Simulation läuft wieder")
        assert [m["running"] for m in s["installed"]] == [False, True] or s["runtime"]["model_id"] == "simmodell"


def test_probelauf_abbrechen(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m", "slow")
    with llm_api(tmp_path) as c:
        call(c, "POST", "/api/models/installed/m/probe")
        assert call(c, "DELETE", "/api/models/probe").status_code == 200
        s = wait_for(c, lambda s: s["probe"]["phase"] in ("cancelled", "done"), "beendet")
        assert s["probe"]["phase"] == "cancelled" and s["installed"][0]["probe"] is None


# ---------- Folgen für Zurücksetzen ----------

def test_zuruecksetzen_startet_das_gewaehlte_modell(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m1")
    put_model(tmp_path, "m2")
    with llm_api(tmp_path) as c:
        call(c, "PUT", "/api/llm", {"mode": "builtin"})
        call(c, "POST", "/api/llm/start", {"model_id": "m1"})
        wait_for(c, lambda s: s["runtime"]["model_id"] == "m1" and s["runtime"]["state"] == "running", "m1 läuft")
        r = call(c, "POST", "/api/sim/reset", {"confirm": True, "model": "m2"})
        assert r.status_code == 200, r.text
        s = status(c)
        assert s["runtime"]["model_id"] == "m2" and s["runtime"]["state"] == "running" and s["sim_model"] == "m2"


def test_zuruecksetzen_mit_unbekanntem_modell_aendert_nichts(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m1")
    with llm_api(tmp_path) as c:
        call(c, "PUT", "/api/llm", {"mode": "builtin"})
        minute = c.get("/api/state").json()["clock"]["minute"]
        r = call(c, "POST", "/api/sim/reset", {"confirm": True, "model": "gibt-es-nicht"})
        assert r.status_code == 422 and "nicht installiert" in r.json()["detail"]
        assert c.sim.settings.llm_model == "qwen3.8-9b-uncensored" and c.get("/api/state").json()["clock"]["minute"] == minute


def test_zuruecksetzen_im_externen_modus_wie_bisher(tmp_path):
    with llm_api(tmp_path) as c:
        r = call(c, "POST", "/api/sim/reset", {"confirm": True, "model": "irgendeins"})
        assert r.status_code == 200 and c.sim.settings.llm_model == "irgendeins"


def test_autostart_beim_start_des_servers(tmp_path):
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m1")
    (tmp_path / "llm.json").write_text('{"mode": "builtin", "last_model": "m1"}')
    with llm_api(tmp_path) as c:
        s = wait_for(c, lambda s: s["runtime"]["state"] == "running", "Autostart")
        assert s["runtime"]["model_id"] == "m1"


# ---------- WebSocket ----------

def test_websocket_meldet_den_fortschritt(tmp_path):
    hub = FakeHub()
    hub.add(REPO, FILE, os.urandom(2_000_000))
    with llm_api(tmp_path, hub) as c:
        with c.websocket_connect("/ws") as ws:
            ws.send_json({"type": "hello", "last_seq": None})
            assert ws.receive_json()["type"] == "snapshot"
            call(c, "POST", "/api/models/downloads", {"repo": REPO, "file": FILE, "confirm": True})
            phases = []
            for _ in range(400):
                m = ws.receive_json()
                if m["type"] != "models":
                    continue
                t = m["status"]["transfer"]
                phases.append(t["phase"] if t else None)
                if t and t["phase"] == "done":
                    assert m["status"]["installed"][0]["id"] == MID
                    break
            assert "downloading" in phases or "verifying" in phases
            assert phases[-1] == "done"


# ---------- Endpunkt des Clients ----------

def test_client_der_simulation_bekommt_die_neue_adresse_und_ohne_schluessel(tmp_path):
    from on_their_own.config import Settings
    from on_their_own.llm.providers import OpenAICompatProvider
    from on_their_own.simulation.builder import Simulation
    install_fake_runtime(tmp_path)
    put_model(tmp_path, "m1")
    s = Settings(data_dir=tmp_path, llm_api_key_value="alter-schluessel", llm_api_key_file="/nonexistent")
    sim = Simulation.create(s, ":memory:", OpenAICompatProvider("http://alt:8080/v1", "alter-schluessel"))
    app = create_app(sim, settings=s)
    with TestClient(app) as c:
        c.sim = sim
        assert sim.client.provider._headers == {"Authorization": "Bearer alter-schluessel"}
        call(c, "PUT", "/api/llm", {"mode": "builtin"})
        call(c, "POST", "/api/llm/start", {"model_id": "m1"})
        wait_for(c, lambda st: st["runtime"]["state"] == "running", "läuft")
        assert sim.client.provider.base_url == s.llm_base_url and sim.client.provider.base_url.startswith("http://127.0.0.1:") and sim.client.provider._headers == {}
        call(c, "PUT", "/api/llm", {"mode": "external", "external_url": "http://neu:1/v1", "external_key": "neuer"})
        assert sim.client.provider.base_url == "http://neu:1/v1" and sim.client.provider._headers == {"Authorization": "Bearer neuer"}
        assert status(c)["runtime"]["state"] == "stopped", "beim Wechsel auf den externen Server wird das eingebaute Modell beendet"
        assert LLMClientFromSettings(s).provider.base_url == "http://neu:1/v1", "auch eine neu angelegte Simulation nutzt die gewählte Adresse"
    sim.close()


def LLMClientFromSettings(s):
    from on_their_own.llm.client import LLMClient
    return LLMClient.from_settings(s)
