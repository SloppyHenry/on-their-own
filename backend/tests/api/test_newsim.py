"""Assistent „Neue Simulation“ und Vorlagen über die API (AP17b): Prüfung, Vorschau ohne Wirkung, Anlegen mit Sicherung, Beziehungen, Vorgeschichte, keine höhere Instanz."""

import json

import pytest

from simulacra.agents import options as opt_mod
from simulacra.agents import perception, prompts
from simulacra.agents.schema import META_RE
from simulacra.world import loader
from tests.saves.conftest import file_sim

from .conftest import api, post
from tests.conftest import START_WORLD


@pytest.fixture
def c(monkeypatch, tmp_path):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = file_sim(tmp_path / "live.db")
    with api(sim) as client:
        yield client


def person(name, **kw):
    p = {"name": name, "gender": "weiblich", "age": 33, "description": "Freundlich und neugierig.", "background": "Kommt aus der Stadt.", "interests": ["Brot"], "dislikes": ["Lärm"],
         "goals": ["ein Haus einrichten"], "communication_style": "ruhig", **kw}
    return {"template": None, "profile": p, "personality": {k: 50 for k in ("sociability", "curiosity", "helpfulness", "risk_taking", "conflict_readiness", "cooperation", "calm_need",
                                                                          "conversation_initiative", "suggestion_acceptance", "persistence", "spontaneity", "autonomy")}}


def spec(n=3, **kw):
    return {"world": {"kind": "generated", "seed": 5}, "residents": [person(x) for x in ("Ida", "Jo", "Kai", "Lea")[:n]], **kw}


def state(c):
    s = c.get("/api/state").json()
    return {"seq": s["seq"], "name": s["world_name"], "agents": sorted(a["id"] for a in s["agents"])}


# --- Vorlagen -----------------------------------------------------------------------------------------------------------------------

def test_vorlagen_liste_eigene_export_import(c):
    lst = c.get("/api/templates").json()
    assert [t["id"] for t in lst][:2] == ["alex", "mira"] and len(lst) == 6 and all(t["builtin"] for t in lst)
    mine = c.post("/api/templates", json={"profile": person("Ida")["profile"], "personality": person("Ida")["personality"]}).json()
    assert mine["id"] == "eigene-ida" and not mine["builtin"]
    exp = c.get("/api/templates/eigene-ida/export")
    assert exp.status_code == 200 and "attachment" in exp.headers["content-disposition"] and json.loads(exp.text)["format"] == "simulacra-vorlage"
    imp = c.post("/api/templates/import", content=exp.content)
    assert imp.status_code == 200 and imp.json()["template"]["id"] == "eigene-ida-2" and imp.json()["warnings"] == []
    assert c.put("/api/templates/alex", json={"profile": person("X")["profile"], "personality": person("X")["personality"]}).status_code == 403
    assert c.delete("/api/templates/eigene-ida-2").status_code == 200 and c.get("/api/templates/eigene-ida-2").status_code == 404
    dup = c.post("/api/templates/hanne/duplicate").json()
    assert dup["profile"]["name"] == "Hanne (Kopie)"


def test_import_meldet_alle_fehler(c):
    bad = {"format": "simulacra-vorlage", "version": 1, "profile": {"name": "Ida", "gender": "x", "age": 200}, "personality": {}}
    r = c.post("/api/templates/import", content=json.dumps(bad).encode())
    assert r.status_code == 422 and "Geschlecht: männlich, weiblich oder divers." in r.json()["detail"] and "Alter:" in r.json()["detail"] and "Geselligkeit" in r.json()["detail"]
    assert c.post("/api/templates/import", content=b"{kaputt").status_code == 422
    assert c.post("/api/templates/import", content=b"x" * 30_000).status_code == 413
    assert len(c.get("/api/templates").json()) == 6


def test_grenzen_der_maske(c):
    r = c.get("/api/sim/new/limits").json()
    assert r == {"max_residents": 8, "seconds_per_decision": 4.5, "max_per_house": 2}


# --- Vorschau -------------------------------------------------------------------------------------------------------------------------

def test_vorschau_aendert_nichts_und_zeigt_haeuser_mit_betten(c):
    before = state(c)
    p = post(c, "/api/sim/new/preview", spec(3), key=None).json()
    assert p["ok"] and p["errors"] == [] and p["digest"] and p["snapshot"]["world_name"].startswith("Dorf ")
    assert [r["id"] for r in p["residents"]] == ["ida", "jo", "kai"] and [h["beds"] for h in p["houses"]] == [2, 2]
    assert {a["id"] for a in p["snapshot"]["agents"]} == {"ida", "jo", "kai"}
    assert all(o["owner"] is None for o in p["snapshot"]["objects"] if o["kind"] == "bed")
    assert state(c) == before
    assert post(c, "/api/sim/new/preview", spec(3), key=None).json()["digest"] == p["digest"]


def test_vorschau_nennt_jeden_fehler_mit_bewohner_und_feld(c):
    body = spec(4)
    body["residents"][0]["profile"]["description"] = "x" * 700
    body["residents"][1]["profile"]["name"] = ""
    body["residents"][2]["home"], body["residents"][3]["home"], body["residents"][0]["home"] = 1, 1, 1
    p = post(c, "/api/sim/new/preview", body, key=None).json()
    assert not p["ok"] and p["digest"] is None
    assert any(e.startswith("Bewohner 1 (Ida): Beschreibung: höchstens 600 Zeichen") for e in p["errors"]) and any(e.startswith("Bewohner 2: Name: fehlt") for e in p["errors"])
    assert any("Haus 1: höchstens 2 Personen je Haus" in e for e in p["errors"])


def test_startwelt_nur_mit_alex_und_mira(c):
    ok = spec(2)
    ok["world"] = {"kind": "start"}
    ok["residents"][0]["template"], ok["residents"][1]["template"] = "alex", "mira"
    p = post(c, "/api/sim/new/preview", ok, key=None).json()
    assert p["ok"] and [r["id"] for r in p["residents"]] == ["alex", "mira"] and p["houses"] == []
    bad = spec(2)
    bad["world"] = {"kind": "start"}
    p = post(c, "/api/sim/new/preview", bad, key=None).json()
    assert not p["ok"] and "nur für Alex und Mira" in p["errors"][0]


def test_wortpruefung_warnt_aber_sperrt_nicht(c):
    body = spec(2)
    body["residents"][0]["profile"]["background"] = "Ein Spieler hat sie ersonnen."
    body["stories"] = [{"a": 0, "b": 1, "text": "Die Leitstelle brachte sie zusammen."}]
    p = post(c, "/api/sim/new/preview", body, key=None).json()
    assert p["ok"] and len(p["warnings"]) == 2 and "Spieler" in p["warnings"][0] and "Leitstelle" in p["warnings"][1]


def test_beziehungen_und_vorgeschichte_werden_geprueft(c):
    body = spec(2, relations=[{"a": 0, "b": 5, "trust": 10}], stories=[{"a": 1, "b": 1, "text": "x"}])
    e = post(c, "/api/sim/new/preview", body, key=None).json()["errors"]
    assert any("unbekannte oder gleiche Bewohner" in x for x in e) and len(e) == 2
    assert post(c, "/api/sim/new/preview", spec(2, relations=[{"a": 0, "b": 1, "trust": 120}]), key=None).status_code == 422
    assert any("Vorgeschichte: höchstens 300" in x for x in post(c, "/api/sim/new/preview", spec(2, stories=[{"a": 0, "b": 1, "text": "x" * 400}]), key=None).json()["errors"])


# --- Anlegen --------------------------------------------------------------------------------------------------------------------------

def apply(c, body, key="auto", **extra):
    p = post(c, "/api/sim/new/preview", body, key=None).json()
    assert p["ok"], p["errors"]
    return post(c, "/api/sim/new", {**body, "digest": p["digest"], "confirm": True, **extra}, key=key), p


def test_anlegen_braucht_bestaetigung_und_passende_vorschau(c):
    p = post(c, "/api/sim/new/preview", spec(3), key=None).json()
    assert post(c, "/api/sim/new", {**spec(3), "digest": p["digest"]}).status_code == 400
    assert post(c, "/api/sim/new", {**spec(3), "digest": "0" * 16, "confirm": True}).status_code == 409
    assert post(c, "/api/sim/new", {**spec(3), "digest": p["digest"], "confirm": True}, key=None).status_code == 400          # ohne Idempotency-Key
    assert state(c)["agents"] == ["alex", "mira"]


def test_anlegen_legt_bewohner_beziehungen_und_vorgeschichte_an(c):
    body = spec(3, relations=[{"a": 0, "b": 1, "trust": 80, "sympathy": 70, "tension": 5, "familiarity": 60}], stories=[{"a": 0, "b": 1, "text": "Ida und Jo kennen sich vom Markt."}])
    body["residents"][1]["voice"] = {"base": 200, "timbre": "weich", "speed": 1, "size": 1, "lively": 1, "breath": 0.1, "vib": 5, "style": "plappern"}
    body["residents"][2]["known"] = ["square"]
    r, p = apply(c, body, key="schluessel-0101")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["backup"] and out["state"] == "stopped" and [x["id"] for x in out["residents"]] == ["ida", "jo", "kai"]
    sim = c.sim
    assert state(c)["agents"] == ["ida", "jo", "kai"] and state(c)["name"] == p["snapshot"]["world_name"]
    got = sim.store.get("ida")
    assert got.profile.name == "Ida" and got.profile.known_places and "square" in got.profile.known_places
    assert sim.store.get("kai").profile.known_places == ["square"]
    st = sim.engine.state
    assert all(a in st.locations["square"].discovered_by for a in ("ida", "jo", "kai")) and "ida" not in st.locations["lake"].discovered_by
    rel = sim.autonomy.relations
    r01, r10 = rel.get("ida", "jo"), rel.get("jo", "ida")
    assert (r01.trust, r01.sympathy, r01.tension, r01.familiarity) == (80, 70, 5, 60) and r10.values() == {"trust": 50, "sympathy": 50, "tension": 10, "familiarity": 30}
    assert sim.engine.state.conn.execute("SELECT COUNT(*) c FROM relation_log").fetchone()["c"] == 0                     # wie von Anfang an, kein Vorgang
    for me, other in (("ida", "jo"), ("jo", "ida")):
        mem = [m for m in sim.memory.memories(me)]
        assert len(mem) == 1 and mem[0].kind == "fact" and mem[0].text == "Ida und Jo kennen sich vom Markt." and mem[0].persons == [other]
    assert sim.memory.memories("kai") == []
    assert sim.engine.state.get_meta("voices").keys() == {"jo"}
    assert any(s["name"].startswith("Vor der neuen Simulation") for s in c.get("/api/saves").json())
    again = post(c, "/api/sim/new", {**body, "digest": p["digest"], "confirm": True}, key="schluessel-0101")
    assert again.headers.get("Idempotent-Replay") == "true" and again.json() == out


def test_anlegen_mit_vorwort_wohnt_schon_in_haus(c):
    body = spec(4)
    body["residents"][0]["home"], body["residents"][1]["home"] = 2, 2
    r, _ = apply(c, body)
    assert r.status_code == 200, r.text
    st = c.sim.engine.state
    owned = {b.owner: b.location_id for b in st.objects_of_kind("bed") if b.owner}
    assert set(owned) == {"ida", "jo"} and owned["ida"].split("_")[0] == owned["jo"].split("_")[0]
    assert c.sim.store.get("ida").profile.known_places[-1].startswith("house.")            # sein vorgegebenes Haus kennt er


def test_startwelt_mit_einem_bewohner(c):
    body = spec(1)
    body["world"] = {"kind": "start"}
    body["residents"][0]["template"] = "mira"
    body["residents"][0]["profile"]["name"] = "Mira"
    r, _ = apply(c, body)
    assert r.status_code == 200, r.text
    assert state(c)["agents"] == ["mira"] and c.sim.store.get("mira").profile.description == "Freundlich und neugierig."


def test_sofort_laufen_lassen(c):
    r, _ = apply(c, spec(2), run="running")
    assert r.status_code == 200 and r.json()["state"] == "running"


def test_bewohner_erfahren_nichts_von_einer_hoeheren_instanz(c):
    """Prompts, Optionen und Erinnerungen der neuen Bewohner enthalten keinen Hinweis auf Spieler, Leitstelle, Editor oder Simulation."""
    body = spec(4, relations=[{"a": 0, "b": 1, "trust": 90}], stories=[{"a": 2, "b": 3, "text": "Kai und Lea haben zusammen im Garten gearbeitet."}],
                run="paused")
    r, _ = apply(c, body)
    assert r.status_code == 200
    sim = c.sim
    for aid in ("ida", "jo", "kai", "lea"):
        p = perception.build(sim.engine, sim.store, sim.convs, aid)
        text = prompts.system_prompt(sim.store.get(aid)) + "\n" + prompts.user_prompt(p, opt_mod.build_options(sim.engine, sim.store, p, __import__("simulacra.agents.scoring", fromlist=["Tuning"]).Tuning()))
        text += "\n".join(m.text for m in sim.memory.memories(aid))
        assert META_RE.findall(text) == [], (aid, META_RE.findall(text))
    ev = sim.engine.state.conn.execute("SELECT agents, type FROM events").fetchall()
    assert not [e for e in ev if e["type"].startswith("agent.") and any(a in json.loads(e["agents"]) for a in ("ida", "jo", "kai", "lea"))]       # für die Bewohner ist noch nichts geschehen


# --- Regeln und Modell --------------------------------------------------------------------------------------------------------------

def test_regeln_preset_autonomie_knappheit_und_modus_gelten_ab_dem_start(c):
    body = spec(2, rules={"preset": "ressourcenknappheit", "autonomy": 80, "mode": "creator", "creator_text": "Es gibt jemanden, der zusieht."}, model="anderes-modell")
    r, _ = apply(c, body)
    assert r.status_code == 200, r.text
    sim = c.sim
    assert sim.params.get("autonomy") == 80 and sim.params.get("mode") == "creator" and sim.planner.mode.creator_text == "Es gibt jemanden, der zusieht."
    assert sim.params.get("world.scarcity") > 0                                          # aus dem Preset
    assert sim.settings.llm_model == "anderes-modell" and sim.engine.state.get_meta("llm_model") == "anderes-modell"


def test_preset_setzt_keine_werte_je_bewohner(c):
    body = spec(2, rules={"preset": "hohe-autonomie"})
    body["residents"][0]["profile"]["name"] = "Alex"
    body["residents"][0]["personality"]["autonomy"] = 11
    r, _ = apply(c, body)
    assert r.status_code == 200
    assert c.sim.store.get("alex").personality.autonomy == 11 and c.sim.params.get("autonomy") == 90        # allgemeiner Wert gilt, die Figur bleibt, wie sie angelegt wurde


def test_unbekanntes_preset_und_standardmodus(c):
    p = post(c, "/api/sim/new/preview", spec(2, rules={"preset": "gibt-es-nicht"}), key=None).json()
    assert not p["ok"] and p["errors"][0].startswith("Preset:")
    r, _ = apply(c, spec(2))
    assert r.status_code == 200 and c.sim.params.get("mode") == "observer"


# --- Weltregeln als Startereignisse -------------------------------------------------------------------------------------------------------

def rules_preview(c, body, text, **kw):
    return post(c, "/api/sim/new/rules/preview", {"draft": body, "text": text, **kw}, key=None)


def test_weltregel_vorschau_ist_die_der_ereigniseingabe_und_aendert_nichts(c):
    body = spec(2)
    before = state(c)
    r = rules_preview(c, body, "Heute regnet es.")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] in ("ready", "needs_confirmation") and p["ops"][0]["op"] == "set_weather"
    assert state(c) == before and c.sim.engine.state.conn.execute("SELECT COUNT(*) c FROM inject_log").fetchone()["c"] == 0        # nichts in der laufenden Welt
    unclear = rules_preview(c, body, "Ida findet etwas.").json()                                                                    # die Bewohner der Vorschau-Welt sind bekannt
    assert unclear["status"] in ("needs_clarification", "ready", "needs_confirmation")
    gone = rules_preview(c, body, "", answer_to="inj_gibtsnicht", answer="x")
    assert gone.status_code == 404


def test_startereignis_wird_nach_dem_anlegen_ausgefuehrt(c):
    body = spec(2)
    p = rules_preview(c, body, "Heute regnet es.").json()
    ev = {"text": p["text"], "source": p["source"], "ops": p["ops"]}
    body["rules"] = {"events": [ev]}
    r, _ = apply(c, body)
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    sim = c.sim
    assert sim.engine.state.conn.execute("SELECT status FROM inject_log").fetchone()["status"] == "executed"
    assert sim.engine.state.conn.execute("SELECT COUNT(*) c FROM events WHERE type='world.weather_changed'").fetchone()["c"] >= 1


def test_unmoegliches_startereignis_laesst_die_welt_unveraendert(c):
    body = spec(2, rules={"events": [{"text": "Ein Ding im Nichts", "ops": [{"op": "spawn_object", "name": "Eimer", "kind": "item", "location": "gibt_es_nicht"}]}]})
    p = post(c, "/api/sim/new/preview", body, key=None).json()
    before = state(c)
    r = post(c, "/api/sim/new", {**body, "digest": p["digest"], "confirm": True})
    assert r.status_code == 422 and "Startereignis" in r.text
    assert state(c) == before


def test_eigene_figur_wird_beim_anlegen_gewaehlt_und_gespeichert(c):
    """AP18h-c1: `player` ist die Nummer in `residents`; nur in der Spielart Leben, höchstens eine, Spielstand und Schnappschuss kennen sie."""
    assert post(c, "/api/sim/new/preview", spec(2, player=0, play_mode="gott"), key=None).status_code in (200, 422)
    p = post(c, "/api/sim/new/preview", spec(2, player=0, play_mode="gott"), key=None).json()
    assert not p.get("ok", False) and any("nur in der Spielart Leben" in e for e in p["errors"])
    p = post(c, "/api/sim/new/preview", spec(2, player=5), key=None).json()
    assert not p["ok"] and any("gibt es im Entwurf nicht" in e for e in p["errors"])
    r, _ = apply(c, spec(3, player=1, play_mode="leben"), key="eigene-figur-1")
    assert r.status_code == 200, r.text
    snap = c.get("/api/state").json()
    assert snap["play_mode"] == "leben" and snap["player"] == "jo"
    assert "jo" not in c.sim.store.thinking_ids() and "ida" in c.sim.store.thinking_ids()
