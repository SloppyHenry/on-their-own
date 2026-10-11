// Lesbare Texte für Ziele, Bedingungen und Bedürfnisse.
import { resourceName } from "./names";

export const NEED_LABEL: Record<string, string> = { energy: "Energie", hunger: "Sattheit", thirst: "Wasser", social: "Gesellschaft", calm: "Ruhe", warmth: "Wärme" };
export const METRIC_LABEL: Record<string, string> = { trust: "Vertrauen", sympathy: "Sympathie", tension: "Spannung", familiarity: "Vertrautheit" };
export const GOAL_STATE: Record<string, string> = { active: "aktiv", paused: "pausiert", achieved: "erreicht", abandoned: "aufgegeben" };

type Cond = Record<string, unknown>;
export interface NameLookup { location(id: string): string; agent(id: string): string }

/** Erfüllungsbedingung in Worten (so prüft die Welt das Ziel, nicht das Modell). */
export function conditionText(c: Cond | null | undefined, n: NameLookup): string {
  if (!c) return "";
  switch (c.type) {
    case "object_count": return `Es gibt ${c.min}× ${String(c.kind)}${c.location ? ` (${n.location(String(c.location))})` : ""}`;
    case "location_visited": return `${n.location(String(c.location))} besucht`;
    case "has_resource": return `${c.amount}× ${resourceName(String(c.resource))} dabei`;
    case "talked_with": return `Gespräch mit ${n.agent(String(c.person))}${c.topic ? ` über „${String(c.topic)}“` : ""}`;
    case "plant_stage": return `Eigene Pflanze erreicht Stufe ${c.min_stage}`;
    default: return String(c.type);
  }
}

/** Anteil des Bedürfnisses, der gedeckt ist (Balken voll = gut); der Server liefert Dringlichkeit. */
export const met = (urgency: number) => Math.max(0, Math.min(100, 100 - urgency));
export const needColor = (m: number) => (m < 20 ? "var(--color-warn)" : m < 45 ? "var(--color-alex)" : "var(--color-ok)");
