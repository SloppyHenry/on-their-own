"""Spielstände: Roundtrip, Sicherungen vor destruktiven Schritten, Überschreiben nur mit Bestätigung, Autosave-Ringpuffer, Neustart, Zurücksetzen."""

import asyncio
import shutil

import pytest

from simulacra.saves.service import SaveError
from simulacra.simulation.builder import Simulation

from .conftest import dump, file_sim


async def run_ticks(sim, n):
    await sim.runner.step(n)


async def test_roundtrip_restores_exactly_the_saved_state(sim, tmp_path):
    await run_ticks(sim, 40)
    await sim.params.patch([{"key": "world.scarcity", "value": 30}, {"key": "personality.curiosity", "value": 20, "agent": "mira"}])
    entry = await sim.engine.db.run(lambda: sim.saves.create("Stand A", "vor dem Weitersimulieren"))
    saved_minute = sim.engine.minute
    saved = dump(sim.saves.index.path(entry["id"]))
    await run_ticks(sim, 60)
    await sim.params.patch([{"key": "world.scarcity", "value": 80}])
    assert sim.engine.minute > saved_minute
    await sim.load_save(entry["id"])
    assert sim.engine.minute == saved_minute and sim.params.current_value("world.scarcity") == 30                 # auch die Parameter sind wieder wie gespeichert
    sim.close()
    live = dump(tmp_path / "live.db")
    assert {t: v for t, v in live.items() if t != "events"} == {t: v for t, v in saved.items() if t != "events"}      # alle Tabellen, Zeile für Zeile
    assert live["events"][: len(saved["events"])] == saved["events"] and [e[3] for e in live["events"][len(saved["events"]):]] == ["simulation.loaded"]
    sim2 = file_sim(tmp_path / "live.db")
    await run_ticks(sim2, 3)                                                                                       # und die geladene Welt läuft weiter
    sim2.close()


async def test_loading_makes_a_backup_first_and_tells_every_browser(sim):
    await run_ticks(sim, 10)
    entry = await sim.engine.db.run(lambda: sim.saves.create("Stand A"))
    await run_ticks(sim, 20)
    sub = sim.engine.bus.subscribe()
    await sim.load_save(entry["id"])
    backups = [e for e in sim.saves.list() if e["kind"] == "backup"]
    assert len(backups) == 1 and backups[0]["name"].startswith("Vor dem Laden") and backups[0]["sim_minute"] > entry["sim_minute"]
    got: list[str] = []
    while "simulation.loaded" not in got:
        got += [e.type for e in await asyncio.wait_for(sub.get(), 2)]
    assert "simulation.saved" in got                                                                              # die Sicherung wurde gemeldet, dann das Laden
    sub.close()
    # die Sicherung lässt sich wieder laden: man geht zum Stand vor dem Laden zurück
    before = backups[0]["sim_minute"]
    await sim.load_save(backups[0]["id"])
    assert sim.engine.minute == before


async def test_same_name_never_overwrites_without_confirmation(sim):
    await run_ticks(sim, 5)
    first = await sim.engine.db.run(lambda: sim.saves.create("Mein Stand"))
    await run_ticks(sim, 5)
    with pytest.raises(SaveError) as e:
        await sim.engine.db.run(lambda: sim.saves.create("mein stand"))
    assert e.value.code == "exists" and sim.saves.get(first["id"])["sim_minute"] == first["sim_minute"]
    again = await sim.engine.db.run(lambda: sim.saves.create("Mein Stand", overwrite=True))
    assert again["id"] == first["id"] and again["sim_minute"] > first["sim_minute"] and len([s for s in sim.saves.list() if s["kind"] == "manual"]) == 1
    for bad in ("", "x" * 81):
        with pytest.raises(SaveError):
            await sim.engine.db.run(lambda b=bad: sim.saves.create(b))


async def test_all_saves_are_listed_after_a_restart(tmp_path):
    sim = file_sim(tmp_path / "live.db")
    await run_ticks(sim, 5)
    a = await sim.engine.db.run(lambda: sim.saves.create("Eins"))
    b = await sim.engine.db.run(lambda: sim.saves.backup("Vor dem Test"))
    sim.close()
    sim2 = file_sim(tmp_path / "live.db")
    assert {e["id"] for e in sim2.saves.list()} == {a["id"], b["id"]} and all(e["available"] for e in sim2.saves.list())
    sim2.close()


async def test_a_corrupt_or_missing_save_is_refused_and_the_live_state_stays(sim):
    await run_ticks(sim, 10)
    entry = await sim.engine.db.run(lambda: sim.saves.create("Kaputt"))
    path = sim.saves.index.path(entry["id"])
    data = bytearray(path.read_bytes())
    data[len(data) // 2] ^= 0xFF
    path.write_bytes(bytes(data))
    minute = sim.engine.minute
    with pytest.raises(SaveError) as e:
        await sim.load_save(entry["id"])
    assert e.value.code == "corrupt" and sim.engine.minute == minute and [s for s in sim.saves.list() if s["kind"] == "backup"] == []
    path.unlink()
    with pytest.raises(SaveError) as e:
        await sim.load_save(entry["id"])
    assert e.value.status == 404


async def test_delete_removes_only_that_save(sim):
    a = await sim.engine.db.run(lambda: sim.saves.create("A"))
    b = await sim.engine.db.run(lambda: sim.saves.create("B"))
    sim.saves.delete(a["id"])
    assert [e["id"] for e in sim.saves.list()] == [b["id"]] and not sim.saves.index.path(a["id"]).exists()
    with pytest.raises(SaveError):
        sim.saves.delete(a["id"])


async def test_reset_backs_up_first_and_can_keep_profiles_presets_and_parameters(sim):
    await run_ticks(sim, 15)
    await sim.params.patch([{"key": "profile.interests", "value": "Schach", "agent": "mira"}, {"key": "exploration", "value": 77}])
    sim.presets.save("Mein Preset", "", data={"exploration": 10})
    minute = sim.engine.minute
    backup = await sim.reset(keep_profiles=True)
    assert sim.engine.minute < minute and backup is not None and backup.exists()
    names = [e["name"] for e in sim.saves.list() if e["kind"] == "backup"]
    assert len(names) == 1 and names[0].startswith("Vor dem Zurücksetzen")
    assert sim.store.get("mira").profile.interests == ["Schach"] and sim.params.current_value("exploration") == 77
    assert [p["name"] for p in sim.presets.list() if not p["builtin"]] == ["Mein Preset"]
    old = Simulation.create(sim.settings, backup, sim.provider)                                                  # der alte Stand ist unverändert da
    assert old.engine.minute == minute
    old.close()
    await sim.reset(keep_profiles=False)
    assert sim.engine.minute == 420 and sim.store.get("mira").profile.interests != ["Schach"] and sim.params.current_value("exploration") == 77
    assert len([e for e in sim.saves.list() if e["kind"] == "backup"]) == 2                                      # jedes Zurücksetzen sichert


async def test_the_model_belongs_to_the_simulation_and_survives_save_load_and_restart(sim, tmp_path):
    await sim.reset(model="modell-b")
    assert sim.client.params.model == "modell-b"
    entry = await sim.engine.db.run(lambda: sim.saves.create("Modell B"))
    assert entry["model"] == "modell-b"
    await sim.reset(model="modell-a")
    assert sim.client.params.model == "modell-a"
    await sim.load_save(entry["id"])
    assert sim.client.params.model == "modell-b"                                                                  # Laden verwendet immer das gespeicherte Modell
    sim.close()
    again = file_sim(tmp_path / "live.db")
    assert again.client.params.model == "modell-b"                                                                # auch nach einem Neustart
    again.close()
