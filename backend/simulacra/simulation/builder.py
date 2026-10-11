"""Verdrahtet alle Teile zu einer lauffähigen Simulation (Engine, Agenten, Modell, Schleife)."""

import shutil
from typing import Any
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from ..agents.autonomy import Autonomy
from ..agents.conversation import ConversationManager
from ..agents.observations import ObservationCollector
from ..agents.planner import Planner
from ..agents.scoring import Tuning
from ..agents.store import AgentStore
from ..config import Settings
from ..db.connection import Database
from ..llm.client import LLMClient
from ..llm.providers import LLMProvider
from ..events_user.service import InjectService
from ..memory.params import MemoryParams
from ..memory.system import MemorySystem
from ..params.apply import ParamService
from ..params.presets import PresetManager
from ..saves.service import AutoSavePolicy, SaveService
from ..saves import snapshot as snap
from ..world.engine import WorldEngine
from .limits import DecisionLimiter
from .runner import SimulationRunner


@dataclass
class Simulation:
    settings: Settings
    db_path: str
    provider: LLMProvider | None
    db: Database
    engine: WorldEngine
    store: AgentStore
    convs: ConversationManager
    client: LLMClient
    planner: Planner
    collector: ObservationCollector
    memory: MemorySystem
    autonomy: Autonomy
    runner: SimulationRunner
    params: ParamService
    presets: PresetManager
    inject: InjectService
    npcs: Any
    autosave: AutoSavePolicy
    saves: SaveService | None

    @classmethod
    def create(cls, settings: Settings, db_path: str | Path = ":memory:", provider: LLMProvider | None = None, seed: int = 1) -> "Simulation":
        db = Database(db_path)
        engine = WorldEngine.create(db, seed=seed)
        if (stored := engine.state.get_meta("llm_model")):
            settings.llm_model = stored                 # das Modell gehört zur Simulation (Frage 10): gespeichert beim Anlegen, gilt nach Neustart und Laden
        else:
            engine.state.set_meta("llm_model", settings.llm_model)
        store = AgentStore(engine.state)
        convs = ConversationManager(engine, store, max_turns=settings.sim_conversation_max_turns)
        client = LLMClient.from_settings(settings, provider)
        memory = MemorySystem(engine, MemoryParams.from_settings(settings), store, client)
        autonomy = Autonomy(engine, store, memory, client)
        memory.reflector.relations = autonomy.relations
        planner = Planner(engine, store, convs, client, Tuning(top_k=settings.sim_top_k), settings.sim_memory_lines, settings.sim_correction_retries, memory, autonomy)
        collector = ObservationCollector(engine.state, store)
        runner = SimulationRunner(engine, store, convs, collector, planner, memory, autonomy,
                                  DecisionLimiter(settings.sim_min_decision_gap_s, settings.sim_max_decisions_per_minute), settings.sim_tick_delay_s)
        sim = cls(settings, str(db_path), provider, db, engine, store, convs, client, planner, collector, memory, autonomy, runner, None, None, None, None, AutoSavePolicy(), None)  # type: ignore[arg-type]
        sim.params, sim.presets = ParamService(sim), PresetManager(sim)
        sim.inject = InjectService(sim)
        runner.inject = sim.inject
        runner.owner = sim
        if str(db_path) != ":memory:":
            sim.saves = SaveService(sim, Path(db_path).parent / "saves")
        sim.params.restore(sim.params.export())            # gespeicherte Abweichungen (Neustart) wieder anwenden
        return sim

    async def reset(self, backup_dir: Path | None = None, model: str | None = None, keep_profiles: bool = False) -> Path | None:
        """Hält an, sichert den bisherigen Stand (nie löschen: als Spielstand „Vor dem Zurücksetzen“) und legt eine frische Welt an. Gibt den Sicherungspfad zurück.

        Parameter und eigene Presets bleiben erhalten; `keep_profiles` behält auch die Profile und Persönlichkeitswerte. `model` wählt das Modell der neuen Simulation.
        """
        await self.runner.stop()
        kept = [k for k in await self.db.run(self.params.export) if keep_profiles or k[1] is None]      # „komplett Standard“: auch Werte je Agent fallen weg
        presets = await self.db.run(lambda: [tuple(r) for r in self.db.conn.execute("SELECT id, name, description, data, created, updated FROM presets")])
        profiles = await self.db.run(lambda: [tuple(r) for r in self.db.conn.execute("SELECT agent_id, profile, personality FROM agent_profiles")]) if keep_profiles else []
        saved: Path | None = None
        if self.saves is not None:
            entry = await self.db.run(lambda: self.saves.backup("Vor dem Zurücksetzen"))
            saved = self.saves.index.path(entry["id"])
        self.db.close()
        if self.db_path != ":memory:" and Path(self.db_path).exists():
            if saved is None:
                target_dir = backup_dir or Path(self.db_path).parent / "backups"
                target_dir.mkdir(parents=True, exist_ok=True)
                saved = target_dir / f"live-{datetime.now():%Y%m%d-%H%M%S}.db"
                shutil.move(self.db_path, saved)
            else:
                self._remove_live_files()
        if model:
            self.settings.llm_model = model
        fresh = Simulation.create(self.settings, self.db_path, self.provider)
        fresh.store.ensure_all()                       # ohne await bis zum Austausch: kein Browser-Aufruf trifft die geschlossene alte Datenbank
        self._restore_kept(fresh, kept, presets, profiles)
        self._swap_in(fresh)
        self.engine.emit_event("simulation.reset", data={"backup": str(saved) if saved else None})
        return saved

    def _remove_live_files(self) -> None:
        for suffix in ("", "-wal", "-shm"):
            Path(self.db_path + suffix).unlink(missing_ok=True)

    @staticmethod
    def _restore_kept(fresh: "Simulation", kept, presets, profiles) -> None:
        fresh.params.restore(kept, persist=True)
        conn = fresh.db.conn
        for row in presets:
            conn.execute("INSERT OR REPLACE INTO presets(id, name, description, data, created, updated) VALUES(?,?,?,?,?,?)", row)
        for aid, prof, pers in profiles:
            conn.execute("UPDATE agent_profiles SET profile=?, personality=? WHERE agent_id=?", (prof, pers, aid))

    def _swap_in(self, fresh: "Simulation") -> None:
        """Die frische Simulation übernimmt den Platz dieser (Abonnenten, also Browser, bleiben verbunden)."""
        fresh.engine.bus = self.engine.bus
        old_saves = self.saves
        self.__dict__.pop("movement_custom", None)
        self.__dict__.update(fresh.__dict__)
        self.params.sim = self.presets.sim = self.inject.sim = self.npcs.sim = self
        if self.saves is not None:
            self.saves.sim = self
        self.runner.inject, self.runner.owner = self.inject, self
        if old_saves is not None and old_saves is not self.saves:
            old_saves.index.close()

    async def load_save(self, save_id: str) -> dict[str, Any]:
        """Lädt einen Spielstand: prüft ihn, sichert den aktuellen Stand („Vor dem Laden“), ersetzt den Live-Stand und gibt allen Browsern einen frischen Snapshot."""
        if self.saves is None:
            raise RuntimeError("Spielstände gibt es nur mit einer Datenbankdatei.")
        entry = self.saves.get(save_id)
        path = self.saves.index.path(save_id)
        if snap.sha256(path) != entry["sha256"] or not snap.integrity_ok(path):
            from ..saves.service import SaveError
            raise SaveError("corrupt", "Dieser Spielstand ist beschädigt (Prüfsumme oder Integrität stimmen nicht) und wird nicht geladen.", 409)
        await self.runner.stop()
        backup = await self.db.run(lambda: self.saves.backup("Vor dem Laden"))
        model = snap.read_meta(path).get("llm_model")
        self.db.close()
        self._remove_live_files()
        shutil.copyfile(path, self.db_path)
        if model:
            self.settings.llm_model = str(model)
        fresh = Simulation.create(self.settings, self.db_path, self.provider)
        fresh.store.ensure_all()
        self._swap_in(fresh)
        self.engine.emit_event("simulation.loaded", data={"save_id": save_id, "name": entry["name"], "minute": self.engine.minute, "backup": backup["name"]})
        return entry

    def close(self) -> None:
        self.db.close()
