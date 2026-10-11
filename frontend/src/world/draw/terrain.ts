// Gelände aus Kacheln: Wiese, Wege, Pflaster, Böden, Wände mit Vorderseite, Wasser mit Ufer. Unbekannte Kachelarten werden einfarbig gezeichnet.
import type { LocationInfo, TileTypeInfo } from "../../store/types";
import { newCanvas, pick, rnd, TILE as T, type Pen } from "./pen";

export interface TerrainInput {
  rows: string[];
  legend: Record<string, string>;
  tileTypes: Record<string, TileTypeInfo>;
  locations: LocationInfo[];
}

export interface Terrain {
  canvas: HTMLCanvasElement;
  trees: { x: number; y: number }[];
  water: [number, number][];
}

type Style = { floor?: string; surface?: string; rug?: boolean };
const styleOf = (l: LocationInfo): Style => (l.props.style as Style | undefined) ?? {};

class Grid {
  constructor(readonly inp: TerrainInput) {}
  get w() { return this.inp.rows[0]?.length ?? 0; }
  get h() { return this.inp.rows.length; }
  at(x: number, y: number): string { return x < 0 || y < 0 || y >= this.h || x >= this.w ? "" : this.inp.legend[this.inp.rows[y][x]] ?? ""; }
  is(x: number, y: number, ...t: string[]) { return t.includes(this.at(x, y)); }
  /** Nur innerhalb der Karte; außerhalb zählt als „gleich“, damit Ränder keine Kanten bekommen. */
  same(x: number, y: number, t: string) { const a = this.at(x, y); return a === "" || a === t; }
}

function surfaceMap(g: Grid): (x: number, y: number) => Style {
  const locs = g.inp.locations.filter((l) => !l.props.fallback && Object.keys(styleOf(l)).length);
  return (x, y) => {
    for (const l of locs) {
      const [rx, ry, rw, rh] = l.rect;
      if (x >= rx && y >= ry && x < rx + rw && y < ry + rh) return styleOf(l);
    }
    return {};
  };
}

const GRASS = ["#69a74a", "#6fae4f", "#75b655"];

function grass(p: Pen, x: number, y: number) {
  const px = x * T, py = y * T, r = (s: number) => rnd(x, y, s);
  p.F(pick(GRASS, (Math.sin(x * 0.55 + y * 0.3) + Math.sin(y * 0.8 - x * 0.2) + 2) / 4), px, py, T, T);
  for (let i = 0; i < 5; i++) {
    const gx = px + (r(10 + i) * 14 | 0), gy = py + (r(20 + i) * 13 | 0), c = i % 2 ? "#559a3c" : "#8fd06a";
    p.F(c, gx, gy, 1, 2);
    p.F(c, gx + 1, gy + 1, 1, 1);
  }
  if (r(40) < 0.06) {
    const c = pick(["#fff3d6", "#f2d24b", "#f08ab0", "#b99cf0"], r(41)), fx = px + 3 + (r(42) * 9 | 0), fy = py + 3 + (r(43) * 9 | 0);
    p.F("#3f7e3a", fx, fy + 1, 1, 2);
    p.F(c, fx - 1, fy, 3, 1);
    p.F(c, fx, fy - 1, 1, 3);
    p.F("#f6b73c", fx, fy, 1, 1);
  }
}

function dirt(p: Pen, x: number, y: number) {
  const px = x * T, py = y * T;
  p.F(pick(["#c9a066", "#c29a60", "#cfa86f"], rnd(x, y, 3)), px, py, T, T);
  for (let i = 0; i < 4; i++) {
    const sx = px + (rnd(x, y, 30 + i) * 14 | 0), sy = py + (rnd(x, y, 50 + i) * 14 | 0);
    p.F("#a97f4b", sx, sy, 2, 1);
    p.F("#dcb985", sx, sy + 1, 1, 1);
  }
}

function cobble(p: Pen, x: number, y: number) {
  const px = x * T, py = y * T;
  p.F("#8a7f74", px, py, T, T);
  for (let row = 0; row < 2; row++) for (let c = 0; c < 2; c++) {
    const sx = px + c * 8 + (row ? 4 : 0), sy = py + row * 8, sh = pick(["#c9bfae", "#bdb3a2", "#d1c8b8", "#b5ab9b"], rnd(x, y, 60 + row * 2 + c));
    p.F(sh, sx + 1, sy + 1, 6, 6);
    p.F("#e6ddcc", sx + 1, sy + 1, 6, 1);
    p.F("#968c7c", sx + 1, sy + 6, 6, 1);
  }
}

function sand(p: Pen, x: number, y: number) {
  const px = x * T, py = y * T;
  p.F("#e3cf94", px, py, T, T);
  for (let i = 0; i < 6; i++) p.F(i % 2 ? "#cdb878" : "#f2e3b0", px + (rnd(x, y, i) * 15 | 0), py + (rnd(x, y, i + 9) * 15 | 0), 1, 1);
}

function water(p: Pen, x: number, y: number) {
  p.F(pick(["#3a88c9", "#3f8fd0", "#4296d6"], (Math.sin(x * 0.9 + y * 0.5) + 1) / 2), x * T, y * T, T, T);
}

function floor(p: Pen, x: number, y: number, kind: string) {
  const px = x * T, py = y * T;
  if (kind === "tile") {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) p.F((i + j + x + y) % 2 ? "#cfc7b4" : "#e2dccd", px + i * 8, py + j * 8, 8, 8);
    p.F("#b8af9b", px, py + 7, T, 1);
    p.F("#b8af9b", px + 7, py, 1, T);
    return;
  }
  const base = kind === "workshop" ? "#9a7048" : "#b98a58", line = kind === "workshop" ? "#82592f" : "#a57849";
  p.F(base, px, py, T, T);
  for (let i = 0; i < T; i += 4) p.F(line, px, py + i + 3, T, 1);
  for (let i = 0; i < 4; i++) p.F(line, px + (rnd(x, y, i) * 14 | 0) + 1, py + i * 4, 1, 3);
  p.F(kind === "workshop" ? "#a98055" : "#c79a68", px, py, T, 1);
  if (kind === "workshop") for (let i = 0; i < 4; i++) p.F("#d9b98a", px + (rnd(x, y, 70 + i) * 15 | 0), py + (rnd(x, y, 80 + i) * 15 | 0), 1, 1);
}

/** Wand: Vorderseite (Putz) wenn darunter keine Wand liegt, sonst Oberkante mit Schindelmuster. */
function wall(p: Pen, g: Grid, x: number, y: number) {
  const px = x * T, py = y * T;
  if (g.is(x, y + 1, "wall")) {
    p.F("#8a4b3a", px, py, T, T);
    for (let j = 0; j < T; j += 4) { const off = (j / 4 + x) % 2 * 4; for (let i = -off; i < T; i += 8) { p.F("#a35d49", Math.max(px, px + i), py + j, Math.min(8, T - Math.max(0, i)) - 1, 2); p.F("#6e3a2d", Math.max(px, px + i), py + j + 3, 8, 1); } }
    if (!g.is(x, y - 1, "wall")) p.F("#b9705a", px, py, T, 1);
    return;
  }
  p.F("#7a4a3a", px, py, T, 4);
  p.F("#93604b", px, py, T, 1);
  p.F("#ecd9b2", px, py + 4, T, 12);
  for (let j = 7; j < 14; j += 4) p.F("#dcc79b", px, py + j, T, 1);
  if (x % 3 === 0) p.F("#8a5a32", px, py + 4, 2, 12);
  p.F("#8a5a32", px, py + 14, T, 2);
  p.F("#6a4424", px, py + 15, T, 1);
}

function doorway(p: Pen, g: Grid, x: number, y: number, kind: string) {
  floor(p, x, y, kind);
  const px = x * T, py = y * T, horizontal = g.is(x - 1, y, "wall") && g.is(x + 1, y, "wall");
  if (horizontal) { p.F("#8a5a32", px, py, T, 2); p.F("#6a4424", px + 1, py + 2, 2, 12); p.F("#6a4424", px + 13, py + 2, 2, 12); p.F("rgba(0,0,0,.15)", px + 3, py + 2, 10, 2); }
  else { p.F("#8a5a32", px, py, 2, T); p.F("#6a4424", px + 2, py + 1, 12, 2); p.F("#6a4424", px + 2, py + 13, 12, 2); }
}

function edges(p: Pen, g: Grid, x: number, y: number, t: string) {
  const px = x * T, py = y * T;
  const sides: [number, number, number, number, number, number][] = [[0, -1, px, py - 1, T, 1], [0, 1, px, py + T, T, 1], [-1, 0, px - 1, py, 1, T], [1, 0, px + T, py, 1, T]];
  if (t === "path" || t === "cobble") {
    for (const [dx, dy, ex, ey, w, h] of sides) {
      if (g.at(x + dx, y + dy) !== "grass") continue;
      for (let i = 0; i < T; i += 2) p.F((i / 2 + x + y) % 3 ? "#4f8f3a" : "#8fd06a", w > 1 ? ex + i : ex, h > 1 ? ey + i : ey, w > 1 ? 2 : 1, h > 1 ? 2 : 1);
    }
  }
  if (t === "water") {
    const foam = "rgba(255,255,255,.55)";
    if (g.at(x, y - 1) === "sand") p.F(foam, px, py, T, 1);
    if (g.at(x, y + 1) === "sand") p.F(foam, px, py + T - 1, T, 1);
    if (g.at(x - 1, y) === "sand") p.F(foam, px, py, 1, T);
    if (g.at(x + 1, y) === "sand") p.F(foam, px + T - 1, py, 1, T);
  }
  if (t === "floor" || t === "grass" || t === "path") if (g.is(x, y - 1, "wall")) { p.F("rgba(40,25,20,.28)", px, py, T, 3); p.F("rgba(40,25,20,.12)", px, py + 3, T, 2); }
}

function rugs(p: Pen, g: Grid) {
  for (const l of g.inp.locations) {
    if (!styleOf(l).rug) continue;
    const [rx, ry, rw, rh] = l.rect, x0 = (rx + 2) * T, y0 = (ry + 1) * T, w = (rw - 4) * T, h = (rh - 2) * T;
    p.F("#6e2a25", x0, y0, w, h);
    p.F("#a8443a", x0 + 2, y0 + 2, w - 4, h - 4);
    p.F("#e6c27a", x0 + 4, y0 + 4, w - 8, 1);
    p.F("#e6c27a", x0 + 4, y0 + h - 5, w - 8, 1);
    for (let i = 8; i < w - 8; i += 8) p.F("#c9604f", x0 + i, y0 + 6, 3, h - 12);
  }
}

export function buildTerrain(inp: TerrainInput): Terrain {
  const g = new Grid(inp), surf = surfaceMap(g), { canvas, p } = newCanvas(g.w * T, g.h * T);
  const trees: Terrain["trees"] = [], waterTiles: [number, number][] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const t = g.at(x, y), s = surf(x, y);
    switch (t) {
      case "grass": grass(p, x, y); break;
      case "path": s.surface === "cobble" ? cobble(p, x, y) : dirt(p, x, y); break;
      case "floor": floor(p, x, y, s.floor ?? "planks"); break;
      case "door": doorway(p, g, x, y, s.floor ?? "planks"); break;
      case "wall": wall(p, g, x, y); break;
      case "sand": sand(p, x, y); break;
      case "water": water(p, x, y); waterTiles.push([x, y]); break;
      case "tree": {
        const deep = [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => g.same(x + dx, y + dy, "tree")));
        p.F(deep ? "#2f5d34" : pick(GRASS, rnd(x, y, 1)), x * T, y * T, T, T);
        if (deep) for (let i = 0; i < 3; i++) p.F("#26492a", x * T + (rnd(x, y, i) * 14 | 0), y * T + (rnd(x, y, i + 5) * 14 | 0), 3, 2);
        else trees.push({ x, y });
        break;
      }
      default: {
        const info = Object.values(inp.tileTypes).find((tt) => inp.legend[tt.char ?? ""] === t);
        p.F(info?.color ?? "#6b6f78", x * T, y * T, T, T);
      }
    }
  }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) edges(p, g, x, y, g.at(x, y) === "path" && surf(x, y).surface === "cobble" ? "cobble" : g.at(x, y));
  rugs(p, g);
  return { canvas, trees, water: waterTiles };
}
