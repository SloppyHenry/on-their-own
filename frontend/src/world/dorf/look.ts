// Darstellung einer Welt nach Mockup A (`look` aus der Weltdatei): Formen, Bäume, Deko und Lage der Dinge in Dorfkoordinaten
// (wie world.js). Weltpixel = Dorfkoordinaten + origin; eine Kachel hat 16 Weltpixel.
import type { World } from "../../store/types";

export interface Look {
  style: "mockup-a";
  /** Weltpixel des Dorfpunkts (0, 0). */
  origin: [number, number];
  /** Bodentextur von A: Dorf (0, 0) liegt bei Texel `offset`, Größe `size` (W_OX/W_OY, W_TW/W_TH). */
  texture: { offset: [number, number]; size: [number, number] };
  shapes: {
    paths: number[][][];
    square: { x: number; y: number; r: number };
    lake: { x: number; y: number; rx: number; ry: number };
    garden: { x0: number; y0: number; x1: number; y1: number };
    beds: number[][];
    house: { x: number; y: number };
    dock: { x0: number; y0: number; x1: number; y1: number };
  };
  /** Deko wie wObjects: [Art, x, y, Zusatz]. */
  decor: [string, number, number, number][];
  /** Lichtquellen wie W_LIGHTS: [x, y, Höhe, Stärke]. */
  lights: number[][];
  /** Lage im Bild (Dorfkoordinaten) für Dinge aus dem Zustand; `sprite: "none"` = im Bild schon enthalten (Beete, Steg …). */
  place: Record<string, { at: [number, number]; sprite?: string }>;
  door: { outside: [number, number]; inside: [number, number]; at: [number, number] };
  /** Innenbereich des Hauses in Kacheln [x, y, w, h]. */
  interior: { rect: [number, number, number, number] };
}

export const lookOf = (w: World | null): Look | null => ((w?.look as unknown as Look | null | undefined)?.style === "mockup-a" ? (w!.look as unknown as Look) : null);

export const T = 16;
export const inRect = (r: number[], tx: number, ty: number) => tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3];
/** Liegt die Kachel im Innenbereich des Hauses? */
export const isInside = (L: Look, tx: number, ty: number) => inRect(L.interior.rect, tx, ty);
