// Abbildung wie wProject und der Bodenpass in Mockup A (world.js): kleiner Puffer 320 × 200, gewölbter Boden („tiefe“, Mischung)
// oder Draufsicht („flach“, Mockup B). Ist das Fenster breiter oder höher als 16 : 10, wird der Puffer an den Rändern erweitert
// (mehr Himmel oben, mehr Wald seitlich); die Mitte bleibt Pixel für Pixel Bild A.
export type Mode = "tiefe" | "flach";

export const LW = 320, LH = 200, GAMMA = 1.45;

export interface Frame {
  mode: Mode;
  /** Puffergröße und Versatz von Bild A darin (A-Pixel (0, 0) liegt bei Puffer (xo, yo)). */
  lw: number;
  lh: number;
  xo: number;
  yo: number;
  /** Textur von A: Größe und Lage von Dorf (0, 0). */
  tw: number;
  th: number;
  ox: number;
  oy: number;
}

export interface P { x: number; y: number; sc: number; t: number }

export function frameFor(mode: Mode, lw: number, lh: number, tex: { size: [number, number]; offset: [number, number] }): Frame {
  return { mode, lw, lh, xo: Math.floor((lw - LW) / 2), yo: lh - LH, tw: tex.size[0], th: tex.size[1], ox: tex.offset[0], oy: tex.offset[1] };
}

/** Horizont in A-Pixeln an der A-Spalte ax. */
export const horizonA = (ax: number) => { const k = (ax - 160) / 160; return 34 + 14 * k * k; };

/** Dorfkoordinaten → Puffer (wie wProject). */
export function project(f: Frame, vx: number, vy: number): P {
  if (f.mode === "flach") return { x: vx + 32 + f.xo, y: vy + 8 + f.yo, sc: 1, t: 0 };
  const tx = vx + f.ox, ty = vy + f.oy, cx = f.tw / 2;
  const t = Math.pow(Math.max(0, 1 - ty / f.th), 1 / GAMMA), s = 0.62 + 0.9 * t;
  const x = 160 + (tx - cx) / s, yh = horizonA(x);
  return { x: x + f.xo, y: LH - t * (LH - yh) + f.yo, sc: 1 / s, t };
}

/** Puffer → Dorfkoordinaten auf dem Boden (Umkehrung des Bodenpasses); über dem Horizont null. */
export function unproject(f: Frame, x: number, y: number): { x: number; y: number } | null {
  const ax = x - f.xo, ay = y - f.yo;
  if (f.mode === "flach") return { x: ax - 32, y: ay - 8 };
  const yh = horizonA(ax);
  if (ay < yh) return null;
  const t = (LH - ay) / (LH - yh), s = 0.62 + 0.9 * t;
  return { x: f.tw / 2 + (ax - 160) * s - f.ox, y: f.th * (1 - Math.pow(Math.max(0, t), GAMMA)) - f.oy };
}

/** Texel (in Texturkoordinaten) und Dunst für jeden Pufferpunkt – genau die Schleife aus createWorld. */
export function groundMap(f: Frame): { tx: Int32Array; ty: Int32Array; fog: Float32Array; sky: Uint8Array } {
  const n = f.lw * f.lh, tx = new Int32Array(n), ty = new Int32Array(n), fog = new Float32Array(n), sky = new Uint8Array(n), cx = f.tw / 2;
  for (let y = 0; y < f.lh; y++) for (let x = 0; x < f.lw; x++) {
    const i = y * f.lw + x, ax = x - f.xo, ay = y - f.yo;
    if (f.mode === "flach") { tx[i] = ax + 32; ty[i] = ay + 88; continue; }
    const yh = horizonA(ax);
    if (ay < yh) { sky[i] = 1; continue; }
    const t = (LH - ay) / (LH - yh), s = 0.62 + 0.9 * t;
    tx[i] = Math.floor(cx + (ax - 160) * s); ty[i] = Math.floor(f.th * (1 - Math.pow(t, GAMMA)));
    fog[i] = Math.pow(t, 2.2) * 0.55;
  }
  return { tx, ty, fog, sky };
}
