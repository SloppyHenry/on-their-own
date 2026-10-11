// Laufende Wege: das Backend meldet je Weg einen Fahrplan (`agent.walking`), die Position ergibt sich aus der Sim-Uhr.
import type { EventDataMap } from "../../types/generated";
import type { Walk, World } from "../types";
import { without } from "./helpers";

type Tile = [number, number];

const facingOf = (a: Tile, b: Tile): string => (b[0] > a[0] ? "right" : b[0] < a[0] ? "left" : b[1] > a[1] ? "down" : "up");

/** Kachel und Blickrichtung laut Fahrplan zur Minute `minute` (null: noch kein Schritt getan). */
export function walkPos(walk: Walk, minute: number): { tile: Tile; facing: string | null } {
  let k = 0;
  while (k < walk.arrive.length && walk.arrive[k] <= minute) k++;
  if (k === 0) return { tile: walk.from, facing: null };
  const prev = k === 1 ? walk.from : walk.path[k - 1 - 1];
  return { tile: walk.path[k - 1], facing: facingOf(prev, walk.path[k - 1]) };
}

/** Setzt alle laufenden Wege auf die Minute `minute`; unveränderte Agenten bleiben dieselben Objekte. */
export function advanceWalks(w: World, minute: number): World {
  let agents = w.agents;
  for (const [id, walk] of Object.entries(w.walks)) {
    const a = agents[id];
    if (!a) continue;
    const { tile, facing } = walkPos(walk, minute);
    if (a.x === tile[0] && a.y === tile[1]) continue;
    if (agents === w.agents) agents = { ...agents };
    agents[id] = { ...a, x: tile[0], y: tile[1], facing: facing ?? a.facing };
  }
  return agents === w.agents ? w : { ...w, agents };
}

export const startWalk = (w: World, id: string, d: EventDataMap["agent.walking"]): World => {
  const walk: Walk = { from: d.from as Tile, path: d.path as Tile[], arrive: d.arrive };
  const a = w.agents[id];
  const agents = a ? { ...w.agents, [id]: { ...a, x: walk.from[0], y: walk.from[1] } } : w.agents;
  return { ...w, agents, walks: { ...w.walks, [id]: walk } };
};

/** Weg beendet (angekommen, abgebrochen, gescheitert): genaue Kachel übernehmen, falls bekannt. */
export const endWalk = (w: World, id: string, at?: number[] | null): World => {
  const a = w.agents[id];
  const walks = id in w.walks ? without(w.walks, id) : w.walks;
  if (!a || !at) return walks === w.walks ? w : { ...w, walks };
  return { ...w, walks, agents: { ...w.agents, [id]: { ...a, x: at[0], y: at[1] } } };
};

/** Aus dem Snapshot: der restliche Weg beginnt an der aktuellen Kachel. */
export function walksOf(agents: { id: string; x: number; y: number; walk?: { path: number[][]; arrive: number[] } | null }[]): Record<string, Walk> {
  const out: Record<string, Walk> = {};
  for (const a of agents) if (a.walk && a.walk.path.length) out[a.id] = { from: [a.x, a.y], path: a.walk.path as Tile[], arrive: a.walk.arrive };
  return out;
}

/** Kacheln des Fahrplans nach `from` bis einschließlich `to` (mehrere Schritte zwischen zwei Bildern bei hohem Tempo); null, wenn nicht auf der Route. */
export function routeBetween(walk: Walk | undefined, from: [number, number], to: [number, number]): [number, number][] | null {
  if (!walk) return null;
  const route = [walk.from, ...walk.path];
  const i = route.findIndex((t) => t[0] === from[0] && t[1] === from[1]);
  const j = route.findIndex((t, k) => k > i && t[0] === to[0] && t[1] === to[1]);
  return i >= 0 && j > i ? route.slice(i + 1, j + 1) : null;
}
