"""Presets: sechs mitgelieferte (laden, vergleichen), eigene speichern, duplizieren, umbenennen, löschen."""

import json
import uuid

import pytest
from api.conftest import api, post

from on_their_own.params.presets import DIR

BUILTIN = ["freie-exploration", "soziale-entwicklung", "kooperative-gemeinschaft", "ressourcenknappheit", "hohe-autonomie", "experimentelle-konfiguration"]


def load(c, pid):
    return post(c, f"/api/presets/{pid}/load", {"confirm": True})


def test_six_builtin_presets_exist_and_are_read_only():
    assert sorted(p.stem for p in DIR.glob("*.json")) == sorted(BUILTIN)
    with api() as c:
        lst = c.get("/api/presets").json()
        assert [p["id"] for p in lst if p["builtin"]] == sorted(BUILTIN) and all(p["count"] > 3 and p["description"] for p in lst)
        assert post(c, "/api/presets/freie-exploration/duplicate", {"name": "Freie Exploration"}).status_code == 409        # Namen sind eindeutig
        assert c.patch("/api/presets/freie-exploration", json={"name": "Neu"}, headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 409
        assert c.delete("/api/presets/freie-exploration?confirm=true", headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 409


@pytest.mark.parametrize("pid", BUILTIN)
def test_every_builtin_preset_loads_without_a_single_rejection_and_reaches_the_consumers(pid):
    with api() as c:
        data = json.loads((DIR / f"{pid}.json").read_text())["values"]
        prev = c.get(f"/api/presets/{pid}/preview").json()
        assert prev["diff"], "ein Preset ohne Unterschied zum Standard wäre wirkungslos"
        r = load(c, pid)
        assert r.status_code == 200
        res = r.json()
        assert [x for x in res["results"] if x["status"] == "rejected"] == []
        values = c.get("/api/params").json()["values"]
        for key, want in data.items():                                                       # der Wert steht jetzt beim Verbraucher
            assert values[key] == want, key
        assert c.get(f"/api/presets/{pid}/preview").json()["diff"] == []                     # danach gibt es keinen Unterschied mehr
        assert [x for x in post(c, "/api/params/reset").json()["results"] if x["status"] == "rejected"] == []


def test_loading_needs_confirmation_and_the_preview_shows_old_and_new():
    with api() as c:
        assert post(c, "/api/presets/ressourcenknappheit/load", {}).status_code == 400
        assert c.get("/api/params").json()["values"]["world.scarcity"] == 0
        diff = {(d["key"], d["agent"]): d for d in c.get("/api/presets/ressourcenknappheit/preview").json()["diff"]}
        assert diff[("world.scarcity", None)]["old"] == 0 and diff[("world.scarcity", None)]["new"] == 70 and diff[("world.scarcity", None)]["label"]
        assert c.get("/api/presets/gibt-es-nicht").status_code == 404


def test_custom_presets_save_load_duplicate_rename_delete():
    with api() as c:
        c.patch("/api/params", json={"changes": [{"key": "world.scarcity", "value": 30}, {"key": "exploration", "value": 85}, {"key": "memory.w_shared", "value": 0.9},
                                                  {"key": "personality.curiosity", "value": 99, "agent": "mira"}]}, headers={"Idempotency-Key": str(uuid.uuid4())})
        saved = post(c, "/api/presets", {"name": "Mein Lauf", "description": "Test"}).json()
        assert not saved["builtin"] and saved["data"]["world.scarcity"] == 30 and saved["data"]["personality.curiosity"]["mira"] == 99
        assert "llm.base_url" not in saved["data"] and "llm.model" not in saved["data"]              # Maschinenabhängiges gehört nicht in ein Preset
        assert post(c, "/api/presets", {"name": "mein lauf"}).status_code == 409                    # eindeutig, ohne Rücksicht auf Groß-/Kleinschreibung
        assert post(c, "/api/presets", {"name": "  "}).status_code == 422
        post(c, "/api/params/reset")
        assert c.get("/api/params").json()["values"]["exploration"] == 50
        assert load(c, saved["id"]).status_code == 200
        v = c.get("/api/params").json()["values"]
        assert (v["world.scarcity"], v["exploration"], v["personality.curiosity"]["mira"]) == (30, 85, 99)
        copy = post(c, f"/api/presets/{saved['id']}/duplicate").json()
        assert copy["name"] == "Mein Lauf (Kopie)" and copy["data"] == saved["data"]
        renamed = c.patch(f"/api/presets/{copy['id']}", json={"name": "Kopie 2"}, headers={"Idempotency-Key": str(uuid.uuid4())}).json()
        assert renamed["name"] == "Kopie 2"
        assert c.delete(f"/api/presets/{copy['id']}", headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 400          # Bestätigung fehlt
        assert c.delete(f"/api/presets/{copy['id']}?confirm=true", headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 200
        assert [p["name"] for p in c.get("/api/presets").json() if not p["builtin"]] == ["Mein Lauf"]


def test_saving_only_selected_groups():
    with api() as c:
        c.patch("/api/params", json={"changes": [{"key": "world.scarcity", "value": 30}, {"key": "exploration", "value": 85}]}, headers={"Idempotency-Key": str(uuid.uuid4())})
        p = post(c, "/api/presets", {"name": "Nur Welt", "groups": ["world"]}).json()
        assert "world.scarcity" in p["data"] and "exploration" not in p["data"] and "memory.w_shared" not in p["data"]
        post(c, "/api/params/reset")
        load(c, p["id"])
        v = c.get("/api/params").json()["values"]
        assert v["world.scarcity"] == 30 and v["exploration"] == 50


def test_custom_presets_survive_a_restart_and_unknown_keys_are_skipped(tmp_path):
    from on_their_own.config import Settings
    from on_their_own.simulation.builder import Simulation
    s = Settings(llm_api_key_file="/nonexistent")
    sim = Simulation.create(s, tmp_path / "x.db")
    sim.store.ensure_all()
    p = sim.presets.save("Alt", "", data={"world.scarcity": 20, "gibt.es.nicht": 1, "personality.curiosity": {"alex": 60, "geist": 5}})
    sim.close()
    sim = Simulation.create(s, tmp_path / "x.db")
    sim.store.ensure_all()
    assert sim.presets.get(p["id"])["name"] == "Alt"
    assert {(c["key"], c["agent"]) for c in sim.presets.changes(p["id"])} == {("world.scarcity", None), ("personality.curiosity", "alex")}
    sim.close()
