"""AP16d: Probelauf mit Fake-Modell auf einer umgebauten Welt. Draußen und im Haus gestalten, übernehmen, die Simulation laufen lassen: nichts bricht, die Ereignisse sind gültig,
und die Bewohner erfahren nichts vom Umbau (keine Wörter wie Editor, Leitstelle, Spieler, Gott, Entwurf in Prompts und Erinnerungen)."""

import json

import pytest

from on_their_own.config import Settings
from on_their_own.generator.generate import new_world
from on_their_own.llm.providers import FakeProvider, first_option_fn
from on_their_own.simulation.builder import Simulation
from on_their_own.world import loader
from tests.conftest import START_WORLD
from agents.conftest import with_goals

from .conftest import api, post
from .test_gestalten import frei

VERBOTEN = ("Editor", "Leitstelle", "Spieler", "Gott", "Entwurf", "Gestalten", "gestalten", "world.edited", "Vor dem Gestalten")


@pytest.fixture
def c(monkeypatch, tmp_path):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = Simulation.create(Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0), tmp_path / "live.db", FakeProvider(fn=with_goals(first_option_fn)), world=new_world(7)[0])
    sim.store.ensure_all()
    with api(sim) as client:
        yield client


def werte(x):
    return list(x.values()) if isinstance(x, dict) else list(x)


def texte(c):
    out = []
    for call in c.sim.provider.calls:
        out += [m["content"] if isinstance(m["content"], str) else json.dumps(m["content"], ensure_ascii=False) for m in call["messages"]]
    return "\n".join(out)


def erinnerungen(c):
    s = c.get("/api/state").json()
    out = []
    for a in s["agents"]:
        page = c.get(f"/api/agents/{a['id']}/memories", params={"limit": 200}).json()
        out += [m.get("content", "") for m in page.get("items", [])]
    return "\n".join(out)


def schritte(c, n):
    for _ in range(n):
        assert c.post("/api/sim/step", json={"n": 1}, headers={"Idempotency-Key": f"s{_}-{id(c)}-{n}"}).status_code == 200


def test_probelauf_nach_dem_umbau(c):
    schritte(c, 10)
    vor_prompts = texte(c)
    assert not [w for w in VERBOTEN if w in vor_prompts], "schon die Ausgangslage nennt verbotene Wörter"
    (a, b, d) = frei(c)
    akt = [{"art": "deko", "sorte": "bank", "tile": list(a)}, {"art": "weg", "punkte": [list(b), [b[0] + 3, b[1]]]}, {"art": "garten", "rechteck": [d[0] - 1, d[1] - 1, 3, 3]}]
    p = post(c, "/api/world/draft/preview", {"actions": akt}, key=None).json()
    assert p["ok"], p
    assert post(c, "/api/world/draft/apply", {"actions": akt, "digest": p["digest"], "confirm": True}).status_code == 200
    schritte(c, 40)
    s = c.get("/api/state").json()
    assert any(o["kind"] == "bench" for o in werte(s["objects"])), "die neue Bank steht in der Welt"
    nach = texte(c)
    assert not [w for w in VERBOTEN if w in nach], f"Wörter im Prompt: {[w for w in VERBOTEN if w in nach]}"
    mem = erinnerungen(c)
    assert not [w for w in VERBOTEN if w in mem], f"Wörter in Erinnerungen: {[w for w in VERBOTEN if w in mem]}"
    # Das Ereignis der Übernahme steht im Protokoll, aber in keiner Wahrnehmung
    ev = c.get("/api/events", params={"type": "world.edited"}).json()["items"]
    assert len(ev) == 1 and ev[0]["visibility"] == "system"
    assert c.get("/api/state").json()["seq"] > s["seq"] - 1


def test_neues_haus_mit_einrichtung_ist_nutzbar(c):
    """Haus setzen, Möbel hinein, Farben: der Zustand gilt für die Engine als gültige Welt (Prüfung ✓, alle Objekte mit Handlungen)."""
    (a, b, d) = frei(c)
    r = post(c, "/api/world/draft/preview", {"actions": [{"art": "haus", "gebaeude": "house", "breite": 66, "dach": "blau", "wand": "rosa", "tuer": list(a)}]}, key=None).json()
    assert r["ok"], r
    assert post(c, "/api/world/draft/apply", {"actions": [{"art": "haus", "gebaeude": "house", "breite": 66, "dach": "blau", "wand": "rosa", "tuer": list(a)}], "digest": r["digest"], "confirm": True}).status_code == 200
    s = c.get("/api/state").json()
    neu = [l for l in werte(s["locations"]) if l["id"].startswith("house.e")]
    assert neu, "das neue Haus hat Räume"
    x0, y0, bw, bh = neu[0]["rect"]
    rows = s["map"]["rows"]
    belegt = {(o["x"], o["y"]) for o in werte(s["objects"]) if o["x"] is not None}
    t = next((x, y) for y in range(y0, y0 + bh) for x in range(x0, x0 + bw) if rows[y][x] == "_" and (x, y) not in belegt and not any(rows[y + dy][x + dx] == "+" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))
    akt = [{"art": "moebel", "kind": "sofa", "tile": list(t)}, {"art": "farbe", "tile": list(t), "tapete": "ranken"}]
    p = post(c, "/api/world/draft/preview", {"actions": akt}, key=None).json()
    assert p["ok"] and p["fehler"] == 0, p
    assert post(c, "/api/world/draft/apply", {"actions": akt, "digest": p["digest"], "confirm": True}).status_code == 200
    schritte(c, 30)
    s2 = c.get("/api/state").json()
    sofa = next(o for o in werte(s2["objects"]) if o["kind"] == "sofa" and (o["x"], o["y"]) == t)
    assert sofa["name"] == "Sofa"
    assert "Editor" not in texte(c) and "Leitstelle" not in texte(c)


def test_leistung_vieler_aktionen():
    """Viele Aktionen auf einer großen leeren Welt: 20 unter einer Sekunde (Vorschau der Werkstatt), alle 200 in wenigen Sekunden."""
    import random
    import time

    from on_their_own.generator.blank import blank_world
    from on_their_own.generator.edit import entwurf
    w = blank_world("W", "gross", "wald")
    rnd = random.Random(3)
    breite, hoehe = len(w["tiles"][0]), len(w["tiles"])
    akt = []
    for i in range(200):
        x, y = rnd.randrange(8, breite - 8), rnd.randrange(8, hoehe - 30)
        akt.append([{"art": "deko", "sorte": "baum", "tile": [x, y]}, {"art": "weg", "punkte": [[x, y], [x + 4, y + 1]]}, {"art": "garten", "rechteck": [x, y, 4, 3]}, {"art": "see", "mitte": [x, y], "rx": 2.5}][i % 4])
    t = time.time()
    entwurf.anwenden(w, akt[:20])
    assert time.time() - t < 1.0
    t = time.time()
    r = entwurf.anwenden(w, akt)
    assert time.time() - t < 15.0 and sum(s["ok"] for s in r.stati) > 100
