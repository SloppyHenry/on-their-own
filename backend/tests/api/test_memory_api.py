from agents.conftest import make_sim

from .conftest import api
from tests.memory.test_integration import intent_chooser  # noqa: E402


def sim_with_memories():
    sim = make_sim(fn=intent_chooser())
    sim.store.ensure_all()
    w = sim.memory.writer
    w.remember("alex", "relation", "Ich habe am See lange mit Mira geredet.", 7, 300, location_id="lake", persons=["mira"], shared=True, source_event_id=None)
    w.remember("alex", "episode", "Ich habe im Wald Holz gesammelt.", 4, 480, location_id="forest")
    w.remember("mira", "fact", "Ich weiß, dass im Wald Pilze wachsen.", 6, 490, location_id="forest")
    return sim


def test_list_filters_sorting_and_pagination():
    with api(sim_with_memories()) as c:
        r = c.get("/api/agents/alex/memories").json()
        assert r["total"] == 2 and [m["text"][:12] for m in r["items"]] == ["Ich habe im ", "Ich habe am "]            # neueste zuerst
        assert c.get("/api/agents/alex/memories?sort=importance").json()["items"][0]["importance"] == 7
        assert c.get("/api/agents/alex/memories?person=mira").json()["total"] == 1
        assert c.get("/api/agents/alex/memories?location=forest&kind=episode").json()["total"] == 1
        assert c.get("/api/agents/alex/memories?q=Holz").json()["total"] == 1
        page = c.get("/api/agents/alex/memories?limit=1").json()
        assert len(page["items"]) == 1 and page["next_cursor"] == "1"
        assert c.get("/api/agents/alex/memories?limit=1&cursor=1").json()["next_cursor"] is None


def test_agents_never_see_each_others_memories_through_the_api():
    with api(sim_with_memories()) as c:
        mira = c.get("/api/agents/mira/memories").json()
        assert [m["agent_id"] for m in mira["items"]] == ["mira"]
        alex_id = c.get("/api/agents/alex/memories").json()["items"][0]["id"]
        assert c.get(f"/api/agents/mira/memories/{alex_id}").status_code == 404
        assert c.get(f"/api/agents/alex/memories/{alex_id}").status_code == 200


def test_validation_and_unknown_agent():
    with api(sim_with_memories()) as c:
        assert c.get("/api/agents/niemand/memories").status_code == 404
        assert c.get("/api/agents/alex/memories?kind=unsinn").status_code == 422
        assert c.get("/api/agents/alex/memories?limit=9999").status_code == 422
        assert c.get("/api/agents/alex/memories?cursor=abc").status_code == 422
        assert c.get("/api/agents/alex/memories/nichts").status_code == 422
        assert c.get("/api/agents/alex/memories/mem_AAAAAAAAAAAA").status_code == 404


def test_detail_has_sources_retrievals_and_source_event():
    sim = sim_with_memories()
    ev = sim.engine.emit_event("agent.arrived", ["alex"], "lake", {"at": [1, 1]})
    w = sim.memory.writer
    base = w.remember("alex", "episode", "Ich bin am See angekommen.", 6, 520, location_id="lake", source_event_id=ev.event_id)
    other = sim.memory.store.list("alex")[0][-1]
    refl = w.remember("alex", "reflection", "Ich mag den See.", 6, 530, source_memory_ids=[base.id, other.id], force=True)
    from simulacra.memory.retrieval import Situation
    sim.memory.retriever.recall("alex", Situation(minute=600, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"]))
    with api(sim) as c:
        d = c.get(f"/api/agents/alex/memories/{base.id}").json()
        assert d["source_event"]["id"] == ev.event_id and [x["id"] for x in d["derived"]] == [refl.id]
        assert d["retrievals"] and d["retrievals"][0]["sim_minute"] == 600
        r = c.get(f"/api/agents/alex/memories/{refl.id}").json()
        assert {s["id"] for s in r["sources"]} == {base.id, other.id}


def test_knowledge_retrievals_and_stats():
    sim = sim_with_memories()
    sim.memory.know.note_object("alex", "bench_square", "Bank am Platz", "bench", "", "square", 100)
    sim.memory.know.note_location("alex", "lake", 200, visit=True)
    from simulacra.memory.retrieval import Situation
    sim.memory.retriever.recall("alex", Situation(minute=600, location_id="lake", location_name="See", persons=["mira"], person_names=["Mira"]))
    with api(sim) as c:
        k = c.get("/api/agents/alex/knowledge").json()
        assert any(o["name"] == "Bank am Platz" and o["location_name"] for o in k["objects"])
        assert any(l["location_id"] == "lake" and l["visits"] == 1 and l["name"] == "See" for l in k["locations"])
        assert k["persons"][0]["id"] == "mira" and k["persons"][0]["memories"] == 1
        rs = c.get("/api/agents/alex/retrievals").json()
        assert rs and rs[0]["items"][0]["text"] and {"relevanz", "aktualität"} <= set(rs[0]["items"][0]["parts"])
        s = c.get("/api/agents/alex/memory-stats").json()
        assert s["active"] == 2 and s["archived"] == 0 and s["by_kind"]["relation"] == 1
