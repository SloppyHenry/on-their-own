"""Weltenbibliothek und Werkstatt (AP18e): Welten sind eigene Dateien, getrennt von Spielständen; leere Welt, erzeugen, speichern, kopieren, Export/Import byte-gleich."""

import json

import pytest

from simulacra.world import loader
from tests.conftest import START_WORLD
from tests.saves.conftest import file_sim

from .conftest import api, post
from .test_newsim import apply, spec


@pytest.fixture
def c(monkeypatch, tmp_path):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = file_sim(tmp_path / "live.db")
    with api(sim) as client:
        client.tmp = tmp_path
        yield client


def ids(c):
    return [w["id"] for w in c.get("/api/worlds").json()]


def test_mitgelieferte_welten_sind_da_und_geschuetzt(c):
    ws = {w["id"]: w for w in c.get("/api/worlds").json()}
    assert "dorf-am-see" in ws and ws["dorf-am-see"]["readonly"] and ws["dorf-am-see"]["origin"] == "mitgeliefert"
    assert c.delete("/api/worlds/dorf-am-see").status_code == 403
    assert c.patch("/api/worlds/dorf-am-see", json={"name": "x"}).status_code == 403
    assert c.put("/api/worlds/dorf-am-see", json={"world": c.get("/api/worlds/dorf-am-see").json()["world"]}).status_code == 403


def test_leere_welt_anlegen_speichern_kopieren_umbenennen_loeschen(c):
    r = c.post("/api/worlds/blank", json={"name": "Meine Wiese", "size": "klein", "edge": "wald"})
    assert r.status_code == 200, r.text
    info = r.json()
    assert info["origin"] == "leer" and info["size"] == [48, 32] and not info["startplatz"] and info["houses"] == 0
    wid = info["id"]
    doc = c.get(f"/api/worlds/{wid}").json()
    world = doc["world"]
    world["startplatz"] = [24, 16]
    assert c.put(f"/api/worlds/{wid}", json={"world": world}).json()["startplatz"] is True
    dup = c.post(f"/api/worlds/{wid}/duplicate").json()
    assert dup["origin"] == "kopie" and dup["name"].endswith("(Kopie)") and dup["id"] != wid
    assert c.patch(f"/api/worlds/{dup['id']}", json={"name": "Zweite"}).json()["name"] == "Zweite"
    assert c.delete(f"/api/worlds/{dup['id']}").status_code == 204
    assert dup["id"] not in ids(c) and wid in ids(c)
    assert c.get("/api/worlds/gibt-es-nicht").status_code == 404


def test_speichern_als_legt_eine_kopie_unter_neuem_namen_an(c):
    wid = c.post("/api/worlds/blank", json={"name": "Vorlage", "size": "klein"}).json()["id"]
    world = c.get(f"/api/worlds/{wid}").json()["world"]
    r = c.post("/api/worlds", json={"world": world, "name": "Mit anderem Namen"})
    assert r.status_code == 200 and r.json()["origin"] == "kopie" and r.json()["name"] == "Mit anderem Namen"
    assert c.post("/api/worlds", json={"world": {"name": "x"}, "name": "kaputt"}).status_code == 422


def test_export_und_import_sind_byte_gleich(c):
    wid = c.post("/api/worlds/blank", json={"name": "Export", "size": "klein", "edge": "offen"}).json()["id"]
    raw = c.get(f"/api/worlds/{wid}/export").content
    imp = c.post("/api/worlds/import", content=raw)
    assert imp.status_code == 200 and imp.json()["origin"] == "import" and imp.json()["id"] != wid
    assert c.get(f"/api/worlds/{imp.json()['id']}/export").content == raw
    assert c.post("/api/worlds/import", content=b"das ist kein json").status_code == 422
    assert c.post("/api/worlds/import", content=json.dumps({"name": "x"}).encode()).status_code == 422


def test_erzeugte_welt_ist_deterministisch_und_hat_keine_bewohner(c):
    a = c.post("/api/worlds/generate", json={"seed": 7}).json()
    b = c.post("/api/worlds/generate", json={"seed": 7}).json()
    assert a["origin"] == "erzeugt" and a["seed"] is not None and a["houses"] >= 1
    wa, wb = (c.get(f"/api/worlds/{x['id']}").json()["world"] for x in (a, b))
    assert wa["agents"] == [] and wa["tiles"] == wb["tiles"] and wa["look"] == wb["look"]


def test_vorschau_der_werkstatt_aendert_die_laufende_welt_nicht(c):
    wid = c.post("/api/worlds/blank", json={"name": "Vorschau", "size": "klein"}).json()["id"]
    world = c.get(f"/api/worlds/{wid}").json()["world"]
    before = c.get("/api/state").json()["map"]["width"]
    r = c.post("/api/worlds/preview", json={"world": world})
    assert r.status_code == 200 and r.json()["snapshot"]["map"]["width"] == 48
    assert c.get("/api/state").json()["map"]["width"] == before
    assert c.post("/api/worlds/preview", json={"world": {"name": "kaputt"}}).status_code == 422


def test_gebiet_erzeugen_fuegt_ein_dorf_an_die_welt(c):
    wid = c.post("/api/worlds/blank", json={"name": "Gebiet", "size": "klein"}).json()["id"]
    world = c.get(f"/api/worlds/{wid}").json()["world"]
    r = c.post("/api/worlds/add-area", json={"world": world, "seed": 5, "at": [6, 4]})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ok"] and out["village"] and len(out["world"]["objects"]) > 0 and out["world"]["tiles"] != world["tiles"]
    again = c.post("/api/worlds/add-area", json={"world": out["world"], "seed": 6, "at": [6, 4]}).json()      # besetzte Fläche: abgelehnt, nichts geändert
    assert not again["ok"] and "nicht genug freie Fläche" in again["error"]


def test_welt_aus_der_laufenden_simulation_sichern_ohne_bewohner(c):
    r = c.post("/api/worlds/from-sim", json={"name": "Gesichert"})
    assert r.status_code == 200 and r.json()["origin"] == "spiel"
    assert c.get(f"/api/worlds/{r.json()['id']}").json()["world"]["agents"] == []


def test_neue_simulation_aus_der_bibliothek_kopiert_die_welt_und_laesst_sie_unveraendert(c):
    wid = c.post("/api/worlds/generate", json={"seed": 3, "name": "Bib"}).json()["id"]
    before = c.get(f"/api/worlds/{wid}/export").content
    body = spec(2)
    body["world"] = {"kind": "library", "library_id": wid}
    r, _ = apply(c, body)
    assert r.status_code == 200, r.text
    assert c.get(f"/api/worlds/{wid}/export").content == before
    st = c.get("/api/state").json()
    assert len(st["agents"]) == 2 and st["simulation"]


def test_leere_welt_ohne_startplatz_startet_mit_hinweis(c):
    wid = c.post("/api/worlds/blank", json={"name": "Ohne", "size": "klein"}).json()["id"]
    body = spec(2)
    body["world"] = {"kind": "library", "library_id": wid}
    r = post(c, "/api/sim/new/preview", body)
    assert r.status_code == 200 and any("Startplatz" in w for w in r.json().get("warnings", []))


def test_erzeugen_mit_stellgroessen_ist_gleich_bei_gleichen_werten_und_lehnt_ungueltiges_ab(c):
    style = {"form": "haufen", "seen": 2, "wasser": "fluss", "wald": "dicht", "gaerten": 2}
    a = c.post("/api/worlds/generate", json={"seed": 4, "style": style})
    b = c.post("/api/worlds/generate", json={"seed": 4, "style": style})
    assert a.status_code == 200 and b.status_code == 200, a.text
    assert c.get(f"/api/worlds/{a.json()['id']}").json()["world"]["tiles"] == c.get(f"/api/worlds/{b.json()['id']}").json()["world"]["tiles"]
    assert c.get(f"/api/worlds/{a.json()['id']}").json()["world"]["generator"]["stil"]["form"] == "haufen"
    assert c.post("/api/worlds/generate", json={"seed": 4, "style": {"form": "stadt"}}).status_code == 422
    assert c.post("/api/worlds/generate", json={"seed": 4, "style": {"seen": 9}}).status_code == 422


def test_neue_simulation_mit_stellgroessen_und_vorschau_des_generators(c):
    body = spec(2)
    body["world"] = {"kind": "generated", "seed": 5, "style": {"form": "beidseitig", "seen": 0}}
    r, p = apply(c, body)
    assert r.status_code == 200, r.text
    assert c.get("/api/state").json()["look"]["regions"][0]["shapes"]["lakes"] == []
    pv = post(c, "/api/world/generate", {"kind": "new", "seed": 6, "style": {"wasser": "keiner", "felder": 1}}, key=None)
    assert pv.status_code == 200 and pv.json()["ok"], pv.text
    assert post(c, "/api/world/generate", {"kind": "new", "seed": 6, "style": {"wege": "kurvig"}}, key=None).status_code == 422
