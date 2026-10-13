// Schmale Brücke zwischen React/Zustand und Phaser: Die Szene liest nur hierüber, React sieht nur Bildschirmpositionen. So rendern sich beide nie gegenseitig neu.
import { useSimStore } from "../store/simStore";
import type { Bubble, World } from "../store/types";
import { useUiStore, type Selection } from "../store/uiStore";
import type { ViewMode } from "./view/projection";

export interface AgentFrame {
  id: string;
  /** Fußpunkt in Bildschirmpixeln (relativ zur Weltfläche). */
  x: number;
  y: number;
  /** Bildschirmpixel je Weltpixel an dieser Stelle (Tiefe: hinten kleiner). */
  scale: number;
  visible: boolean;
  /** Im Haus (Index) und draußen nicht zu sehen: Schild steht dann über dem Dach; sonst -1. */
  house: number;
}

export interface HouseFrame {
  i: number;
  /** Dachspitze (dort stehen die Schilder der Bewohner darin) und Mitte des Hauses, in Bildschirmpixeln. */
  x: number;
  y: number;
  cy: number;
  occupants: string[];
}

export interface Frame {
  agents: AgentFrame[];
  houses: HouseFrame[];
  /** Raumnamen der Innenansicht (Bildschirmpunkt am vorderen Rand des Raums). */
  rooms: { id: string; x: number; y: number }[];
  /** Innenansicht eines Gebäudes (Index) oder -1. */
  interior: number;
  interiorRooms: string[];
  /** Ziel der Wegvorschau (Mitspieler-Vorschau) in Bildschirmpixeln. */
  goal: { x: number; y: number } | null;
}

export interface WorldBridge {
  world(): World | null;
  bubbles(): Record<string, Bubble>;
  subscribe(fn: () => void): () => void;
  selection(): Selection;
  lastAgent(): string | null;
  follow(): string | null;
  select(s: Selection): void;
  mode(): ViewMode;
  playerPreview(): boolean;
  setFollow(id: string | null): void;
  emitFrame(f: Frame): void;
  /** Meldet sich für den Bildtakt an; liefert die Abmeldung. */
  onFrame(fn: (f: Frame) => void): () => void;
  /** Befehle der Oberfläche an die Szene (Taste 0, Taste F). */
  commands: { fit?: () => void; toggleFollow?: () => void; focusTile?: (x: number, y: number) => void; leaveInterior?: () => void };
}

export function createBridge(): WorldBridge {
  const listeners = new Set<(f: Frame) => void>();
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
    mode: () => ui.getState().worldMode,
    playerPreview: () => ui.getState().playerPreview,
    setFollow: (id) => ui.getState().setFollow(id),
    emitFrame: (f) => listeners.forEach((fn) => fn(f)),
    onFrame: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    commands: {},
  };
}
