// Werkzeuge in der Hand und kleine Zusatzbilder (Schatten, Schlaf-Zeichen).
import { gridCanvas } from "../../lib/px";
import { ICONS } from "../../lib/px";

const TOOLS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  hammer: { rows: ["..ggg...", "..gggh..", "...hh...", "...hh...", "...hh...", "...hh..."], pal: { g: "#aeb4bd", h: "#8b6340" } },
  can: { rows: [".bbbb.", "bbbbbb", "bbbbbb", ".bbbb.", "..ww.."], pal: { b: "#4f86c6", w: "#9fd0ee" } },
  shovel: { rows: ["..hh..", "..hh..", "..hh..", "..ss..", ".ssss.", ".ssss."], pal: { h: "#8b6340", s: "#aeb4bd" } },
  axe: { rows: ["..gg..", ".gggh.", "..gh..", "...h..", "...h..", "...h.."], pal: { g: "#aeb4bd", h: "#8b6340" } },
  book: { rows: ["bbbbb", "bwwwb", "bwwwb", "bbbbb"], pal: { b: "#b24a3a", w: "#f2ece0" } },
};

const cache = new Map<string, HTMLCanvasElement>();
export function toolCanvas(name: string): HTMLCanvasElement | null {
  const t = TOOLS[name];
  if (!t) return null;
  if (!cache.has(name)) cache.set(name, gridCanvas(t.rows, t.pal));
  return cache.get(name)!;
}

/** Aktion -> Werkzeug in der Hand. */
export const TOOL_FOR_ACTION: Record<string, string> = { build: "hammer", water: "can", plant: "shovel", gather: "axe", use: "hammer" };

export function shadowCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 14;
  c.height = 6;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(25,35,15,.38)";
  for (let dy = -2; dy <= 2; dy++) g.fillRect(2 + Math.abs(dy) * 2, 3 + dy, 10 - Math.abs(dy) * 4, 1);
  return c;
}

export const zzzCanvas = () => gridCanvas(ICONS.zzz, { "#": "#cfe8ff" }, 1);
