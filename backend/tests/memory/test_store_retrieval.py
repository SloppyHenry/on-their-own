import re
from pathlib import Path

import pytest

from agents.conftest import make_sim
from simulacra.memory.models import Observed
from simulacra.memory.params import MemoryParams
from simulacra.memory.retrieval import Situation


@pytest.fixture
def sim():
    s = make_sim()
    s.store.ensure_all()
    yield s
    s.close()


def obs(agent, text, imp, kind="result", minute=500, persons=(), location="garden", shared=False):
    return Observed(agent_id=agent, kind=kind, text=text, importance=imp, minute=minute, event_seq=1, event_id="evt_x", location_id=location,
                    persons=list(persons), shared=shared)


def test_threshold_decides_what_is_remembered(sim):
    w = sim.memory.writer
    out = w.process([obs("alex", "Du hast das Beet fertiggestellt.", 5), obs("alex", "Du hast etwas gegessen.", 2, kind="body"),
                     obs("alex", "Du siehst dir die Bank an.", 3, kind="inspect")])
    assert [m.text for m in out] == ["Ich habe das Beet fertiggestellt."]          # Du-Form wird zur Ich-Form
    assert sim.memory.store.count("alex") == 1


def test_conversation_lines_are_not_stored_one_by_one(sim):
    out = sim.memory.writer.process([obs("alex", "Mira sagt zu dir: «Hallo»", 6, kind="heard", persons=["mira"], shared=True)])
    assert out == []


def test_duplicates_within_half_an_hour_are_dropped(sim):
    w = sim.memory.writer
    assert len(w.process([obs("alex", "Du hast das Beet fertiggestellt.", 5, minute=500)])) == 1
    assert w.process([obs("alex", "Du hast das Beet fertiggestellt.", 5, minute=510)]) == []
    assert len(w.process([obs("alex", "Du hast das Beet fertiggestellt.", 5, minute=600)])) == 1


def test_decision_importance_is_blended_for_own_actions(sim):
    w = sim.memory.writer
    out = w.process([obs("alex", "Du prüfst die Quelle für Holz.", 3, kind="inspect")], {"alex": 7})
    assert out and out[0].importance == 5                                            # Mittel aus Regel (3) und Einschätzung (7)


def test_first_meeting_is_more_important(sim):
    out = sim.memory.writer.process([obs("alex", "Mira kommt im Garten dazu.", 3, kind="seen", persons=["mira"], shared=True)])
    assert out and out[0].importance == 5 and out[0].persons == ["mira"]


def test_memory_event_is_system_visible_and_has_data(sim):
    sim.memory.writer.process([obs("alex", "Du hast das Beet fertiggestellt.", 5)])
    ev = [e for e in sim.engine.events_since(0) if e.type == "agent.memory_created"]
    assert ev and ev[0].visibility == "system" and ev[0].agents == ["alex"] and ev[0].data["kind"] == "episode"


# --- getrennte Gedächtnisse -----------------------------------------------------------------------------
def test_memories_of_one_agent_are_never_visible_to_another(sim):
    sim.memory.writer.process([obs("alex", "Du hast ein Geheimnis im Wald entdeckt.", 8, kind="discovery", location="forest")])
    store = sim.memory.store
    assert store.list("mira")[0] == [] and store.count("mira") == 0
    sit = Situation(minute=600, location_id="forest", location_name="Wald")
    assert sim.memory.retriever.recall("mira", sit).items == []
    assert [s.memory.agent_id for s in sim.memory.retriever.recall("alex", sit).items] == ["alex"]
    alex_id = store.list("alex")[0][0].id
    assert store.get("mira", alex_id) is None and store.get_many("mira", [alex_id]) == []


def test_every_memory_statement_is_scoped_to_the_agent(sim):
    """Laufzeitprüfung: alle SQL-Anweisungen der Gedächtnis-Methoden auf Agententabellen nennen die Agentenkennung."""
    w, st, kn = sim.memory.writer, sim.memory.store, sim.memory.know
    m = w.remember("alex", "relation", "Ich habe am See mit Mira geredet.", 6, 300, location_id="lake", persons=["mira"], shared=True)
    w.remember("mira", "episode", "Ich habe Mira-eigenes erlebt.", 6, 301, location_id="lake")
    seen: list[str] = []
    sim.engine.state.conn.set_trace_callback(seen.append)
    sit = Situation(minute=400, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"])
    rec = sim.memory.retriever.recall("alex", sit)
    st.list("alex", q="See", person="mira", location="lake", kind="relation", status="active", sort="importance")
    st.get("alex", m.id); st.get_many("alex", [m.id]); st.pinned("alex"); st.recent("alex"); st.episodes_of_day("alex", 1)
    st.count("alex"); st.stats("alex"); st.touch("alex", [m.id], 400); st.set_status("alex", [m.id], "active")
    kn.retrievals("alex"); kn.retrievals_of("alex", m.id); kn.objects("alex"); kn.locations("alex"); kn.state_of("alex")
    kn.note_object("alex", "bench", "Bank", "bench", "", "lake", 400); kn.note_location("alex", "lake", 400, visit=True)
    kn.add_importance("alex", 3); kn.link_decision("alex", rec.retrieval_id, 1)
    sim.engine.state.conn.set_trace_callback(None)
    tables = ("memories", "retrievals", "known_objects", "known_locations", "memory_state")
    stmts = [q for q in seen if any(f" {t} " in q.replace("\n", " ") + " " or f" {t}(" in q for t in tables) and not q.startswith(("INSERT INTO memories_fts", "SAVEPOINT", "RELEASE"))]
    assert stmts
    unscoped = [q[:100] for q in stmts if "agent_id" not in q or "'mira'" in q.replace('"', "'") and "'alex'" not in q]
    assert not unscoped, unscoped


# --- Abruf ------------------------------------------------------------------------------------------------
def seed(sim):
    st = sim.memory.store
    st_add = lambda *a, **k: sim.memory.writer.remember(*a, **k)   # noqa: E731
    st_add("alex", "relation", "Ich habe am See lange mit Mira geredet.", 6, 300, location_id="lake", persons=["mira"], shared=True)
    st_add("alex", "episode", "Ich habe im Wald Holz gesammelt.", 4, 480, location_id="forest")
    st_add("alex", "episode", "Ich habe das Beet gegossen.", 4, 490, location_id="garden")
    return st


def test_situation_brings_the_matching_earlier_meeting_first(sim):
    seed(sim)
    sit = Situation(minute=560, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"])
    rec = sim.memory.retriever.recall("alex", sit)
    assert rec.items[0].memory.text.startswith("Ich habe am See lange mit Mira")
    assert rec.items[0].parts["relevanz"] > 0.5


def test_weights_change_the_order_measurably(sim):
    seed(sim)
    sit = Situation(minute=700, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"])
    first = lambda: sim.memory.retriever.recall("alex", sit, log=False).items[0].memory.text    # noqa: E731
    assert "See" in first()
    sim.memory.params.w_rel, sim.memory.params.w_rec, sim.memory.params.w_imp, sim.memory.params.w_shared = 0.0, 5.0, 0.0, 0.0
    assert "Beet" in first()                                                           # nur Aktualität zählt: das jüngste zuerst


def test_threshold_and_token_budget_are_respected(sim):
    seed(sim)
    sit = Situation(minute=560, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"])
    sim.memory.params.min_score = 0.99
    assert sim.memory.retriever.recall("alex", sit, log=False).items == []
    sim.memory.params.min_score, sim.memory.params.budget_tokens = 0.0, 25
    rec = sim.memory.retriever.recall("alex", sit, log=False)
    assert 1 <= len(rec.items) < 3 and rec.tokens <= 25


def test_recall_updates_access_and_logs_the_retrieval(sim):
    seed(sim)
    sit = Situation(minute=560, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"])
    rec = sim.memory.retriever.recall("alex", sit)
    m = sim.memory.store.get("alex", rec.items[0].memory.id)
    assert m.access_count == 1 and m.sim_last_access == 560
    log = sim.memory.know.retrievals("alex")
    assert log[0]["id"] == rec.retrieval_id and log[0]["items"][0]["id"] == m.id
    assert sim.memory.know.retrievals_of("alex", m.id)[0]["sim_minute"] == 560


def test_recent_experiences_already_in_the_prompt_buffer_are_not_repeated(sim):
    seed(sim)
    sit = Situation(minute=560, location_id="garden", location_name="Garten", exclude_since=485)
    texts = [s.memory.text for s in sim.memory.retriever.recall("alex", sit, log=False).items]
    assert not any("Beet" in t for t in texts)


def test_reflections_and_open_intentions_are_preferred(sim):
    from simulacra.memory.models import Memory
    from simulacra.memory.retrieval import PIN_BONUS
    sit = Situation(minute=560, location_id="garden", location_name="Garten")
    base = dict(id="m", agent_id="alex", text="x", importance=5, sim_created=500, location_id="garden", keywords=["gart"])
    r = sim.memory.retriever
    plain = r.score(Memory(kind="episode", **base), 1.0, 1.0, sit)[0]
    assert r.score(Memory(kind="reflection", **base), 1.0, 1.0, sit)[0] == pytest.approx(plain + PIN_BONUS)
    assert r.score(Memory(kind="intention", intention_state="open", **base), 1.0, 1.0, sit)[0] == pytest.approx(plain + PIN_BONUS)
    assert r.score(Memory(kind="intention", intention_state="done", **base), 1.0, 1.0, sit)[0] == pytest.approx(plain)


def test_persistence_across_restart(tmp_path):
    from simulacra.config import Settings
    from simulacra.simulation.builder import Simulation
    from simulacra.llm.providers import FakeProvider, first_option_fn
    s = Settings(llm_api_key_file="/nonexistent", llm_backoff_s=0.0)
    a = Simulation.create(s, tmp_path / "w.db", FakeProvider(fn=first_option_fn))
    a.store.ensure_all()
    a.memory.writer.remember("alex", "fact", "Ich weiß, wo der Schlüssel liegt.", 7, 100, location_id="forest")
    a.close()
    b = Simulation.create(s, tmp_path / "w.db", FakeProvider(fn=first_option_fn))
    assert [m.text for m in b.memory.store.list("alex")[0]] == ["Ich weiß, wo der Schlüssel liegt."]
    assert b.memory.store.list("mira")[0] == []
    assert b.memory.retriever.recall("alex", Situation(minute=200, location_id="forest", location_name="Wald")).items
    b.close()
