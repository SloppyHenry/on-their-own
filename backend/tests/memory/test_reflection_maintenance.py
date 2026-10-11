import json

import pytest

from agents.conftest import make_sim
from simulacra.memory.retrieval import Situation


def reflect_fn(sources=(1, 2), text="Ich merke, dass mir der Garten Ruhe gibt.", extra=None):
    def fn(messages, schema, params):
        refl = [{"text": text, "importance": 6, "sources": list(sources)}] + (extra or [])
        return json.dumps({"reflections": refl}, ensure_ascii=False)
    return fn


def fill(sim, agent="alex", n=8, importance=5, start=100, step=20, who="mira"):
    w = sim.memory.writer
    return [w.remember(agent, "episode", f"Ich habe Aufgabe {i} im Garten erledigt.", importance, start + i * step, location_id="garden", persons=[who] if i % 2 else [])
            for i in range(n)]


@pytest.fixture
def sim():
    s = make_sim(fn=reflect_fn())
    s.store.ensure_all()
    yield s
    s.close()


def test_reflection_is_due_by_importance_or_in_the_evening(sim):
    r = sim.memory.reflector
    assert r.due("alex", 600) is None                                       # noch nichts erlebt
    fill(sim, n=14, importance=6)                                          # 84 >= Schwelle 80
    assert r.due("alex", 600) == "importance"
    sim.memory.know.mark_reflected("alex", 600, 1)
    assert r.due("alex", 620) is None                                       # Mindestabstand und Zähler zurückgesetzt
    assert r.due("alex", 1300) is None                                      # am Abend desselben Tages wurde schon reflektiert
    assert r.due("alex", 1440 + 600) is None                                # nächster Tag, aber noch nicht Abend und zu wenig Neues
    assert r.due("alex", 1440 + 1300) == "evening"                          # Tag 2, 21:40: einmal am Abend
    sim.memory.know.mark_reflected("alex", 1440 + 1300, 2)
    assert r.due("alex", 1440 + 1380) is None


async def test_valid_sources_are_stored_with_source_ids(sim):
    mems = fill(sim, n=8)
    out = await sim.memory.reflector.run("alex", "test")
    assert len(out) == 1 and out[0].kind == "reflection" and out[0].agent_id == "alex"
    assert set(out[0].source_memory_ids) <= {m.id for m in mems}
    assert len(out[0].source_memory_ids) == 2
    ev = [e for e in sim.engine.events_since(0, 10000) if e.type == "agent.memory_created" and e.data["kind"] == "reflection"]
    assert ev and ev[0].data["source_memory_ids"] == out[0].source_memory_ids
    assert sim.memory.know.state_of("alex")["importance_since_reflection"] == 0


async def test_invented_sources_are_discarded():
    sim = make_sim(fn=reflect_fn(sources=(99, 100)))
    sim.store.ensure_all()
    fill(sim, n=8)
    assert await sim.memory.reflector.run("alex", "test") == []
    assert sim.memory.store.list("alex", kind="reflection")[0] == []
    skipped = [e for e in sim.engine.events_since(0, 10000) if e.type == "agent.memory_skipped"]
    assert skipped and "Quellen" in skipped[-1].data["reason"]
    sim.close()


async def test_mixed_answer_keeps_only_the_valid_part():
    extra = [{"text": "Das habe ich frei erfunden.", "importance": 9, "sources": [77]}, {"text": "", "importance": 3, "sources": [1]}]
    sim = make_sim(fn=reflect_fn(sources=(1, 3, 3, 500), extra=extra))
    sim.store.ensure_all()
    mems = fill(sim, n=8)
    out = await sim.memory.reflector.run("alex", "test")
    assert [m.text for m in out] == ["Ich merke, dass mir der Garten Ruhe gibt."]
    assert len(out[0].source_memory_ids) == 2                                # 3 doppelt, 500 existiert nicht
    sim.close()


async def test_a_reflection_never_cites_another_agents_memories(sim):
    fill(sim, "alex", n=8)
    fill(sim, "mira", n=8, who="alex")
    job = sim.memory.reflector.prepare("alex", "test")
    assert job and {m.agent_id for m in job.sources.values()} == {"alex"}
    prompt = job.messages[1]["content"]
    mira_text = sim.memory.store.list("mira")[0][0].id
    assert mira_text not in prompt


async def test_bad_json_is_rejected_without_breaking_anything():
    sim = make_sim(fn=lambda m, s, p: "kein json")
    sim.store.ensure_all()
    fill(sim, n=8)
    assert await sim.memory.reflector.run("alex", "test") == []
    sim.close()


async def test_runner_reflects_when_enough_new_importance_has_accumulated():
    sim = make_sim(fn=reflect_fn())
    sim.store.ensure_all()
    sim.memory.params.reflect_threshold = 10
    fill(sim, n=8, importance=6, start=300)
    sim.runner.engine.state  # noqa: B018
    await sim.runner.step(2)
    assert sim.memory.store.list("alex", kind="reflection")[0] or sim.memory.store.list("mira", kind="reflection")[0]
    sim.close()


# --- Pflege --------------------------------------------------------------------------------------------------
def test_day_summary_is_written_once_and_old_routine_is_archived_not_deleted(sim):
    w, st = sim.memory.writer, sim.memory.store
    day1 = fill(sim, n=6, importance=5, start=100)
    big = w.remember("alex", "episode", "Ich habe etwas sehr Wichtiges erlebt.", 9, 500, location_id="lake")
    total = st.count("alex")
    r = sim.memory.maintenance.run("alex", 4 * 1440 + 60)                    # Tag 5
    assert r["summaries"] >= 1 and r["archived"] >= 1
    summaries = st.list("alex", kind="summary")[0]
    assert len(summaries) == 1 and "Rückblick auf Tag 1" in summaries[0].text and set(summaries[0].source_memory_ids) >= {m.id for m in day1}
    archived = st.list("alex", status="archived")[0]
    assert archived and all(m.status == "archived" for m in archived)
    assert st.get("alex", big.id).status == "active"                          # wichtig: bleibt aktiv
    assert st.count("alex") + st.count("alex", "archived") == total + 1       # nichts gelöscht (+ die Zusammenfassung)
    assert sim.memory.maintenance.run("alex", 4 * 1440 + 90)["summaries"] == 0     # nicht doppelt
    ev = [e for e in sim.engine.events_since(0, 10000) if e.type == "agent.memory_archived"]
    assert ev and ev[0].data["count"] == len(archived)


def test_archived_memories_leave_the_active_recall_but_stay_findable(sim):
    fill(sim, n=6, importance=5, start=100)
    sit = Situation(minute=5000, location_id="garden", location_name="Garten", persons=["mira"], person_names=["Mira"])
    sim.memory.params.min_score = 0.0
    assert sim.memory.retriever.recall("alex", sit, log=False).items
    sim.memory.maintenance.run("alex", 5 * 1440)
    ids = {m.id for m in sim.memory.store.list("alex", status="archived")[0]}
    assert ids
    recalled = {s.memory.id for s in sim.memory.retriever.recall("alex", sit, log=False).items}
    assert not (recalled & ids)
    assert sim.memory.store.list("alex", q="Garten", status="archived")[1] == len(ids)


def test_upper_limit_archives_more_but_never_deletes(sim):
    sim.memory.params.max_active = 5
    mems = fill(sim, n=12, importance=5, start=1500)
    sim.memory.maintenance.archive("alex", 1500 + 1440)
    st = sim.memory.store
    assert st.count("alex") <= 5 and st.count("alex") + st.count("alex", "archived") == len(mems)


# --- Vorhaben, Qualität der Reflexionen, Abruf --------------------------------------------------------------------
def test_plans_are_stored_only_when_they_persist_or_contain_a_commitment(sim):
    w, st = sim.memory.writer, sim.memory.store
    assert w.set_intention("alex", "Holz für das Regal sammeln", 500, "forest") is None          # erste Nennung: nur merken
    kept = w.set_intention("alex", "Mit dem Holz für das Regal weitermachen", 510, "forest")      # kehrt wieder: bleibt bestehen
    assert kept and kept.kind == "intention" and kept.intention_state == "open"
    assert w.set_intention("alex", "Weiter Holz für das Regal sammeln", 520, "forest") is None     # offenes Vorhaben nur aufgefrischt
    assert len(st.list("alex", kind="intention")[0]) == 1
    assert "Weiter Holz" in st.get("alex", kept.id).text
    promise = w.set_intention("alex", "Später mit Mira im Garten sprechen", 530, "garden")         # Zusage mit Person und Zeit
    assert promise and promise.persons == ["mira"]
    assert st.get("alex", kept.id).intention_state in ("dropped", "done")                         # das alte Vorhaben ist überholt
    assert [m.intention_state for m in st.list("alex", kind="intention")[0]].count("open") == 1


def test_source_citations_are_removed_from_reflection_text():
    from simulacra.memory.reflection import Reflector
    assert Reflector._clean("Ich merke, dass ich gern plane (Quelle: 3, 5).") == "Ich merke, dass ich gern plane."
    assert Reflector._clean("Alex ist geduldig. Quellen: 2, 4.") == "Alex ist geduldig."
    assert Reflector._clean("Ich mag den See [Erinnerung 2].") == "Ich mag den See."


async def test_repeating_an_earlier_reflection_is_discarded(sim):
    fill(sim, n=8)
    assert len(await sim.memory.reflector.run("alex", "test")) == 1
    sim.memory.know.mark_reflected("alex", 0, 0)
    assert await sim.memory.reflector.run("alex", "test") == []                              # dieselbe Einsicht noch einmal
    assert len(sim.memory.store.list("alex", kind="reflection")[0]) == 1


def test_recall_does_not_let_reflections_crowd_out_experience(sim):
    w = sim.memory.writer
    for i in range(5):
        w.remember("alex", "reflection", f"Ich erkenne Muster {i} in meinem Verhalten im Garten.", 8, 400 + i, force=True)
    w.remember("alex", "episode", "Ich habe im Garten die Beete gegossen.", 5, 550, location_id="garden")
    sim.memory.params.min_score = 0.0
    items = sim.memory.retriever.recall("alex", Situation(minute=560, location_id="garden", location_name="Garten"), log=False).items
    assert [s.memory.kind for s in items].count("reflection") <= 2
    assert any(s.memory.kind == "episode" for s in items)
