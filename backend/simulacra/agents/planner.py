"""Entscheidung eines Agenten: Optionen vorbereiten, Modell fragen, Antwort prüfen, Rückfall bei Fehlern.

Die Engine entscheidet über den Erfolg einer Handlung; der Planer liefert nur einen geprüften Vorschlag.
"""

import json
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from ..llm.client import LLMClient
from ..llm.providers import LLMError
from ..memory.system import MemorySystem
from ..world.engine import WorldEngine
from . import options as options_mod
from . import perception, prompts
from .conversation import ConversationManager
from .perception import Perception
from .scoring import Option, Tuning
from .store import AgentStore

RAW_LIMIT = 300      # Rohantworten werden nur im Fehlerfall und gekürzt protokolliert (§13)
FALLBACK = ("wait", {"minutes": 10})


class ModelDecision(BaseModel):
    option_id: str
    intent: str = Field("", max_length=300)
    utterance: str = ""
    importance: int = Field(3, ge=1, le=10)
    plan_next: str = ""
    proposal: str = ""
    other_action: str | None = None
    other_params: dict[str, Any] = {}


@dataclass
class Prepared:
    perception: Perception
    options: list[Option]
    messages: list[dict[str, str]]
    schema: dict[str, Any]


@dataclass
class Decision:
    agent_id: str
    minute: int
    status: str                       # valid | fallback
    options: list[Option]
    action: str
    params: dict[str, Any]
    chosen: Option | None = None
    chosen_id: str | None = None
    intent: str = ""
    importance: int = 3
    utterance: str = ""
    plan_next: str = ""
    proposal: str = ""
    attempts: int = 0
    latency_ms: int = 0
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    error: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


class Planner:
    def __init__(self, engine: WorldEngine, store: AgentStore, convs: ConversationManager, client: LLMClient,
                 tuning: Tuning | None = None, memory_lines: int = 10, correction_retries: int = 2, memory: MemorySystem | None = None):
        self.engine, self.store, self.convs, self.client = engine, store, convs, client
        self.tuning, self.memory_lines, self.correction_retries = tuning or Tuning(), memory_lines, correction_retries
        self.memory = memory

    def prepare(self, agent_id: str) -> Prepared:
        """Wahrnehmen, erinnern, Optionen erzeugen und bewerten, Prompt bauen. Nur lesend; gehört auf den DB-Thread."""
        p = perception.build(self.engine, self.store, self.convs, agent_id, self.memory_lines)
        if self.memory is not None:
            self.memory.perceive(p)
            buffer = self.store.recent_observations(agent_id, self.memory_lines)
            rec = self.memory.recall_for(p, exclude_since=buffer[0]["sim_minute"] if buffer else None)
            p.recalled, p.extra["retrieval_id"] = rec.lines, rec.retrieval_id
        opts = options_mod.build_options(self.engine, self.store, p, self.tuning)
        messages = [{"role": "system", "content": prompts.system_prompt(p.agent)}, {"role": "user", "content": prompts.user_prompt(p, opts)}]
        return Prepared(p, opts, messages, prompts.decision_schema([o.id for o in opts]))

    # --- Antwort prüfen -------------------------------------------------------------------------------
    def parse(self, raw: str, prep: Prepared) -> tuple[ModelDecision, Option | None] | str:
        """Gibt (Entscheidung, Option) zurück oder eine Fehlermeldung für die Korrekturschleife."""
        try:
            d = ModelDecision(**json.loads(raw))
        except (ValueError, TypeError, ValidationError) as e:
            return "Das war kein gültiges JSON im vorgegebenen Format." + (f" ({str(e).splitlines()[0][:120]})" if isinstance(e, ValidationError) else "")
        by_id = {o.id: o for o in prep.options}
        if d.option_id == "other":
            if d.other_action not in prompts.ALLOWED_OTHER:
                return "Bei \"other\" fehlt eine erlaubte other_action."
            return d, None
        opt = by_id.get(d.option_id)
        if opt is None:
            return f"Die Option \"{d.option_id}\" gibt es nicht. Erlaubt sind: {', '.join(by_id)} oder other."
        if opt.utterance_key and not d.utterance.strip():
            return "Bei dieser Option musst du in \"utterance\" schreiben, was du sagst oder schreibst."
        return d, opt

    async def ask(self, prep: Prepared) -> Decision:
        """Fragt das Modell, korrigiert bei unbrauchbaren Antworten und fällt notfalls auf `wait` zurück."""
        p = prep.perception
        dec = Decision(p.agent.id, p.minute, "fallback", prep.options, *FALLBACK)
        dec.extra["retrieval_id"] = p.extra.get("retrieval_id")
        messages = list(prep.messages)
        t0 = time.perf_counter()
        for attempt in range(1, self.correction_retries + 2):
            dec.attempts = attempt
            try:
                res = await self.client.chat(messages, prep.schema)
            except LLMError as e:
                dec.error = f"LLM {e.kind}: {e.text}"[:300]
                break
            dec.prompt_tokens, dec.completion_tokens = res.prompt_tokens, res.completion_tokens
            parsed = self.parse(res.content, prep)
            if isinstance(parsed, str):
                dec.error = f"{parsed} | Antwort: {res.content[:RAW_LIMIT]}"[:600]
                messages = messages + [{"role": "assistant", "content": res.content[:RAW_LIMIT]},
                                       {"role": "user", "content": prompts.correction_message(parsed)}]
                continue
            md, opt = parsed
            dec.error = None
            dec.status, dec.chosen, dec.chosen_id = "valid", opt, md.option_id
            dec.intent, dec.importance, dec.utterance = md.intent.strip(), md.importance, md.utterance.strip()[:500]
            dec.plan_next, dec.proposal = md.plan_next.strip()[:200], md.proposal.strip()[:200]
            if opt is None:
                dec.action, dec.params = md.other_action, dict(md.other_params)
            else:
                dec.action, dec.params = opt.action, dict(opt.params)
                if opt.utterance_key:
                    dec.params[opt.utterance_key] = dec.utterance
            break
        dec.latency_ms = int((time.perf_counter() - t0) * 1000)
        return dec
