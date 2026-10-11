// Dächer: Ein Gebäude ist der zusammenhängende Block aus Wänden, Böden und Türen, der Räume (Orte mit `style.floor`) enthält.
// Das Dach deckt alles außer der Südfassade ab und blendet sich aus, solange jemand im Gebäude ist.
import type { LocationInfo } from "../../store/types";
import { newCanvas, rnd, TILE as T } from "./pen";

export interface Building {
  id: string;
  tiles: Set<string>;               // alle Kacheln des Blocks
  roof: [number, number][];         // vom Dach bedeckte Kacheln (ohne Südfassade)
  rooms: string[];                  // Orte darin
  rects: number[][];                // deren Rechtecke (für Firstlinien und Fugen)
  bbox: { x0: number; y0: number; x1: number; y1: number };
  chimney: { x: number; y: number };
}

const SOLID = ["wall", "floor", "door"];
const key = (x: number, y: number) => `${x},${y}`;

export function findBuildings(rows: string[], legend: Record<string, string>, locations: LocationInfo[]): Building[] {
  const type = (x: number, y: number) => legend[rows[y]?.[x] ?? ""] ?? "";
  const rooms = locations.filter((l) => (l.props.style as { floor?: string } | undefined)?.floor && !l.props.fallback);
  const seen = new Set<string>(), out: Building[] = [];
  for (const r of rooms) {
    const [rx, ry] = r.rect;
    if (seen.has(key(rx, ry)) || !SOLID.includes(type(rx, ry))) continue;
    const tiles = new Set<string>(), stack: [number, number][] = [[rx, ry]];
    while (stack.length) {
      const [x, y] = stack.pop()!, k = key(x, y);
      if (tiles.has(k) || !SOLID.includes(type(x, y))) continue;
      tiles.add(k);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    tiles.forEach((k) => seen.add(k));
    const roof: [number, number][] = [];
    for (const k of tiles) {
      const [x, y] = k.split(",").map(Number), facade = (type(x, y) === "wall" || type(x, y) === "door") && !SOLID.includes(type(x, y + 1));
      if (!facade) roof.push([x, y]);
    }
    if (!roof.length) continue;
    const xs = roof.map((t) => t[0]), ys = roof.map((t) => t[1]), x1 = Math.max(...xs), y0 = Math.min(...ys);
    const inside = rooms.filter((l) => tiles.has(key(l.rect[0], l.rect[1])));
    out.push({
      id: `building:${rx},${ry}`, tiles, roof, rooms: inside.map((l) => l.id), rects: inside.map((l) => l.rect),
      bbox: { x0: Math.min(...xs), y0, x1, y1: Math.max(...ys) }, chimney: { x: x1 - 2, y: y0 },
    });
  }
  return out;
}

/** Ist jemand im Gebäude (auf einer seiner Kacheln oder in einem seiner Räume), oder ist einer davon ausgewählt? */
export function isOccupied(b: Building, agents: { x: number; y: number; location_id: string }[], selectedLocation: string | null): boolean {
  return agents.some((a) => b.tiles.has(key(a.x, a.y)) || b.rooms.includes(a.location_id)) || (selectedLocation !== null && b.rooms.includes(selectedLocation));
}

const PAD = 4;
export const ROOF_PAD = PAD;

export function roofCanvas(b: Building): HTMLCanvasElement {
  const { x0, y0, x1, y1 } = b.bbox, w = (x1 - x0 + 1) * T, h = (y1 - y0 + 1) * T;
  const { canvas, p } = newCanvas(w + PAD * 2, h + PAD * 2 + 8);
  const mask = new Set(b.roof.map(([x, y]) => key(x, y))), has = (x: number, y: number) => mask.has(key(x, y));
  const ox = (x: number) => (x - x0) * T + PAD, oy = (y: number) => (y - y0) * T + PAD;
  for (const [x, y] of b.roof) {                      // Überstand zuerst, damit die Kanten sauber überdeckt werden
    const px = ox(x), py = oy(y);
    if (!has(x - 1, y)) p.F("#3a1d18", px - PAD, py, PAD, T);
    if (!has(x + 1, y)) p.F("#3a1d18", px + T, py, PAD, T);
    if (!has(x, y - 1)) p.F("#3a1d18", px, py - PAD, T, PAD);
    if (!has(x, y + 1)) { p.F("#3a1d18", px, py + T, T, PAD); p.F("rgba(30,20,15,.32)", px, py + T + PAD, T, 4); }
  }
  for (const [x, y] of b.roof) {
    const px = ox(x), py = oy(y);
    p.F("#a8443a", px, py, T, T);
    for (let j = 0; j < T; j += 4) {
      const off = (((y * 4 + j) / 4) % 2) * 4;
      for (let i = -off; i < T; i += 8) {
        const sx = Math.max(0, i), sw = Math.min(T, i + 8) - sx;
        p.F(rnd(x + (i >> 3), y * 4 + j, 4) > 0.7 ? "#bf5a4b" : "#b24a3a", px + sx, py + j, sw, 3);
        p.F("#7b2f27", px + sx, py + j + 3, sw, 1);
        p.F("#7b2f27", px + sx, py + j, 1, 3);
      }
    }
    if (!has(x, y - 1)) p.F("#d4705e", px, py, T, 1);
    if (!has(x - 1, y)) p.F("#d4705e", px, py, 1, T);
  }
  for (const [rx, ry, rw, rh] of b.rects) {          // jeder Raum ein Dachfeld: Fugen am Rand, Firstlinie in der Mitte
    const x = ox(rx) - T, y = oy(ry) - T, w = (rw + 2) * T, h = (rh + 2) * T, mid = y + Math.floor(h / 2);
    p.F("rgba(70,25,20,.55)", x, y, w, 1); p.F("rgba(70,25,20,.55)", x, y + h - 1, w, 1);
    p.F("rgba(70,25,20,.55)", x, y, 1, h); p.F("rgba(70,25,20,.55)", x + w - 1, y, 1, h);
    p.F("#e0806f", x + 3, mid - 1, w - 6, 2); p.F("#7b2f27", x + 3, mid + 1, w - 6, 1);
  }
  const cx = ox(b.chimney.x) + 4, cy = oy(b.chimney.y) + 2;
  p.F("#2e2218", cx - 1, cy - 1, 11, 14); p.F("#8a7a74", cx, cy, 9, 12); p.F("#a8978f", cx, cy, 2, 12); p.F("#4b4440", cx - 1, cy - 2, 11, 3);
  return canvas;
}
