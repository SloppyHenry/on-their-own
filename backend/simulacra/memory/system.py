"""Das Gedächtnis als Ganzes: Speicher, Schreiben, Abrufen, Reflexion, Pflege. Eine Instanz je Simulation."""

from ..agents.perception import Perception
from ..world.engine import WorldEngine
from .knowledge import KnowledgeStore
from .models import Memory
from .params import MemoryParams
from .retrieval import Recall, Retriever, Situation
from .store import MemoryStore
from .writer import MemoryWriter


class MemorySystem:
    def __init__(self, engine: WorldEngine, params: MemoryParams | None = None):
        self.engine = engine
        self.params = params or MemoryParams()
        self.store = MemoryStore(engine.state)
        self.know = KnowledgeStore(engine.state)
        self.writer = MemoryWriter(engine, self.store, self.know, self.params)
        self.retriever = Retriever(self.store, self.know, self.params)

    def situation(self, p: Perception) -> Situation:
        talk = " ".join(p.conversation["lines"][-3:]) if p.conversation else ""
        return Situation(minute=p.minute, location_id=p.location_id, location_name=p.location_name, persons=[x.id for x in p.people],
                         person_names=[x.name for x in p.people], objects=[o["name"] for o in p.objects], plan=p.plan_next,
                         goals=list(p.agent.profile.goals), talk=talk)

    def perceive(self, p: Perception) -> None:
        """Was der Agent hier sieht, merkt er sich als Wissen (kann veralten) und zählt Ortsbesuche."""
        a = p.agent.id
        for o in p.objects:
            self.know.note_object(a, o["id"], o["name"], o["kind"], o["note"], p.location_id, p.minute)
        loc = self.engine.state.locations.get(p.location_id)
        if loc and not loc.props.get("fallback"):
            self.know.note_location(a, p.location_id, p.minute, visit=False)

    def recall_for(self, p: Perception, exclude_since: int | None = None) -> Recall:
        """Abruf für eine Entscheidung; meldet `agent.memory_retrieved`."""
        sit = self.situation(p)
        sit.exclude_since = exclude_since
        rec = self.retriever.recall(p.agent.id, sit)
        if rec.items:
            self.engine.emit_event("agent.memory_retrieved", [p.agent.id], p.location_id,
                                   {"retrieval_id": rec.retrieval_id, "tokens": rec.tokens, "query": rec.query[:12],
                                    "items": [{"id": s.memory.id, "kind": s.memory.kind, "score": round(s.score, 3), "text": s.memory.text} for s in rec.items]})
        return rec

    def memories(self, agent_id: str, **kw) -> list[Memory]:
        return self.store.list(agent_id, **kw)[0]
