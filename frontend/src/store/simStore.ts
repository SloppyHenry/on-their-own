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

interface SimStore {
  world: World | null;
  events: EventOut[];
  bubbles: Record<string, Bubble>;
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
  conn: "connecting",
  setSnapshot: (s) => set({ world: applySnapshot(s), events: [], bubbles: {} }),
  pushEvents: (items, live) =>
    set((st) => {
      if (!st.world) return st;
      const bubbles = { ...st.bubbles };
      if (live) for (const ev of items) { const b = bubbleOf(ev); if (b) bubbles[b.agent] = b; }
      return { world: applyEvents(st.world, items), events: mergeEvents(st.events, items), bubbles };
    }),
  setHistory: (items) => set((st) => ({ events: mergeEvents(items, st.events) })),
  setConn: (conn) => set({ conn }),
  mergeSimulation: (s) => set((st) => (st.world ? { world: { ...st.world, simulation: s.simulation } } : st)),
}));
