import type { ObjectData } from "../../types/generated";
import type { AgentInfo, ObjectInfo, World } from "../types";

export const toObjectInfo = (o: ObjectData, old?: ObjectInfo): ObjectInfo => ({
  portable: false,
  owner: null,
  hidden: false,
  known_by: [],
  ...old,
  id: o.id,
  kind: o.kind,
  name: o.name,
  x: o.x ?? null,
  y: o.y ?? null,
  location_id: o.location_id ?? null,
  holder: o.holder ?? null,
  state: o.state ?? old?.state ?? {},
});

export const withAgent = (w: World, id: string, patch: Partial<AgentInfo>): World => {
  const a = w.agents[id];
  return a ? { ...w, agents: { ...w.agents, [id]: { ...a, ...patch } } } : w;
};

export const setObject = (w: World, o: ObjectInfo): World => ({ ...w, objects: { ...w.objects, [o.id]: o } });

export const without = <T,>(rec: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _gone, ...rest } = rec;
  return rest;
};
