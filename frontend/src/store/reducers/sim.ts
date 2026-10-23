import type { EventDataMap, EventType } from "../../types/generated";
import type { World } from "../types";
import type { Handler } from "./index";

const state = (s: "running" | "paused" | "stopped"): Handler<unknown> => (w) => ({ ...w, simulation: { ...w.simulation, state: s } });

export const simHandlers: { [K in EventType]?: Handler<EventDataMap[K]> } = {
  "simulation.started": state("running"),
  "simulation.resumed": state("running"),
  "simulation.paused": state("paused"),
  "simulation.stopped": state("stopped"),
  "simulation.speed_changed": (w, d): World => ({ ...w, simulation: { ...w.simulation, speed_level: d.level, tick_delay_s: d.tick_delay_s } }),
  "simulation.player_takt": (w, d): World => ({ ...w, player: d.player ?? null, playerAutopilot: d.autopilot ?? false, playerHold: d.hold ?? false, playerAuto: d.auto ?? false, playerAutoMinutes: d.auto_minutes ?? 5, playerWaiting: d.waiting ?? false }),
  "simulation.play_mode_changed": (w, d): World => ({ ...w, playMode: d.play_mode === "leben" ? "leben" : "gott" }),
  "simulation.voice_changed": (w, d): World => {                                      // Stimme einer Figur: gilt sofort in allen Browsern
    const voices = { ...w.voices };
    if (d.voice) voices[d.agent] = d.voice as unknown as World["voices"][string]; else delete voices[d.agent];
    return { ...w, voices };
  },
};
