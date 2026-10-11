"""Abrufpfad: aus der aktuellen Situation die relevantesten Erinnerungen holen, begrenzt durch Schwelle, Höchstzahl und Token-Budget.

score = (w_rel·Relevanz + w_rec·Aktualität + w_imp·Wichtigkeit + w_shared·gemeinsam) / Summe der Gewichte, danach kleine Zuschläge für
Reflexionen und offene Vorhaben. Alles in 0–1, damit die Schwelle verständlich bleibt.
"""

from dataclasses import dataclass, field

from ..world import clock
from . import keywords as kw
from .knowledge import KnowledgeStore
from .models import Memory
from .params import MemoryParams
from .store import MemoryStore

PIN_BONUS = 0.12


@dataclass
class Situation:
    minute: int
    location_id: str
    location_name: str = ""
    persons: list[str] = field(default_factory=list)          # anwesende Personen (Kennungen)
    person_names: list[str] = field(default_factory=list)
    objects: list[str] = field(default_factory=list)          # Namen sichtbarer Objekte
    plan: str = ""
    goals: list[str] = field(default_factory=list)
    talk: str = ""                                            # letzter Gesprächsinhalt
    exclude_since: int | None = None                          # was jünger ist, steht schon im Kurzzeitpuffer des Prompts

    def words(self) -> list[str]:
        text = " ".join([self.location_name, " ".join(self.person_names), " ".join(self.objects), self.plan, " ".join(self.goals), self.talk])
        return kw.build(text, [self.location_id, *self.persons])


@dataclass
class Scored:
    memory: Memory
    score: float
    parts: dict[str, float]
    tokens: int

    def line(self) -> str:
        return format_line(self.memory)


@dataclass
class Recall:
    items: list[Scored]
    tokens: int
    query: list[str]
    retrieval_id: int | None = None

    @property
    def lines(self) -> list[str]:
        return [s.line() for s in self.items]


def format_line(m: Memory) -> str:
    when = clock.fmt(m.sim_created).replace("Tag ", "Tag ")
    label = {"reflection": "Einsicht", "intention": "Vorhaben", "summary": "Rückblick"}.get(m.kind)
    return f"{when}: " + (f"[{label}] " if label else "") + m.text


class Retriever:
    def __init__(self, mem: MemoryStore, know: KnowledgeStore, params: MemoryParams):
        self.mem, self.know, self.params = mem, know, params

    def candidates(self, agent_id: str, sit: Situation, words: list[str]) -> dict[str, tuple[Memory, float]]:
        found: dict[str, tuple[Memory, float]] = {}
        match = kw.fts_query(words)
        if match:
            for m, rank in self.mem.search(agent_id, match, self.params.candidates):
                found[m.id] = (m, rank)
        recent = self.mem.recent(agent_id, limit=8) + self.mem.recent(agent_id, min_importance=7, limit=5)      # damit Aktualität und Wichtigkeit auch ohne Stichwort wirken
        for m in self.mem.related(agent_id, sit.persons, sit.location_id, 20) + self.mem.pinned(agent_id) + recent:
            found.setdefault(m.id, (m, 0.0))
        return found

    def score(self, m: Memory, rank: float, max_rank: float, sit: Situation) -> tuple[float, dict[str, float]]:
        p = self.params
        fts = rank / max_rank if max_rank > 0 else 0.0
        person = len(set(m.persons) & set(sit.persons)) / len(sit.persons) if sit.persons else 0.0
        place = 1.0 if m.location_id and m.location_id == sit.location_id else 0.0
        rel = min(1.0, 0.55 * fts + 0.30 * person + 0.15 * place)
        age_h = max(0, sit.minute - m.sim_created) / 60
        rec = 0.5 ** (age_h / max(0.1, p.half_life_h))
        imp = m.importance / 10
        shared = 1.0 if m.shared else 0.0
        total_w = p.w_rel + p.w_rec + p.w_imp + p.w_shared
        base = (p.w_rel * rel + p.w_rec * rec + p.w_imp * imp + p.w_shared * shared) / total_w
        pinned = m.kind == "reflection" or (m.kind == "intention" and m.intention_state == "open")
        bonus = PIN_BONUS * (0.35 + 0.65 * min(1.0, rel * 2)) if pinned else 0.0     # bevorzugt, aber nur so stark, wie es zur Lage passt
        parts = {"relevanz": round(rel, 3), "aktualität": round(rec, 3), "wichtigkeit": round(imp, 3), "gemeinsam": shared, "zuschlag": bonus}
        return min(1.0, base + bonus), parts

    def recall(self, agent_id: str, sit: Situation, log: bool = True) -> Recall:
        words = sit.words()
        found = self.candidates(agent_id, sit, words)
        max_rank = max((r for _, r in found.values()), default=0.0)
        scored: list[Scored] = []
        for m, rank in found.values():
            if sit.exclude_since is not None and m.kind in ("episode", "fact", "relation") and m.sim_created >= sit.exclude_since:
                continue
            s, parts = self.score(m, rank, max_rank, sit)
            if s >= self.params.min_score:
                scored.append(Scored(m, s, parts, kw.estimate_tokens(format_line(m))))
        scored.sort(key=lambda x: (-x.score, -x.memory.sim_created))
        chosen: list[Scored] = []
        used = 0
        kinds = {"reflection": 0, "intention": 0}
        for s in scored:
            if len(chosen) >= self.params.max_items:
                break
            if s.memory.kind in kinds and kinds[s.memory.kind] >= (self.params.max_reflections if s.memory.kind == "reflection" else 1):
                continue
            kinds[s.memory.kind] = kinds.get(s.memory.kind, 0) + 1
            if used + s.tokens > self.params.budget_tokens:
                continue
            chosen.append(s)
            used += s.tokens
        rid = None
        if log and chosen:
            self.mem.touch(agent_id, [s.memory.id for s in chosen], sit.minute)
            rid = self.know.log_retrieval(agent_id, sit.minute, " ".join(words), [{"id": s.memory.id, "score": round(s.score, 3), "parts": s.parts} for s in chosen], used)
        return Recall(chosen, used, words, rid)
