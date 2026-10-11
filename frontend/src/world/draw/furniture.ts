// Möbel und Innenobjekte, 16 x 32 Pixel, unten bündig auf der Kachel. Jede Art ist eine Zeichenfunktion mit Zustand (z. B. Kamin an/aus).
import type { ObjectInfo } from "../../store/types";
import { accentOf } from "./characters";
import { type Pen } from "./pen";

export type Drawer = (p: Pen, o: ObjectInfo) => void;
export const H = 32;                                   // Texturhöhe; Grundlinie ist y = H
const WOOD = "#b98a58", WOOD_D = "#8a5a32", WOOD_L = "#d3a672", DARK = "#2e2218";
const rect = (p: Pen, x: number, y: number, w: number, h: number, c: string, hi?: string, lo?: string) => {
  p.F(DARK, x - 1, y - 1, w + 2, h + 2);
  p.F(c, x, y, w, h);
  if (hi) p.F(hi, x, y, w, 1);
  if (lo) p.F(lo, x, y + h - 1, w, 1);
};
const owner = (o: ObjectInfo): string => {
  const hay = `${o.id} ${o.name} ${o.owner ?? ""}`.toLowerCase();
  const id = ["alex", "mira"].find((a) => hay.includes(a));
  return id ? accentOf(id) : "#b0b8c8";
};
const shadow = (p: Pen, x = 1, w = 14) => p.F("rgba(30,20,10,.28)", x, H - 2, w, 2);

export const FURNITURE: Record<string, Drawer> = {
  bed: (p, o) => {
    const c = owner(o);
    shadow(p);
    rect(p, 1, H - 15, 14, 14, WOOD_D, WOOD);
    p.F("#f2ece0", 2, H - 14, 12, 5);
    p.F("#dcd3c0", 2, H - 11, 12, 1);
    p.F(c, 2, H - 9, 12, 7);
    p.F("rgba(0,0,0,.18)", 2, H - 3, 12, 1);
    p.F("#fff8ea", 3, H - 13, 5, 3);
  },
  chest: (p) => { shadow(p); rect(p, 2, H - 12, 12, 11, "#8a5a32", WOOD_L, "#6a4424"); p.F("#c9a23a", 2, H - 8, 12, 1); p.F("#f2d24b", 7, H - 9, 2, 3); },
  desk: (p, o) => {
    shadow(p);
    rect(p, 1, H - 13, 14, 12, WOOD, WOOD_L, WOOD_D);
    p.F(WOOD_D, 2, H - 5, 2, 4);
    p.F(WOOD_D, 12, H - 5, 2, 4);
    p.F("#f2ece0", 3, H - 12, 5, 4);
    if (((o.state.notes as unknown[]) ?? []).length) p.F("#d9453a", 10, H - 12, 3, 3);
    p.F("#3d6fb0", 9, H - 12, 2, 1);
  },
  workbench: (p) => {
    shadow(p);
    rect(p, 0, H - 14, 16, 13, "#a67a4a", WOOD_L, WOOD_D);
    p.F(WOOD_D, 1, H - 4, 2, 3);
    p.F(WOOD_D, 13, H - 4, 2, 3);
    p.F("#9aa0a8", 3, H - 13, 6, 1);
    p.F("#6b4a2f", 3, H - 12, 1, 4);
    p.F("#cdd2d8", 10, H - 12, 4, 2);
    p.F("#8a5a32", 11, H - 10, 1, 3);
  },
  stove: (p) => { shadow(p); rect(p, 1, H - 16, 14, 15, "#5a5f68", "#7b818b", "#3f434a"); p.F("#2a2d32", 3, H - 12, 4, 4); p.F("#2a2d32", 9, H - 12, 4, 4); p.F("#e0a458", 3, H - 11, 4, 1); p.F("#2a2d32", 3, H - 6, 10, 4); p.F("#7b818b", 4, H - 5, 8, 1); },
  tap: (p) => { shadow(p); rect(p, 1, H - 13, 14, 12, "#c8cdd4", "#eef0f3", "#9aa0a8"); p.F("#6aa8e0", 3, H - 11, 10, 6); p.F("#9ccaf2", 4, H - 10, 4, 1); p.F("#9aa0a8", 7, H - 15, 2, 4); p.F("#9aa0a8", 7, H - 15, 5, 1); },
  sofa: (p, o) => { const c = o.id.includes("alex") ? "#c8864a" : "#4f7aa8"; shadow(p, 0, 16); rect(p, 0, H - 14, 16, 13, c, "#ffffff22", "#00000033"); p.F("#00000022", 1, H - 8, 14, 1); p.F(c, 1, H - 13, 3, 11); p.F(c, 12, H - 13, 3, 11); p.F("#ffffff22", 5, H - 7, 6, 4); },
  table: (p) => { shadow(p); rect(p, 0, H - 14, 16, 12, WOOD, WOOD_L, WOOD_D); p.F(WOOD_D, 1, H - 3, 2, 2); p.F(WOOD_D, 13, H - 3, 2, 2); p.F("#e8d9a8", 5, H - 12, 6, 4); p.F("#d9453a", 7, H - 12, 2, 2); },
  bookshelf: (p, o) => {
    shadow(p);
    rect(p, 0, H - 28, 16, 27, "#7a4e2c", WOOD, "#5b3a22");
    const cols = ["#b24a3a", "#3d6fb0", "#e0a458", "#4f9d4b", "#8660a8"];
    for (let row = 0; row < 3; row++) {
      p.F("#5b3a22", 1, H - 26 + row * 9 + 8, 14, 1);
      for (let i = 0; i < 6; i++) p.F(cols[(i + row * 2) % cols.length], 2 + i * 2, H - 25 + row * 9 + (i % 3), 2, 7 - (i % 3));
    }
    void o;
  },
  fireplace: (p, o) => {
    shadow(p);
    rect(p, 0, H - 22, 16, 21, "#6b6f78", "#8e939c", "#4a4d55");
    p.F("#1c1a18", 3, H - 14, 10, 12);
    p.F("#8a5a32", 4, H - 4, 8, 2);
    if (o.state.lit) { p.F("#f2d24b", 6, H - 10, 4, 6); p.F("#e0702f", 5, H - 8, 6, 5); p.F("#fff3b0", 7, H - 8, 2, 3); }
    else p.F("#3a3836", 5, H - 5, 6, 2);
  },
  seedbed: (p) => { p.F(DARK, 0, H - 15, 16, 15); p.F("#6a4630", 1, H - 14, 14, 13); for (let i = 2; i < 14; i += 3) p.F("#523522", i, H - 13, 1, 11); p.F("#8a6040", 1, H - 14, 14, 1); },
  board: (p, o) => {
    shadow(p);
    p.F(DARK, 2, H - 22, 12, 22);
    p.F("#6b4a2f", 3, H - 21, 2, 20);
    p.F("#6b4a2f", 11, H - 21, 2, 20);
    rect(p, 2, H - 24, 12, 11, "#c99a5b", WOOD_L, WOOD_D);
    const n = Math.min(3, ((o.state.notes as unknown[]) ?? []).length);
    for (let i = 0; i < n; i++) p.F("#f2ece0", 3 + i * 4, H - 22, 3, 5);
  },
  note: (p) => p.F("#f2ece0", 4, H - 8, 8, 6),
  map: (p) => { p.F(DARK, 3, H - 10, 10, 8); p.F("#e8d9a8", 4, H - 9, 8, 6); p.F("#b24a3a", 6, H - 7, 2, 1); p.F("#4f7aa8", 8, H - 6, 3, 1); },
  meal: (p) => { p.F("#f2ece0", 4, H - 7, 8, 4); p.F("#d9453a", 6, H - 8, 3, 2); p.F("#e0a458", 9, H - 8, 2, 2); },
  item: (p) => { p.F(DARK, 4, H - 9, 8, 7); p.F("#b0b8c8", 5, H - 8, 6, 5); },
  key: (p) => { p.F("#c9a23a", 5, H - 8, 4, 4); p.F("#2e2218", 6, H - 7, 2, 2); p.F("#c9a23a", 9, H - 7, 4, 1); p.F("#c9a23a", 11, H - 6, 1, 2); },
  axe: (p) => { p.F("#8a5a32", 7, H - 12, 2, 10); p.F("#aeb4bd", 9, H - 12, 4, 4); p.F("#d8dde3", 9, H - 12, 4, 1); },
  pickaxe: (p) => { p.F("#8a5a32", 7, H - 12, 2, 10); p.F("#aeb4bd", 3, H - 13, 10, 2); p.F("#d8dde3", 3, H - 13, 10, 1); },
};
