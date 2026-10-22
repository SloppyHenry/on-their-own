"""Die eigene Figur steuern (AP18h-a2): handeln, sprechen, Möglichkeiten abfragen, abbrechen.

Nur in der Spielart „leben“ mit gesetzter Figur (`meta.player`), sonst 409. Die Figur ist ein Bewohner wie jeder andere: dieselben Handlungen (`ALLOWED_OTHER`),
derselbe Weg über `WorldEngine.propose`, dieselben Ablehnungstexte. Für Handlungen des Menschen gibt es **kein** `agent.decision`: keine Optionsliste, kein Grund.
Die anderen sehen nur `agent.action_started`, `agent.dialogue` & Co. wie immer; nichts hier gelangt in einen Prompt.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..agents import options as options_mod
from ..agents import perception
from ..agents.prompts import ALLOWED_OTHER
from ..simulation import mitleben
from ..world.models import Accepted

router = APIRouter(prefix="/api/player")

SAY_MAX = 500
ACT_ACTIONS = [a for a in ALLOWED_OTHER if a != "speak"]            # Sprechen geht über /say, damit das Gespräch vorher angemeldet wird


class ActRequest(BaseModel):
    action: str
    params: dict[str, Any] = Field(default_factory=dict)


class SayRequest(BaseModel):
    to: str
    text: str = Field(min_length=1, max_length=SAY_MAX)


class ActResult(BaseModel):
    ok: bool
    minutes: int | None = None                  # erwartete Dauer (angenommen)
    ends_at: int | None = None
    code: str | None = None                     # Ablehnung: Code und Text der Engine, unverändert
    text: str | None = None


class ChoiceOut(BaseModel):
    kind: str
    label: str
    action: str
    params: dict[str, Any]
    utterance_key: str | None = None
    eta: int | None = None
    ok: bool = True
    reason: str | None = None                   # warum es gerade nicht geht (Text der Engine)


def _player(sim) -> str:
    """Die eigene Figur oder 409. Gehört auf den DB-Thread."""
    pid = mitleben.player_id(sim.engine.state)
    if pid is None:
        raise HTTPException(409, "Es gibt keine eigene Figur: Sie gibt es nur in der Spielart Leben, nachdem du eine gewählt hast.")
    return pid


def _result(res) -> ActResult:
    if res.ok:
        return ActResult(ok=True, ends_at=res.ends_at)
    return ActResult(ok=False, code=str(getattr(res.rejected.code, "value", res.rejected.code)), text=res.rejected.text)


async def _run(request: Request, payload, work):
    sim = request.app.state.sim

    async def handler():
        return await sim.engine.db.run(lambda: work(sim))
    return await request.app.state.idempotency.run(sim, request, payload, handler)


def _propose(sim, pid: str, action: str, params: dict[str, Any]) -> ActResult:
    res = sim.engine.propose(pid, action, params)
    sim.runner.note_events(res.events)                  # Beobachtungen der Figur und der Umstehenden wie bei jeder Handlung
    out = _result(res)
    if res.ok and res.ends_at is not None:
        out.minutes = max(0, res.ends_at - sim.engine.minute)
    return out


@router.post("/act", response_model=ActResult)
async def act(request: Request, body: ActRequest):
    if body.action not in ACT_ACTIONS:
        raise HTTPException(422, f"Unbekannte Handlung '{body.action}'. Erlaubt: {', '.join(ACT_ACTIONS)} (Sprechen über /api/player/say).")

    def work(sim):
        return _propose(sim, _player(sim), body.action, body.params)
    return await _run(request, body, work)


@router.post("/say", response_model=ActResult)
async def say(request: Request, body: SayRequest):
    def work(sim):
        pid = _player(sim)
        partner = sim.engine.state.agent(body.to)
        if partner is not None:
            sim.convs.note_intent(pid, partner.id)       # wie in `Runner._apply`, bevor gesprochen wird
        return _propose(sim, pid, "speak", {"to": body.to, "text": body.text})
    return await _run(request, body, work)


@router.post("/cancel", response_model=ActResult)
async def cancel(request: Request):
    def work(sim):
        pid = _player(sim)
        body = sim.engine.state.agent(pid)
        if body.action is None:
            return ActResult(ok=False, code="nothing_to_cancel", text="Gerade läuft nichts, das sich abbrechen ließe.")
        sim.runner.note_events(sim.engine.interrupt(pid))      # für die anderen ein Abbruch wie jeder andere, ohne Vermerk
        return ActResult(ok=True)
    return await _run(request, None, work)


@router.get("/choices", response_model=list[ChoiceOut])
async def choices(request: Request):
    """Was der Optionsgenerator der Figur jetzt anbieten würde, mit Grund bei Unmöglichem. Ändert nichts (kein Abruf im Gedächtnis, kein Ereignis)."""
    sim = request.app.state.sim

    def work():
        pid = _player(sim)
        p = perception.build(sim.engine, sim.store, sim.convs, pid)
        out = []
        for o in options_mod.generate(sim.engine, sim.store, p):
            probe = {**o.params, **({o.utterance_key: options_mod.PLACEHOLDER} if o.utterance_key else {})}
            res = sim.engine.check(pid, o.action, probe)
            if isinstance(res, Accepted):
                path = res.data.get("path", [])
                eta = sum(sim.engine.state.grid.cost(*t) for t in path) if o.action == "move_to" else res.duration
                out.append(ChoiceOut(kind=o.kind, label=o.label, action=o.action, params=o.params, utterance_key=o.utterance_key, eta=eta or None))
            else:
                out.append(ChoiceOut(kind=o.kind, label=o.label, action=o.action, params=o.params, utterance_key=o.utterance_key, ok=False, reason=res.text))
        return out
    return await sim.engine.db.run(work)
