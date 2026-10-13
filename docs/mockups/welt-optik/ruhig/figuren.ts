// Mockup „Ruhige Ansicht“: Figuren gehen auf Kacheln (auch durch die Haustür), schlendern von selbst, wenn niemand sie lenkt.
// Sprites aus frontend/src/world/art/people. Kein Produktionscode.
import { rng } from "../../../../frontend/src/world/art/pen";
import type { Dir } from "../../../../frontend/src/world/art/people";
import { T, nearby, route, type Step } from "./karte";

export interface Fig {
  id: string;
  name: string;
  x: number;                 // Fußpunkt in Weltpixeln
  y: number;
  inside: boolean;
  dir: Dir;
  walked: number;
  path: Step[];
  idle: number;              // Sekunden bis zum nächsten Schlendern
  goal: Step | null;
}

const SPEED = 42;            // Weltpixel je Sekunde
const R = rng(7);
export const footOf = (s: Step) => ({ x: s.tx * T + 8, y: s.ty * T + 12 });
export const tileOf = (f: Fig): Step => ({ tx: Math.floor(f.x / T), ty: Math.floor(f.y / T), inside: f.inside });

export function makeFig(id: string, name: string, tx: number, ty: number, inside: boolean, idle: number): Fig {
  const p = footOf({ tx, ty, inside });
  return { id, name, ...p, inside, dir: "down", walked: 0, path: [], idle, goal: null };
}

/** Ziel setzen; false, wenn es keinen Weg gibt. */
export function sendTo(f: Fig, tx: number, ty: number, inside: boolean, byPlayer: boolean): boolean {
  const p = route(tileOf(f), tx, ty, inside);
  if (!p) return false;
  f.path = p;
  f.goal = { tx, ty, inside };
  if (byPlayer) f.idle = 25;
  return true;
}

export function stepFig(f: Fig, dt: number) {
  if (!f.path.length) {
    f.goal = null;
    f.idle -= dt;
    if (f.idle <= 0) {
      const to = nearby(tileOf(f), 6, R);
      if (to) sendTo(f, to.tx, to.ty, to.inside, false);
      f.idle = 5 + R() * 9;
    }
    return;
  }
  let left = SPEED * dt;
  while (left > 0 && f.path.length) {
    const s = f.path[0], t = footOf(s), dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
    if (d > 0.01) f.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    if (d <= left) { f.x = t.x; f.y = t.y; f.inside = s.inside; f.path.shift(); left -= d; f.walked += d; }
    else { f.x += (dx / d) * left; f.y += (dy / d) * left; f.walked += left; left = 0; }
  }
}

export const frameOf = (f: Fig) => (f.path.length ? ((Math.floor(f.walked / 5) % 4) as 0 | 1 | 2 | 3) : "stand");
export const doing = (f: Fig) => (f.path.length ? (f.idle > 10 ? "geht" : "schlendert") : "steht");
