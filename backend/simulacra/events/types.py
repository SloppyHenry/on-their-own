"""Registry der Ereignistypen: Kategorie, Datenmodell, Beschreibung. Neue Typen nur hier ergänzen.

`STRICT` (in den Tests eingeschaltet) prüft jedes erzeugte Ereignis gegen sein Modell; ein unbekannter Typ
oder ein nicht im Modell enthaltenes Feld ist dann ein Fehler.
"""

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel

from . import models as m

CATEGORIES = ("world", "dialogue", "planning", "memory", "system")
STRICT = False


@dataclass(frozen=True)
class EventType:
    name: str
    category: str
    model: type[BaseModel]
    description: str
    planned: bool = False          # vorgesehen für ein späteres Paket, wird noch nicht erzeugt


def _t(name: str, category: str, model: type[BaseModel], description: str, planned: bool = False) -> EventType:
    return EventType(name, category, model, description, planned)


_ALL = [
    # Aktionen und Bewegung
    _t("agent.action_started", "world", m.ActionStarted, "Eine Aktion wurde angenommen und beginnt"),
    _t("agent.action_completed", "world", m.ActionCompleted, "Eine Aktion ist abgeschlossen"),
    _t("agent.action_failed", "world", m.ActionProblem, "Eine angenommene Aktion ist beim Abschluss gescheitert"),
    _t("agent.action_rejected", "world", m.ActionProblem, "Die Welt hat einen Vorschlag abgelehnt"),
    _t("agent.action_interrupted", "world", m.ActionInterrupted, "Eine laufende Aktion wurde abgebrochen"),
    _t("agent.moved", "world", m.Moved, "Ein Schritt auf eine Nachbarkachel"),
    _t("agent.arrived", "world", m.Arrived, "Ziel eines Weges erreicht"),
    _t("agent.location_changed", "world", m.LocationChanged, "Ein Agent betritt einen anderen Ort"),
    _t("agent.location_discovered", "world", m.LocationDiscovered, "Ein Agent lernt einen Ort zum ersten Mal kennen"),
    # Ergebnisse von Aktionen
    _t("agent.inspected", "world", m.Inspected, "Ein Objekt oder eine Quelle wurde untersucht"),
    _t("agent.read", "world", m.Read, "Etwas wurde gelesen"),
    _t("agent.fished", "world", m.Fished, "Angeln beendet"),
    _t("agent.ate", "world", m.Ate, "Gegessen"),
    _t("agent.drank", "world", m.Drank, "Getrunken"),
    _t("agent.slept", "world", m.Slept, "Geschlafen"),
    _t("agent.rested", "world", m.Rested, "Ausgeruht"),
    _t("agent.item_taken", "world", m.ItemMoved, "Gegenstand aufgenommen"),
    _t("agent.item_dropped", "world", m.ItemMoved, "Gegenstand abgelegt"),
    _t("agent.item_given", "world", m.ItemGiven, "Gegenstand oder Ressource übergeben"),
    _t("agent.inventory_changed", "world", m.InventoryChanged, "Ressourcenbestand eines Agenten geändert"),
    # Gespräche und Entscheidungen
    _t("agent.dialogue", "dialogue", m.Dialogue, "Ein Beitrag in einem Gespräch"),
    _t("agent.conversation_started", "dialogue", m.ConversationStarted, "Gespräch hat begonnen"),
    _t("agent.conversation_ended", "dialogue", m.ConversationEnded, "Gespräch ist beendet"),
    _t("agent.proposal_accepted", "dialogue", m.ProposalAnswered, "Ein Vorschlag im Gespräch wurde angenommen"),
    _t("agent.proposal_declined", "dialogue", m.ProposalAnswered, "Ein Vorschlag im Gespräch wurde abgelehnt"),
    _t("agent.decision", "planning", m.Decision, "Entscheidung mit angebotenen Optionen und Bewertung"),
    _t("agent.status_changed", "planning", m.StatusChanged, "Handlungsstatus eines Agenten hat sich geändert"),
    _t("agent.decision_failed", "system", m.DecisionFailed, "Keine verwertbare Antwort vom Modell: Rückfall"),
    _t("agent.memory_created", "memory", m.Loose, "Erinnerung gespeichert (ab AP05)", True),
    _t("agent.memory_retrieved", "memory", m.Loose, "Erinnerung abgerufen (ab AP05)", True),
    _t("agent.goal_changed", "planning", m.Loose, "Ziel geändert (ab AP06)", True),
    # Welt
    _t("world.object_created", "world", m.ObjectCreated, "Objekt ist entstanden"),
    _t("world.object_changed", "world", m.ObjectChanged, "Objektzustand geändert"),
    _t("world.object_removed", "world", m.ObjectRemoved, "Objekt entfernt"),
    _t("world.object_discovered", "world", m.ObjectDiscovered, "Ein Agent hat ein verborgenes Objekt entdeckt"),
    _t("world.resource_changed", "world", m.ResourceChanged, "Bestand einer Quelle geändert"),
    _t("world.resource_added", "world", m.ResourceAdded, "Neue Ressourcenquelle"),
    _t("world.weather_changed", "world", m.WeatherChanged, "Wetterwechsel"),
    _t("world.phase_changed", "world", m.PhaseChanged, "Tageszeit-Phase gewechselt"),
    _t("world.day_started", "world", m.DayStarted, "Neuer Tag"),
    _t("world.time", "system", m.WorldTime, "Uhrzeit, einmal je Simulationsstunde"),
    _t("world.tile_changed", "world", m.TileChanged, "Eine Kachel hat sich verändert (Bau)"),
    _t("world.tiles_changed", "world", m.TilesChanged, "Mehrere Kacheln verändert"),
    _t("world.tile_type_added", "world", m.TileTypeAdded, "Neue Kachelart"),
    _t("world.map_extended", "world", m.MapExtended, "Karte vergrößert"),
    _t("world.location_added", "world", m.LocationEvent, "Neuer Ort"),
    _t("world.location_updated", "world", m.LocationEvent, "Ort geändert"),
    _t("world.agent_added", "world", m.AgentAdded, "Neue Figur in der Welt"),
    _t("world.patch_applied", "system", m.PatchApplied, "Welt-Patch angewendet"),
    # Simulation
    _t("simulation.started", "system", m.SimControl, "Simulation gestartet"),
    _t("simulation.paused", "system", m.SimControl, "Simulation pausiert"),
    _t("simulation.resumed", "system", m.SimControl, "Simulation fortgesetzt"),
    _t("simulation.stopped", "system", m.SimControl, "Simulation beendet"),
    _t("simulation.stepped", "system", m.SimStepped, "Einzelschritte ausgeführt"),
    _t("simulation.reset", "system", m.SimReset, "Simulation zurückgesetzt"),
    _t("simulation.parameter_changed", "system", m.ParameterChanged, "Parameter geändert"),
    _t("simulation.speed_changed", "system", m.SpeedChanged, "Geschwindigkeit geändert"),
    _t("simulation.event_injected", "system", m.Loose, "Ereignis vom Benutzer ausgelöst (ab AP08)", True),
]
REGISTRY: dict[str, EventType] = {t.name: t for t in _ALL}
assert len(REGISTRY) == len(_ALL), "doppelter Ereignistyp"


def category_of(type_: str) -> str:
    t = REGISTRY.get(type_)
    return t.category if t else "system"


def visibility_of(type_: str, agents: list[str]) -> str:
    """Wer das Ereignis in der Simulation wahrnimmt. Der Beobachter im Browser sieht immer alles."""
    cat = category_of(type_)
    if cat == "system":
        return "system"
    if cat in ("dialogue", "planning", "memory") and agents:
        return "agents:" + ",".join(sorted(agents))
    return "public"


def validate(type_: str, data: dict[str, Any]) -> None:
    t = REGISTRY.get(type_)
    if t is None:
        raise ValueError(f"Ereignistyp '{type_}' ist nicht in der Registry")
    t.model.model_validate(data)
