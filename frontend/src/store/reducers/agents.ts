import type { EventDataMap, EventType } from "../../types/generated";
import type { Activity, World } from "../types";
import { toObjectInfo, setObject, withAgent } from "./helpers";
import type { Handler } from "./index";
import { endWalk, startWalk } from "./walks";

const act = (w: World, id: string, patch: Partial<Activity>): World => ({ ...w, activity: { ...w.activity, [id]: { ...w.activity[id], ...patch } } });

function problem(w: World, id: string, text: string, minute: number, at?: number[] | null): World {
  return act(withAgent(endWalk(w, id, at), id, { action: null }), id, { lastResult: { ok: false, text, minute } });
}

const setNeed = (key: "hunger" | "thirst" | "energy"): Handler<{ hunger?: number; thirst?: number; energy?: number }> => (w, d, ev) => {
  const id = ev.agents[0];
  const a = w.agents[id];
  const v = d[key];
  return a && v !== undefined ? withAgent(w, id, { needs: { ...a.needs, [key]: v } }) : w;
};

const itemMoved: Handler<EventDataMap["agent.item_taken"]> = (w, d) => {
  const old = w.objects[d.object.id];
  return setObject(w, toObjectInfo(d.object, old));
};

export const agentHandlers: { [K in EventType]?: Handler<EventDataMap[K]> } = {
  "agent.walking": (w, d, ev) => startWalk(w, ev.agents[0], d),
  "agent.arrived": (w, d, ev) => endWalk(w, ev.agents[0], d.at),
  "agent.moved": (w, d, ev) => withAgent(w, ev.agents[0], { x: d.to[0], y: d.to[1], facing: d.facing }),   // nur ältere Protokolle
  "agent.location_changed": (w, d, ev) => withAgent(w, ev.agents[0], d.at ? { location_id: d.to_location, x: d.at[0], y: d.at[1] } : { location_id: d.to_location }),
  "agent.action_started": (w, d, ev) =>
    withAgent(w, ev.agents[0], { action: { type: d.action, params: d.params ?? {}, started_at: ev.sim_time.total, ends_at: d.ends_at ?? null } }),
  "agent.action_completed": (w, d, ev) => {
    const id = ev.agents[0];
    const next = withAgent(endWalk(w, id), id, { action: null });
    return act(next, id, { lastResult: { ok: true, text: d.action, minute: ev.sim_time.total } });
  },
  "agent.action_failed": (w, d, ev) => problem(w, ev.agents[0], d.text, ev.sim_time.total, d.at),
  "agent.action_rejected": (w, d, ev) => problem(w, ev.agents[0], d.text, ev.sim_time.total),
  "agent.action_interrupted": (w, d, ev) => problem(w, ev.agents[0], d.reason ?? "unterbrochen", ev.sim_time.total, d.at),
  "agent.status_changed": (w, d, ev) => withAgent(w, ev.agents[0], { status: d.new }),
  "agent.inventory_changed": (w, d, ev) => {
    const a = w.agents[ev.agents[0]];
    if (!a) return w;
    const inv = { ...a.inventory };
    if (d.qty > 0) inv[d.resource] = d.qty;
    else delete inv[d.resource];
    return withAgent(w, a.id, { inventory: inv });
  },
  "agent.decision": (w, d, ev) => act(w, ev.agents[0], { intent: d.intent ?? "", chosen: d.chosen ?? null }),
  "agent.item_taken": itemMoved,
  "agent.item_dropped": itemMoved,
  "agent.ate": setNeed("hunger"),
  "agent.drank": setNeed("thirst"),
  "agent.slept": setNeed("energy"),
  "agent.rested": setNeed("energy"),
  "world.agent_added": (w, d) =>
    w.agents[d.id]
      ? w
      : {
          ...w,
          agentOrder: [...w.agentOrder, d.id],
          agents: {
            ...w.agents,
            [d.id]: { id: d.id, name: d.name, x: d.tile[0], y: d.tile[1], location_id: "", facing: "down", capacity: d.capacity, action: null, walk: null, status: "idle", needs: {}, words: {}, inventory: {}, held: [], profile: null, plan_next: "" },
          },
        },
};
