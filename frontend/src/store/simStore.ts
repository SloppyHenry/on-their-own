// Einzige Quelle der Wahrheit für alle Komponenten: Welt, Ereignisliste, Sprechblasen, Verbindungsstatus.
import { create } from "zustand";
import type { EventOut, StateSnapshot } from "../types/generated";
import { applyEvents, applySnapshot } from "./reducers";
import type { Bubble, Conn, World } from "./types";

export const MAX_EVENTS = 5000;

/** Fügt zwei nach `seq` sortierte Listen ohne Doppelte zusammen und kappt auf die letzten MAX_EVENTS. */
export function mergeEvents(a: EventOut[], b: EventOut[], max = MAX_EVENTS): EventOut[] {
  if (!b.length) return a;
  const last = a.length ? a[a.length - 1].seq : -1;
  const merged = b[0].seq > last ? a.concat(b) : [...new Map([...a, ...b].map((e) => [e.seq, e])).values()].sort((x, y) => x.seq - y.seq);
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

export interface Pulse {
  kind: "saved" | "recalled";
  at: number;
}

interface SimStore {
  world: World | null;
  events: EventOut[];
  bubbles: Record<string, Bubble>;
  /** Aufleuchten am Agenten, wenn er etwas merkt oder abruft (nur Live-Ereignisse). */
  pulses: Record<string, Pulse>;
  /** Neu gemerkte Erinnerungen seit dem Laden (für die Markierung im Inspektor) und ein Zähler, der Listen zum Nachladen auffordert. */
  newMemories: Record<string, number>;
  memoryVersion: number;
  /** Zähler für Ziele, Beziehungen und Schutzmechanismen: Ansichten laden bei Änderung neu. */
  autonomyVersion: number;
  conn: Conn;
  setSnapshot: (s: StateSnapshot) => void;
  pushEvents: (items: EventOut[], live: boolean) => void;
  setHistory: (items: EventOut[]) => void;
  setConn: (c: Conn) => void;
  mergeSimulation: (s: StateSnapshot) => void;
}

const bubbleOf = (ev: EventOut): Bubble | null => {
  if (ev.type !== "agent.dialogue") return null;
  const d = ev.data as { speaker: string; to: string; text: string };
  return { id: ev.id, agent: d.speaker, to: d.to, text: d.text, seq: ev.seq, shownAt: Date.now() };
};

export const useSimStore = create<SimStore>((set) => ({
  world: null,
  events: [],
  bubbles: {},
  pulses: {},
  newMemories: {},
  memoryVersion: 0,
  autonomyVersion: 0,
  conn: "connecting",
  setSnapshot: (s) => set({ world: applySnapshot(s), events: [], bubbles: {}, pulses: {}, newMemories: {}, memoryVersion: 0, autonomyVersion: 0 }),
  pushEvents: (items, live) =>
    set((st) => {
      if (!st.world) return st;
      const bubbles = { ...st.bubbles };
      const pulses = { ...st.pulses }, fresh = { ...st.newMemories };
      let touched = false, auto = false;
      for (const ev of items) {
        if (ev.type === "agent.memory_created" || ev.type === "agent.memory_retrieved") touched = true;
        if (ev.type === "agent.goal_changed" || ev.type === "agent.relation_changed" || ev.type === "agent.guard_triggered") auto = true;
        if (!live) continue;
        const b = bubbleOf(ev);
        if (b) bubbles[b.agent] = b;
        if (ev.type === "agent.memory_created") { pulses[ev.agents[0]] = { kind: "saved", at: Date.now() }; fresh[(ev.data as { memory_id: string }).memory_id] = Date.now(); }
        if (ev.type === "agent.memory_retrieved") pulses[ev.agents[0]] = { kind: "recalled", at: Date.now() };
      }
      return { world: applyEvents(st.world, items), events: mergeEvents(st.events, items), bubbles, pulses, newMemories: fresh, memoryVersion: touched ? st.memoryVersion + 1 : st.memoryVersion, autonomyVersion: auto ? st.autonomyVersion + 1 : st.autonomyVersion };
    }),
  setHistory: (items) => set((st) => ({ events: mergeEvents(items, st.events) })),
  setConn: (conn) => set({ conn }),
  mergeSimulation: (s) => set((st) => (st.world ? { world: { ...st.world, simulation: s.simulation } } : st)),
}));
