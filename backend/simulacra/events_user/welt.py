"""Ereignisse von allein (AP18i): Die Welt bringt von sich aus Ereignisse, die niemand beeinflusst (Henry: „Es sollte schon Wetter und Ereignisse geben, die wir nicht beeinflussen können.“).

Der Katalog liegt als Daten in `data/ereignisse_welt.json`. Jedes Ereignis hat Bedingungen (Wetter, Tageszeit, vorhandene Orte), ein Gewicht, einen Mindestabstand und Wirkungen
als **Operationen der Ereigniseingabe** (AP08): dieselbe Ausführung, dieselbe Wissensverteilung, wer es erlebt, erfährt es. Der Takt ist deterministisch aus Seed und Zeit, wie das Wetter
(`world/weather.py`): ein Spielstand läuft gleich weiter. Für die Bewohner sind es natürliche Vorgänge ohne Urheber; im Protokoll steht ein eigenes Ereignis `world.nature_event`.
"""

import json
import random
from pathlib import Path
from typing import Any

from ..world import clock
from ..world.ereignis_takt import FREQUENCIES
from . import apply as applier
from .schema import parse_ops

CATALOG = Path(__file__).resolve().parent.parent / "data" / "ereignisse_welt.json"
CHECK_EVERY = 60
DAY = 1440


def load_catalog() -> list[dict[str, Any]]:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    return data["ereignisse"]


class Weltereignisse:
    def __init__(self, sim: Any):
        self.sim = sim
        self.frequency = "manchmal"                      # Standard (Frage 62); einstellbar beim Anlegen und in den Einstellungen (Parameter `world.events`)
        self.catalog = load_catalog()

    # --- Orte und Bewohner ---------------------------------------------------------------------------------------------
    def _places(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for loc in self.sim.engine.state.locations.values():
            if loc.props.get("fallback"):
                continue
            if "wald" not in out and loc.id.startswith("forest"):
                out["wald"] = loc.id
            if "see" not in out and (loc.props.get("fishing") or loc.id.startswith("lake")):
                out["see"] = loc.id
            if "garten" not in out and (loc.props.get("beds") or loc.id.startswith("garden")):
                out["garten"] = loc.id
        return out

    def _agents(self, which: str) -> list[str]:
        st = self.sim.engine.state
        ids = list(self.sim.store.ai_agent_ids())
        if which == "@draussen":
            return [a for a in ids if (ag := st.agent(a)) is not None and not ag.location_id.startswith("house")]
        return ids

    # --- Auswahl ---------------------------------------------------------------------------------------------------------
    def _fits(self, e: dict[str, Any], minute: int, weather: str, places: dict[str, str], last: dict[str, int]) -> bool:
        cond = e.get("wenn", {})
        if cond.get("wetter") and weather not in cond["wetter"]:
            return False
        if cond.get("phase") and clock.phase(minute) not in cond["phase"]:
            return False
        if any(p not in places for p in e.get("braucht", [])):
            return False
        return minute - last.get(e["id"], -10**9) >= e.get("abstand_tage", 2) * DAY

    def _resolve(self, ops: list[dict[str, Any]], places: dict[str, str]) -> list[dict[str, Any]] | None:
        out = []
        for raw in ops:
            op = dict(raw)
            for k, v in list(op.items()):
                if isinstance(v, str) and v.startswith("@") and k == "location":
                    if v[1:] not in places:
                        return None
                    op[k] = places[v[1:]]
                elif isinstance(v, str) and v in ("@alle", "@draussen") and k in ("agents", "recipients"):
                    who = self._agents(v)
                    if not who:
                        return None                        # niemand, der es erlebt: dann geschieht es nicht (kein Ereignis ohne Zeugen)
                    op[k] = who
            out.append(op)
        return out

    def due(self, minute: int) -> dict[str, Any] | None:
        """Das Ereignis, das zu diesem Zeitpunkt geschieht (oder None). Rein aus Seed, Zeit und Zustand bestimmt."""
        p = FREQUENCIES.get(self.frequency, 0.0)
        if p <= 0 or minute % CHECK_EVERY != 0:
            return None
        st = self.sim.engine.state
        rng = random.Random(f"{st.get_meta('seed')}:welt:{minute}")
        roll, pick = rng.random(), rng.random()
        last = st.get_meta("weltereignisse") or {}
        places, weather = self._places(), st.weather()["kind"]
        fits = [e for e in self.catalog if self._fits(e, minute, weather, places, last)]
        if not fits or roll >= p:
            return None
        total = sum(e.get("gewicht", 1) for e in fits)
        x = pick * total
        for e in fits:
            x -= e.get("gewicht", 1)
            if x < 0:
                return e
        return fits[-1]

    # --- Ausführen -------------------------------------------------------------------------------------------------------
    def tick(self, minute: int) -> list:
        e = self.due(minute)
        if e is None:
            return []
        st = self.sim.engine.state
        ops = self._resolve(e["ops"], self._places())
        if ops is None:
            return []
        mark = self.sim.engine.emit_event("world.nature_event", [], None, {"id": e["id"], "name": e["name"], "sign": e.get("zeichen", ""),
                                                                           "text": next((o["description"] for o in e["ops"] if o.get("description")), e["name"])})
        events = applier.execute(self.sim, parse_ops(ops), None, self.sim.planner.mode.mode)
        last = dict(st.get_meta("weltereignisse") or {})
        last[e["id"]] = minute
        with self.sim.db.transaction():
            st.set_meta("weltereignisse", last)
        return [mark, *events]
