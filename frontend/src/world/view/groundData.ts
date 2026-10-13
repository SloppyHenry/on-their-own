// Kachelraster für den Boden: Art, Stil und Gebäude je Kachel, Abstand zum Ufer. Einmal je Kartenstand aufgebaut.
import type { LocationInfo, ObjectInfo, TileTypeInfo } from "../../store/types";
import { findBuildings, type Building } from "./buildings";

export const T = 16;
export const enum K { Grass, Path, Floor, Wall, Water, Tree, Door, Sand, Other }
export const enum S { None, Planks, Tile, Workshop, Cobble, Garden }
const KIND: Record<string, K> = { grass: K.Grass, path: K.Path, floor: K.Floor, wall: K.Wall, water: K.Water, tree: K.Tree, door: K.Door, sand: K.Sand };

export interface GroundInput {
  rows: string[];
  legend: Record<string, string>;
  tileTypes: Record<string, TileTypeInfo>;
  locations: LocationInfo[];
  objects: ObjectInfo[];
}

type Style = { floor?: string; surface?: string; rug?: boolean; fence?: boolean };
const styleOf = (l: LocationInfo): Style => (l.props.style as Style | undefined) ?? {};

export class GroundData {
  readonly w: number;
  readonly h: number;
  readonly kind: Uint8Array;
  readonly style: Uint8Array;
  readonly rug: Uint8Array;
  readonly bld: Int16Array;
  readonly seedbed: Uint8Array;
  readonly dist: Float32Array;
  readonly other: Map<number, [number, number, number]> = new Map();
  readonly buildings: Building[];

  constructor(inp: GroundInput) {
    this.w = inp.rows[0]?.length ?? 0;
    this.h = inp.rows.length;
    const n = this.w * this.h;
    this.kind = new Uint8Array(n); this.style = new Uint8Array(n); this.rug = new Uint8Array(n);
    this.bld = new Int16Array(n).fill(-1); this.seedbed = new Uint8Array(n); this.dist = new Float32Array(n);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = inp.legend[inp.rows[y][x]] ?? "", i = y * this.w + x;
      this.kind[i] = KIND[t] ?? K.Other;
      if (this.kind[i] === K.Other) { const c = inp.tileTypes[t]?.color ?? "#7a7a7a", v = parseInt(c.slice(1), 16); this.other.set(i, [(v >> 16) & 255, (v >> 8) & 255, v & 255]); }
    }
    // Stile aus den Orten: kleinere Orte gewinnen (Zimmer vor Haus, Platz vor Wegenetz)
    const locs = inp.locations.filter((l) => !l.props.fallback && Object.keys(styleOf(l)).length).sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3]);
    for (const l of locs) {
      const st = styleOf(l), [rx, ry, rw, rh] = l.rect;
      const code = st.floor === "tile" ? S.Tile : st.floor === "workshop" ? S.Workshop : st.floor ? S.Planks : st.surface === "cobble" ? S.Cobble : st.fence ? S.Garden : S.None;
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        if (!this.inside(x, y)) continue;
        const i = y * this.w + x;
        if (code) this.style[i] = code;
        if (st.rug && x > rx && y > ry && x < rx + rw - 1 && y < ry + rh - 1) this.rug[i] = 1;
      }
    }
    this.buildings = findBuildings(inp.rows, inp.legend, inp.locations);
    this.buildings.forEach((b, k) => b.tiles.forEach((key) => { const [x, y] = key.split(",").map(Number); if (this.inside(x, y)) this.bld[y * this.w + x] = k; }));
    for (const o of inp.objects) if (o.kind === "seedbed" && o.x != null && o.y != null && this.inside(o.x, o.y)) this.seedbed[o.y * this.w + o.x] = 1;
    this.waterDistance();
  }

  inside(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  /** Art der Kachel; außerhalb der Karte Wald. */
  k(x: number, y: number): K { return this.inside(x, y) ? this.kind[y * this.w + x] : K.Tree; }
  idx(x: number, y: number) { return this.inside(x, y) ? y * this.w + x : -1; }

  /** Abstand jeder Wasserkachel zum Ufer (Kacheln), für Tiefe und Schaum wie wLake im Mockup. */
  private waterDistance() {
    const d = this.dist, q: number[] = [];
    for (let i = 0; i < d.length; i++) { const w = this.kind[i] === K.Water; d[i] = w ? 1e9 : 0; if (!w) q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % this.w, y = (i / this.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = x + dx, b = y + dy;
        if (!this.inside(a, b)) continue;
        const j = b * this.w + a;
        if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
      }
    }
  }

  /** Weich abgetasteter Uferabstand an einem Weltpunkt. */
  shore(wx: number, wy: number): number {
    const fx = wx / T - 0.5, fy = wy / T - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
    const at = (a: number, b: number) => (this.inside(a, b) ? this.dist[b * this.w + a] : 0);
    return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v - 0.5;
  }
}
