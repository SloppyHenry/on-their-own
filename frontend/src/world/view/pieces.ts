// Einzelteile eines Bildes: Figur mit Schatten, Auswahlring, Werkzeug und Schlafzeichen; Wandstücke der Innenansicht; Rauch; Umriss.
import { gridCanvas, ICONS } from "../../lib/px";
import { WP } from "../art/palette";
import { accentOf } from "../art/people";
import type { Building } from "./buildings";
import type { Pose } from "./figures";
import { K, T, type GroundData } from "./groundData";
import { project, type Camera, type Viewport } from "./projection";
import type { Drawn } from "./renderer";

/** Gefüllte Ellipse aus Pixelzeilen (scharf wie der Rest des Bildes). */
function ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    const k = 1 - ((y + 0.5 - cy) / ry) ** 2;
    if (k <= 0) continue;
    const hw = rx * Math.sqrt(k);
    g.fillRect(Math.round(cx - hw), y, Math.max(1, Math.round(hw * 2)), 1);
  }
}

function ring(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  for (let a = 0; a < Math.PI * 2; a += 0.08) g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
}

const ZZZ = gridCanvas(ICONS.zzz, { "#": "#cfe8ff" }, 1);

export function drawPose(g: CanvasRenderingContext2D, cam: Camera, vp: Viewport, p: Pose, t: number, selected: boolean, drawn: Drawn[]) {
  const q = project(cam, vp, p.x, p.y), sc = q.sc;
  if (!p.inBed) {
    g.fillStyle = "rgba(40,30,60,0.28)";
    ellipse(g, q.x + sc, q.y, 6 * sc, Math.max(1, 2 * sc));
  }
  if (selected) {
    g.globalAlpha = 0.55 + Math.sin(t * 3) * 0.25;
    g.fillStyle = accentOf(p.id);
    ring(g, q.x, q.y, 9 * sc, 3.5 * sc);
    g.globalAlpha = 1;
  }
  const s = p.spr, w = Math.round(s.width * sc), h = Math.round(s.height * sc);
  const dx = Math.round(q.x - (s.width * sc) / 2), dy = Math.round(q.y - (p.inBed ? 2 * sc : 0) - p.lift * sc - s.height * sc);
  g.drawImage(s, dx, dy, w, h);
  drawn.push({ x: dx, y: dy, w, h, spr: s, target: { kind: "agent", id: p.id } });
  if (p.toolSpr) {
    g.save();
    g.translate(Math.round(q.x + 6 * sc), Math.round(q.y - (9 + p.lift) * sc));
    g.rotate(p.toolAngle);
    g.drawImage(p.toolSpr, Math.round(-2 * sc), Math.round(-6 * sc), Math.round(8 * sc), Math.round(8 * sc));
    g.restore();
  }
  if (p.sleeping) {
    g.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 2));
    g.drawImage(ZZZ, Math.round(q.x + 5 * sc), Math.round(q.y - (p.inBed ? 16 : 10) * sc - ((t * 4) % 3)), Math.round(ZZZ.width * sc), Math.round(ZZZ.height * sc));
    g.globalAlpha = 1;
  }
}

/** Rauch aus dem Schornstein wie im Mockup (fünf Wölkchen). */
export function drawSmoke(g: CanvasRenderingContext2D, cam: Camera, vp: Viewport, x: number, y: number, t: number, night: boolean) {
  const ch = project(cam, vp, x, y);
  g.fillStyle = night ? "#8a90b8" : "#f4f1ec";
  for (let k = 0; k < 5; k++) {
    const age = (t * 0.35 + k / 5) % 1, sx = ch.x + (Math.sin(age * 5 + k) * 3 + age * 8) * ch.sc, sy = ch.y - (78 + age * 26) * ch.sc, rad = (1.5 + age * 3.5) * ch.sc;
    g.globalAlpha = (1 - age) * 0.75;
    g.fillRect(Math.round(sx - rad), Math.round(sy - rad), Math.round(rad * 2), Math.round(rad * 2));
  }
  g.globalAlpha = 1;
}

const sil = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
/** Einfarbige Fläche eines Sprites (für den Umriss beim Darüberfahren). */
export function silhouette(spr: HTMLCanvasElement, color = "#fff8ec"): HTMLCanvasElement {
  let m = sil.get(spr);
  if (!m) { m = new Map(); sil.set(spr, m); }
  let c = m.get(color);
  if (!c) {
    c = document.createElement("canvas"); c.width = spr.width; c.height = spr.height;
    const x = c.getContext("2d")!;
    x.drawImage(spr, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}

export interface WallPiece { x0: number; x1: number; y: number; h: number; back: boolean }

/** Wände der Innenansicht: hintere Außenwand steht, alle anderen sind niedrige Sockel; Türen bleiben offen (Mockup haus-B-innen). */
export function wallPieces(b: Building, g: GroundData): WallPiece[] {
  const out: WallPiece[] = [];
  for (const key of b.tiles) {
    const [x, y] = key.split(",").map(Number);
    if (g.k(x, y) !== K.Wall) continue;
    const back = !b.tiles.has(`${x},${y - 1}`);
    out.push({ x0: x * T, x1: (x + 1) * T, y: (y + 1) * T - 0.05, h: back ? 22 : 5, back });
  }
  return out;
}

export function wallPiece(g: CanvasRenderingContext2D, cam: Camera, vp: Viewport, w: WallPiece) {
  const a = project(cam, vp, w.x0, w.y), b = project(cam, vp, w.x1, w.y), behind = project(cam, vp, w.x0, w.y - T);
  const x0 = Math.round(a.x), x1 = Math.round(b.x), base = Math.round(a.y), top = Math.round(a.y - w.h * a.sc), cap = Math.max(1, Math.round(a.y - behind.y));
  if (x1 < 0 || x0 > vp.w || base < 0 || top - cap > vp.h) return;
  const wd = Math.max(1, x1 - x0);
  g.fillStyle = w.back ? "#f0e2c4" : WP.wall1; g.fillRect(x0, top, wd, base - top);
  if (w.back) { g.fillStyle = "#e8d6b4"; g.fillRect(x0, top, wd, Math.round(5 * a.sc)); }
  g.fillStyle = w.back ? "#9a8a78" : WP.stone2; g.fillRect(x0, base - Math.max(1, Math.round(2.5 * a.sc)), wd, Math.max(1, Math.round(2.5 * a.sc)));
  g.fillStyle = WP.wood2; g.fillRect(x0, top, wd, Math.max(1, Math.round(1.5 * a.sc)));
  g.fillStyle = "#b58a62"; g.fillRect(x0, top - cap, wd, cap);
  g.fillStyle = WP.wood3; g.fillRect(x0, top - cap, 1, cap); g.fillRect(x0, top - cap, wd, 1);
}
