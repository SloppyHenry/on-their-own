"""§17 Nr. 16: Ressourcenverbrauch ist durch definierte Grenzen kontrollierbar.

Jede Grenze wird niedrig gesetzt und muss dann im Lauf halten: Entscheidungen (= LLM-Aufrufe) je Minute, Objekte in der
Welt, aktive Erinnerungen je Agent, Gesprächslänge, freie Eingaben je Minute, Rückstand je WebSocket-Verbindung.
Dazu die Messwerte der Langläufe (scripts/langlauf.py) gegen die Grenzwerte aus AP11, sobald sie vorliegen.
"""

import asyncio
import importlib.util
import json
from pathlib import Path

import pytest

from agents.conftest import make_sim, put
from autonomy.test_longrun import model
from params.conftest import patch
from on_their_own.events_user.service import InjectError

ROOT = Path(__file__).resolve().parents[3]
_spec = importlib.util.spec_from_file_location("langlauf", ROOT / "scripts" / "langlauf.py")
langlauf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(langlauf)
LIMITS = langlauf.LIMITS


async def test_k16_entscheidungen_je_minute_sind_begrenzt():
    sim = make_sim(fn=model())
    lim = sim.runner.limiter
    await patch(sim, "sim.max_decisions_per_min", 3)
    for aid in ("alex", "mira", "alex"):
        await lim.acquire(aid)
    assert lim.delay_for("mira") > 50                                  # die vierte Entscheidung (und damit der vierte LLM-Aufruf) wartet
    await patch(sim, "sim.max_decisions_per_min", 0)
    assert lim.delay_for("mira") == 0
    sim.close()


async def test_k16_objekte_erinnerungen_und_gespraeche_bleiben_im_lauf_unter_der_grenze():
    sim = make_sim(fn=model())
    put(sim, "alex", 7, 7)
    put(sim, "mira", 8, 7)
    st = sim.engine.state
    limit = max(20, -(-(st.object_count() + 2) // 10) * 10)                 # Schrittweite des Parameters: 10
    await patch(sim, "world.max_objects", limit)
    sim.memory.params.max_active = 25
    sim.convs.max_turns = 4
    await sim.runner.step(1440)
    await sim.runner.step(2 * 1440 + 1 - sim.engine.minute)            # bis kurz nach dem Tageswechsel: dort läuft die Gedächtnispflege
    c = st.conn
    assert sim.runner.stats.decisions > 200                             # es ist wirklich etwas passiert
    assert st.object_count() <= limit
    for a in ("alex", "mira"):
        assert sim.memory.store.count(a) <= 25                          # die Grenze greift einmal je Sim-Tag (dazwischen wächst der Bestand)
    turns = [len(json.loads(t)) for (t,) in c.execute("SELECT turns FROM conversations")]
    assert turns and max(turns) <= 4
    sim.close()


async def test_k16_freie_eingaben_je_minute_sind_begrenzt():
    sim = make_sim(fn=model())
    sim.inject.rate = 3
    for _ in range(3):
        sim.inject._limit("Heute regnet es.")
    with pytest.raises(InjectError) as e:
        sim.inject._limit("Heute regnet es.")
    assert e.value.status == 429
    sim.close()


async def test_k16_rueckstand_je_verbindung_ist_begrenzt():
    sim = make_sim(fn=model())
    sub = sim.engine.bus.subscribe(max_backlog=5)
    await sim.runner.step(30)                                           # erzeugt deutlich mehr als 5 Ereignisse, niemand liest
    await asyncio.sleep(0.05)
    assert sub.overflowed and sub.pending <= 5                          # statt unbegrenzt zu puffern: Resync verlangen
    sim.close()


def _runs() -> list[Path]:
    return [p for p in (ROOT / "data" / "langlauf" / m / "samples.jsonl" for m in ("real", "fake")) if p.exists()]


@pytest.mark.skipif(not _runs(), reason="noch kein Langlauf (scripts/langlauf.py)")
@pytest.mark.parametrize("samples", _runs(), ids=lambda p: p.parent.name)
def test_k16_langlauf_bleibt_innerhalb_der_grenzwerte(samples: Path):
    rows = [json.loads(line) for line in samples.read_text().splitlines() if line.strip()]
    assert len(rows) >= 2
    first, last = rows[0], rows[-1]
    assert all(r["alive"] for r in rows)                                # kein Absturz
    assert max(r["rss_mb"] for r in rows) < LIMITS["rss_mb"]
    sim_days = (last["sim_minute"] - first["sim_minute"]) / 1440
    if sim_days >= 0.5:
        assert (last["db_mb"] - first["db_mb"]) / sim_days < LIMITS["db_mb_per_sim_day"]
    for aid, s in langlauf.db_metrics(samples.parent)["streaks"].items():          # aus der Datenbank des Laufs, nicht aus der letzten Messzeile
        assert s["error_streak"] <= LIMITS["error_streak"], aid
        assert s["guarded_streak"] < LIMITS["action_streak"], (aid, s["guarded_streak_key"])
        # Warten und Gesprächszüge sperrt der Schutz absichtlich nicht; ihre Serien stehen im Langlauf-Bericht (docs/status/langlauf.md)
    assert last["ws"]["gaps"] == 0                                      # keine Lücke in den Ereignisnummern beim Mitlesen
