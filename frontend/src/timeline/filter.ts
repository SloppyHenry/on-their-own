import type { EventOut } from "../types/generated";
import type { Filters } from "../store/uiStore";

/** Einzelschritte und System-Takt sind standardmäßig ausgeblendet (Entscheidung Henry offen: Verdichtung, siehe offene-fragen.md Nr. 13). */
const NOISE = new Set(["agent.moved", "agent.status_changed", "world.time"]);

export function matchesFilters(ev: EventOut, text: string, f: Filters): boolean {
  if (!f.categories[ev.category]) return false;
  if (!f.moves && NOISE.has(ev.type)) return false;
  if (f.agent && !ev.agents.includes(f.agent)) return false;
  return !f.text || text.toLowerCase().includes(f.text.toLowerCase());
}
