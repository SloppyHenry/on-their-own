// Bäume als Sprites (unten mittig verankert). Wenige Varianten, per Kachelposition gewählt; eine Palette.
import { newCanvas, OUTLINE, rnd, type Pen } from "./pen";

export const TREE_W = 32;
export const TREE_H = 44;
const BASE_X = 16;
const BASE_Y = TREE_H - 2;

function oak(p: Pen, seed: number, big: boolean) {
  const r = big ? 11 : 8, by = BASE_Y, cx = BASE_X;
  p.ctx.fillStyle = "rgba(30,45,20,.3)";
  for (let dy = -2; dy <= 2; dy++) p.ctx.fillRect(cx - r + 1 + Math.abs(dy) * 2, by - 1 + dy, 2 * r - Math.abs(dy) * 4, 1);
  p.F(OUTLINE, cx - 3, by - 11, 6, 11);
  p.F("#6b4a2f", cx - 2, by - 10, 4, 10);
  p.F("#8b6340", cx - 2, by - 10, 1, 10);
  const cy = by - 11 - r + 4;
  p.disc(cx, cy + 1, r + 1, OUTLINE);
  p.disc(cx, cy, r, "#2f6b3a");
  p.disc(cx - 1, cy - 1, r - 2, "#3e8a42");
  p.disc(cx - 2, cy - 3, r - 5, "#58a64f");
  p.disc(cx - 3, cy - 4, Math.max(2, r - 8), "#82cc66");
  for (let i = 0; i < r * 2; i++) {
    const a = rnd(seed, i, 1) * 6.28, d = rnd(i, seed, 2) * (r - 2);
    p.F(i % 2 ? "#2f6b3a" : "#9ad97a", cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2, 1);
  }
  if (seed % 3 === 0) for (const [dx, dy] of [[-3, -2], [3, 1], [0, 4]]) p.F("#d9453a", cx + dx, cy + dy, 2, 2);   // manche Bäume tragen Früchte
}

function pine(p: Pen) {
  const by = BASE_Y, cx = BASE_X;
  p.F("rgba(30,45,20,.3)", cx - 6, by - 2, 14, 3);
  p.F(OUTLINE, cx - 2, by - 5, 5, 5);
  p.F("#6b4a2f", cx - 1, by - 4, 3, 4);
  for (let i = 0; i < 4; i++) {
    const w = 8 + i * 4, y = by - 8 - (3 - i) * 7 + 6;
    for (let k = 0; k < 8; k++) {
      const ww = Math.round((w * (k + 1)) / 8);
      p.F(OUTLINE, cx - ww / 2 - 1, y + k - 7, ww + 2, 1);
      p.F(k < 5 ? "#2f7a45" : "#276a3b", cx - ww / 2, y + k - 7, ww, 1);
      p.F("#4fa05a", cx - ww / 2, y + k - 7, Math.max(1, (ww / 3) | 0), 1);
    }
  }
}

const cache: HTMLCanvasElement[] = [];
export const TREE_VARIANTS = 6;

/** Variante 0–3 Eichen (klein/groß), 4–5 Kiefern. */
export function treeTexture(variant: number): HTMLCanvasElement {
  const v = variant % TREE_VARIANTS;
  if (!cache[v]) {
    const { canvas, p } = newCanvas(TREE_W, TREE_H);
    if (v >= 4) pine(p);
    else oak(p, v + 1, v % 2 === 1);
    cache[v] = canvas;
  }
  return cache[v];
}

export const treeVariantAt = (x: number, y: number) => {
  const r = rnd(x, y, 9);
  return r < 0.3 ? 4 + ((rnd(x, y, 3) * 2) | 0) : Math.floor(rnd(x, y, 5) * 4);
};
