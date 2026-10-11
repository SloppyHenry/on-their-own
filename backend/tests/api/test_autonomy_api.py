from agents.conftest import make_sim, put

from .conftest import api, post




def test_overview_needs_goals_relations_failures_and_decisions():
    sim = make_sim()
    sim.store.ensure_all()
    with api(sim) as c:
        post(c, "/api/sim/step", {"n": 40})
        ov = c.get("/api/overview").json()
        assert [o["id"] for o in ov] == ["alex", "mira"]
        a = ov[0]
        assert a["goal"]["kind"] == "short" and a["goal"]["text"] == "Den Garten besuchen" and a["goal"]["condition"]["type"] == "location_visited"
        assert [g["text"] for g in a["long_goals"]] == ["etwas Bleibendes bauen"] and a["mood"]["word"] and {n["key"] for n in a["needs"]} >= {"energy", "hunger", "thirst", "social", "calm"}
        assert "warmth" not in {n["key"] for n in a["needs"]}                         # Wärme ist standardmäßig aus
        needs = c.get("/api/agents/alex/needs").json()
        assert needs["mood"]["reasons"][0][0] == "Grundstimmung" and all(0 <= n["value"] <= 100 for n in needs["needs"])
        goals = c.get("/api/agents/alex/goals").json()
        assert goals[0]["plan"][0]["kind"] == "move" and c.get("/api/agents/alex/goals?state=active").json()
        assert c.get("/api/agents/alex/goals?state=quatsch").status_code == 422
        rel = c.get("/api/agents/alex/relations").json()
        assert rel[0]["other_id"] == "mira" and set(rel[0]["values"]) == {"trust", "sympathy", "tension", "familiarity"}
        dec = c.get("/api/agents/alex/decisions?limit=5").json()
        assert dec and dec[0]["why"].startswith("Alex ") and dec[0]["rank"] and dec[0]["options"][0]["factors"]
        one = c.get(f"/api/decisions/{dec[0]['id']}").json()
        assert one["why"] == dec[0]["why"] and one["groups"]
        assert c.get("/api/decisions/99999").status_code == 404
        assert c.get("/api/agents/alex/failures").status_code == 200
        reg = c.get("/api/factors").json()
        assert {"label": "Ziel", "key": "goal_progress"} in reg["factors"] and reg["groups"]["goal_progress"]
        for path in ("needs", "goals", "relations", "failures", "decisions"):
            assert c.get(f"/api/agents/niemand/{path}").status_code == 404


def test_relation_changes_and_failures_show_up_in_the_api():
    sim = make_sim()
    sim.store.ensure_all()
    sim.autonomy.relations.adjust("alex", "mira", {"trust": 3}, "Mira hat mir geholfen", 500, shared="Gemeinsam Holz gestapelt")
    sim.autonomy.guards.log_failure("alex", 500, "gather", {"resource": "wood"}, "missing_tool", "Du brauchst eine Axt.", {"location": "forest"}, 12)
    with api(sim) as c:
        r = c.get("/api/agents/alex/relations").json()[0]
        assert r["values"]["trust"] == 53 and r["shared"] == ["Gemeinsam Holz gestapelt"] and r["log"][0]["reason"] == "Mira hat mir geholfen"
        f = c.get("/api/agents/alex/failures").json()[0]
        assert f["code"] == "missing_tool" and f["params"] == {"resource": "wood"} and f["context"]["location"] == "forest"
