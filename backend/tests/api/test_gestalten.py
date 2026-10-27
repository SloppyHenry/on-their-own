"""Gestalten über die API (AP16a): Entwurf im Spiel (Vorschau ändert nichts, Übernehmen mit Bestätigung, Prüfsumme, Sicherung, Idempotenz, nur Gott) und in der Werkstatt (zustandslos)."""

import copy
import time

import pytest

from on_their_own.config import Settings
from on_their_own.llm.providers import FakeProvider
from on_their_own.generator.blank import blank_world
from on_their_own.generator.generate import new_world
from on_their_own.simulation.builder import Simulation
from on_their_own.world import loader
from tests.conftest import START_WORLD
from agents.conftest import with_goals
from tests.saves.conftest import wait_one_minute

from .conftest import api, post
from .test_spielart import to


@pytest.fixture
def c(monkeypatch, tmp_path):
    """Ein erzeugtes Dorf (Seed 7) als laufende Welt: groß genug für ein paar freie Wiesenstücke."""
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = Simulation.create(Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0), tmp_path / "live.db", FakeProvider(fn=with_goals(wait_one_minute)), world=new_world(7)[0])
    sim.store.ensure_all()
    with api(sim) as client:
        yield client


def frei(c, n=3):
    """Ein paar Wiesenkacheln ohne Ding, Figur und Weg, die weit auseinander liegen."""
    s = c.get("/api/state").json()
    rows = s["map"]["rows"]
    belegt = {(o["x"], o["y"]) for o in s["objects"].values()} if isinstance(s["objects"], dict) else {(o["x"], o["y"]) for o in s["objects"]}
    belegt |= {(a["x"], a["y"]) for a in s["agents"]}
    out = []
    for y in range(3, len(rows) - 3):
        for x in range(3, len(rows[0]) - 3):
            if all(rows[y + dy][x + dx] == "." and (x + dx, y + dy) not in belegt for dx in range(-2, 3) for dy in range(-2, 3)) and all(abs(x - a) + abs(y - b) > 5 for a, b in out):
                out.append((x, y))
                if len(out) == n:
                    return out
    raise AssertionError("keine freien Kacheln")


def zustand(c):
    s = c.get("/api/state").json()
    return {"rows": s["map"]["rows"], "objects": len(s["objects"]), "seq": s["seq"], "look": s["look"]}


def test_vorschau_aendert_nichts(c):
    (a, b, d) = frei(c)
    vor = zustand(c)
    r = post(c, "/api/world/draft/preview", {"actions": [{"art": "deko", "sorte": "baum", "tile": list(a)}, {"art": "deko", "sorte": "bank", "tile": list(b)}]}, key=None)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["ok"] and p["digest"] and all(s["ok"] for s in p["stati"]) and p["fehler"] == 0
    assert p["snapshot"]["map"]["rows"][a[1]][a[0]] == "T" and len(p["snapshot"]["objects"]) == vor["objects"] + 1
    assert zustand(c) == vor and c.sim.engine.edit.applied_patches() == []
    assert post(c, "/api/world/draft/preview", {"actions": [{"art": "deko", "sorte": "baum", "tile": list(a)}, {"art": "deko", "sorte": "bank", "tile": list(b)}]}, key=None).json()["digest"] == p["digest"]


def test_abgelehnte_aktion_wird_gemeldet(c):
    s = c.get("/api/state").json()
    figur = (s["agents"][0]["x"], s["agents"][0]["y"])
    r = post(c, "/api/world/draft/preview", {"actions": [{"art": "see", "mitte": list(figur), "rx": 2}, {"art": "zauber"}]}, key=None).json()
    assert not r["ok"] and not r["stati"][0]["ok"] and r["stati"][0]["grund"] and r["stati"][1]["grund"].startswith("Unbekannte")


def test_uebernehmen(c):
    (a, b, d) = frei(c)
    akt = [{"art": "deko", "sorte": "baum", "tile": list(a)}, {"art": "weg", "punkte": [list(b), [b[0] + 2, b[1]]]}, {"art": "garten", "rechteck": [d[0] - 1, d[1] - 1, 3, 3]}]
    p = post(c, "/api/world/draft/preview", {"actions": akt}, key=None).json()
    assert p["ok"], p
    assert post(c, "/api/world/draft/apply", {"actions": akt, "digest": p["digest"]}).status_code == 400
    assert post(c, "/api/world/draft/apply", {"actions": akt, "digest": "0" * 16, "confirm": True}).status_code == 409
    assert post(c, "/api/world/draft/apply", {"actions": akt, "digest": p["digest"], "confirm": True}, key=None).status_code == 400
    body = {"actions": akt, "digest": p["digest"], "confirm": True}
    r = post(c, "/api/world/draft/apply", body, key="schluessel-0001")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["backup"].startswith("Vor dem Gestalten") and out["actions"] == 3 and out["counts"]["tiles"] > 0
    nach = zustand(c)
    assert nach["rows"] == p["snapshot"]["map"]["rows"] and nach["look"] == p["snapshot"]["look"]
    assert any(s["name"].startswith("Vor dem Gestalten") for s in c.get("/api/saves").json())
    ev = c.get("/api/events", params={"type": "world.edited"}).json()["items"]
    assert len(ev) == 1 and ev[0]["data"]["actions"] == 3 and ev[0]["visibility"] == "system"
    again = post(c, "/api/world/draft/apply", body, key="schluessel-0001")
    assert again.headers.get("Idempotent-Replay") == "true" and again.json() == out
    assert post(c, "/api/world/draft/apply", body, key="schluessel-0002").status_code == 409                    # dieselbe Vorschau, aber die Welt ist schon anders


def test_loeschen_ist_ein_patch_und_eine_antwort_mit_ereignissen(c):
    """Weg ziehen, übernehmen, wieder löschen: die Engine entfernt Formen aus der Gestaltung (`world.look_edited`) und der Ereignisstrom bleibt gültig."""
    (a, b, d) = frei(c)
    akt = [{"art": "weg", "punkte": [list(a), [a[0] + 2, a[1]]]}]
    p = post(c, "/api/world/draft/preview", {"actions": akt}, key=None).json()
    assert post(c, "/api/world/draft/apply", {"actions": akt, "digest": p["digest"], "confirm": True}).status_code == 200
    akt2 = [{"art": "loeschen", "tile": [a[0] + 1, a[1]]}]
    p2 = post(c, "/api/world/draft/preview", {"actions": akt2}, key=None).json()
    assert p2["ok"], p2
    assert post(c, "/api/world/draft/apply", {"actions": akt2, "digest": p2["digest"], "confirm": True}).status_code == 200
    assert zustand(c)["rows"][a[1]][a[0] + 1] == "."
    edits = c.get("/api/events", params={"type": "world.look_edited"}).json()["items"]
    assert [o["op"] for e in edits for o in e["data"]["ops"]] == ["add", "remove"]


def test_nur_in_der_spielart_gott(c):
    assert to(c, "leben").status_code == 200
    (a, b, d) = frei(c)
    akt = {"actions": [{"art": "deko", "sorte": "baum", "tile": list(a)}]}
    assert post(c, "/api/world/draft/preview", akt, key=None).status_code == 403
    assert post(c, "/api/world/draft/apply", {**akt, "digest": "x", "confirm": True}).status_code == 403


def test_katalog(c):
    k = c.get("/api/gestalten/katalog").json()
    assert {d["sorte"] for d in k["deko"]} >= {"baum", "bank", "laterne"} and k["karte"]["max"] == 256 and {h["gebaeude"] for h in k["haeuser"]} == {"house", "shop", "workshop", "barn", "stable"}


# --- Werkstatt -------------------------------------------------------------------------------------------------------

def test_werkstatt_zustandslos(c):
    w = blank_world("W", "mittel", "wald")
    vor = copy.deepcopy(w)
    akt = [{"art": "weg", "punkte": [[5, 10], [12, 10]]}, {"art": "haus", "gebaeude": "house", "tuer": [20, 20]}, {"art": "startplatz", "tile": [4, 4]}]
    r = post(c, "/api/worlds/draft", {"world": w, "actions": akt}, key=None)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ok"] and out["spielbar"] and out["world"]["startplatz"] == [4, 4] and out["world"]["tiles"][10][8] == "," and out["snapshot"] is None
    assert w == vor and out["digest"]
    schnell = time.time()
    s = post(c, "/api/worlds/draft", {"world": w, "actions": akt, "snapshot": True}, key=None).json()
    assert s["snapshot"]["world_name"] == "W" and len(s["snapshot"]["look"]["regions"][0]["houses"]) == 1
    erst = time.time() - schnell
    schnell = time.time()
    again = post(c, "/api/worlds/draft", {"world": w, "actions": akt, "snapshot": True}, key=None).json()
    assert again["digest"] == s["digest"] and again["snapshot"] == s["snapshot"] and time.time() - schnell < erst + 0.5
    kaputt = post(c, "/api/worlds/draft", {"world": {"name": "x"}, "actions": []}, key=None)
    assert kaputt.status_code == 422


def test_werkstatt_speichern_trotz_fehler_aber_nicht_spielbar(c):
    """✗ sperrt „Damit spielen“ (spielbar = false), das Speichern bleibt erlaubt."""
    w = blank_world("W", "mittel", "wald")
    w["startplatz"] = [3, 3]
    h = post(c, "/api/worlds/draft", {"world": w, "actions": [{"art": "haus", "gebaeude": "shop", "tuer": [30, 20]}]}, key=None).json()["world"]
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if (dx, dy) != (0, 0):
                h["tiles"][3 + dy] = h["tiles"][3 + dy][:3 + dx] + "#" + h["tiles"][3 + dy][4 + dx:]
    out = post(c, "/api/worlds/draft", {"world": h, "actions": [{"art": "deko", "sorte": "baum", "tile": [40, 10]}]}, key=None).json()
    assert out["ok"] and out["spielbar"] and out["hinweise"] >= 1                                              # Altlast zählt als Hinweis
