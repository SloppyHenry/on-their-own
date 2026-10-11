import type { EventOut } from "../types/generated";
import type { Filters } from "../store/uiStore";

/** Einzelschritte (nur ältere Protokolle) und System-Takt sind standardmäßig ausgeblendet; ein Weg (`agent.walking`) erscheint als eine Zeile. */
const NOISE = new Set(["agent.moved", "agent.status_changed", "world.time"]);

/** Eingaben des Benutzers und ihre Folgen gehören ins Protokoll, auch wenn „System“ ausgeblendet ist. */
const USER_EVENTS = new Set(["simulation.event_injected", "simulation.event_scheduled", "simulation.event_fired", "simulation.effect_ended", "simulation.loaded"]);

export const FAILURE_TYPES = new Set(["agent.action_failed", "agent.action_rejected", "agent.decision_failed", "agent.guard_triggered"]);

export function matchesFilters(ev: EventOut, text: string, f: Filters): boolean {
  if (f.failures) return FAILURE_TYPES.has(ev.type) && (!f.agent || ev.agents.includes(f.agent)) && (!f.text || text.toLowerCase().includes(f.text.toLowerCase()));
  if (!f.categories[ev.category] && !USER_EVENTS.has(ev.type)) return false;
  if (!f.moves && NOISE.has(ev.type)) return false;
  if (f.agent && !ev.agents.includes(f.agent)) return false;
  return !f.text || text.toLowerCase().includes(f.text.toLowerCase());
}
