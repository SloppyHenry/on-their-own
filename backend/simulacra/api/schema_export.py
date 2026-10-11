"""Erzeugt aus den Pydantic-Modellen das JSON-Schema und die Ereignistyp-Tabelle für das Frontend.

    python -m simulacra.api.schema_export schema     # JSON-Schema (alle API- und Ereignisdaten-Modelle)
    python -m simulacra.api.schema_export ts-extra   # Ereignistyp -> Datentyp, Kategorien (wird an generated.ts angehängt)
Aufruf normalerweise über scripts/gen_types.sh.
"""

import json
import sys

from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from ..events import models as event_models
from ..events.schema import EventOut, SimTime
from ..events.types import REGISTRY
from . import models as api
from . import models_memory as mm
from . import models_autonomy as ma

API_MODELS: list[type[BaseModel]] = [
    api.StateSnapshot, api.AgentDetail, api.LocationDetail, api.EventsPage, api.EventDetail, api.SimCommandResult,
    api.StartRequest, api.StepRequest, api.ResetRequest, api.SpeedRequest,
    api.WsHello, api.WsResync, api.WsPong, api.WsSnapshot, api.WsEvents, api.WsEvent, api.WsPing, api.WsResyncRequired,
    mm.MemoriesPage, mm.MemoryDetail, mm.Knowledge, mm.RetrievalOut, mm.MemoryStats,
    ma.GoalOut, ma.AgentNeeds, ma.AgentOverview, ma.RelationOut, ma.FailureOut, ma.DecisionOut, ma.FactorRegistry,
    EventOut, SimTime,
]


def event_data_models() -> list[type[BaseModel]]:
    seen: dict[str, type[BaseModel]] = {}
    for t in REGISTRY.values():
        if t.model is not event_models.Loose:
            seen[t.model.__name__] = t.model
    return list(seen.values())


def _clean(node, top: bool = False):
    """Titel von Feldern entfernen (sonst entsteht für jedes Feld ein eigener Typ) und Objekte schließen (keine Indexsignaturen)."""
    if isinstance(node, dict):
        if "properties" in node:
            node.setdefault("additionalProperties", False)
            for prop in node["properties"].values():
                if isinstance(prop, dict):
                    prop.pop("title", None)
        for k, v in node.items():
            _clean(v)
    elif isinstance(node, list):
        for v in node:
            _clean(v)
    return node


REQUESTS = {api.StartRequest, api.StepRequest, api.ResetRequest, api.SpeedRequest, api.WsHello, api.WsResync, api.WsPong}


def build_schema() -> dict:
    """Antworten im Serialisierungsmodus (Felder mit Standardwert sind immer vorhanden); Anfragen und Ereignisdaten im Validierungsmodus
    (Aliase wie `from`)."""
    models = [(m, "validation" if m in REQUESTS else "serialization") for m in API_MODELS] + [(m, "validation") for m in event_data_models()]
    _, defs = models_json_schema(models, title="SimulacraApi")
    root = {"title": "SimulacraApi", "type": "object", "additionalProperties": False,
            "properties": {m.__name__: {"$ref": f"#/$defs/{m.__name__}"} for m, _ in models}, "$defs": defs["$defs"]}
    return _clean(root)


def ts_extra() -> str:
    lines = ["", "/** Ereignistyp -> Typ der Daten (`data`). */", "export interface EventDataMap {"]
    for name, t in REGISTRY.items():
        lines.append(f'  "{name}": {"Record<string, unknown>" if t.model is event_models.Loose else t.model.__name__};')
    lines += ["}", "", "export type EventType = keyof EventDataMap;",
              'export type EventCategory = "world" | "dialogue" | "planning" | "memory" | "system";', "",
              "/** Kategorie je Ereignistyp (steuert die Unterscheidung im Protokoll). */", "export const EVENT_CATEGORY: Record<EventType, EventCategory> = {"]
    lines += [f'  "{name}": "{t.category}",' for name, t in REGISTRY.items()]
    lines += ["};", "", "/** Noch nicht erzeugte, für spätere Pakete vorgesehene Typen. */",
              "export const PLANNED_EVENT_TYPES: EventType[] = [" + ", ".join(f'"{n}"' for n, t in REGISTRY.items() if t.planned) + "];", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "schema"
    sys.stdout.write(json.dumps(build_schema(), indent=1, ensure_ascii=False, sort_keys=True) + "\n" if what == "schema" else ts_extra())
