// Zustand des Clients: Snapshot des Backends plus daraus abgeleitete Laufzeitdaten.
import type { AgentInfo, ClockInfo, LocationInfo, MapData, ObjectInfo, ResourceInfo, SimStatus, StateSnapshot, TileTypeInfo, WeatherInfo } from "../types/generated";

export type { AgentInfo, ClockInfo, LocationInfo, MapData, ObjectInfo, ResourceInfo, SimStatus, StateSnapshot, TileTypeInfo, WeatherInfo };
export type Conn = "connecting" | "open" | "reconnecting" | "closed";

export interface Outcome {
  ok: boolean;
  text: string;
  minute: number;
}

/** Was ein Agent zuletzt getan oder gewollt hat; entsteht nur aus Ereignissen. */
export interface Activity {
  lastResult?: Outcome;
  intent?: string;
  chosen?: string | null;
}

/** Laufender Weg: Startkachel, folgende Kacheln und die Sim-Minute, zu der jede erreicht wird. */
export interface Walk {
  from: [number, number];
  path: [number, number][];
  arrive: number[];
}

export interface World {
  seq: number;
  worldName: string;
  map: MapData;
  tileTypes: Record<string, TileTypeInfo>;
  locations: Record<string, LocationInfo>;
  objects: Record<string, ObjectInfo>;
  resources: Record<string, ResourceInfo>;
  agents: Record<string, AgentInfo>;
  agentOrder: string[];
  activity: Record<string, Activity>;
  walks: Record<string, Walk>;
  clock: ClockInfo;
  weather: WeatherInfo;
  simulation: SimStatus;
  rules: StateSnapshot["rules"];
  /** Übergänge zwischen Kacheln, die nicht nebeneinander liegen (Haustür ↔ Innenbereich). */
  links?: number[][][];
  /** Darstellung der Welt (Mockup A); fehlt bei Welten ohne eigene Gestaltung (alte Spielstände). */
  look?: StateSnapshot["look"];
  /** Eigene Stimmen der Figuren (AP17d), gespeichert in der Welt und damit im Spielstand; fehlt eine, gilt der Vorschlag. */
  voices: StateSnapshot["voices"];
  /** Spielart (AP18d): „leben“ = nur die Bewohner verändern die Welt, „gott“ = auch du von außen. Alte Spielstände gelten als „gott“. */
  playMode: "leben" | "gott";
  /** Deine eigene Figur (AP18h), nur in der Spielart Leben; sonst null. Der Autopilot übernimmt sie vorübergehend. */
  player: string | null;
  playerAutopilot: boolean;
  /** Takt der eigenen Figur (a3): Schalter, Frist in echten Minuten, und ob die Zeit gerade auf dich wartet. */
  playerHold: boolean;
  playerAuto: boolean;
  playerAutoMinutes: number;
  playerWaiting: boolean;
  /** Ein Ereignis war unvollständig (z. B. abgeschnittene Kachelliste): Zustand neu laden. */
  stale: boolean;
}

export interface Bubble {
  id: string;
  agent: string;
  to: string;
  text: string;
  seq: number;
  shownAt: number;
}
