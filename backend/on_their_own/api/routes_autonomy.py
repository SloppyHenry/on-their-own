"""Autonomie-Schnittstellen (AP06): Ziele, Bedürfnisse und Stimmung, Beziehungen, Fehlschläge, Entscheidungen mit Erklärung. Nur lesend."""

from fastapi import APIRouter, HTTPException, Path, Query, Request

from ..agents.factors import FACTOR_KEYS, KEY_LABELS
from ..agents.goals import Goal
from ..agents.needs import LABELS
from .models_autonomy import (AgentNeeds, AgentOverview, DecisionOut, FactorInfo, FactorRegistry, FailureOut, GoalOut, MoodOut, NeedOut, OptionOut, RelationLogItem,
                              RelationOut)

router = APIRouter(prefix="/api")


def id_param():
    return Path(pattern=r"^[A-Za-z0-9_.\-]{1,64}$")


def _need_agent(sim, agent_id: str) -> None:
    if sim.engine.state.agent(agent_id) is None:
        raise HTTPException(404, f"Agent '{agent_id}' unbekannt")


def goal_out(g: Goal) -> GoalOut:
    return GoalOut(id=g.id, kind=g.kind, text=g.text, state=g.state, condition=g.condition, plan=g.plan, plan_step=g.plan_step, progress=round(g.progress, 2),
                   created=g.created, updated=g.updated, last_progress=g.last_progress, failures=g.failures, replans=g.replans, reason=g.reason)


def needs_of(sim, agent_id: str) -> AgentNeeds:
    ctx = sim.autonomy.context(agent_id, sim.engine.minute)
    body = sim.engine.state.agent(agent_id)
    act = sim.autonomy.needs.active(body.needs, ctx.soft)
    return AgentNeeds(needs=[NeedOut(key=k, label=LABELS[k], value=round(v, 1), critical=k in ctx.critical) for k, v in act.items()],
                      mood=MoodOut(value=round(ctx.mood.value, 2), word=ctx.mood.word, reasons=[[n, round(v, 2)] for n, v in ctx.mood.reasons]))


def decision_out(row: dict) -> DecisionOut:
    t = row.get("trace") or {}
    return DecisionOut(id=row["id"], agent_id=row["agent_id"], sim_minute=row["sim_minute"], status=row["status"], chosen=row["chosen"], action=row["action"],
                       params=row["params"], intent=row["intent"], importance=row["importance"], utterance=row["utterance"], plan_next=row["plan_next"], outcome=row["outcome"],
                       outcome_text=row["outcome_text"], attempts=row["attempts"], latency_ms=row["latency_ms"],
                       options=[OptionOut(**{k: o.get(k) for k in ("id", "kind", "label", "action", "params", "eta", "score", "factors")}) for o in row["options"]],
                       why=t.get("why", ""), rank=t.get("rank"), best=t.get("best"), goal=t.get("goal"), goal_why=t.get("goal_why"), groups=t.get("groups", {}),
                       mood=t.get("mood"), retrieval_id=t.get("retrieval_id"), event_seq=row["event_seq"])


@router.get("/agents/{agent_id}/goals", response_model=list[GoalOut])
async def get_goals(request: Request, agent_id: str = id_param(), state: str | None = Query(None, pattern="^(active|paused|achieved|abandoned)$"), limit: int = Query(30, ge=1, le=100)):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        return [goal_out(g) for g in sim.autonomy.goals.list(agent_id, state=state, limit=limit)]
    return await sim.engine.db.run(work)


@router.get("/agents/{agent_id}/needs", response_model=AgentNeeds)
async def get_needs(request: Request, agent_id: str = id_param()):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        return needs_of(sim, agent_id)
    return await sim.engine.db.run(work)


@router.get("/overview", response_model=list[AgentOverview])
async def get_overview(request: Request):
    """Je Agent Ziele, Stimmung und Bedürfnisse für die Agentenübersicht."""
    sim = request.app.state.sim

    def work():
        out = []
        for aid in sim.store.profile_ids():
            n = needs_of(sim, aid)
            g = sim.autonomy.goals.active_short(aid)
            out.append(AgentOverview(id=aid, goal=goal_out(g) if g else None, long_goals=[goal_out(x) for x in sim.autonomy.goals.long_goals(aid)], mood=n.mood, needs=n.needs,
                                     resting=sim.autonomy.guards.resting(aid, sim.engine.minute)))
        return out
    return await sim.engine.db.run(work)


@router.get("/agents/{agent_id}/relations", response_model=list[RelationOut])
async def get_relations(request: Request, agent_id: str = id_param()):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        st, rel = sim.engine.state, sim.autonomy.relations
        return [RelationOut(other_id=a.id, other_name=a.name, values=(r := rel.get(agent_id, a.id)).values(), shared=r.shared, conflicts=r.conflicts,
                            log=[RelationLogItem(**l) for l in rel.log(agent_id, a.id, 15)]) for a in st.agents() if a.id != agent_id]
    return await sim.engine.db.run(work)


@router.get("/agents/{agent_id}/failures", response_model=list[FailureOut])
async def get_failures(request: Request, agent_id: str = id_param(), limit: int = Query(20, ge=1, le=100)):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        return [FailureOut(id=r["id"], sim_minute=r["sim_minute"], action=r["action"], params=r["params"], code=r["code"], text=r["text"], context=r["context"],
                           event_seq=r["event_seq"]) for r in sim.autonomy.guards.failures(agent_id, limit)]
    return await sim.engine.db.run(work)


@router.get("/agents/{agent_id}/decisions", response_model=list[DecisionOut])
async def get_decisions(request: Request, agent_id: str = id_param(), limit: int = Query(20, ge=1, le=100)):
    sim = request.app.state.sim

    def work():
        _need_agent(sim, agent_id)
        return [decision_out(r) for r in sim.store.decisions(agent_id, limit)]
    return await sim.engine.db.run(work)


@router.get("/decisions/{decision_id}", response_model=DecisionOut)
async def get_decision(request: Request, decision_id: int = Path(ge=1)):
    sim = request.app.state.sim
    rows = await sim.engine.db.run(lambda: sim.store.decision(decision_id))
    if rows is None:
        raise HTTPException(404, "Entscheidung unbekannt")
    return decision_out(rows)


@router.get("/factors", response_model=FactorRegistry)
async def get_factors():
    return FactorRegistry(factors=[FactorInfo(label=k, key=v) for k, v in FACTOR_KEYS.items()], groups=KEY_LABELS)
