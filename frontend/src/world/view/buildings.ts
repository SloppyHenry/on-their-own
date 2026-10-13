// Gebäude: zusammenhängender Block aus Wänden, Böden und Türen, der Räume (Orte mit `style.floor`) enthält.
// Draußen steht dafür das Haus aus Mockup A an der Haustür; innen zeigt die Innenansicht den echten Grundriss (Frage 18).
import type { LocationInfo } from "../../store/types";

export interface Building {
  id: string;
  tiles: Set<string>;               // alle Kacheln des Blocks
  rooms: string[];                  // Orte darin
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Haustür: Türkachel an der Südseite mit freiem Feld davor; sonst Mitte der Südkante. */
  door: { x: number; y: number };
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
    if (!tiles.has(key(rx, ry)) || tiles.size < 4) continue;
    const pts = [...tiles].map((k) => k.split(",").map(Number));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bbox = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    const doors = pts.filter(([x, y]) => type(x, y) === "door" && !tiles.has(key(x, y + 1)) && type(x, y + 1) !== "" && type(x, y + 1) !== "water");
    doors.sort((a, b) => b[1] - a[1] || Math.abs(a[0] - (bbox.x0 + bbox.x1) / 2) - Math.abs(b[0] - (bbox.x0 + bbox.x1) / 2));
    const door = doors.length ? { x: doors[0][0], y: doors[0][1] } : { x: Math.round((bbox.x0 + bbox.x1) / 2), y: bbox.y1 };
    const inside = rooms.filter((l) => tiles.has(key(l.rect[0], l.rect[1])));
    out.push({ id: `building:${rx},${ry}`, tiles, rooms: inside.map((l) => l.id), bbox, door });
  }
  return out;
}

/** Steht jemand auf einer Kachel des Gebäudes? */
export const contains = (b: Building, x: number, y: number) => b.tiles.has(key(x, y));

/** Gebäude, in dem die Kachel liegt (oder null). */
export const buildingAt = (bs: Building[], x: number, y: number) => bs.find((b) => b.tiles.has(key(x, y))) ?? null;
