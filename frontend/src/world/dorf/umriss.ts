// Umriss der Wiese eines Gebiets für den Schleier der Vorschau (Welteditor): Punkte entlang des Rands, durch die Projektion der Ansicht
// geschickt; was hinter dem Horizont liegt, fällt weg. Liefert null, wenn nichts Sichtbares bleibt.
import type { Look, Pt } from "./look";

type Proj = (wx: number, wy: number) => { x: number; y: number; t: number };

export function umriss(look: Look, regionId: string, project: Proj, toCss: (b: { x: number; y: number }) => { x: number; y: number }): Pt[] | null {
  const r = look.regions.find((q) => q.id === regionId);
  if (!r) return null;
  const { left, right, top } = r.bounds, bottom = r.bounds.bottom ?? top + 232, [fx, fy] = r.frame, N = 10, pts: Pt[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number) => { for (let i = 0; i < N; i++) pts.push([fx + x0 + ((x1 - x0) * i) / N, fy + y0 + ((y1 - y0) * i) / N]); };
  edge(left, top, right, top); edge(right, top, right, bottom); edge(right, bottom, left, bottom); edge(left, bottom, left, top);
  const out = pts.map(([x, y]) => project(x, y)).filter((p) => p.t <= 1).map((p) => toCss(p));
  return out.length >= 3 ? out.map((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]) : null;
}
