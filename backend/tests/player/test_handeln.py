"""AP18h-a2: eigene Figur handeln lassen – Gleichheit mit den Bewohnern, 409 außerhalb von Leben, kein Hinweis für die anderen, Gespräch bis `expire`."""

import json

import pytest
from agents.conftest import make_sim, put

from simulacra.simulation import mitleben
from simulacra.world import spielart
from tests.api.conftest import api, post


def leben(sim, player="alex"):
    sim.store.ensure_all()
    spielart.set_mode(sim.engine.state, "leben")
    mitleben.set_player(sim.engine.state, player)
    with sim.engine.db.transaction():                                 # die Startwelt lässt Alex mit einer laufenden Erholung beginnen: frei machen
        a = sim.engine.state.agent(player)
        a.action = None
        sim.engine.state.save_agent(a)
    return sim


@pytest.fixture
def c():
    with api(leben(make_sim())) as client:
        yield client


def act(c, action, **params):
    r = post(c, "/api/player/act", {"action": action, "params": params})
    assert r.status_code == 200, r.text
    return r.json()


def test_409_without_figure_or_outside_leben():
    sim = make_sim()
    sim.store.ensure_all()
    with api(sim) as c:                                              # alter Stand: Gott, keine Figur
        for path, body in [("/api/player/act", {"action": "wait", "params": {}}), ("/api/player/say", {"to": "mira", "text": "Hi"}), ("/api/player/cancel", None)]:
            assert post(c, path, body).status_code == 409
        assert c.get("/api/player/choices").status_code == 409
        spielart.set_mode(sim.engine.state, "leben")                 # Leben, aber niemand gewählt
        assert post(c, "/api/player/act", {"action": "wait", "params": {}}).status_code == 409
        mitleben.set_player(sim.engine.state, "alex")
        assert post(c, "/api/player/act", {"action": "wait", "params": {}}).status_code == 200
        spielart.set_mode(sim.engine.state, "gott")                  # Wechsel auf Gott: sie ist wieder ein normaler Bewohner
        assert post(c, "/api/player/act", {"action": "wait", "params": {}}).status_code == 409


def test_unknown_or_speak_action_is_422(c):
    for a in ("fly", "speak", "teleport"):
        assert post(c, "/api/player/act", {"action": a, "params": {}}).status_code == 422


REJECTS = [("move_to", {"target": "gibt_es_nicht"}), ("take", {"object_id": "axe"}), ("use", {"object_id": "nichts", "mode": "sit"}),
           ("gather", {"resource": "wood"}), ("give", {"to": "mira", "item": "axe"}), ("use", {"object_id": "old_key", "mode": "unlock"}),
           ("eat", {}), ("build", {"blueprint": "bank"})]


def test_rejections_equal_the_engines_own_texts():
    """Dieselbe Welt, derselbe Vorschlag: über die Schnittstelle kommt genau der Text der Engine zurück (wie für einen Bewohner im Runner)."""
    direct = leben(make_sim())
    expected = []
    for action, params in REJECTS:
        res = direct.engine.propose("alex", action, params)
        expected.append((res.ok, str(getattr(res.rejected.code, "value", res.rejected.code)) if res.rejected else None, res.rejected.text if res.rejected else None))
        direct.engine.interrupt("alex")                              # auch eine Ablehnung lässt die Figur kurz „erholen“ (Engine): frei machen
    with api(leben(make_sim())) as c:
        got = []
        for action, params in REJECTS:
            r = act(c, action, **params)
            got.append((r["ok"], r["code"], r["text"]))
            post(c, "/api/player/cancel")
    assert got == expected
    assert sum(not ok for ok, *_ in got) >= 5 and len({code for ok, code, _ in got if not ok}) >= 3      # die Tabelle deckt verschiedene Ablehnungsfälle ab


def test_action_has_no_decision_event_and_cancel_works(c):
    sim = c.sim
    r = act(c, "wait", minutes=30)
    assert r["ok"] and r["minutes"] == 30
    assert sim.engine.state.agent("alex").action is not None
    assert act(c, "wait", minutes=5)["code"] == "busy"               # beschäftigt, wie bei jedem Bewohner
    assert post(c, "/api/player/cancel").json()["ok"] is True
    assert sim.engine.state.agent("alex").action is None
    assert post(c, "/api/player/cancel").json()["ok"] is False       # nichts mehr zu tun
    rows = sim.engine.state.conn.execute("SELECT type FROM events WHERE agents LIKE '%alex%'").fetchall()
    kinds = {r["type"] for r in rows}
    assert "agent.action_started" in kinds and "agent.action_interrupted" in kinds and "agent.decision" not in kinds
    assert sim.store.conn.execute("SELECT COUNT(*) c FROM decisions WHERE agent_id='alex'").fetchone()["c"] == 0


def test_choices_list_possible_and_impossible_without_side_effects(c):
    sim = c.sim
    n0 = sim.engine.state.conn.execute("SELECT COUNT(*) c FROM events").fetchone()["c"]
    r = c.get("/api/player/choices")
    assert r.status_code == 200
    items = r.json()
    assert any(i["ok"] for i in items) and {"kind", "label", "action", "params", "ok"} <= set(items[0])
    assert any(i["action"] == "wait" and i["ok"] for i in items)
    assert all(i["reason"] for i in items if not i["ok"])
    assert sim.engine.state.conn.execute("SELECT COUNT(*) c FROM events").fetchone()["c"] == n0
    assert sim.store.conn.execute("SELECT COUNT(*) c FROM decisions").fetchone()["c"] == 0


FORBIDDEN = ("Spieler", "Mensch", "gesteuert", "player", "Autopilot", "Leitstelle")


async def test_conversation_runs_without_hint_until_expire(monkeypatch):
    monkeypatch.setattr(mitleben, "REPLY_SECONDS", 0)                     # die Frist in echten Sekunden gilt hier nicht (eigener Test in test_takt.py)
    sim = leben(make_sim())
    put(sim, "alex", 20, 13)
    put(sim, "mira", 21, 13)
    with api(sim) as c:
        r = post(c, "/api/player/say", {"to": "mira", "text": "Hallo Mira, wie geht es dir?"})
        assert r.status_code == 200 and r.json()["ok"], r.text
        for _ in range(8):
            await sim.runner.step()
        assert "Hallo Mira" in json.dumps(sim.store.recent_observations("mira", 50), ensure_ascii=False)       # Mira erfährt genau den Satz
        for _ in range(45):                                                                                 # Alex schweigt: nach der Stille endet das Gespräch
            await sim.runner.step()
        ended = sim.store.conn.execute("SELECT status, end_reason FROM conversations").fetchall()
        assert ended and all(e["status"] == "ended" for e in ended)
        assert sim.store.conn.execute("SELECT COUNT(*) c FROM decisions WHERE agent_id='alex'").fetchone()["c"] == 0
        for call in sim.client.provider.calls:                                                              # kein Hinweis in irgendeinem Prompt
            text = json.dumps(call["messages"], ensure_ascii=False)
            assert not [w for w in FORBIDDEN if w in text], (call["messages"][0]["content"][:30], [w for w in FORBIDDEN if w in text])
