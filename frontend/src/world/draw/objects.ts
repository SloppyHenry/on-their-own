// Objekt -> Textur. Der Schlüssel enthält nur, was optisch zählt (Art, Zustand), damit Texturen geteilt werden.
import type { ObjectInfo, ResourceInfo } from "../../store/types";
import { ALL_DRAWERS, drawDoor, drawPlant, drawResource } from "./outdoor";
import { H } from "./furniture";
import { newCanvas, TILE } from "./pen";

export const OBJ_W = TILE;
export const OBJ_H = H;
const WET_MINUTES = 360;

export interface ObjectEnv {
  minute: number;
  doorHorizontal: (x: number, y: number) => boolean;
}

export function visualKey(o: ObjectInfo, env: ObjectEnv): string {
  const s = o.state;
  switch (o.kind) {
    case "plant": return `plant|${s.stage ?? 0}|${s.crop ?? ""}|${s.watered_at != null && env.minute - Number(s.watered_at) < WET_MINUTES ? "w" : "d"}`;
    case "door": return `door|${s.locked ? "L" : "o"}|${o.x != null && o.y != null && env.doorHorizontal(o.x, o.y) ? "h" : "v"}`;
    case "fireplace": case "firepit": return `${o.kind}|${s.lit ? 1 : 0}`;
    case "construction_site": return `site|${Math.round((Number(s.progress ?? 0) / Math.max(1, Number(s.total ?? 1))) * 3)}|${Math.round((Number(s.progress ?? 0) / Math.max(1, Number(s.total ?? 1))) * 12)}`;
    case "bed": case "sofa": return `${o.kind}|${o.id}`;
    case "desk": case "board": return `${o.kind}|${Math.min(3, ((s.notes as unknown[]) ?? []).length)}`;
    default: return ALL_DRAWERS[o.kind] ? o.kind : "unknown";
  }
}

export function objectCanvas(o: ObjectInfo, env: ObjectEnv): HTMLCanvasElement {
  const { canvas, p } = newCanvas(OBJ_W, OBJ_H);
  const key = visualKey(o, env);
  if (key.startsWith("plant|")) drawPlant(p, o, key.endsWith("|w"));
  else if (o.kind === "door") drawDoor(p, o, key.endsWith("|h"));
  else (ALL_DRAWERS[o.kind] ?? ALL_DRAWERS.unknown)(p, o);
  return canvas;
}

export function resourceKey(n: ResourceInfo): string {
  const ratio = n.cap > 0 && n.cap < 500 ? Math.round(Math.max(0, Math.min(1, n.amount / n.cap)) * 5) : 5;
  return `res|${n.resource}|${n.id.includes("mushroom") ? "m" : ""}|${n.amount >= 1 ? 1 : 0}|${ratio}`;
}

export function resourceCanvas(n: ResourceInfo): HTMLCanvasElement {
  const { canvas, p } = newCanvas(OBJ_W, OBJ_H);
  drawResource(p, n);
  return canvas;
}
