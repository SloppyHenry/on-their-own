"""Statistiken und Ereignisverlauf: echte Zahlen aus einer Simulation, per SQL aus den Protokolltabellen."""

import json

from api.conftest import api, post

from on_their_own.stats.queries import compute

from .conftest import file_sim


def chat_fn(messages, schema, params):
    me_mira = messages[0]["content"].startswith("Du bist Mira")
    opts = dict(__import__("re").findall(r"^(o\d+): (.*)$", messages[1]["content"], __import__("re").M))
    pick = next((k for k, v in opts.items() if "antworten" in v or "Gespräch beginnen" in v), None) or ("o1" if me_mira else "o2")
    return json.dumps({"option_id": pick, "intent": "weiter", "utterance": "Hallo, wie geht es dir? Der Garten sieht schön aus.", "importance": 5})


async def long_run():
    import tempfile
    from pathlib import Path
    d = Path(tempfile.mkdtemp())
    sim = file_sim(d / "live.db", chat_fn)
    await sim.runner.step(24 * 60)                                                                 # ein ganzer Simulationstag
    return sim


def stats(sim, **kw):
    st = sim.engine.state
    return compute(st.conn, sim.store.profile_ids(), {a.id: a.name for a in st.agents()}, {l.id: l.name for l in st.locations.values()}, **kw)


async def test_numbers_come_from_a_whole_simulated_day():
    sim = await long_run()
    out = stats(sim)
    assert out["minute"] == 420 + 24 * 60 and [a["agent"] for a in out["agents"]] == ["alex", "mira"] and out["total"]["agent"] is None
    total = out["total"]
    n_log = sim.engine.state.conn.execute("SELECT COUNT(*) FROM action_log WHERE outcome IN ('completed','failed','rejected','interrupted')").fetchone()[0]
    assert total["actions"]["completed"] + total["actions"]["failed"] == n_log > 20                            # Summe stimmt mit dem Protokoll überein
    assert sum(a["actions"]["completed"] for a in out["agents"]) == total["actions"]["completed"]
    assert total["actions"]["by_action"] and all(0 <= (a["success_rate"] or 0) <= 1 for a in total["actions"]["by_action"])
    assert total["llm"]["decisions"] == sim.runner.stats.decisions and total["llm"]["valid"] + total["llm"]["fallback"] == total["llm"]["decisions"]
    assert total["llm"]["prompt_tokens"] > 0 and total["llm"]["avg_latency_ms"] is not None
    for a in out["agents"]:
        spent = sum(p["minutes"] for p in a["places"]["time_by_location"])
        assert 0 < spent <= 24 * 60 + 5                                                                          # Zeit je Ort ergibt höchstens die Tageslänge
        assert len(a["series"]["needs_mood"]) in (24, 25) and set(a["series"]["needs_mood"][0]) >= {"minute", "energy", "hunger", "mood"}
        assert a["memories_per_day"] and a["memories_per_day"][0]["day"] == 1
    sim.close()


async def test_conversations_and_proposals_are_counted():
    sim = await long_run()
    c = stats(sim)["total"]["conversations"]
    n = sim.engine.state.conn.execute("SELECT COUNT(*) FROM conversations WHERE status='ended'").fetchone()[0]
    assert c["count"] == n and (n == 0 or c["avg_turns"] > 0)
    assert all(len(k["word"]) >= 4 for k in c["keywords"])
    assert n == 0 or "garten" in [k["word"] for k in c["keywords"]]
    sim.close()


async def test_filters_by_agent_and_time_window():
    sim = await long_run()
    whole = stats(sim)
    one = stats(sim, agent="alex")
    assert [a["agent"] for a in one["agents"]] == ["alex"] and one["total"] is None
    assert one["agents"][0]["actions"] == [a for a in whole["agents"] if a["agent"] == "alex"][0]["actions"]
    morning = stats(sim, lo=420, hi=420 + 180)
    assert morning["total"]["actions"]["completed"] < whole["total"]["actions"]["completed"]
    assert all(420 <= p["minute"] <= 600 for p in morning["agents"][0]["series"]["needs_mood"]) and len(morning["agents"][0]["series"]["needs_mood"]) == 3
    assert stats(sim, lo=99999)["total"]["actions"]["completed"] == 0
    sim.close()


async def test_relations_over_time_end_at_the_current_values():
    sim = await long_run()
    rel = stats(sim, agent="mira")["agents"][0]["series"]["relations"]
    cur = dict(sim.engine.state.conn.execute("SELECT trust, sympathy, tension, familiarity FROM relations WHERE agent_id='mira' AND other_id='alex'").fetchone())
    assert rel["alex"][-1] | {} == {"minute": sim.engine.minute, **cur} and len(rel["alex"]) >= 1
    sim.close()


async def test_stats_and_event_history_over_the_api():
    sim = await long_run()
    with api(sim) as c:
        s = c.get("/api/stats").json()
        assert s["total"]["actions"]["completed"] > 0 and [a["agent"] for a in s["agents"]] == ["alex", "mira"]
        assert c.get("/api/stats?agent=mira&from_minute=420&to_minute=600").json()["agents"][0]["agent"] == "mira"
        assert c.get("/api/stats?agent=../x").status_code == 422
        page = c.get("/api/events?from_minute=500&to_minute=520&limit=1000").json()["items"]
        assert page and all(500 <= e["sim_time"]["total"] <= 520 for e in page)
        assert all("garten" in json.dumps(e["data"], ensure_ascii=False).lower() or "garten" in e["type"] for e in c.get("/api/events?q=Garten&limit=50").json()["items"])
        csv_ = c.get("/api/events/export?format=csv&category=dialogue")
        assert csv_.status_code == 200 and "attachment" in csv_.headers["content-disposition"] and csv_.text.splitlines()[0].lstrip("﻿").startswith("seq,sim_minute")
        rows = csv_.text.splitlines()[1:]
        assert rows and all(",agent.dialogue," in r or ",dialogue," in r for r in rows)
        js = c.get("/api/events/export?format=json&agent=alex&from_minute=450&to_minute=470").json()
        assert js and all("alex" in e["agents"] and 450 <= e["sim_time"]["total"] <= 470 for e in js)
        assert c.get("/api/events/export?format=xml").status_code == 422
    sim.close()
