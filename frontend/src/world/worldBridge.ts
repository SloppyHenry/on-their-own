// Schmale Brücke zwischen React/Zustand und Phaser: Die Szene liest nur hierüber, React sieht nur Bildschirmpositionen. So rendern sich beide nie gegenseitig neu.
import { useEditorStore } from "../editor/editorStore";
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
  /** Innenansicht: ein Raum groß (Ort) statt des ganzen Hauses. */
  room?: string | null;
  /** Ziel der Wegvorschau (Mitspieler-Vorschau) in Bildschirmpixeln. */
  goal: { x: number; y: number } | null;
  /** Umriss des Gebiets, das nur als Vorschau gezeigt wird (Welteditor), in Bildschirmpixeln; sonst null. */
  ghost?: [number, number][] | null;
  /** Namensblase über dem Ding unter dem Zeiger (nach kurzem Verweilen), Zeigerposition in CSS-Pixeln. */
  tip?: { text: string; x: number; y: number } | null;
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
  /** Gebiet (`look.regions[].id`), das als Vorschau unter einem Schleier gezeigt wird (Welteditor), sonst null. */
  ghostRegion(): string | null;
  setFollow(id: string | null): void;
  emitFrame(f: Frame): void;
  /** Meldet sich für den Bildtakt an; liefert die Abmeldung. */
  onFrame(fn: (f: Frame) => void): () => void;
  /** Befehle der Oberfläche an die Szene (Taste 0, Taste F). */
  commands: { fit?: () => void; flyTile?: (x: number, y: number) => void; toggleFollow?: () => void; focusTile?: (x: number, y: number) => void; leaveInterior?: () => void };
}

export function createBridge(): WorldBridge {
  const listeners = new Set<(f: Frame) => void>();
  const sim = useSimStore, ui = useUiStore, ed = useEditorStore;
  return {
    world: () => ed.getState().preview?.world ?? sim.getState().world,         // im Welteditor zeigt die Ansicht die Vorschau statt der laufenden Welt
    bubbles: () => sim.getState().bubbles,
    subscribe: (fn) => {
      const a = sim.subscribe(fn), b = ui.subscribe(fn), c = ed.subscribe(fn);
      return () => { a(); b(); c(); };
    },
    selection: () => ui.getState().selection,
    lastAgent: () => ui.getState().lastAgent,
    follow: () => ui.getState().follow,
    select: (s) => ui.getState().select(s),
    mode: () => ui.getState().worldMode,
    playerPreview: () => ui.getState().playerPreview,
    ghostRegion: () => { const p = ed.getState().preview; return p && !p.applied ? p.region : null; },
    setFollow: (id) => ui.getState().setFollow(id),
    emitFrame: (f) => listeners.forEach((fn) => fn(f)),
    onFrame: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    commands: {},
  };
}
