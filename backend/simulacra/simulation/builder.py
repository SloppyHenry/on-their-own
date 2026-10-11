"""Verdrahtet alle Teile zu einer lauffähigen Simulation (Engine, Agenten, Modell, Schleife)."""

import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from ..agents.conversation import ConversationManager
from ..agents.observations import ObservationCollector
from ..agents.planner import Planner
from ..agents.scoring import Tuning
from ..agents.store import AgentStore
from ..config import Settings
from ..db.connection import Database
from ..llm.client import LLMClient
from ..llm.providers import LLMProvider
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
    runner: SimulationRunner

    @classmethod
    def create(cls, settings: Settings, db_path: str | Path = ":memory:", provider: LLMProvider | None = None, seed: int = 1) -> "Simulation":
        db = Database(db_path)
        engine = WorldEngine.create(db, seed=seed)
        store = AgentStore(engine.state)
        convs = ConversationManager(engine, store, max_turns=settings.sim_conversation_max_turns)
        client = LLMClient.from_settings(settings, provider)
        planner = Planner(engine, store, convs, client, Tuning(top_k=settings.sim_top_k), settings.sim_memory_lines, settings.sim_correction_retries)
        collector = ObservationCollector(engine.state, store)
        runner = SimulationRunner(engine, store, convs, collector, planner,
                                  DecisionLimiter(settings.sim_min_decision_gap_s, settings.sim_max_decisions_per_minute), settings.sim_tick_delay_s)
        return cls(settings, str(db_path), provider, db, engine, store, convs, client, planner, collector, runner)

    async def reset(self, backup_dir: Path | None = None) -> Path | None:
        """Hält an, sichert die bisherige Datenbank (nie löschen) und legt eine frische Welt an. Gibt den Sicherungspfad zurück."""
        await self.runner.stop()
        self.db.close()
        saved = None
        if self.db_path != ":memory:" and Path(self.db_path).exists():
            target_dir = backup_dir or Path(self.db_path).parent / "backups"
            target_dir.mkdir(parents=True, exist_ok=True)
            saved = target_dir / f"live-{datetime.now():%Y%m%d-%H%M%S}.db"
            shutil.move(self.db_path, saved)
        bus = self.engine.bus                      # Abonnenten (Browser) bleiben über das Zurücksetzen hinweg verbunden
        fresh = Simulation.create(self.settings, self.db_path, self.provider)
        fresh.engine.bus = bus
        self.__dict__.update(fresh.__dict__)
        self.engine.emit_event("simulation.reset", data={"backup": str(saved) if saved else None})
        return saved

    def close(self) -> None:
        self.db.close()
