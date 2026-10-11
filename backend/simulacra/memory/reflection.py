"""Reflexion: aus den jüngsten wichtigen Erinnerungen werden 1–3 Einsichten. Das Modell nennt die Quellen; erfundene oder fremde Quellen werden verworfen."""

import json
import re
from dataclasses import dataclass
from typing import Any

from ..agents import prompts
from ..agents.store import AgentStore
from ..llm.client import LLMClient
from ..llm.providers import LLMError
from ..world import clock
from ..world.engine import WorldEngine
from .knowledge import KnowledgeStore
from .models import Memory
from .params import MemoryParams
from .retrieval import format_line
from .store import MemoryStore
from .writer import MemoryWriter

MIN_SOURCES = 5
MIN_GAP_MINUTES = 60
MAX_TEXT = 220

SCHEMA: dict[str, Any] = {
    "type": "object", "additionalProperties": False, "required": ["reflections"],
    "properties": {"reflections": {"type": "array", "minItems": 1, "maxItems": 3, "items": {
        "type": "object", "additionalProperties": False, "required": ["text", "importance", "sources"],
        "properties": {"text": {"type": "string"}, "importance": {"type": "integer", "minimum": 1, "maximum": 10},
                       "sources": {"type": "array", "minItems": 1, "items": {"type": "integer"}}}}}},
}


@dataclass
class Job:
    agent_id: str
    reason: str
    minute: int
    sources: dict[int, Memory]                   # Nummer im Prompt -> Erinnerung
    messages: list[dict[str, str]]


class Reflector:
    def __init__(self, engine: WorldEngine, mem: MemoryStore, know: KnowledgeStore, writer: MemoryWriter, agents: AgentStore | None, client: LLMClient | None,
                 params: MemoryParams):
        self.engine, self.mem, self.know, self.writer, self.agents, self.client, self.params = engine, mem, know, writer, agents, client, params

    # --- Auslöser ------------------------------------------------------------------------------------
    def due(self, agent_id: str, minute: int) -> str | None:
        """„importance“ (genug Neues seit der letzten Reflexion), „evening“ (einmal am Abend) oder None."""
        p = self.params
        if not p.reflect_enabled or self.client is None or self.agents is None:
            return None
        st = self.know.state_of(agent_id)
        if st["last_reflection_minute"] is not None and minute - st["last_reflection_minute"] < MIN_GAP_MINUTES:
            return None
        if len(self.mem.recent(agent_id, kinds=("episode", "fact", "relation"), min_importance=3, limit=MIN_SOURCES)) < MIN_SOURCES:
            return None
        if st["importance_since_reflection"] >= p.reflect_threshold:
            return "importance"
        if clock.minute_of_day(minute) >= p.reflect_evening_minute and st["last_reflection_day"] < clock.day_of(minute):
            return "evening"
        return None

    # --- Ablauf -------------------------------------------------------------------------------------------
    def prepare(self, agent_id: str, reason: str) -> Job | None:
        minute = self.engine.minute
        mems = list(reversed(self.mem.recent(agent_id, kinds=("episode", "fact", "relation", "reflection"), min_importance=3, limit=self.params.reflect_sources)))
        model = self.agents.get(agent_id) if self.agents else None
        if len(mems) < MIN_SOURCES or model is None:
            return None
        sources = {i + 1: m for i, m in enumerate(mems)}
        lines = [f"{i}: {format_line(m)}" for i, m in sources.items()]
        before = [m.text for m in self.mem.recent(agent_id, kinds=("reflection",), limit=4)]
        user = "\n".join([f"Jetzt: {clock.fmt(minute)}. Du denkst in Ruhe über das nach, was du zuletzt erlebt hast.", "", "Deine Erinnerungen (Nummer: Zeitpunkt, Inhalt):", *lines, "",
                          *(["Das hast du dir schon überlegt (wiederhole es nicht):", *[f"- {t}" for t in before], ""] if before else []),
                          "Was fällt dir auf? Schreibe 1 bis 3 Einsichten über dich, über andere oder über das Dorf, jeweils ein bis zwei Sätze in der Ich-Form, auf Deutsch. "
                          "Jede Einsicht muss sich auf die Nummern der Erinnerungen stützen, aus denen sie folgt (\"sources\"). Erfinde nichts, was nicht in den Erinnerungen steht. "
                          "\"importance\": 1 bis 10. Antworte nur mit dem JSON-Objekt."])
        return Job(agent_id, reason, minute, sources, [{"role": "system", "content": prompts.system_prompt(model)}, {"role": "user", "content": user}])

    def apply(self, job: Job, raw: str) -> list[Memory]:
        loc = self.engine.state.agent(job.agent_id).location_id
        try:
            items = json.loads(raw)["reflections"]
            assert isinstance(items, list)
        except (ValueError, KeyError, TypeError, AssertionError):
            self._reject(job, "Antwort war nicht im vorgegebenen Format", raw, loc)
            return []
        out: list[Memory] = []
        for it in items[:3]:
            text = str(it.get("text", "")).strip() if isinstance(it, dict) else ""
            srcs = [job.sources[n] for n in dict.fromkeys(it.get("sources", [])) if isinstance(n, int) and n in job.sources] if isinstance(it, dict) else []
            if not text or not srcs:
                self._reject(job, "ohne gültige Quellen" if text else "leer", text, loc)
                continue
            text = self._clean(text)
            if any(self.writer._jaccard(text, old.text) >= 0.5 for old in self.mem.recent(job.agent_id, kinds=("reflection",), limit=20)):
                self._reject(job, "wiederholt eine frühere Einsicht", text, loc)
                continue
            persons = sorted({p for s in srcs for p in s.persons})
            m = self.writer.remember(job.agent_id, "reflection", text[:MAX_TEXT], max(4, min(9, int(it.get("importance", 5)))), job.minute, location_id=None,
                                     persons=persons, shared=any(s.shared for s in srcs), source_memory_ids=[s.id for s in srcs], force=True)
            if m:
                out.append(m)
        return out

    @staticmethod
    def _clean(text: str) -> str:
        """Quellenverweise im Text („(Quelle: 3)“, „Quellen: 2, 5“) gehören ins Feld sources, nicht in die Einsicht."""
        text = re.sub(r"\s*[\(\[]\s*(?:Quellen?|Erinnerung(?:en)?|Nr\.?)\b[^)\]]*[)\]]", "", text)
        text = re.sub(r"\s*(?:Quellen?|Erinnerung(?:en)?)\s*:\s*[\d,\s und]+\.?\s*$", "", text)
        text = re.sub(r"\s*[\(\[]\s*\d+(?:\s*[-–,]\s*\d+)*\s*[\)\]]", "", text)      # „(11–12)“, „(17, 19, 20)“
        return " ".join(text.split())

    def _reject(self, job: Job, why: str, text: str, loc: str | None) -> None:
        self.engine.emit_event("agent.memory_skipped", [job.agent_id], loc, {"text": text[:200], "importance": 0, "reason": f"Reflexion verworfen: {why}"})

    async def run(self, agent_id: str, reason: str = "manual") -> list[Memory]:
        """Eine Reflexion: vorbereiten (DB), Modell fragen, prüfen und speichern (DB). Fehler stören die Simulation nie."""
        db = self.engine.db
        job = await db.run(lambda: self.prepare(agent_id, reason))
        if job is None or self.client is None:
            return []
        try:
            res = await self.client.chat(job.messages, SCHEMA)
        except LLMError as e:
            await db.run(lambda: self.engine.emit_event("agent.memory_skipped", [agent_id], None, {"text": "", "importance": 0, "reason": f"Reflexion nicht möglich ({e.kind})"}))
            return []

        def done() -> list[Memory]:
            out = self.apply(job, res.content)
            self.know.mark_reflected(agent_id, job.minute, clock.day_of(job.minute))
            return out
        return await db.run(done)
