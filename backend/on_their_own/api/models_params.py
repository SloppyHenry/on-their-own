"""Modelle für Parameter, Presets und Systemstatus (AP07)."""

from typing import Any

from pydantic import BaseModel, Field

from .models import Out


class ParamSpecOut(Out):
    key: str
    group: str
    scope: str                                   # global | agent
    type: str                                    # int | float | bool | enum | text
    label: str
    help: str
    default: Any = None
    min: float | None = None
    max: float | None = None
    step: float | None = None
    unit: str = ""
    options: list[list[str]] = []
    effect: str                                  # immediate | next_decision | restart_model
    effect_text: str
    locked: str | None = None
    warn: str | None = None
    max_len: int | None = None


class ParamGroup(Out):
    id: str
    label: str


class ParamSchema(Out):
    groups: list[ParamGroup]
    specs: list[ParamSpecOut]


class ParamValues(Out):
    agents: list[str]
    values: dict[str, Any]                       # global: Wert, je Agent: {Agent: Wert}
    defaults: dict[str, Any]
    changed: list[str] = []                      # Schlüssel, deren Wert vom Standard abweicht


class ParamChange(BaseModel):
    key: str
    value: Any = None
    agent: str | None = None


class ParamPatch(BaseModel):
    changes: list[ParamChange] = Field(min_length=1, max_length=100)


class ParamResult(Out):
    key: str
    agent: str | None = None
    status: str                                  # applied | pending_next_decision | requires_model_restart | rejected
    old: Any = None
    new: Any = None
    reason: str | None = None


class ParamPatchOut(Out):
    results: list[ParamResult]
    values: ParamValues


class ParamResetRequest(BaseModel):
    keys: list[str] | None = None
    group: str | None = None
    agent: str | None = None


class PresetBrief(Out):
    id: str
    name: str
    description: str = ""
    builtin: bool
    count: int


class PresetOut(Out):
    id: str
    name: str
    description: str = ""
    builtin: bool
    data: dict[str, Any]


class PresetSave(BaseModel):
    name: str
    description: str = ""
    groups: list[str] | None = None              # nur diese Gruppen speichern (sonst alles)


class PresetRename(BaseModel):
    name: str
    description: str | None = None


class PresetDuplicate(BaseModel):
    name: str | None = None


class PresetDiffItem(Out):
    key: str
    label: str
    agent: str | None = None
    old: Any = None
    new: Any = None


class PresetPreview(Out):
    preset: PresetBrief
    diff: list[PresetDiffItem]


class PresetLoadRequest(BaseModel):
    confirm: bool = False


class PresetLoadOut(Out):
    preset: PresetBrief
    results: list[ParamResult]
    values: ParamValues


class ModelStatus(Out):
    reachable: bool | None = None          # None: noch keine Anfrage gestellt
    model: str
    base_url: str
    avg_response_s: float | None = None
    avg_tokens_per_s: float | None = None
    errors_15min: int = 0
    queue: int = 0
    calls: int = 0


class SystemLoad(Out):
    decisions_per_minute: float
    sim_minutes_per_minute: float
    actions_ok: int
    actions_failed: int
    state: str
    speed_level: str
    max_concurrent: int
    power_save: bool


class StatusOut(Out):
    model: ModelStatus
    load: SystemLoad
