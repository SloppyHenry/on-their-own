// Eine Projektion für alles: Welt → Bildpuffer (Sprites, Schilder, Blasen, Licht) und Bildpuffer → Welt (Klicks, Boden).
// „Tiefe“ wölbt den Boden zum Horizont wie Mockup A (docs/mockups/welt-optik/world.js, wProject), „Flach“ ist dieselbe Welt ohne Wölbung.
// Koordinaten: Welt in Weltpixeln (Kachel = 16), Bild in Pixeln des kleinen Puffers (vor dem Hochskalieren).

export type ViewMode = "tiefe" | "flach";

export interface Camera {
  /** Fokuspunkt in Weltpixeln: in „Flach“ die Bildmitte, in „Tiefe“ ein Punkt im unteren Drittel. */
  fx: number;
  fy: number;
  /** Bildpixel je Weltpixel in Fokustiefe (Tiefe) bzw. überall (Flach); 1 = Maßstab von Mockup A. */
  zoom: number;
  mode: ViewMode;
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
  /** Tiefe 0 (unterer Rand) … 1 (Horizont); unter dem Bild negativ. In „Flach“ 0. */
  t: number;
}

export const GAMMA = 1.45;            // Wölbung (W_GAMMA im Mockup)
export const DEPTH = 1.44;            // sichtbare Tiefe in Bildhöhen bei Zoom 1 (288 / 200 im Mockup)
export const FOCUS_T = 0.42;          // Tiefe, in der der Fokuspunkt liegt
const S_NEAR = 0.62, S_FAR = 0.9, S_MIN = 0.2;   // Weltpixel je Bildpixel: unten 0,62, am Horizont 1,52 (Mockup)
const FOCUS_F = Math.pow(FOCUS_T, GAMMA);

/** Horizontlinie (Bild-y) an der Spalte x: in der Mitte am höchsten, zu den Rändern hin tiefer (Mockup: 34 + 14·k² bei Höhe 200). */
export function horizon(vp: Viewport, x: number): number {
  const k = (x - vp.w / 2) / (vp.w / 2);
  return vp.h * (0.17 + 0.07 * k * k);
}

/** Sichtbare Tiefe in Weltpixeln vom unteren Rand bis zum Horizont. */
export const depthSpan = (cam: Camera, vp: Viewport) => (vp.h * DEPTH) / cam.zoom;
/** Welt-y am unteren Bildrand (Tiefe). */
export const bottomY = (cam: Camera, vp: Viewport) => cam.fy + depthSpan(cam, vp) * FOCUS_F;

const scaleAt = (t: number, zoom: number) => Math.max(S_MIN, S_NEAR + S_FAR * t) / zoom;

/** Welt → Bild. `height` hebt den Punkt senkrecht an (Weltpixel), z. B. für Köpfe, Lampen, Rauch. */
export function project(cam: Camera, vp: Viewport, wx: number, wy: number, height = 0): Projected {
  if (cam.mode === "flach") {
    return { x: vp.w / 2 + (wx - cam.fx) * cam.zoom, y: vp.h / 2 + (wy - cam.fy - height) * cam.zoom, sc: cam.zoom, t: 0 };
  }
  const D = depthSpan(cam, vp), f = bottomY(cam, vp) - wy;
  const t = Math.sign(f) * Math.pow(Math.abs(f) / D, 1 / GAMMA), s = scaleAt(t, cam.zoom);
  const x = vp.w / 2 + (wx - cam.fx) / s;
  return { x, y: vp.h - t * (vp.h - horizon(vp, x)) - height / s, sc: 1 / s, t };
}

/** Bild → Welt (Boden, Höhe 0). Über dem Horizont (Himmel) `null`. */
export function unproject(cam: Camera, vp: Viewport, x: number, y: number): { x: number; y: number; t: number } | null {
  if (cam.mode === "flach") return { x: cam.fx + (x - vp.w / 2) / cam.zoom, y: cam.fy + (y - vp.h / 2) / cam.zoom, t: 0 };
  const t = (vp.h - y) / (vp.h - horizon(vp, x));
  if (t > 1) return null;
  const D = depthSpan(cam, vp), f = Math.sign(t) * D * Math.pow(Math.abs(t), GAMMA);
  return { x: cam.fx + (x - vp.w / 2) * scaleAt(t, cam.zoom), y: bottomY(cam, vp) - f, t };
}

/** Weltrechteck, das im Bild zu sehen sein kann (für Abschneiden und Bodenblöcke); `below` erweitert nach vorn für hohe Sprites. */
export function visibleWorld(cam: Camera, vp: Viewport, below = 0): { x0: number; y0: number; x1: number; y1: number } {
  if (cam.mode === "flach") {
    const hw = vp.w / 2 / cam.zoom, hh = vp.h / 2 / cam.zoom;
    return { x0: cam.fx - hw, y0: cam.fy - hh, x1: cam.fx + hw, y1: cam.fy + hh + below };
  }
  const yb = bottomY(cam, vp), hw = (vp.w / 2) * scaleAt(1, cam.zoom);
  return { x0: cam.fx - hw, y0: yb - depthSpan(cam, vp), x1: cam.fx + hw, y1: yb + below };
}
