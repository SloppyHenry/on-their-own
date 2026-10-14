"""Weltgenerator über die API (AP12c): Vorschau ändert nichts, Übernehmen braucht Bestätigung und die Prüfsumme der Vorschau, sichert vorher und ist idempotent."""

import pytest

from simulacra.world import loader
from tests.saves.conftest import file_sim

from .conftest import api, post
from tests.conftest import START_WORLD


@pytest.fixture
def start(monkeypatch, tmp_path):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = file_sim(tmp_path / "live.db")
    with api(sim) as c:
        yield c


def state(c):
    s = c.get("/api/state").json()
    return {"locations": len(s["locations"]), "objects": len(s["objects"]), "size": (s["map"]["width"], s["map"]["height"]), "seq": s["seq"],
            "regions": len(s["look"]["regions"]), "name": s["world_name"]}


def test_vorschau_aendert_nichts_und_ist_gleich_bei_gleichem_wunsch(start):
    before = state(start)
    r = post(start, "/api/world/generate", {"kind": "extend", "seed": 5}, key=None)           # Vorschau braucht keinen Idempotency-Key
    assert r.status_code == 200
    p = r.json()
    assert p["ok"] and p["report"]["ok"] and p["error"] is None and p["digest"] and p["village"] and p["focus"] and p["region"] == "v2"
    assert state(start) == before                                                              # Trockenlauf zurückgerollt: auch kein neues Ereignis
    snap = p["snapshot"]
    assert len(snap["locations"]) > before["locations"] and len(snap["look"]["regions"]) == 2 and snap["map"]["height"] > before["size"][1]
    assert post(start, "/api/world/generate", {"kind": "extend", "seed": 5}, key=None).json()["digest"] == p["digest"]
    assert post(start, "/api/world/generate", {"kind": "extend", "seed": 6}, key=None).json()["digest"] != p["digest"]
    assert start.sim.engine.edit.applied_patches() == []


def test_wunsch_wird_geprueft(start):
    assert post(start, "/api/world/generate", {"mix": {"house": 0}}, key=None).status_code == 422
    assert post(start, "/api/world/generate", {"mix": {"turm": 2}}, key=None).status_code == 422
    assert post(start, "/api/world/generate", {"mix": {"house": 6, "shop": 6}}, key=None).status_code == 422
    assert post(start, "/api/world/generate", {"lake": "mitte"}, key=None).status_code == 422
    assert post(start, "/api/world/generate", {"seed": -3}, key=None).status_code == 422
    ok = post(start, "/api/world/generate", {"seed": 2, "lake": "south", "mix": {"house": 2, "shop": 1}}, key=None).json()
    assert ok["ok"] and ok["counts"]["locations"] > 0


def test_uebernehmen_braucht_bestaetigung_und_passende_vorschau(start):
    p = post(start, "/api/world/generate", {"seed": 5}, key=None).json()
    assert post(start, "/api/world/generate/apply", {"seed": 5, "digest": p["digest"]}).status_code == 400
    assert post(start, "/api/world/generate/apply", {"seed": 5, "digest": "0" * 16, "confirm": True}).status_code == 409
    assert post(start, "/api/world/generate/apply", {"seed": 5, "digest": p["digest"], "confirm": True}, key=None).status_code == 400          # ohne Idempotency-Key
    assert state(start)["regions"] == 1


def test_uebernehmen_sichert_wendet_an_und_ist_idempotent(start):
    p = post(start, "/api/world/generate", {"seed": 5}, key=None).json()
    body = {"kind": "extend", "seed": 5, "digest": p["digest"], "confirm": True}
    r = post(start, "/api/world/generate/apply", body, key="schluessel-0001")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["village"] == p["village"] and out["backup"].startswith("Vor dem Erweitern") and out["counts"]["locations"] > 0 and out["focus"] == p["focus"]
    now = state(start)
    assert now["regions"] == 2 and now["locations"] == len(p["snapshot"]["locations"]) and now["size"] == (p["snapshot"]["map"]["width"], p["snapshot"]["map"]["height"])
    assert any(s["name"].startswith("Vor dem Erweitern") for s in start.get("/api/saves").json())
    ev = start.get("/api/events", params={"type": "world.generated"}).json()["items"]
    assert len(ev) == 1 and ev[0]["data"]["village"] == p["village"] and ev[0]["data"]["kind"] == "extend" and ev[0]["data"]["summary"]["locations"] > 0
    again = post(start, "/api/world/generate/apply", body, key="schluessel-0001")                # dieselbe Anfrage: gleiche Antwort, nichts doppelt
    assert again.headers.get("Idempotent-Replay") == "true" and again.json() == out and state(start)["regions"] == 2
    stale = post(start, "/api/world/generate/apply", body, key="schluessel-0002")                # neue Anfrage mit alter Vorschau: Welt hat sich geändert
    assert stale.status_code == 409 and state(start)["regions"] == 2


def test_neue_simulation_vorschau_und_anlegen(start):
    before = state(start)
    p = post(start, "/api/world/generate", {"kind": "new", "seed": 7}, key=None).json()
    assert p["ok"] and p["report"]["ok"] and p["snapshot"]["world_name"].startswith("Dorf ") and p["snapshot"]["world_name"] != before["name"]
    assert state(start) == before
    r = post(start, "/api/world/generate/apply", {"kind": "new", "seed": 7, "digest": p["digest"], "confirm": True})
    assert r.status_code == 200, r.text
    assert r.json()["backup"] and state(start)["name"] == p["snapshot"]["world_name"]
    assert any(s["name"].startswith("Vor der neuen Simulation") for s in start.get("/api/saves").json())
    ev = start.get("/api/events", params={"type": "world.generated"}).json()["items"]
    assert ev and ev[-1]["data"]["kind"] == "new"
    assert {a["id"] for a in start.get("/api/state").json()["agents"]} == {"alex", "mira"}


def test_trockenlauf_beliebiger_patches(start):
    """Auch eine Einzeländerung bekommt ihre Vorschau; Fehler der Engine werden gemeldet, die Welt bleibt unverändert."""
    before = state(start)
    bad = post(start, "/api/world/patch/preview", {"patch": {"id": "kaputt", "locations": [{"id": "weit_weg", "name": "Weit weg", "rect": [9999, 9999, 3, 3], "entrances": []}]}}, key=None).json()
    assert not bad["ok"] and "out_of_bounds" in bad["error"] and bad["snapshot"] is None
    good = post(start, "/api/world/patch/preview", {"patch": {"id": "bank", "objects": [{"kind": "bench", "name": "Neue Bank", "location_id": "square"}]}}, key=None).json()
    assert good["ok"] and good["counts"]["objects"] == 1 and any(o["name"] == "Neue Bank" for o in good["snapshot"]["objects"])
    assert state(start) == before and start.sim.engine.edit.applied_patches() == []
