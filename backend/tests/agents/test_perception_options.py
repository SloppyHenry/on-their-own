import json

from simulacra.agents import options as opt_mod
from simulacra.agents import perception, prompts
from simulacra.agents.model import Personality
from simulacra.agents.scoring import Tuning, agent_themes

from .conftest import needs, put


def percept(sim, aid):
    return perception.build(sim.engine, sim.store, sim.convs, aid)


def opts(sim, aid, tuning=None):
    return opt_mod.build_options(sim.engine, sim.store, percept(sim, aid), tuning or Tuning())


def all_opts(sim, aid):
    return opt_mod.generate(sim.engine, sim.store, percept(sim, aid))


# --- Wahrnehmung -------------------------------------------------------------------------------------

def test_perception_shows_only_own_room_and_known_places(sim):
    p = percept(sim, "alex")
    assert p.location_id == "house.bedroom_a" and {o["name"] for o in p.objects} == {"Bett (Alex)", "Truhe", "Tür Zimmer Alex"}
    assert p.people == []                                           # Mira steht hinter der Wand
    names = {k["name"] for k in p.known_places}
    assert "Garten" in names and "See" not in names and "Wald" not in names and p.unknown_exists


def test_people_are_visible_in_the_same_room_and_outdoors(sim):
    put(sim, "mira", 8, 8)
    assert [x.name for x in percept(sim, "alex").people] == ["Mira"]
    put(sim, "alex", 20, 19)
    put(sim, "mira", 24, 19)
    assert percept(sim, "alex").people[0].distance == 4.0
    put(sim, "mira", 20, 12)                                          # drinnen: nicht sichtbar, auch wenn nah
    assert percept(sim, "alex").people == []


def test_hidden_object_appears_only_for_the_finder(sim):
    put(sim, "alex", 9, 26)
    put(sim, "mira", 9, 26)
    assert "Rostiger Schlüssel" not in {o["name"] for o in percept(sim, "alex").objects}
    with sim.db.transaction():
        k = sim.engine.state.obj("old_key")
        k.known_by = ["alex"]
        sim.engine.state.save_object(k)
    assert "Rostiger Schlüssel" in {o["name"] for o in percept(sim, "alex").objects}
    assert "Rostiger Schlüssel" not in {o["name"] for o in percept(sim, "mira").objects}


def test_prompt_never_reveals_control_type_or_creator(sim):
    prep = sim.planner.prepare("alex")
    text = (prep.messages[0]["content"] + prep.messages[1]["content"]).lower()
    for forbidden in ("ki-agent", "künstliche", "language model", "llm", "simulation", "nutzer", "schöpfer", "spieler", "mensch", "bot "):
        assert forbidden not in text.replace("menschen", ""), forbidden


def test_prompt_structure_stable_prefix_then_variable_part(sim):
    a = sim.planner.prepare("alex")
    put(sim, "alex", 20, 13)
    b = sim.planner.prepare("alex")
    assert a.messages[0] == b.messages[0]                             # System-Teil identisch -> Prompt-Cache
    assert a.messages[1] != b.messages[1]
    assert a.messages[0]["content"].startswith("Du bist Alex")
    assert "Optionen" in a.messages[1]["content"] and "other:" in a.messages[1]["content"]


def test_agents_have_separate_contexts(sim):
    a, m = sim.planner.prepare("alex"), sim.planner.prepare("mira")
    assert "Mira" in m.messages[0]["content"] and "Alex" in a.messages[0]["content"]
    assert "Botanikerin" not in a.messages[0]["content"] + a.messages[1]["content"]
    assert "Zimmermann" not in m.messages[0]["content"] + m.messages[1]["content"]


# --- Optionen ------------------------------------------------------------------------------------------

def test_every_offered_option_is_valid_in_the_engine(sim):
    for aid in ("alex", "mira"):
        for o in opts(sim, aid, Tuning(top_k=30, per_kind_max=30)):
            probe = {**o.params, **({o.utterance_key: "…"} if o.utterance_key else {})}
            assert sim.engine.check(aid, o.action, probe).__class__.__name__ == "Accepted", o.label


def test_top_k_ids_and_diversity(sim):
    put(sim, "alex", 20, 13)
    o = opts(sim, "alex")
    assert len(o) <= 6 and [x.id for x in o] == [f"o{i}" for i in range(1, len(o) + 1)]
    assert [x.score for x in o] == sorted((x.score for x in o), reverse=True)
    from collections import Counter
    assert max(Counter(x.kind for x in o).values()) <= 2


def test_unknown_places_are_not_named(sim):
    labels = " ".join(o.label for o in all_opts(sim, "alex"))
    assert "Wald" not in labels and "See" not in labels and "unbekanntes Gebiet" in labels


def test_discovering_a_place_turns_exploration_into_a_normal_move(sim):
    with sim.db.transaction():
        sim.engine.state.mark_discovered("lake", "alex")
    labels = [o.label for o in all_opts(sim, "alex")]
    assert any(l.startswith("Zum See gehen") for l in labels)


def test_personality_changes_scores_not_just_text(sim):
    put(sim, "alex", 20, 13)
    put(sim, "mira", 21, 13)
    def best(sociability, initiative, aid="alex"):
        with sim.db.transaction():
            pr = sim.store.get(aid)
            pe = pr.personality.model_copy(update={"sociability": sociability, "conversation_initiative": initiative})
            sim.store.save_profile(aid, pr.profile, pe)
        return next(o for o in opts(sim, aid, Tuning(top_k=40, per_kind_max=40)) if o.kind == "speak")
    shy, chatty = best(5, 5), best(95, 95)
    assert chatty.score - shy.score > 25
    names = {n for n, _ in chatty.factors}
    assert {"Geselligkeit", "Gesprächsinitiative"} <= names


def test_curiosity_and_risk_drive_exploration(sim):
    def explore_score(c, r):
        with sim.db.transaction():
            pr = sim.store.get("alex")
            sim.store.save_profile("alex", pr.profile, pr.personality.model_copy(update={"curiosity": c, "risk_taking": r}))
        return max(o.score for o in opts(sim, "alex", Tuning(top_k=40, per_kind_max=40)) if o.kind == "explore")
    assert explore_score(95, 90) - explore_score(5, 10) > 30


def test_hunger_and_thirst_force_matching_options(sim):
    put(sim, "mira", 10, 14)                                          # Küche, Wasserhahn in der Nähe
    needs(sim, "mira", hunger=92, thirst=92)
    kinds = [o.kind for o in opts(sim, "mira")]
    assert "drink" in kinds and any(k in kinds for k in ("eat", "cook"))
    assert max(o.score for o in opts(sim, "mira") if o.kind == "drink") > 55


def test_exhaustion_forces_sleep_or_rest_and_night_prefers_sleep(sim):
    needs(sim, "alex", energy=10)
    assert {"sleep", "rest"} & {o.kind for o in opts(sim, "alex")}
    needs(sim, "alex", energy=80)
    day = next(o for o in all_opts_scored(sim, "alex") if o.kind == "sleep").score
    sim.engine.advance(15 * 60)                                       # 22:00
    night = next(o for o in all_opts_scored(sim, "alex") if o.kind == "sleep").score
    assert night - day > 30


def all_opts_scored(sim, aid):
    return opts(sim, aid, Tuning(top_k=60, per_kind_max=60))


def test_repetition_is_penalised(sim):
    first = next(o for o in all_opts_scored(sim, "alex") if o.kind == "rest")
    for _ in range(3):
        sim.engine.propose("alex", "rest", {"minutes": 15})
        sim.engine.advance(16)
    later = next(o for o in all_opts_scored(sim, "alex") if o.kind == "rest")
    assert ("Wiederholung", -42.0) in later.factors and later.score == 0.0 and first.score > 20      # Punktzahl wird bei 0 gekappt


def test_goals_and_themes_connect_to_places(sim):
    assert agent_themes(["etwas Bleibendes bauen"], ["Holzarbeiten"]) == {"craft": 10}
    assert agent_themes(["einen Garten anlegen"], ["der See", "Gemeinschaft"])["garden"] == 10
    ws = next(o for o in all_opts_scored(sim, "alex") if o.target_loc == "house.workshop")
    kitchen = next(o for o in all_opts_scored(sim, "alex") if o.target_loc == "house.kitchen")
    assert any(n.startswith("Passt zu Zielen") for n, _ in ws.factors) and ws.score > kitchen.score


def test_search_option_for_the_other_agent(sim):
    labels = [o.label for o in all_opts(sim, "alex")]
    assert any(l.startswith("Nach Mira sehen") for l in labels)
    s = {a: next(o for o in all_opts_scored(sim, a) if o.kind == "search").score for a in ("alex", "mira")}
    assert s["mira"] - s["alex"] > 10                               # die Gesellige sucht eher als der Zurückhaltende
    put(sim, "mira", 8, 8)
    assert not any(l.startswith("Nach Mira sehen") for l in [o.label for o in all_opts(sim, "alex")])   # sie ist ja da


def test_holding_enough_of_a_resource_discourages_gathering_more(sim):
    put(sim, "alex", 24, 6)
    plain = next(o for o in all_opts_scored(sim, "alex") if o.kind == "gather").score
    with sim.db.transaction():
        sim.engine.state.inv_set("alex", "wood", 3)
    heavy = next(o for o in all_opts_scored(sim, "alex") if o.kind == "gather" and o.params["resource"] == "wood")
    assert any(n == "Schon genug dabei" for n, _ in heavy.factors) and heavy.score < plain


def test_social_and_give_options_need_a_listener(sim):
    assert not [o for o in all_opts(sim, "alex") if o.kind in ("speak", "give")]
    put(sim, "mira", 8, 8)
    with sim.db.transaction():
        sim.engine.state.inv_set("alex", "wood", 2)
    kinds = {o.kind for o in all_opts(sim, "alex")}
    assert {"speak", "give"} <= kinds


def test_build_option_only_when_affordable_and_listed_with_cost(sim):
    put(sim, "alex", 36, 13)
    assert not [o for o in all_opts_scored(sim, "alex") if o.kind == "build"]
    with sim.db.transaction():
        sim.engine.state.inv_set("alex", "wood", 3)
    b = [o for o in all_opts_scored(sim, "alex") if o.kind == "build"]
    assert b and "Bank bauen (Kosten: 3× Holz)" in " ".join(o.label for o in b)


def test_other_schema_enum_matches_offered_options(sim):
    prep = sim.planner.prepare("alex")
    enum = prep.schema["properties"]["option_id"]["enum"]
    assert enum == [o.id for o in prep.options] + ["other"]
    assert prep.schema["required"] == ["option_id", "intent", "utterance", "importance"]
    json.dumps(prep.schema)
    assert Personality().f("sociability") == 0
