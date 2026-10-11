import type { EventOut } from "../types/generated";
import type { Filters } from "../store/uiStore";

/** Einzelschritte und System-Takt sind standardmäßig ausgeblendet (Entscheidung Henry offen: Verdichtung, siehe offene-fragen.md Nr. 13). */
const NOISE = new Set(["agent.moved", "agent.status_changed", "world.time"]);

export const FAILURE_TYPES = new Set(["agent.action_failed", "agent.action_rejected", "agent.decision_failed", "agent.guard_triggered"]);

export function matchesFilters(ev: EventOut, text: string, f: Filters): boolean {
  if (f.failures) return FAILURE_TYPES.has(ev.type) && (!f.agent || ev.agents.includes(f.agent)) && (!f.text || text.toLowerCase().includes(f.text.toLowerCase()));
  if (!f.categories[ev.category]) return false;
  if (!f.moves && NOISE.has(ev.type)) return false;
  if (f.agent && !ev.agents.includes(f.agent)) return false;
  return !f.text || text.toLowerCase().includes(f.text.toLowerCase());
}
