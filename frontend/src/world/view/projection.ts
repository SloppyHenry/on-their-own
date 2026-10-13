// Eine Projektion für alles: Welt → Bildpuffer (Sprites, Schilder, Blasen, Licht) und Bildpuffer → Welt (Klicks, Boden).
// „Tiefe“: Kamera schaut schräg (36°, wie Mockup A) auf eine nach außen gewölbte Welt – nach vorn stärker gekrümmt (der Boden rollt
// zum Horizont weg), zur Seite nur sanft. Die Wölbung liegt immer unter dem Fokus, darum ist die Abbildung in Weltkoordinaten eine
// reine Verschiebung. Innenansicht (`curve` 0): dieselbe Kamera über ebenem Boden, ohne Krümmung. „Flach“: Draufsicht ohne Perspektive.
// Koordinaten: Welt in Weltpixeln (Kachel = 16), Bild in Pixeln des kleinen Puffers (vor dem Hochskalieren).

export type ViewMode = "tiefe" | "flach";

export interface Camera {
  /** Fokuspunkt in Weltpixeln: in „Flach“ die Bildmitte, in „Tiefe“ ein Punkt im unteren Drittel. */
  fx: number;
  fy: number;
  /** Bildpixel je Weltpixel am Fokuspunkt; 1 = Maßstab von Mockup A. */
  zoom: number;
  mode: ViewMode;
  /** Stärke der Wölbung: 1 = normal, 0 = ebener Boden (Innenansicht der Häuser); dazwischen für weiche Übergänge. */
  curve?: number;
}

export interface Viewport {
  w: number;
  h: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Maßstab an dieser Stelle: Bildpixel je Weltpixel (für Sprites, Höhen, Lichtradien). */
  sc: number;
  /** Tiefe 0 (unterer Rand) … 1 (Horizont); > 1: hinter dem Horizont verdeckt. In „Flach“ 0. */
  t: number;
}

export const PITCH = (36 * Math.PI) / 180;   // Blickneigung
export const FOCUS_Y = 0.62;                  // Bildhöhe (Anteil), in der der Fokuspunkt liegt
const KD = 2, KRX = 14, KRY = 5;              // Kameraabstand und Halbachsen der Wölbung in Bildhöhen/Zoom
const SV = Math.sin(PITCH), CV = Math.cos(PITCH);

interface Geo {
  W: number; H: number; f: number; cy: number; C: [number, number, number]; Rx: number; Ry: number; plane: boolean;
  d0: number; dH: number;
}

const geos = new Map<string, Geo>();
function geo(cam: Camera, vp: Viewport): Geo {
  const curve = Math.max(0, Math.min(1, cam.curve ?? 1)), plane = curve < 0.002, key = `${cam.zoom}|${vp.w}|${vp.h}|${curve.toFixed(3)}`;
  let g = geos.get(key);
  if (g) return g;
  const U = vp.h / cam.zoom, d = KD * U;
  g = { W: vp.w, H: vp.h, f: cam.zoom * d, cy: FOCUS_Y * vp.h, C: [0, d * SV, -d * CV], Rx: (KRX * U) / Math.max(curve, 0.002), Ry: (KRY * U) / Math.max(curve, 0.002), plane, d0: 0, dH: 1 };
  const b = hit(g, vp.w / 2, vp.h - 0.5), hz = hit(g, vp.w / 2, horizonOf(g, vp.w / 2) + 0.5);
  g.d0 = b?.dist ?? d;
  g.dH = Math.max(g.d0 + 1, hz?.dist ?? d * 4);
  if (geos.size > 64) geos.clear();
  geos.set(key, g);
  return g;
}

/** Strahl durch Bildpunkt (x, y) trifft den Boden: Lage relativ zum Fokus und Entfernung; null im Himmel. */
function hit(g: Geo, x: number, y: number): { dx: number; dy: number; dist: number } | null {
  const a = (x - g.W / 2) / g.f, b = (g.cy - y) / g.f, D0 = a, D1 = b * CV - SV, D2 = b * SV + CV, len = Math.hypot(D0, D1, D2);
  if (g.plane) {
    if (D1 >= 0) return null;
    const t = -g.C[1] / D1;
    return { dx: g.C[0] + t * D0, dy: -(g.C[2] + t * D2), dist: t * len };
  }
  const o0 = g.C[0] / g.Rx, o1 = (g.C[1] + g.Ry) / g.Ry, o2 = g.C[2] / g.Ry, e0 = D0 / g.Rx, e1 = D1 / g.Ry, e2 = D2 / g.Ry;
  const A = e0 * e0 + e1 * e1 + e2 * e2, B = 2 * (o0 * e0 + o1 * e1 + o2 * e2), Cc = o0 * o0 + o1 * o1 + o2 * o2 - 1, disc = B * B - 4 * A * Cc;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t < 0) return null;
  const p0 = o0 + t * e0, p1 = o1 + t * e1, p2 = o2 + t * e2;
  return { dx: Math.asin(Math.max(-1, Math.min(1, p0))) * g.Rx, dy: -Math.atan2(p2, p1) * g.Ry, dist: t * len };
}

/** Bildzeile des Horizonts in Spalte x (Grenze zwischen Boden und Himmel). */
function horizonOf(g: Geo, x: number): number {
  let lo = -4 * g.H, hi = g.H;
  if (!hit(g, x, hi - 0.01)) return g.H;
  for (let i = 0; i < 34; i++) { const m = (lo + hi) / 2; if (hit(g, x, m)) hi = m; else lo = m; }
  return hi;
}

const horizons = new Map<Geo, Float32Array>();
/** Horizontlinie (Bild-y) an der Spalte x; in „Flach“ ganz oben (kein Himmel). */
export function horizon(cam: Camera, vp: Viewport, x: number): number {
  if (cam.mode === "flach") return -Infinity;
  const g = geo(cam, vp);
  let a = horizons.get(g);
  if (!a) { a = new Float32Array(vp.w + 1); for (let i = 0; i <= vp.w; i++) a[i] = horizonOf(g, i); horizons.set(g, a); if (horizons.size > 64) horizons.clear(); }
  return a[Math.max(0, Math.min(vp.w, Math.round(x)))];
}

/** Welt → Bild. `height` hebt den Punkt senkrecht an (Weltpixel), z. B. für Köpfe, Lampen, Rauch. */
export function project(cam: Camera, vp: Viewport, wx: number, wy: number, height = 0): Projected {
  if (cam.mode === "flach") {
    return { x: vp.w / 2 + (wx - cam.fx) * cam.zoom, y: vp.h / 2 + (wy - cam.fy - height) * cam.zoom, sc: cam.zoom, t: 0 };
  }
  const g = geo(cam, vp), dx = wx - cam.fx, dy = wy - cam.fy;
  let P0: number, P1: number, P2: number, n0 = 0, n1 = 1, n2 = 0;
  if (g.plane) { P0 = dx; P1 = height; P2 = -dy; }
  else {
    const l = dx / g.Rx, p = -dy / g.Ry, cl = Math.cos(l);
    n0 = Math.sin(l); n1 = cl * Math.cos(p); n2 = cl * Math.sin(p);
    P0 = g.Rx * n0 + height * n0; P1 = g.Ry * n1 - g.Ry + height * n1; P2 = g.Ry * n2 + height * n2;
  }
  const q0 = P0 - g.C[0], q1 = P1 - g.C[1], q2 = P2 - g.C[2];
  const Z = -q1 * SV + q2 * CV, Y = q1 * CV + q2 * SV, sc = g.f / Math.max(1e-6, Z);
  const facing = g.plane || -(q0 * n0 + q1 * n1 + q2 * n2) > 0;
  const dist = Math.hypot(q0, q1, q2), t = !facing || Z <= 0 ? 2 : (dist - g.d0) / (g.dH - g.d0);
  return { x: g.W / 2 + q0 * sc, y: g.cy - Y * sc, sc, t };
}

/** Bild → Welt (Boden, Höhe 0). Über dem Horizont (Himmel) `null`. */
export function unproject(cam: Camera, vp: Viewport, x: number, y: number): { x: number; y: number; t: number } | null {
  if (cam.mode === "flach") return { x: cam.fx + (x - vp.w / 2) / cam.zoom, y: cam.fy + (y - vp.h / 2) / cam.zoom, t: 0 };
  const g = geo(cam, vp), h = hit(g, x, y);
  return h ? { x: cam.fx + h.dx, y: cam.fy + h.dy, t: (h.dist - g.d0) / (g.dH - g.d0) } : null;
}

export interface RayTable { dx: Float32Array; dy: Float32Array; fog: Float32Array; sky: Uint8Array; /** Bodenstufe je Pixel (0 voll, 1 halb, 2 viertel) nach Weltpixeln je Bildpixel. */ lvl: Uint8Array; bounds: { x0: number; y0: number; x1: number; y1: number } }
const tables = new Map<Geo, RayTable>();

/** Je Bildpixel der getroffene Bodenpunkt relativ zum Fokus, Dunst und Himmel – hängt nur von Zoom und Puffergröße ab. */
export function rayTable(cam: Camera, vp: Viewport): RayTable {
  const g = geo(cam, vp);
  let r = tables.get(g);
  if (r) return r;
  const n = vp.w * vp.h, dx = new Float32Array(n), dy = new Float32Array(n), fog = new Float32Array(n), sky = new Uint8Array(n);
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let y = 0; y < vp.h; y++) for (let x = 0; x < vp.w; x++) {
    const i = y * vp.w + x, h = hit(g, x + 0.5, y + 0.5);
    if (!h) { sky[i] = 1; continue; }
    dx[i] = h.dx; dy[i] = h.dy;
    const t = Math.max(0, Math.min(1, (h.dist - g.d0) / (g.dH - g.d0)));
    fog[i] = g.plane ? 0 : Math.pow(t, 2.2) * 0.55;
    if (h.dx < b.x0) b.x0 = h.dx; if (h.dx > b.x1) b.x1 = h.dx; if (h.dy < b.y0) b.y0 = h.dy; if (h.dy > b.y1) b.y1 = h.dy;
  }
  const lvl = new Uint8Array(n);
  for (let y = 0; y < vp.h; y++) for (let x = 0; x < vp.w; x++) {
    const i = y * vp.w + x, j = x + 1 < vp.w ? i + 1 : i - 1, k = y + 1 < vp.h ? i + vp.w : i - vp.w;
    if (sky[i]) continue;
    const s = Math.max(sky[j] ? 0 : Math.hypot(dx[j] - dx[i], dy[j] - dy[i]), sky[k] ? 0 : Math.hypot(dx[k] - dx[i], dy[k] - dy[i]));
    lvl[i] = s > 3.5 ? 2 : s > 1.75 ? 1 : 0;
  }
  r = { dx, dy, fog, sky, lvl, bounds: b };
  tables.set(g, r);
  if (tables.size > 16) tables.clear();
  return r;
}

/** Weltrechteck, das im Bild zu sehen sein kann (für Abschneiden und Bodenblöcke); `below` erweitert nach vorn für hohe Sprites. */
export function visibleWorld(cam: Camera, vp: Viewport, below = 0): { x0: number; y0: number; x1: number; y1: number } {
  if (cam.mode === "flach") {
    const hw = vp.w / 2 / cam.zoom, hh = vp.h / 2 / cam.zoom;
    return { x0: cam.fx - hw, y0: cam.fy - hh, x1: cam.fx + hw, y1: cam.fy + hh + below };
  }
  const b = rayTable(cam, vp).bounds;
  return { x0: cam.fx + b.x0, y0: cam.fy + b.y0, x1: cam.fx + b.x1, y1: cam.fy + b.y1 + below };
}

/** Bild-y, in dem der Fokus steht (dort steht eine verfolgte Figur). */
export const focusRow = (cam: Camera, vp: Viewport) => (cam.mode === "flach" ? vp.h / 2 : FOCUS_Y * vp.h);
