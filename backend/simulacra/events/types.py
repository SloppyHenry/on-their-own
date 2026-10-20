"""Registry der Ereignistypen: Kategorie, Datenmodell, Beschreibung. Neue Typen nur hier ergänzen.

`STRICT` (in den Tests eingeschaltet) prüft jedes erzeugte Ereignis gegen sein Modell; ein unbekannter Typ
oder ein nicht im Modell enthaltenes Feld ist dann ein Fehler.
"""

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel

from . import models as m
from . import models_edit as me
from . import models_move as mm
from . import models_user as mu

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
    _t("agent.walking", "world", mm.Walking, "Ein Weg beginnt oder sein Fahrplan ändert sich"),
    _t("agent.moved", "world", mm.Moved, "Veraltet: ein Schritt je Ereignis (nur in Protokollen vor AP11)"),
    _t("agent.arrived", "world", mm.Arrived, "Ziel eines Weges erreicht"),
    _t("agent.location_changed", "world", mm.LocationChanged, "Ein Agent betritt einen anderen Ort"),
    _t("agent.location_discovered", "world", mm.LocationDiscovered, "Ein Agent lernt einen Ort zum ersten Mal kennen"),
    # Ergebnisse von Aktionen
    _t("agent.inspected", "world", m.Inspected, "Ein Objekt oder eine Quelle wurde untersucht"),
    _t("agent.read", "world", m.Read, "Etwas wurde gelesen"),
    _t("agent.fished", "world", m.Fished, "Angeln beendet"),
    _t("agent.ate", "world", m.Ate, "Gegessen"),
    _t("agent.drank", "world", m.Drank, "Getrunken"),
    _t("agent.slept", "world", m.Slept, "Geschlafen"),
    _t("agent.rested", "world", m.Rested, "Ausgeruht"),
    _t("agent.rowed", "world", m.Rowed, "Mit dem Boot gerudert"),
    _t("agent.petted", "world", m.Petted, "Ein Tier gestreichelt"),
    _t("agent.stored", "world", m.Stored, "Etwas in eine Ablage gelegt oder herausgenommen"),
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
    _t("agent.relation_changed", "planning", m.RelationChanged, "Eine Beziehung hat sich verändert (mit Grund)"),
    _t("agent.guard_triggered", "planning", m.GuardTriggered, "Ein Schutzmechanismus hat eingegriffen (Wiederholung, Gesprächsschleife, Ruhemodus …)"),
    _t("agent.decision_failed", "system", m.DecisionFailed, "Keine verwertbare Antwort vom Modell: Rückfall"),
    _t("agent.memory_created", "memory", m.MemoryCreated, "Erinnerung gespeichert"),
    _t("agent.memory_retrieved", "memory", m.MemoryRetrieved, "Erinnerungen für eine Entscheidung abgerufen"),
    _t("agent.memory_skipped", "memory", m.MemorySkipped, "Nicht gemerkt (unter der Schwelle); nur mit Debug-Parameter"),
    _t("agent.memory_archived", "memory", m.MemoryArchived, "Erinnerungen archiviert (nicht gelöscht)"),
    _t("agent.goal_changed", "planning", m.GoalChanged, "Ziel gesetzt, erreicht, pausiert oder aufgegeben (mit Grund)"),
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
    _t("world.map_extended", "world", me.MapExtended, "Karte vergrößert"),
    _t("world.location_added", "world", m.LocationEvent, "Neuer Ort"),
    _t("world.location_updated", "world", m.LocationEvent, "Ort geändert"),
    _t("world.agent_added", "world", m.AgentAdded, "Neue Figur in der Welt"),
    _t("world.links_added", "world", me.LinksAdded, "Neue Übergänge (Haustüren)"),
    _t("world.look_changed", "world", me.LookChanged, "Gebiete oder Landstraßen der Darstellung ergänzt"),
    _t("world.look_added", "system", me.LookAdded, "Gebautes in die Darstellung eingetragen (Weg, Beet, Baum, Laterne, Brunnen)"),
    _t("world.generated", "world", me.Generated, "Dorf mit dem Weltgenerator erzeugt"),
    _t("world.patch_applied", "system", me.PatchApplied, "Welt-Patch angewendet"),
    # Simulation
    _t("simulation.started", "system", m.SimControl, "Simulation gestartet"),
    _t("simulation.paused", "system", m.SimControl, "Simulation pausiert"),
    _t("simulation.resumed", "system", m.SimControl, "Simulation fortgesetzt"),
    _t("simulation.stopped", "system", m.SimControl, "Simulation beendet"),
    _t("simulation.stepped", "system", m.SimStepped, "Einzelschritte ausgeführt"),
    _t("simulation.reset", "system", m.SimReset, "Simulation zurückgesetzt"),
    _t("simulation.parameter_changed", "system", m.ParameterChanged, "Parameter geändert"),
    _t("simulation.speed_changed", "system", m.SpeedChanged, "Geschwindigkeit geändert"),
    _t("simulation.event_injected", "system", mu.EventInjected, "Ereignis vom Benutzer ausgelöst"),
    _t("simulation.event_scheduled", "system", mu.EventScheduled, "Ereignis für später eingeplant"),
    _t("simulation.event_fired", "system", mu.EventFired, "Geplantes Ereignis ausgelöst oder befristete Wirkung zurückgenommen"),
    _t("simulation.effect_ended", "system", mu.EffectEnded, "Eine befristete Wirkung ist abgelaufen"),
    _t("agent.informed", "dialogue", mu.Informed, "Information, Nachricht, Einladung oder Situation erreicht bestimmte Agenten"),
    _t("world.nature_event", "world", mu.NatureEvent, "Die Welt hat von sich aus ein Ereignis gebracht (Gewitter, Fuchs im Garten …); nur Protokoll, ohne Urheber"),
    _t("simulation.play_mode_changed", "system", mu.PlayModeChanged, "Spielart gewechselt (Leben oder Gott; nur Leitstelle, nie in einem Prompt)"),
    _t("simulation.voice_changed", "system", mu.VoiceChanged, "Stimme einer Figur eingestellt (nur Darstellung, die Bewohner merken nichts)"),
    _t("simulation.saved", "system", mu.SimSaved, "Spielstand gespeichert (manuell, automatisch oder als Sicherung)"),
    _t("simulation.loaded", "system", mu.SimLoaded, "Ein Spielstand wurde geladen: alle Browser bekommen einen frischen Snapshot"),
    _t("world.npc_acted", "world", mu.NpcAction, "Eine Nebenfigur hat sich bewegt oder etwas gesagt"),
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
    if cat == "memory" or type_ == "agent.relation_changed":
        return "system"                      # was ein Agent speichert oder abruft, sieht der andere nie
    if cat in ("dialogue", "planning") and agents:
        return "agents:" + ",".join(sorted(agents))
    return "public"


def validate(type_: str, data: dict[str, Any]) -> None:
    t = REGISTRY.get(type_)
    if t is None:
        raise ValueError(f"Ereignistyp '{type_}' ist nicht in der Registry")
    t.model.model_validate(data)
