"""Antwortmodelle der Autonomie-Schnittstellen (AP06)."""

from typing import Any

from .models import Out


class GoalOut(Out):
    id: str
    kind: str
    text: str
    state: str
    condition: dict[str, Any] | None = None
    plan: list[dict[str, Any]] = []
    plan_step: int = 0
    progress: float = 0.0
    created: int
    updated: int
    last_progress: int
    failures: int = 0
    replans: int = 0
    reason: str = ""


class NeedOut(Out):
    key: str
    label: str
    value: float                    # Dringlichkeit 0-100
    critical: bool = False


class MoodOut(Out):
    value: float
    word: str
    reasons: list[list[Any]] = []


class AgentNeeds(Out):
    needs: list[NeedOut]
    mood: MoodOut


class RelationLogItem(Out):
    sim_minute: int
    deltas: dict[str, float]
    reason: str
    source: str
    event_seq: int | None = None


class RelationOut(Out):
    other_id: str
    other_name: str
    values: dict[str, float]
    shared: list[str] = []
    conflicts: list[str] = []
    log: list[RelationLogItem] = []


class FailureOut(Out):
    id: int
    sim_minute: int
    action: str
    params: dict[str, Any] = {}
    code: str
    text: str
    context: dict[str, Any] = {}
    event_seq: int | None = None


class OptionOut(Out):
    id: str
    kind: str
    label: str
    action: str
    params: dict[str, Any] = {}
    eta: int | None = None
    score: float
    factors: list[list[Any]] = []


class DecisionOut(Out):
    id: int
    agent_id: str
    sim_minute: int
    status: str
    chosen: str | None = None
    action: str | None = None
    params: dict[str, Any] | None = None
    intent: str | None = None
    importance: int | None = None
    utterance: str | None = None
    plan_next: str | None = None
    outcome: str | None = None
    outcome_text: str | None = None
    attempts: int = 1
    latency_ms: int | None = None
    options: list[OptionOut] = []
    why: str = ""
    rank: int | None = None
    best: bool | None = None
    goal: dict[str, Any] | None = None
    goal_why: str | None = None
    groups: dict[str, float] = {}
    mood: dict[str, Any] | None = None
    retrieval_id: int | None = None
    event_seq: int | None = None


class AgentOverview(Out):
    id: str
    goal: GoalOut | None = None
    long_goals: list[GoalOut] = []
    mood: MoodOut
    needs: list[NeedOut]
    resting: bool = False


class FactorInfo(Out):
    label: str
    key: str


class FactorRegistry(Out):
    factors: list[FactorInfo]
    groups: dict[str, str]


__all__ = ["GoalOut", "NeedOut", "MoodOut", "AgentNeeds", "RelationLogItem", "RelationOut", "FailureOut", "OptionOut", "DecisionOut", "AgentOverview",
           "FactorInfo", "FactorRegistry"]
