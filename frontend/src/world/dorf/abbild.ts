// Abbildung wie wProject und der Bodenpass in Mockup A (world.js): kleiner Puffer 320 × 200, gewölbter Boden („tiefe“, Mischung)
// oder Draufsicht („flach“, Mockup B). Ist das Fenster breiter oder höher als 16 : 10, wird der Puffer an den Rändern erweitert
// (mehr Himmel oben, mehr Wald seitlich); die Mitte bleibt Pixel für Pixel Bild A.
// AP12a: Die Kamera ist beweglich. `cam` ist der Boden am unteren Bildrand in der Mitte (Texelkoordinaten, Weltpixel − `shift`);
// bei (192, 288) ist es genau Bild A. `zo` zoomt in ganzen Stufen heraus (1, 2, 4: der Puffer zeigt zo-mal so viel Welt), `curve` ist die
// Wölbung des Horizonts (1 = wie A; beim Fahren geht sie gegen 0, das nimmt den „Globus-Effekt“).
export type Mode = "tiefe" | "flach";

export const LW = 320, LH = 200, GAMMA = 1.45, TH = 288;
/** Kamera in der Startlage von Bild A (Texelkoordinaten). */
export const HOME_TEX: [number, number] = [192, 288];
/** Anteil der Tiefe, der bei 1× zwischen unterem Bildrand und Bildmitte liegt (Boden in Bildmitte = cam.y − TH · zo · FOCUS). */
export const FOCUS = Math.pow((LH - 100) / (LH - 34), GAMMA);

export interface Frame {
  mode: Mode;
  /** Puffergröße und Versatz von Bild A darin (A-Pixel (0, 0) liegt bei Puffer (xo, yo)). */
  lw: number;
  lh: number;
  xo: number;
  yo: number;
  /** Kamera (Texelkoordinaten), Herauszoomen und Wölbung. */
  cx: number;
  cy: number;
  zo: number;
  curve: number;
  /** Weltpixel − Texel. */
  sx: number;
  sy: number;
}

export interface P { x: number; y: number; sc: number; t: number }

export function frameFor(mode: Mode, lw: number, lh: number, shift: [number, number], cam: [number, number] = HOME_TEX, zo = 1, curve = 1): Frame {
  return { mode, lw, lh, xo: Math.floor((lw - LW) / 2), yo: lh - LH, cx: cam[0], cy: cam[1], zo, curve, sx: shift[0], sy: shift[1] };
}

/** Horizont in A-Pixeln an der A-Spalte ax. */
export const horizonA = (ax: number, curve = 1) => { const k = (ax - 160) / 160; return 34 + 14 * curve * k * k; };

/** Weltpixel → Puffer (wie wProject). */
export function project(f: Frame, wx: number, wy: number): P {
  const tx = wx - f.sx, ty = wy - f.sy;
  if (f.mode === "flach") return { x: 160 + (tx - f.cx) / f.zo + f.xo, y: LH + (ty - f.cy) / f.zo + f.yo, sc: 1 / f.zo, t: 0 };
  const t = Math.pow(Math.max(0, 1 - (ty - (f.cy - TH * f.zo)) / (TH * f.zo)), 1 / GAMMA), s = (0.62 + 0.9 * t) * f.zo;       // bei cy = TH, zo = 1: wie 1 − ty / th in A
  const x = 160 + (tx - f.cx) / s, yh = horizonA(x, f.curve);
  return { x: x + f.xo, y: LH - t * (LH - yh) + f.yo, sc: 1 / s, t };
}

/** Puffer → Weltpixel auf dem Boden (Umkehrung des Bodenpasses); über dem Horizont null. */
export function unproject(f: Frame, x: number, y: number): { x: number; y: number } | null {
  const ax = x - f.xo, ay = y - f.yo;
  if (f.mode === "flach") return { x: f.cx + (ax - 160) * f.zo + f.sx, y: f.cy + (ay - LH) * f.zo + f.sy };
  const yh = horizonA(ax, f.curve);
  if (ay < yh) return null;
  const t = (LH - ay) / (LH - yh), s = (0.62 + 0.9 * t) * f.zo;
  return { x: f.cx + (ax - 160) * s + f.sx, y: f.cy - TH * f.zo + TH * f.zo * (1 - Math.pow(Math.max(0, t), GAMMA)) + f.sy };
}

/** Kamera (Texel), bei der der Weltpunkt (wx, wy) im Puffer an (x, y) erscheint (Zoom um den Zeiger, „hingehen“, Folgen). */
export function camFor(f: Frame, wx: number, wy: number, x: number, y: number): [number, number] {
  const tx = wx - f.sx, ty = wy - f.sy, ax = x - f.xo, ay = y - f.yo;
  if (f.mode === "flach") return [tx - (ax - 160) * f.zo, ty - (ay - LH) * f.zo];
  const yh = horizonA(ax, f.curve), t = Math.max(0, (LH - ay) / (LH - yh)), s = (0.62 + 0.9 * t) * f.zo;
  return [tx - (ax - 160) * s, ty - TH * f.zo * (1 - Math.pow(t, GAMMA)) + TH * f.zo];
}

/** Abstand jedes Pufferpunkts von der Kamera auf dem Boden und Dunst: genau die Schleife aus createWorld. Texel = (cx + ox, cy − TH · zo + oy); bei zo = 1 und cy = 288 ist das A. */
export function groundMap(f: Frame): { ox: Float64Array; oy: Float64Array; fog: Float32Array; sky: Uint8Array } {
  const n = f.lw * f.lh, ox = new Float64Array(n), oy = new Float64Array(n), fog = new Float32Array(n), sky = new Uint8Array(n);
  for (let y = 0; y < f.lh; y++) for (let x = 0; x < f.lw; x++) {
    const i = y * f.lw + x, ax = x - f.xo, ay = y - f.yo;
    if (f.mode === "flach") { ox[i] = (ax - 160) * f.zo; oy[i] = (ay - LH) * f.zo + TH * f.zo; continue; }
    const yh = horizonA(ax, f.curve);
    if (ay < yh) { sky[i] = 1; continue; }
    const t = (LH - ay) / (LH - yh), s = (0.62 + 0.9 * t) * f.zo;
    ox[i] = (ax - 160) * s; oy[i] = TH * f.zo * (1 - Math.pow(t, GAMMA)); fog[i] = Math.pow(t, 2.2) * 0.55;
  }
  return { ox, oy, fog, sky };
}
