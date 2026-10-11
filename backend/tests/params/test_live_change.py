"""Änderungen im laufenden Betrieb (§17 Nr. 9): Die Simulation läuft, ein Regler wird bewegt, die nächste Entscheidung nutzt den neuen Wert."""

import asyncio

from .conftest import patch


async def test_the_next_decision_after_a_change_uses_the_new_value(sim):
    sim.client.provider.delay_s = 0.02
    await sim.runner.start()
    await asyncio.sleep(0.4)
    seen_before = len(sim.client.provider.calls)
    assert seen_before > 3 and sim.runner.state.value == "running"
    await patch(sim, "personality.curiosity", 91, "alex")
    await patch(sim, "profile.description", "ein Mensch mit einer sehr eigenen Stimme", "alex")
    await patch(sim, "llm.temperature", 0.21)
    await patch(sim, "top_k_options", 4)
    await asyncio.sleep(0.5)
    await sim.runner.stop()
    after = sim.client.provider.calls[seen_before + 2:]                                       # ein Aufruf kann beim Ändern schon unterwegs gewesen sein
    alex = [c for c in after if "Du bist Alex" in c["messages"][0]["content"]]
    assert alex and all("Neugier 91" in c["messages"][0]["content"] and "sehr eigenen Stimme" in c["messages"][0]["content"] for c in alex)
    assert all(c["params"].temperature == 0.21 for c in after)
    assert all(len([ln for ln in c["messages"][1]["content"].splitlines() if ln.startswith("o") and ln[1:2].isdigit()]) <= 4 for c in after)
    before = sim.client.provider.calls[:seen_before]
    assert all("Neugier 91" not in c["messages"][0]["content"] for c in before)
