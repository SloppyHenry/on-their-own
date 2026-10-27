// Wegsuche für die Mitspieler-Vorschau: A* auf dem Kachelraster wie backend/on_their_own/world/pathfinding.py
// (4er-Nachbarschaft plus Übergänge wie die Haustür, Kosten je Kachelart, blockierende Objekte und verschlossene Türen sperren).
// Nur Vorschau, das Backend entscheidet später.
import type { World } from "../../store/types";
import { OBJECT_KINDS } from "../../types/generated";

export type Tile = [number, number];
export interface PathGrid { w: number; h: number; open(x: number, y: number): boolean; cost(x: number, y: number): number; links?: Map<number, Tile[]> }

// wie weather.MOVE_MULT im Backend
const MOVE_MULT: Record<string, number> = { clear: 1, cloudy: 1, rain: 1.25, storm: 1.6, fog: 1.1, snow: 1.5 };

export function gridOf(w: World): PathGrid {
  const rows = w.map.rows, type = (x: number, y: number) => w.tileTypes[w.map.legend[rows[y]?.[x] ?? ""] ?? ""];
  const blocked = new Set<string>();
  for (const o of Object.values(w.objects)) {
    if (o.holder || o.x == null || o.y == null) continue;
    if (OBJECT_KINDS[o.kind]?.blocks || (o.kind === "door" && o.state.locked)) blocked.add(`${o.x},${o.y}`);
  }
  const h = rows.length, wd = rows[0]?.length ?? 0, links = new Map<number, Tile[]>();
  for (const [a, b] of w.links ?? []) {
    for (const [p, q] of [[a, b], [b, a]]) { const k = p[1] * wd + p[0]; links.set(k, [...(links.get(k) ?? []), [q[0], q[1]]]); }
  }
  return {
    w: wd, h, links,
    open: (x, y) => x >= 0 && y >= 0 && x < wd && y < h && !!type(x, y)?.walkable && !blocked.has(`${x},${y}`),
    cost: (x, y) => type(x, y)?.cost ?? 1,
  };
}

/** Weg ohne Startkachel bis einschließlich Ziel; null, wenn unerreichbar. */
export function findPath(g: PathGrid, start: Tile, goal: Tile): Tile[] | null {
  if (start[0] === goal[0] && start[1] === goal[1]) return [];
  if (!g.open(goal[0], goal[1])) return null;
  const key = (x: number, y: number) => y * g.w + x, best = new Map<number, number>([[key(...start), 0]]), came = new Map<number, number>();
  const heap = new Heap(), ends = [...(g.links?.keys() ?? [])].map((k) => [k % g.w, Math.floor(k / g.w)]);
  const est = (x: number, y: number) => {                         // zulässige Schätzung, auch über einen Übergang (wie im Backend)
    let d = Math.abs(x - goal[0]) + Math.abs(y - goal[1]);
    if (ends.length) d = Math.min(d, Math.min(...ends.map(([a, b]) => Math.abs(x - a) + Math.abs(y - b))) + 1 + Math.min(...ends.map(([a, b]) => Math.abs(a - goal[0]) + Math.abs(b - goal[1]))));
    return d;
  };
  heap.push(0, 0, key(...start));
  let counter = 0;
  const goalK = key(...goal);
  while (heap.size) {
    const cur = heap.pop();
    if (cur === goalK) {
      const path: Tile[] = [];
      for (let k: number | undefined = cur; k !== undefined && k !== key(...start); k = came.get(k)) path.push([k % g.w, Math.floor(k / g.w)]);
      return path.reverse();
    }
    const cx = cur % g.w, cy = Math.floor(cur / g.w);
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1], ...(g.links?.get(cur) ?? [])]) {
      if (!g.open(nx, ny)) continue;
      const nk = key(nx, ny), cost = best.get(cur)! + g.cost(nx, ny);
      if (cost < (best.get(nk) ?? Infinity)) { best.set(nk, cost); came.set(nk, cur); heap.push(cost + est(nx, ny), ++counter, nk); }
    }
  }
  return null;
}

/** Gehdauer in Sim-Minuten wie movement.schedule: je Minute ein Budget von 1, höchstens eine Kachel je Minute. */
export function walkMinutes(g: PathGrid, path: Tile[], weather: string): number {
  let budget = 0, t = 0;
  for (const [x, y] of path) {
    const need = g.cost(x, y) * (MOVE_MULT[weather] ?? 1);
    for (;;) { budget += 1; t += 1; if (budget + 1e-9 >= need) { budget -= need; break; } }
  }
  return t;
}

/** Nächste begehbare Kachel zu einem Wunschpunkt (Breitensuche). */
export function nearestOpen(g: PathGrid, x: number, y: number): Tile | null {
  const seen = new Set<number>(), q: Tile[] = [[x, y]];
  for (let i = 0; i < q.length && i < 4096; i++) {
    const [a, b] = q[i];
    if (a < 0 || b < 0 || a >= g.w || b >= g.h || seen.has(b * g.w + a)) continue;
    seen.add(b * g.w + a);
    if (g.open(a, b)) return [a, b];
    q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
  return null;
}

/** Kleiner Binärheap nach (f, Zähler) – gleiche Reihenfolge wie heapq im Backend. */
class Heap {
  private a: [number, number, number][] = [];
  get size() { return this.a.length; }
  private less(i: number, j: number) { const x = this.a[i], y = this.a[j]; return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]); }
  private swap(i: number, j: number) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; }
  push(f: number, n: number, v: number) {
    this.a.push([f, n, v]);
    for (let i = this.a.length - 1; i > 0 && this.less(i, (i - 1) >> 1); i = (i - 1) >> 1) this.swap(i, (i - 1) >> 1);
  }
  pop(): number {
    const top = this.a[0][2], last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.less(l, m)) m = l;
        if (r < this.a.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
}
