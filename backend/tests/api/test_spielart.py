"""Spielarten Leben und Gott (AP18d): Standard, Anlegen, Wechseln, Schutz je Endpunkt im Backend, alte Spielstände gelten als Gott, die Bewohner erfahren nichts."""

import json
import uuid

import pytest

from simulacra.agents import options as opt_mod
from simulacra.agents import perception, prompts
from simulacra.agents.schema import META_RE
from simulacra.world import loader, spielart
from tests.conftest import START_WORLD
from tests.saves.conftest import file_sim

from .conftest import api, post
from .test_newsim import apply, spec


@pytest.fixture
def c(monkeypatch, tmp_path):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", START_WORLD)
    sim = file_sim(tmp_path / "live.db")
    with api(sim) as client:
        yield client


def mode(c) -> str:
    return c.get("/api/state").json()["play_mode"]


def put(c, body, key="auto"):
    return c.put("/api/sim/play-mode", json=body, headers={"Idempotency-Key": str(uuid.uuid4())})


def to(c, m):
    return put(c, {"play_mode": m, "confirm": True})


def test_alte_spielstaende_ohne_eintrag_gelten_als_gott(c):
    assert c.sim.engine.state.get_meta("play_mode") is None
    assert mode(c) == "gott" and spielart.get(c.sim.engine.state) == "gott"


def test_neue_simulation_ist_standardmaessig_leben_und_gott_auf_wunsch(c):
    r, _ = apply(c, spec(2))
    assert r.status_code == 200 and mode(c) == "leben"
    r, _ = apply(c, spec(2), play_mode="gott")
    assert r.status_code == 200 and mode(c) == "gott"


def test_zuruecksetzen_behaelt_die_spielart_oder_nimmt_die_gewuenschte(c):
    assert to(c, "leben").status_code == 200
    assert post(c, "/api/sim/reset", {"confirm": True}).status_code == 200 and mode(c) == "leben"
    assert post(c, "/api/sim/reset", {"confirm": True, "play_mode": "gott"}).status_code == 200 and mode(c) == "gott"


def test_wechseln_braucht_bestaetigung_und_geht_in_beide_richtungen(c):
    assert put(c, {"play_mode": "leben"}).status_code == 400
    assert put(c, {"play_mode": "ggott", "confirm": True}).status_code == 422
    assert to(c, "leben").status_code == 200 and mode(c) == "leben"
    assert to(c, "gott").status_code == 200 and mode(c) == "gott"
    types = [e["type"] for e in c.get("/api/events?type_prefix=simulation.play_mode&limit=10").json()["items"]]
    assert types == ["simulation.play_mode_changed", "simulation.play_mode_changed"]


def test_spielart_geht_mit_dem_spielstand(c):
    assert to(c, "leben").status_code == 200
    saved = post(c, "/api/saves", {"name": "mit Leben"}).json()
    assert to(c, "gott").status_code == 200 and mode(c) == "gott"
    assert post(c, f"/api/saves/{saved['id']}/load", {"confirm": True}).status_code == 200
    assert mode(c) == "leben"


def test_in_leben_lehnt_das_backend_alles_von_aussen_ab(c):
    assert to(c, "leben").status_code == 200
    before = c.get("/api/state").json()
    for path, body in [("/api/inject/parse", {"text": "Heute beginnt es zu regnen."}), ("/api/inject/confirm", {"proposal_id": "inj_x"}),
                       ("/api/world/generate", {"kind": "extend", "seed": 1}), ("/api/world/patch/preview", {"patch": {"ops": []}}),
                       ("/api/world/generate/apply", {"kind": "extend", "seed": 1, "digest": "x", "confirm": True})]:
        r = post(c, path, body)
        assert r.status_code == 403 and "Spielart Leben" in r.json()["detail"], (path, r.status_code, r.text)
    assert c.delete("/api/scheduled/x", headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 403
    after = c.get("/api/state").json()
    assert after["seq"] == before["seq"] and after["weather"] == before["weather"]
    assert post(c, "/api/params/reset", None).status_code == 200                     # Regler bleiben erlaubt
    assert c.patch("/api/params", json={"changes": [{"key": "autonomy", "value": 60}]}, headers={"Idempotency-Key": str(uuid.uuid4())}).status_code == 200
    assert post(c, "/api/world/generate", {"kind": "new", "seed": 1}).status_code == 200      # ein neues Dorf anlegen ist nichts, was die laufende Welt verändert


def test_in_gott_geht_alles_wie_bisher(c):
    assert to(c, "gott").status_code == 200
    c.sim.inject.rate = 100
    assert post(c, "/api/inject/parse", {"text": "Heute beginnt es zu regnen."}).status_code == 200
    assert post(c, "/api/world/generate", {"kind": "extend", "seed": 1}).status_code == 200


def test_kein_prompt_und_keine_erinnerung_kennt_die_spielart(c):
    """Auch nach dem Anlegen und Wechseln steht kein Wort zur Spielart in Prompts, Optionen oder Erinnerungen; das Wechsel-Ereignis hat keine Agenten."""
    r, _ = apply(c, spec(3), play_mode="leben")
    assert r.status_code == 200
    assert to(c, "gott").status_code == 200 and to(c, "leben").status_code == 200
    sim = c.sim
    for aid in ("ida", "jo", "kai"):
        p = perception.build(sim.engine, sim.store, sim.convs, aid)
        text = prompts.system_prompt(sim.store.get(aid)) + "\n" + prompts.user_prompt(p, opt_mod.build_options(sim.engine, sim.store, p, __import__("simulacra.agents.scoring", fromlist=["Tuning"]).Tuning()))
        text += "\n".join(m.text for m in sim.memory.memories(aid))
        assert META_RE.findall(text) == [] and "play_mode" not in text.lower() and "gott" not in text.lower().split(), aid
    rows = sim.engine.state.conn.execute("SELECT agents FROM events WHERE type='simulation.play_mode_changed'").fetchall()
    assert rows and all(json.loads(x["agents"]) == [] for x in rows)
