"""API: GET /api/hardware und GET /api/models/catalog (Antwortform, Parameter, Fehler, Netzausfall)."""

from api.conftest import api

from on_their_own.models.hardware import Hardware

from .conftest import FakeHF, machine


def with_models(client, tmp_path, hf=None, hw=None):
    client.app.state.settings = client.app.state.settings.model_copy(update={"data_dir": tmp_path})
    client.app.state.hf_transport = (hf or FakeHF()).transport
    client.app.state.hardware_probe = lambda data_dir: hw or machine()


def test_hardware(tmp_path):
    with api() as client:
        with_models(client, tmp_path)
        r = client.get("/api/hardware")
        assert r.status_code == 200
        d = r.json()
        assert d["kind"] == "metal" and d["name"] == "Apple M1" and d["usable_mb"] == 10922 and d["bandwidth_gbs"] == 68.0 and d["bandwidth_known"] is True
        assert d["summary"].startswith("Apple M1, 16 GB gemeinsamer Speicher") and d["gpu_names"] == ["Apple M1"] and d["cuda_version"] is None


def test_hardware_belegte_karte(tmp_path):
    busy = Hardware("nvidia", "NVIDIA GeForce RTX 3060", 12288, 749, 15889, 90_000, "linux", "x64", cuda_version="13.2", gpu_count=1, gpu_names=["NVIDIA GeForce RTX 3060"])
    with api() as client:
        with_models(client, tmp_path, hw=busy)
        d = client.get("/api/hardware").json()
        assert d["vram_mb"] == 12288 and d["vram_free_mb"] == 749 and d["usable_mb"] == 711 and d["cuda_version"] == "13.2"


def test_hardware_echte_erkennung_liefert_eine_antwort():
    with api() as client:
        d = client.get("/api/hardware").json()
        assert d["kind"] in ("nvidia", "metal", "amd", "vulkan", "cpu") and d["ram_mb"] > 0 and d["free_disk_mb"] > 0


def test_katalog_antwortform_und_empfehlung(tmp_path):
    with api() as client:
        with_models(client, tmp_path)
        r = client.get("/api/models/catalog")
        assert r.status_code == 200
        d = r.json()
        assert set(d) == {"hardware", "source", "fetched_at", "note", "hidden", "total", "recommended", "items"}
        assert d["source"] == "live" and d["fetched_at"].endswith("Z") and d["note"] is None and d["hardware"]["kind"] == "metal"
        top = d["recommended"][0]
        assert top["repo"] == "Qwen/Qwen3-8B-GGUF" and top["source"] == "curated" and top["curated_key"] == "qwen3-8b" and top["license"] == "Apache-2.0"
        assert top["file"]["file"] == "Qwen3-8B-Q4_K_M.gguf" and top["file"]["fit"]["level"] == "good" and top["file"]["fit"]["label"] == "passt gut"
        assert top["file"]["estimate"]["is_estimate"] is True and top["file"]["estimate"]["seconds_per_decision"] > 0
        assert len(top["file"]["sha256"]) == 64 and top["url"] == "https://huggingface.co/Qwen/Qwen3-8B-GGUF" and top["downloadable"] is True
        assert [v["quant"] for v in top["variants"]][0] == "Q4_K_M" and len(top["variants"]) == 5
        assert d["items"][0]["repo"] == top["repo"] and d["total"] >= len(d["items"])
        assert d["hidden"]["Vision-Modell"] > 0


def test_katalog_parameter(tmp_path):
    with api() as client:
        with_models(client, tmp_path)
        fit = client.get("/api/models/catalog", params={"only_fit": "true"}).json()
        assert fit["items"] and all(i["file"]["fit"]["level"] != "no" for i in fit["items"])
        q = client.get("/api/models/catalog", params={"q": "gemma"}).json()
        assert q["items"] and all("gemma" in (i["name"] + i["repo"]).lower() for i in q["items"]) and q["recommended"][0]["repo"] == "Qwen/Qwen3-8B-GGUF"
        assert len(client.get("/api/models/catalog", params={"limit": 2}).json()["items"]) == 2
        allp = client.get("/api/models/catalog", params={"publishers": "all"}).json()
        gated = [i for i in allp["items"] if i["gated"]]
        assert gated and not gated[0]["downloadable"] and gated[0]["file"]["sha256"] is None
        assert client.get("/api/models/catalog", params={"refresh": "true"}).status_code == 200


def test_katalog_falsche_parameter(tmp_path):
    with api() as client:
        with_models(client, tmp_path)
        for params in ({"publishers": "jeder"}, {"limit": 0}, {"limit": 500}, {"q": "x" * 81}, {"only_fit": "vielleicht"}):
            assert client.get("/api/models/catalog", params=params).status_code == 422, params


def test_katalog_ohne_netz_liefert_die_kuratierte_liste(tmp_path):
    with api() as client:
        with_models(client, tmp_path, hf=FakeHF(offline=True))
        r = client.get("/api/models/catalog")
        assert r.status_code == 200                                     # Netzfehler sind kein Serverfehler
        d = r.json()
        assert d["source"] == "curated" and "kuratierte Liste" in d["note"] and d["fetched_at"] is None
        assert [i["curated_key"] for i in d["items"]] == ["qwen3-8b", "qwen3-4b", "qwen3-14b"] and d["recommended"][0]["curated_key"] == "qwen3-8b"
        assert d["recommended"][0]["file"]["sha256"] is None


def test_zugangsschutz_gilt_auch_hier(tmp_path):
    from agents.conftest import make_sim
    sim = make_sim(access_token="geheim")
    with api(sim) as client:
        assert client.get("/api/hardware").status_code == 401 and client.get("/api/models/catalog").status_code == 401
