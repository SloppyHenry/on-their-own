// Schmale Brücke zwischen React/Zustand und Phaser: Die Szene liest nur hierüber, React sieht nur Bildschirmpositionen. So rendern sich beide nie gegenseitig neu.
import { useSimStore } from "../store/simStore";
import type { Bubble, World } from "../store/types";
import { useUiStore, type Selection } from "../store/uiStore";

export interface AgentFrame {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface Frame {
  agents: AgentFrame[];
  zoom: number;
}

export interface WorldBridge {
  world(): World | null;
  bubbles(): Record<string, Bubble>;
  subscribe(fn: () => void): () => void;
  selection(): Selection;
  lastAgent(): string | null;
  follow(): string | null;
  select(s: Selection): void;
  setFollow(id: string | null): void;
  emitFrame(f: Frame): void;
  onFrame(fn: ((f: Frame) => void) | null): void;
  /** Eigene 2D-Fläche über der Szene für Licht und Wetter (vom Container gesetzt). */
  fx: HTMLCanvasElement | null;
  /** Befehle der Oberfläche an die Szene (Taste 0, Taste F). */
  commands: { fit?: () => void; toggleFollow?: () => void };
}

export function createBridge(): WorldBridge {
  let listener: ((f: Frame) => void) | null = null;
  const sim = useSimStore, ui = useUiStore;
  return {
    world: () => sim.getState().world,
    bubbles: () => sim.getState().bubbles,
    subscribe: (fn) => {
      const a = sim.subscribe(fn), b = ui.subscribe(fn);
      return () => { a(); b(); };
    },
    selection: () => ui.getState().selection,
    lastAgent: () => ui.getState().lastAgent,
    follow: () => ui.getState().follow,
    select: (s) => ui.getState().select(s),
    setFollow: (id) => ui.getState().setFollow(id),
    emitFrame: (f) => listener?.(f),
    onFrame: (fn) => { listener = fn; },
    fx: null,
    commands: {},
  };
}
