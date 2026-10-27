"""Pflege: Tageszusammenfassung und Archivierung. Es wird nie etwas gelöscht; archivierte Erinnerungen bleiben abrufbar im Inspektor, gehen aber nicht mehr in den Prompt."""

from ..world import clock
from ..world.engine import WorldEngine
from .knowledge import KnowledgeStore
from .models import Memory
from .params import MemoryParams
from .store import MemoryStore
from .writer import MemoryWriter, _cut

KEEP_IMPORTANCE = 8          # ab dieser Wichtigkeit bleibt eine Erinnerung aktiv
KEEP_ACCESSED = 3            # ebenso, wenn sie oft abgerufen wurde


class Maintenance:
    def __init__(self, engine: WorldEngine, mem: MemoryStore, know: KnowledgeStore, writer: MemoryWriter, params: MemoryParams):
        self.engine, self.mem, self.know, self.writer, self.params = engine, mem, know, writer, params

    def run(self, agent_id: str, minute: int) -> dict[str, int]:
        """Einmal je Tag: fehlende Zusammenfassungen schreiben, dann archivieren."""
        made = self.summarize(agent_id, minute) if self.params.summary_enabled else 0
        return {"summaries": made, "archived": self.archive(agent_id, minute)}

    def _loc(self, lid: str | None) -> str:
        loc = self.engine.state.locations.get(lid) if lid else None
        return loc.name if loc else ""

    def summarize(self, agent_id: str, minute: int) -> int:
        today, made = clock.day_of(minute), 0
        st = self.know.state_of(agent_id)
        if today - st["last_summary_day"] <= self.params.summary_interval_days:
            return 0                                          # erst wieder nach Ablauf des Intervalls (Parameter)
        for day in range(max(1, st["last_summary_day"] + 1), today):
            eps = self.mem.episodes_of_day(agent_id, day)
            if len(eps) >= 2:
                top = sorted(eps, key=lambda m: (-m.importance, m.sim_created))[:3]
                places = list(dict.fromkeys(n for n in (self._loc(m.location_id) for m in eps) if n))[:4]
                people = list(dict.fromkeys(self.writer._name(p) for m in eps for p in m.persons))[:3]
                text = (f"Rückblick auf Tag {day}: {len(eps)} Erlebnisse. Wichtig war: " + " ".join(_cut(m.text, 90) for m in top)
                        + (f" Orte: {', '.join(places)}." if places else "") + (f" Mit: {', '.join(people)}." if people else ""))
                self.writer.remember(agent_id, "summary", text, min(8, max(m.importance for m in eps)), day * 1440 - 1, persons=[], source_memory_ids=[m.id for m in eps], force=True)
                made += 1
            self.know.mark_summarized(agent_id, day)
        return made

    def _keep(self, m: Memory) -> bool:
        return m.importance >= KEEP_IMPORTANCE or m.access_count >= KEEP_ACCESSED

    def archive(self, agent_id: str, minute: int) -> int:
        today = clock.day_of(minute)
        if self.params.archive_after_days <= 0:
            return 0                                          # 0 = nie archivieren
        covered = {r for m in self.mem.recent(agent_id, kinds=("summary",), limit=500) for r in m.source_memory_ids}
        old, ids = (today - self.params.archive_after_days) * 1440, []
        for m in self.mem.recent(agent_id, kinds=("episode", "fact", "relation", "intention"), limit=100000):
            if m.sim_created >= old or self._keep(m):
                continue
            if m.kind == "intention" and m.intention_state in ("done", "dropped") or m.id in covered:
                ids.append(m.id)
        over = self.mem.count(agent_id) - len(ids) - self.params.max_active                # Obergrenze: stärker archivieren, nie löschen
        if over > 0:
            rest = [m for m in reversed(self.mem.recent(agent_id, limit=100000)) if m.id not in ids and m.kind not in ("reflection", "summary") and not (m.kind == "intention" and m.intention_state == "open")]
            ids += [m.id for m in sorted(rest, key=lambda m: (m.importance + min(m.access_count, 5), m.sim_created))[:over]]
        if ids:
            self.mem.set_status(agent_id, ids, "archived")
            self.engine.emit_event("agent.memory_archived", [agent_id], None, {"count": len(ids), "memory_ids": ids[:50], "reason": "älter als die Frist und zusammengefasst" if over <= 0 else "Obergrenze"})
        return len(ids)
