// Gehen im Bild (AP18h): gepunkteter Weg auf dem Boden, Zielring, Kachel unter dem Zeiger.
import type { Tile } from "../player/pathfind";
import { T } from "./groundData";

/** Weltpixel → Bildpunkt und Maßstab der jeweiligen Ansicht. */
export type Proj = (x: number, y: number) => { x: number; y: number; sc: number };

export interface PreviewIn { from: Tile | null; path: Tile[] | null; goal: Tile | null; hover: Tile | null }

const foot = (t: Tile) => ({ x: t[0] * T + 8, y: t[1] * T + 8 });

/** Auf dem Boden (vor den aufrechten Dingen gezeichnet). */
export function drawPreviewGround(g: CanvasRenderingContext2D, project: Proj, p: PreviewIn, t: number) {
  if (p.hover) {
    const [x, y] = p.hover, c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => project(a * T, b * T));
    g.fillStyle = "rgba(255,248,236,0.85)";
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4], n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let k = 0; k < n; k++) g.fillRect(Math.round(a.x + ((b.x - a.x) * k) / n), Math.round(a.y + ((b.y - a.y) * k) / n), 1, 1);
    }
  }
  if (p.from && p.path?.length) {
    const pts = [p.from, ...p.path].map(foot);
    g.fillStyle = "#fff8ec";
    let along = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (let s = 0; s < T; s += 1, along += 1) {
        if ((along + Math.floor(t * 8)) % 6 > 1) continue;
        const q = project(a.x + ((b.x - a.x) * s) / T, a.y + ((b.y - a.y) * s) / T);
        const r = Math.max(1, Math.round(q.sc));
        g.fillRect(Math.round(q.x - r / 2), Math.round(q.y - r / 2), r, r);
      }
    }
  }
  if (p.goal) {
    const q = project(p.goal[0] * T + 8, p.goal[1] * T + 8), rx = (7 + Math.sin(t * 4)) * q.sc, ry = rx * 0.45;
    g.fillStyle = p.path ? "#fff8ec" : "#ff6b6b";
    for (let a = 0; a < Math.PI * 2; a += 0.1) g.fillRect(Math.round(q.x + Math.cos(a) * rx), Math.round(q.y + Math.sin(a) * ry), 1, 1);
  }
}
