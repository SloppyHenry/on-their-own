import json

from on_their_own.world.models import Event

from .conftest import add_ai_agent, make_sim, put


def dialogue(sim, speaker, to, text):
    """Lässt `speaker` etwas zu `to` sagen und verarbeitet die Ereignisse wie die Schleife."""
    res = sim.engine.propose(speaker, "speak", {"to": to, "text": text})
    assert res.ok, res.rejected
    out = []
    for _ in range(10):
        if sim.engine.state.agent(speaker).action is None:
            break
        evs = sim.engine.tick()
        extra = []
        for e in evs:
            if e.type == "agent.dialogue":
                extra += sim.convs.on_dialogue(e)
        sim.collector.ingest(evs + extra, sim.store.profile_ids())
        out += evs + extra
    return out


def together(sim):
    sim.store.ensure_all()
    put(sim, "alex", 20, 13)
    put(sim, "mira", 21, 13)


def memory(sim, aid):
    return [o["text"] for o in sim.store.recent_observations(aid, 50)]


# --- Beobachtungen ----------------------------------------------------------------------------------

def test_dialogue_is_observed_by_speaker_and_addressee_only_when_alone():
    sim = make_sim(); together(sim)
    dialogue(sim, "alex", "mira", "Schönes Wetter heute.")
    assert any(t.startswith("Du sagst zu Mira") for t in memory(sim, "alex"))
    assert any(t.startswith("Alex sagt zu dir: «Schönes Wetter heute.»") for t in memory(sim, "mira"))


def test_third_agent_overhears_only_in_range():
    sim = make_sim(); together(sim)
    add_ai_agent(sim, "jonas", "Jonas", [22, 14])
    dialogue(sim, "alex", "mira", "Geheimnis über die Karte.")
    assert any("Alex sagt zu Mira: «Geheimnis" in t for t in memory(sim, "jonas"))
    put(sim, "jonas", 40, 25)                                         # weit weg, anderer Ort
    dialogue(sim, "mira", "alex", "Nur für dich.")
    assert not any("Nur für dich" in t for t in memory(sim, "jonas"))


def test_agents_learn_nothing_about_what_happens_elsewhere():
    sim = make_sim(); together(sim)
    put(sim, "mira", 25, 9)                                           # Werkstatt, Alex bleibt im Wohnzimmer
    sim.engine.propose("mira", "inspect", {"object_id": "pickaxe"})
    evs = sim.engine.advance(3)
    sim.collector.ingest(evs, ["alex", "mira"])
    assert any("Du siehst dir Spitzhacke" in t for t in memory(sim, "mira"))
    assert not any("Spitzhacke" in t for t in memory(sim, "alex"))


def test_others_actions_are_seen_in_the_same_room_only():
    sim = make_sim(); together(sim)
    with sim.db.transaction():
        sim.engine.state.inv_set("mira", "food", 1)
        sim.engine.state.inv_set("mira", "wood", 1)
    put(sim, "mira", 7, 12)                                           # Küche, am Herd
    put(sim, "alex", 8, 13)                                           # ebenfalls Küche
    r = sim.engine.propose("mira", "use", {"object_id": "stove", "mode": "cook"})
    assert r.ok
    sim.collector.ingest(r.events, ["alex", "mira"])
    assert any(t.startswith("Mira kocht etwas") for t in memory(sim, "alex"))
    put(sim, "alex", 20, 13)
    sim.engine.interrupt("mira")
    r = sim.engine.propose("mira", "use", {"object_id": "stove", "mode": "cook"})
    before = len(memory(sim, "alex"))
    sim.collector.ingest(r.events, ["alex", "mira"])
    assert len(memory(sim, "alex")) == before                          # Wohnzimmer sieht die Küche nicht


def test_arrival_failure_and_world_news_are_recorded():
    sim = make_sim(); sim.store.ensure_all()
    evs = []
    sim.engine.propose("alex", "move_to", {"target": "kitchen_tap"})
    for _ in range(40):
        evs += sim.engine.tick()
    sim.collector.ingest(evs, ["alex", "mira"])
    mem = memory(sim, "alex")
    assert any(t.startswith("Du bist angekommen") for t in mem)
    r = sim.engine.propose("alex", "gather", {"resource": "stone"})
    sim.collector.ingest(r.events, ["alex"])
    assert any(t.startswith("Das ging nicht:") for t in memory(sim, "alex"))
    sim.collector.ingest(sim.engine.set_weather("storm", 120), ["alex", "mira"])
    assert any("Sturm" in t for t in memory(sim, "mira"))


def test_hidden_discovery_is_private():
    sim = make_sim(); sim.store.ensure_all()
    put(sim, "alex", 8, 25)
    from on_their_own.world.models import WorldObject
    with sim.db.transaction():
        sim.engine.state.save_object(WorldObject(id="stein_1", kind="item", name="Stein", location_id="forest", x=8, y=25), new=True)
    sim.engine.propose("alex", "inspect", {"object_id": "stein_1"})
    evs = sim.engine.advance(3)
    sim.collector.ingest(evs, ["alex", "mira"])
    assert any("Du entdeckst etwas: Rostiger Schlüssel" in t for t in memory(sim, "alex"))
    assert not any("Schlüssel" in t for t in memory(sim, "mira"))


# --- Gespräche ----------------------------------------------------------------------------------------

def test_conversation_opens_with_first_turn_and_offers_reply_to_the_partner():
    sim = make_sim(); together(sim)
    sim.convs.note_intent("alex", "mira")
    assert sim.convs.active_for("mira").status == "opening"
    evs = dialogue(sim, "alex", "mira", "Wie war deine Nacht?")
    assert "agent.conversation_started" in [e.type for e in evs]
    v = sim.convs.view_for("mira")
    assert v["awaiting_reply"] and v["partner_name"] == "Alex" and v["lines"] == ["Alex: Wie war deine Nacht?"]
    assert not sim.convs.view_for("alex")["awaiting_reply"]
    kinds = {o.kind for o in sim.planner.prepare("mira").options}
    assert "reply" in kinds and "end_talk" in kinds
    assert "speak" not in {o.kind for o in sim.planner.prepare("alex").options}      # man redet nicht zweimal hintereinander von vorn


def test_conversation_ends_after_max_turns():
    sim = make_sim(sim_conversation_max_turns=4); together(sim)
    ended = []
    for i, (a, b) in enumerate([("alex", "mira"), ("mira", "alex")] * 2):
        ended += [e for e in dialogue(sim, a, b, f"Beitrag Nummer {i} mit ganz eigenem Inhalt {i * 7}") if e.type == "agent.conversation_ended"]
    assert ended and ended[0].data["reason"] == "max_turns" and ended[0].data["turns"] == 4
    assert sim.convs.active_for("alex") is None


def test_repetition_ends_conversation():
    sim = make_sim(); together(sim)
    dialogue(sim, "alex", "mira", "Das Wetter ist heute wirklich sehr schön.")
    dialogue(sim, "mira", "alex", "Ja, finde ich auch.")
    evs = dialogue(sim, "alex", "mira", "Das Wetter ist heute wirklich sehr schön!")
    end = [e for e in evs if e.type == "agent.conversation_ended"]
    assert end and end[0].data["reason"] == "repetition"


def test_farewell_ends_conversation_and_observation_is_stored():
    sim = make_sim(); together(sim)
    dialogue(sim, "alex", "mira", "Hallo.")
    sim.convs.note_intent("mira", "alex", end=True)
    evs = dialogue(sim, "mira", "alex", "Ich muss weiter, bis später.")
    assert [e.data["reason"] for e in evs if e.type == "agent.conversation_ended"] == ["farewell"]
    assert any("Das Gespräch mit Alex ist zu Ende" in t for t in memory(sim, "mira"))


def test_silence_and_distance_end_conversations():
    sim = make_sim(); together(sim)
    dialogue(sim, "alex", "mira", "Hallo, hörst du mich?")
    sim.engine.advance(40)
    end = sim.convs.expire(sim.engine.minute)
    assert end and end[0].data["reason"] == "timeout"
    dialogue(sim, "alex", "mira", "Noch einmal hallo.")
    put(sim, "mira", 40, 25)
    end = sim.convs.expire(sim.engine.minute)
    assert end and end[0].data["reason"] == "left"


def test_unspoken_conversation_expires_silently():
    sim = make_sim(); together(sim)
    sim.convs.note_intent("alex", "mira")
    sim.engine.advance(40)
    assert sim.convs.expire(sim.engine.minute) == [] and sim.convs.active_for("alex") is None


def test_proposal_acceptance_sets_a_shared_plan():
    sim = make_sim(); together(sim)
    sim.convs.note_intent("alex", "mira", proposal="Lass uns zusammen zum See gehen.")
    dialogue(sim, "alex", "mira", "Hast du Lust auf einen Ausflug?")
    v = sim.convs.view_for("mira")
    assert v["open_proposal"]["text"] == "Lass uns zusammen zum See gehen." and not v["own_proposal_open"]
    kinds = {o.kind for o in sim.planner.prepare("mira").options}
    assert {"accept", "decline"} <= kinds
    sim.convs.note_intent("mira", "alex", respond="accept")
    evs = dialogue(sim, "mira", "alex", "Gern, lass uns gehen.")
    assert "agent.proposal_accepted" in [e.type for e in evs]
    assert sim.store.get("alex").plan_next == sim.store.get("mira").plan_next == "Lass uns zusammen zum See gehen."
    assert "Vorhaben: Lass uns zusammen" in sim.planner.prepare("alex").messages[1]["content"]


def test_proposal_decline_keeps_plans_untouched():
    sim = make_sim(); together(sim)
    sim.convs.note_intent("alex", "mira", proposal="Wir sollten Holz holen.")
    dialogue(sim, "alex", "mira", "Ich hätte eine Idee.")
    sim.convs.note_intent("mira", "alex", respond="decline")
    evs = dialogue(sim, "mira", "alex", "Heute lieber nicht.")
    assert "agent.proposal_declined" in [e.type for e in evs]
    assert sim.store.get("alex").plan_next == "" and sim.store.get("mira").plan_next == ""


def test_acceptance_willingness_shapes_the_scores():
    sim = make_sim(sim_top_k=40); together(sim)
    sim.convs.note_intent("alex", "mira", proposal="Lass uns zum See gehen.")
    dialogue(sim, "alex", "mira", "Ich habe einen Vorschlag.")
    def accept_minus_decline(value):
        with sim.db.transaction():
            pr = sim.store.get("mira")
            sim.store.save_profile("mira", pr.profile, pr.personality.model_copy(update={"suggestion_acceptance": value, "cooperation": value}))
        o = {x.kind: x.score for x in sim.planner.prepare("mira").options}
        return o["accept"] - o["decline"]
    assert accept_minus_decline(95) - accept_minus_decline(5) > 40
