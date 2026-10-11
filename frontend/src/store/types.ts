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
  clock: ClockInfo;
  weather: WeatherInfo;
  simulation: SimStatus;
  rules: StateSnapshot["rules"];
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
