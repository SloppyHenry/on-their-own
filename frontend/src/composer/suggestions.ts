// Vorschläge für die Eingabeleiste: feste Beispiele, aus der Welt abgeleitete und zuletzt verwendete Eingaben.
import type { World } from "../store/types";

export const EXAMPLES = [
  "Heute beginnt es zu regnen.",
  "Im Wald wird ein unbekannter Gegenstand entdeckt.",
  "Alex findet eine alte Karte im Haus.",
  "Mira erhält eine Einladung zu einem Fest.",
  "Ein Fremder zieht in das Dorf.",
  "Im Garten taucht ein verletztes Tier auf.",
  "Der Strom im Haus fällt aus.",
  "Beide entdecken eine verschlossene Tür.",
  "Für die nächsten drei Tage sind die Ressourcen knapp.",
  "Mira erfährt, dass Alex gestern allein am See war.",
  "Am zentralen Platz findet morgen ein Markt statt.",
];

const KEY = "on-their-own.composer.recent";
const prep = (name: string) => (/^(Wald|See|Garten|Platz|Zentraler Platz)/.test(name) ? (name.startsWith("See") ? "am" : "im") : "in");

export function recent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function remember(text: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([text, ...recent().filter((t) => t !== text)].slice(0, 8)));
  } catch {
    /* ohne Speicher geht es auch */
  }
}

/** Beispiele passend zur aktuellen Welt (Orte, Figuren, Objekte aus dem Zustand). */
export function contextual(world: World | null): string[] {
  if (!world) return [];
  const agents = world.agentOrder.map((id) => world.agents[id]?.name).filter(Boolean) as string[];
  const places = Object.values(world.locations).filter((l) => !l.id.startsWith("paths") && !l.props?.fallback);
  const out: string[] = [];
  if (agents[0]) out.push(`${agents[0]} findet einen Schlüssel ${prep("Garten")} Garten.`);
  const spot = places.find((l) => !l.id.startsWith("house."));
  if (spot) out.push(`${prep(spot.name)} ${spot.name} taucht ein Wanderer auf.`.replace(/^in /, "In "));
  const obj = Object.values(world.objects).find((o) => o.kind === "door" || o.kind === "chest");
  if (obj) out.push(`${obj.name} ist plötzlich verschlossen.`);
  return out;
}

export function suggest(text: string, world: World | null): string[] {
  const all = [...(text ? [] : recent()), ...contextual(world), ...EXAMPLES];
  const t = text.trim().toLowerCase();
  const out = t ? all.filter((s) => s.toLowerCase().includes(t) && s.toLowerCase() !== t) : all;
  return [...new Set(out)].slice(0, 14);
}
