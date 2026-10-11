// Lesbare Sätze aus Ereignistyp und Daten. Entsteht im Frontend, nicht im Modell. Jeder Typ hat einen Eintrag (vom Compiler erzwungen).
import { formatTime } from "../lib/clock";
import { ACTIVITIES, resourceName, statusName, weatherName } from "../lib/names";
import type { EventDataMap, EventOut, EventType } from "../types/generated";

export interface Names {
  agent(id: string): string;
  location(id: string): string;
}

export interface Described {
  text: string;
  icon: string;
}

type Fn<K extends EventType> = (d: EventDataMap[K], n: Names, ev: EventOut) => string;
type Table = { [K in EventType]: Fn<K> };

const who = (ev: EventOut, n: Names) => n.agent(ev.agents[0] ?? "?");
const act = (a: string) => ACTIVITIES[a]?.[0] ?? a;
const q = (s: string) => `„${s}“`;

const TEXT: Table = {
  "agent.action_started": (d, n, ev) => `${who(ev, n)} ${act(d.action)}.`,
  "agent.action_completed": (d, n, ev) => `${who(ev, n)} ist fertig: ${act(d.action)}.`,
  "agent.action_failed": (d, n, ev) => `${who(ev, n)} scheitert: ${d.text}`,
  "agent.action_rejected": (d, n, ev) => `${who(ev, n)} darf nicht: ${d.text}`,
  "agent.action_interrupted": (d, n, ev) => `${who(ev, n)} wird unterbrochen${d.reason ? ` (${d.reason})` : ""}.`,
  "agent.moved": (d, n, ev) => `${who(ev, n)} geht nach (${d.to[0]}, ${d.to[1]}).`,
  "agent.arrived": (d, n, ev) => `${who(ev, n)} kommt an${d.label ? `: ${d.label}` : ""}.`,
  "agent.location_changed": (d, n, ev) => `${who(ev, n)} verlässt ${n.location(d.from_location)} und betritt ${n.location(d.to_location)}.`,
  "agent.location_discovered": (d, n, ev) => `${who(ev, n)} entdeckt ${n.location(d.location)}.`,
  "agent.inspected": (d, n, ev) => `${who(ev, n)} untersucht ${d.object?.name ?? (d.resource ? resourceName(d.resource) : "die Umgebung")}.`,
  "agent.read": (d, n, ev) => `${who(ev, n)} liest ${d.name}.`,
  "agent.fished": (d, n, ev) => `${who(ev, n)} angelt${d.caught ? " und fängt einen Fisch" : " ohne Erfolg"}.`,
  "agent.ate": (_d, n, ev) => `${who(ev, n)} isst.`,
  "agent.drank": (_d, n, ev) => `${who(ev, n)} trinkt.`,
  "agent.slept": (d, n, ev) => `${who(ev, n)} hat ${Math.round(d.minutes / 60 * 10) / 10} Stunden geschlafen.`,
  "agent.rested": (_d, n, ev) => `${who(ev, n)} ruht sich aus.`,
  "agent.item_taken": (d, n, ev) => `${who(ev, n)} nimmt ${d.object.name}.`,
  "agent.item_dropped": (d, n, ev) => `${who(ev, n)} legt ${d.object.name} ab.`,
  "agent.item_given": (d, n) => `${n.agent(d.from)} gibt ${n.agent(d.to)} ${d.object?.name ?? `${d.amount ?? ""} ${resourceName(d.resource ?? "")}`.trim()}.`,
  "agent.inventory_changed": (d, n, ev) => `${who(ev, n)}: ${resourceName(d.resource)} ${d.delta > 0 ? "+" : ""}${d.delta} (jetzt ${d.qty}).`,
  "agent.dialogue": (d, n) => `${n.agent(d.speaker)} zu ${n.agent(d.to)}: ${q(d.text)}`,
  "agent.conversation_started": (d, n) => `${n.agent(d.by)} beginnt ein Gespräch.`,
  "agent.conversation_ended": (d) => `Gespräch beendet nach ${d.turns} Beiträgen: ${d.reason_text}`,
  "agent.proposal_accepted": (_d, n, ev) => `${who(ev, n)} nimmt den Vorschlag an.`,
  "agent.proposal_declined": (_d, n, ev) => `${who(ev, n)} lehnt den Vorschlag ab.`,
  "agent.decision": (d, n, ev) => `${who(ev, n)} entscheidet: ${d.intent || (d.chosen ?? act(d.action))}`,
  "agent.status_changed": (d, n, ev) => `${who(ev, n)}: ${statusName(d.new)[0]}.`,
  "agent.decision_failed": (d, n, ev) => `${who(ev, n)} findet keine Entscheidung (${d.reason ?? "unbekannt"}), wartet kurz.`,
  "agent.memory_created": (d, n, ev) => `${who(ev, n)} merkt sich${d.kind === "reflection" ? " (Einsicht)" : d.kind === "summary" ? " (Rückblick)" : d.kind === "intention" ? " (Vorhaben)" : ""}: ${d.text}`,
  "agent.memory_retrieved": (d, n, ev) => `${who(ev, n)} erinnert sich an ${d.items.length} ${d.items.length === 1 ? "Sache" : "Dinge"}: ${d.items.map((i) => i.text).join(" · ").slice(0, 160)}`,
  "agent.memory_skipped": (d, n, ev) => `${who(ev, n)} merkt sich nichts: ${d.reason}.`,
  "agent.memory_archived": (d, n, ev) => `${who(ev, n)} legt ${d.count} Erinnerungen ins Archiv.`,
  "agent.goal_changed": (_d, n, ev) => `${who(ev, n)} ändert ein Ziel.`,
  "world.object_created": (d) => `${d.object.name} ist neu in der Welt.`,
  "world.object_changed": (d) => `${d.name} verändert sich.`,
  "world.object_removed": (d) => `${d.object.name} verschwindet.`,
  "world.object_discovered": (d, n, ev) => `${who(ev, n)} entdeckt ${d.object.name}.`,
  "world.resource_changed": (d, n, ev) => `${resourceName(d.resource)}-Vorrat${ev.location ? ` (${n.location(ev.location)})` : ""}: ${Math.round(d.amount * 10) / 10}.`,
  "world.resource_added": (d) => `Neue Quelle: ${resourceName(d.resource)} (${d.node}).`,
  "world.weather_changed": (d) => `Das Wetter wechselt zu ${weatherName(d.to).toLowerCase()}.`,
  "world.phase_changed": (d) => ({ dawn: "Es dämmert.", day: "Der Tag beginnt.", dusk: "Der Abend bricht an.", night: "Es wird Nacht." }[d.phase] ?? `Tageszeit: ${d.phase}.`),
  "world.day_started": (d) => `Ein neuer Tag beginnt: ${d.weekday}, Tag ${d.day}.`,
  "world.time": (d) => `Es ist ${d.time}.`,
  "world.tile_changed": (d) => `Kachel (${d.x}, ${d.y}) wird zu ${d.type}.`,
  "world.tiles_changed": (d) => `${d.count} Kacheln verändern sich.`,
  "world.tile_type_added": (d) => `Neue Kachelart: ${d.label}.`,
  "world.map_extended": (d) => `Die Karte wächst auf ${d.to[0]} × ${d.to[1]}.`,
  "world.location_added": (d) => `Neuer Ort: ${String((d.location as { name?: string }).name ?? "?")}.`,
  "world.location_updated": (d) => `Ort geändert: ${String((d.location as { name?: string }).name ?? "?")}.`,
  "world.agent_added": (d) => `${d.name} zieht ein.`,
  "world.patch_applied": (d) => `Patch angewendet: ${d.description || d.id}.`,
  "simulation.started": () => "Simulation gestartet.",
  "simulation.paused": () => "Simulation pausiert.",
  "simulation.resumed": () => "Simulation läuft weiter.",
  "simulation.stopped": () => "Simulation angehalten.",
  "simulation.stepped": (d) => `${d.n} Schritt${d.n === 1 ? "" : "e"} ausgeführt (${formatTime(d.minute)}).`,
  "simulation.reset": () => "Simulation zurückgesetzt.",
  "simulation.parameter_changed": (d) => `Parameter geändert: ${d.group}.`,
  "simulation.speed_changed": (d) => `Tempo: ${d.level}.`,
  "simulation.event_injected": () => "Ereignis eingegeben.",
};

const ICON_BY_TYPE: Partial<Record<EventType, string>> = {
  "agent.dialogue": "chat", "agent.conversation_started": "chat", "agent.conversation_ended": "chat", "agent.proposal_accepted": "chat",
  "agent.proposal_declined": "chat", "agent.decision": "plan", "agent.status_changed": "plan", "agent.goal_changed": "plan",
  "agent.decision_failed": "warn", "agent.action_failed": "no", "agent.action_rejected": "no", "agent.action_interrupted": "warn",
  "agent.action_completed": "ok", "world.weather_changed": "rain", "world.day_started": "sun", "world.phase_changed": "sun",
  "agent.slept": "zzz", "agent.rested": "zzz", "agent.memory_created": "think", "agent.memory_retrieved": "think", "agent.memory_skipped": "think", "agent.memory_archived": "think",
};

export function describeEvent(ev: EventOut, names: Names): Described {
  const fn = TEXT[ev.type as EventType] as ((d: unknown, n: Names, e: EventOut) => string) | undefined;
  let text = ev.type as string;
  try {
    if (fn) text = fn(ev.data, names, ev);
  } catch {
    /* unvollständige Daten (z. B. neuere Backend-Version): Typname genügt */
  }
  const icon = ICON_BY_TYPE[ev.type as EventType] ?? (ev.category === "system" ? "link" : "leaf");
  return { text, icon };
}
