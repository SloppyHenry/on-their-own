import type { EventOut, StateSnapshot } from "../types/generated";
import { clockOf } from "../lib/clock";

export function makeSnapshot(over: Partial<StateSnapshot> = {}): StateSnapshot {
  return {
    seq: 10,
    world_name: "Testdorf",
    map: { width: 6, height: 3, rows: ["TTTTTT", "T..,.T", "TTTTTT"], legend: { T: "tree", ".": "grass", ",": "path" } },
    tile_types: {
      tree: { char: "T", walkable: false, cost: 0, color: "#2f5d34", label: "Baum" },
      grass: { char: ".", walkable: true, cost: 2, color: "#5f8f4b", label: "Gras" },
      path: { char: ",", walkable: true, cost: 1, color: "#b59a6a", label: "Weg" },
    },
    locations: [{ id: "paths", name: "Wege", rect: [0, 0, 6, 3], entrances: [], props: {}, discovered_by: [] }],
    objects: [{ id: "bench", kind: "bench", name: "Bank", x: 3, y: 1, location_id: "paths", holder: null, state: {}, portable: false, owner: null, hidden: false, known_by: [] }],
    resources: [],
    links: [],
    look: null,
    voices: {},
    play_mode: "gott",
    player: null,
    player_autopilot: false,
    player_hold: false,
    player_auto: false,
    player_auto_minutes: 5,
    player_waiting: false,
    agents: [
      { id: "alex", name: "Alex", x: 1, y: 1, location_id: "paths", facing: "down", capacity: 10, action: null, walk: null, status: "idle", needs: { energy: 80, hunger: 20, thirst: 20 }, words: {}, inventory: {}, held: [], profile: null, plan_next: "" },
      { id: "mira", name: "Mira", x: 2, y: 1, location_id: "paths", facing: "down", capacity: 10, action: null, walk: null, status: "idle", needs: { energy: 80, hunger: 20, thirst: 20 }, words: {}, inventory: {}, held: [], profile: null, plan_next: "" },
    ],
    clock: clockOf(420),
    weather: { kind: "clear", since: 0, until: 600 },
    simulation: { state: "paused", tick_delay_s: 1, speed_level: "1x", stats: {}, llm: {} },
    rules: {} as StateSnapshot["rules"],
    ...over,
  };
}

let nextSeq = 11;
export function ev(type: string, data: Record<string, unknown>, o: Partial<EventOut> = {}): EventOut {
  const seq = o.seq ?? nextSeq++;
  const total = o.sim_time?.total ?? 420 + seq;
  return {
    id: `evt_${seq}`, seq, ts: "2026-10-11T00:00:00+00:00", type, category: "world", agents: [], location: null, caused_by: null, visibility: "public",
    sim_time: { day: 1, minute: total % 1440, total }, data, ...o,
  } as EventOut;
}
export const resetSeq = (n = 11) => { nextSeq = n; };
