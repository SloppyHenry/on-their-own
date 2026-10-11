// Ereignis-Reducer: Snapshot + Ereignisse ergeben den Zustand. Reine Funktionen, keine Seiteneffekte.
import { clockOf } from "../../lib/clock";
import type { EventOut, StateSnapshot } from "../../types/generated";
import type { World } from "../types";
import { agentHandlers } from "./agents";
import { simHandlers } from "./sim";
import { advanceWalks, walksOf } from "./walks";
import { worldHandlers } from "./world";

export type Handler<T> = (w: World, data: T, ev: EventOut) => World;

const HANDLERS: Record<string, Handler<never> | undefined> = { ...agentHandlers, ...worldHandlers, ...simHandlers } as Record<string, Handler<never> | undefined>;

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]));

export function applySnapshot(s: StateSnapshot): World {
  return {
    seq: s.seq,
    worldName: s.world_name,
    map: s.map,
    tileTypes: s.tile_types,
    locations: byId(s.locations),
    objects: byId(s.objects),
    resources: byId(s.resources),
    agents: byId(s.agents),
    agentOrder: s.agents.map((a) => a.id),
    activity: {},
    walks: walksOf(s.agents),
    clock: s.clock,
    weather: s.weather,
    simulation: s.simulation,
    rules: s.rules,
    stale: false,
  };
}

/** Wendet ein Ereignis an. Bereits gesehene Nummern werden ignoriert; unbekannte Typen ändern nur Uhr und Nummer. */
export function applyEvent(w: World, ev: EventOut): World {
  if (ev.seq <= w.seq) return w;
  const handler = HANDLERS[ev.type] as Handler<unknown> | undefined;
  const next = handler ? handler(w, ev.data, ev) : w;
  return { ...applyClock(next, ev.sim_time.total), seq: ev.seq };
}

/** Uhr vorstellen (aus einem Ereignis oder dem Uhrtakt des Servers) und laufende Wege mitführen. Nie rückwärts. */
export function applyClock(w: World, minute: number): World {
  if (minute < w.clock.minute) return w;
  const next = minute === w.clock.minute ? w : { ...w, clock: clockOf(minute) };
  return advanceWalks(next, minute);
}

export function applyEvents(w: World, events: EventOut[]): World {
  return events.reduce(applyEvent, w);
}
