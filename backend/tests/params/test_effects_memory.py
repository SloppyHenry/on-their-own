"""Wirkungstests: Die Gedächtnis-Regler verändern Abruf, Reflexion und Pflege tatsächlich."""

from simulacra.memory.retrieval import Situation

from .conftest import patch


THINGS = ["Karotten gesät", "das Beet gegossen", "Unkraut gejätet", "einen Zaun repariert", "Holz gestapelt", "eine Schnecke gefunden", "den Brunnen geprüft", "Samen sortiert",
          "einen Rechen geschliffen", "Mist verteilt", "Kürbisse gezählt", "Vögel beobachtet", "die Bank gestrichen", "ein Nest entdeckt", "Wasser geholt", "Kräuter geerntet"]


def fill(sim, agent="alex", n=8, importance=5, start=100, step=20, who="mira"):
    w = sim.memory.writer
    return [w.remember(agent, "episode", f"Ich habe im Garten {THINGS[i % len(THINGS)]}.", importance, start + i * step, location_id="garden", persons=[who] if i % 2 else [])
            for i in range(n)]


SIT = Situation(minute=700, location_id="garden", location_name="Garten", persons=["mira"], person_names=["Mira"])


def recall(sim):
    return sim.memory.retriever.recall("alex", SIT, log=False).items


async def test_memory_retrieval_parameters(sim):
    fill(sim, n=40, start=10, step=15)
    await patch(sim, "memory.retrieval_threshold", 0.0)
    await patch(sim, "memory.max_in_context", 3)
    assert len(recall(sim)) == 3
    await patch(sim, "memory.max_in_context", 40)
    await patch(sim, "memory.context_token_budget", 4000)
    many = recall(sim)
    assert len(many) > 20
    await patch(sim, "memory.context_token_budget", 300)
    small = sim.memory.retriever.recall("alex", SIT, log=False)
    assert 0 < len(small.items) < len(many) and small.tokens <= 300                  # kleines Budget schneidet ab
    await patch(sim, "memory.context_token_budget", 4000)
    await patch(sim, "memory.retrieval_threshold", 0.99)
    assert len(recall(sim)) < len(many) // 2                                          # hohe Schwelle lässt fast nichts durch


async def test_memory_weights_change_the_order(sim):
    w = sim.memory.writer
    old_important = w.remember("alex", "episode", "Ich habe im Garten ein wichtiges Werkzeug gefunden.", 9, 100, location_id="garden")
    new_trivial = w.remember("alex", "episode", "Ich habe im Garten ein Blatt gesehen.", 4, 690, location_id="garden")
    await patch(sim, "memory.retrieval_threshold", 0.0)
    await patch(sim, "memory.w_relevance", 0.0)
    await patch(sim, "memory.w_shared", 0.0)
    await patch(sim, "memory.w_importance", 1.0)
    await patch(sim, "memory.w_recency", 0.0)
    assert recall(sim)[0].memory.id == old_important.id                               # nur Wichtigkeit zählt
    await patch(sim, "memory.w_importance", 0.0)
    await patch(sim, "memory.w_recency", 1.0)
    assert recall(sim)[0].memory.id == new_trivial.id                                 # nur Aktualität zählt
    await patch(sim, "memory.w_importance", 0.5)
    await patch(sim, "memory.recency_half_life", 1)
    short = {s.memory.id: s.parts["aktualität"] for s in recall(sim)}
    await patch(sim, "memory.recency_half_life", 168)
    long_ = {s.memory.id: s.parts["aktualität"] for s in recall(sim)}
    assert long_[old_important.id] > short[old_important.id]                          # lange Halbwertszeit lässt Altes weniger verblassen


async def test_lower_reflection_threshold_means_more_reflections(sim):
    fill(sim, n=8, importance=5)                                                       # 40 Punkte
    assert sim.memory.reflector.due("alex", 600) is None
    await patch(sim, "memory.reflection_threshold", 30)
    assert sim.memory.reflector.due("alex", 600) == "importance"
    await patch(sim, "memory.reflection_threshold", 300)
    assert sim.memory.reflector.due("alex", 600) is None


async def test_summary_interval_and_archive(sim):
    fill(sim, n=6, importance=5, start=100)
    sim.memory.writer.remember("alex", "episode", "Ich habe etwas sehr Wichtiges erlebt.", 9, 500, location_id="lake")
    await patch(sim, "memory.summary_interval", 72)                                    # alle drei Tage
    await patch(sim, "memory.archive_after_days", 0)                                   # 0 = nie archivieren
    assert sim.memory.maintenance.run("alex", 1440 + 60)["summaries"] == 0             # Tag 2: zu früh
    done = sim.memory.maintenance.run("alex", 4 * 1440 + 60)
    assert done["summaries"] >= 1 and done["archived"] == 0 and sim.memory.store.count("alex", "archived") == 0
    await patch(sim, "memory.archive_after_days", 1)
    assert sim.memory.maintenance.archive("alex", 30 * 1440) >= 1
    assert sim.memory.store.count("alex", "archived") >= 1 and sim.memory.store.count("alex") >= 1      # archiviert, nie gelöscht
