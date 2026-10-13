// Pixel-Sprites aus Code, 1:1 wie wSprite, wHash, wNoise und wRng in Mockup A (docs/mockups/welt-optik/world.js).
// Alles deterministisch, damit gleiche Daten gleiche Bilder geben.

export type RGB = [number, number, number];

export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hash(x: number, y: number, s: number): number {
  let n = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Spr {
  w: number;
  h: number;
  g: CanvasRenderingContext2D;
  p(x: number, y: number, col: string): void;
  r(x: number, y: number, w: number, h: number, col: string): void;
  disc(cx: number, cy: number, rad: number, col: string): void;
  ell(cx: number, cy: number, rx: number, ry: number, col: string): void;
  outline(col: string): void;
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function sprite(w: number, h: number, fn: (s: Spr) => void): HTMLCanvasElement {
  const c = canvas(w, h), g = c.getContext("2d", { willReadFrequently: true })!;
  const s: Spr = {
    w, h, g,
    p(x, y, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1); },
    r(x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); },
    disc(cx, cy, rad, col) {
      g.fillStyle = col;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= rad * rad) g.fillRect(x, y, 1, 1);
      }
    },
    ell(cx, cy, rx, ry, col) {
      g.fillStyle = col;
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
      }
    },
    outline(col) {
      const d = g.getImageData(0, 0, w, h), a = d.data, o = new Uint8Array(w * h), oc = hex(col);
      for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 0 ? 1 : 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (o[i]) continue;
        if ((x > 0 && o[i - 1]) || (x < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w])) { a[i * 4] = oc[0]; a[i * 4 + 1] = oc[1]; a[i * 4 + 2] = oc[2]; a[i * 4 + 3] = 255; }
      }
      g.putImageData(d, 0, 0);
    },
  };
  fn(s);
  return c;
}

/** Spiegelt ein Sprite waagerecht (rechte Ansicht aus der linken). */
export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.width, src.height), g = c.getContext("2d")!;
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** Zwischenspeicher für Sprites: ein Schlüssel je sichtbarem Zustand. */
export function memo<A extends unknown[]>(key: (...a: A) => string, make: (...a: A) => HTMLCanvasElement): (...a: A) => HTMLCanvasElement {
  const cache = new Map<string, HTMLCanvasElement>();
  return (...a: A) => {
    const k = key(...a);
    let c = cache.get(k);
    if (!c) { c = make(...a); cache.set(k, c); }
    return c;
  };
}
