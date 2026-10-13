// Mockup Innenräume: Grundriss aus der Startwelt (Innenbereich [26, 3, 24, 13]), „Puppenhaus“-Abbildung: jede Zimmerreihe bekommt
// eine hohe Rückwand mit Tapete, vorn eine aufgeschnittene niedrige Wand; Zwischenwände sind dünn statt kachelbreit.
// Kein Produktionscode.
import welt from "../../../../backend/simulacra/data/world_default.json";
import { WPA } from "../../../../frontend/src/world/art/palette";
import { hash, noise, type RGB } from "../../../../frontend/src/world/art/pen";

export const T = 16, IX = 26, IY = 3, IW = 24, IH = 13;
export const BW = 34, LEDGE = 7, GAP = 3;                            // Rückwand, vordere Schnittkante, Abstand (Pixel)
export const ROWS: string[] = welt.tiles;
export const kind = (tx: number, ty: number) => ROWS[ty]?.[tx] ?? "T";

export interface Room { id: string; name: string; r: number[]; band: 0 | 1; paper: string; floor: string }
const STYLE: Record<string, { paper: string; floor: string }> = {
  "house.bedroom_a": { paper: "streifen", floor: "dielen" },
  "house.bedroom_b": { paper: "blumen", floor: "dielenHell" },
  "house.workshop": { paper: "bretter", floor: "werkstatt" },
  "house.kitchen": { paper: "kacheln", floor: "fliesen" },
  "house.living": { paper: "ranken", floor: "parkett" },
};
export const ROOMS: Room[] = welt.locations.filter((l) => l.id.startsWith("house.")).map((l) => ({ id: l.id, name: l.name, r: l.rect, band: l.rect[1] < 9 ? 0 : 1, ...STYLE[l.id] }));
export const roomAt = (tx: number, ty: number) => ROOMS.find((R) => tx >= R.r[0] && ty >= R.r[1] && tx < R.r[0] + R.r[2] && ty < R.r[1] + R.r[3]);

// Senkrechte Abbildung: Weltpixel y → Bildzeile. Reihe 0: Böden 4–8, Reihe 1: Böden 10–14; die Wandzeile 9 wird zur Schnittkante
// der oberen Reihe plus Rückwand der unteren.
export const Y0 = BW;                                                 // Bildzeile von Weltzeile 4·16
const MID0 = 9 * T, MID1 = 10 * T, Y1 = Y0 + 5 * T + LEDGE + GAP + BW;  // Bildzeile von Weltzeile 10·16
export function Y(y: number): number {
  if (y < MID0) return Y0 + (y - 4 * T);
  if (y < MID1) return Y0 + 5 * T + ((y - MID0) / T) * (LEDGE + GAP + BW);
  return Y1 + (y - MID1);
}
export const HEIGHT = Y(15 * T) + LEDGE + 4, WIDTH = IW * T;
export const bandTop = (b: 0 | 1) => (b === 0 ? 0 : Y0 + 5 * T + LEDGE + GAP);     // Oberkante der Rückwand
export const floorTop = (b: 0 | 1) => (b === 0 ? Y0 : Y1);

// Böden: Farbe je Weltpixel nach Raumstil
const C = (r: number, g: number, b: number): RGB => [r, g, b];
const P = {
  plankA: C(201, 140, 86), plankB: C(186, 126, 76), plankC: C(214, 156, 100), gap: C(140, 92, 58),
  hellA: C(226, 184, 132), hellB: C(212, 168, 118), hellGap: C(166, 120, 80),
  wsA: C(150, 112, 80), wsB: C(136, 100, 72), wsGap: C(98, 70, 50), dust: C(200, 170, 120),
  tileA: C(236, 226, 206), tileB: C(196, 112, 84), grout: C(170, 150, 130),
  parA: C(178, 112, 66), parB: C(160, 98, 58), parGap: C(118, 70, 42),
};
export function floorColor(style: string, wx: number, wy: number): RGB {
  const h = hash(wx >> 2, wy >> 2, 3);
  if (style === "fliesen") { const gx = wx % 10, gy = wy % 10; if (gx === 0 || gy === 0) return P.grout; return (Math.floor(wx / 10) + Math.floor(wy / 10)) & 1 ? P.tileB : P.tileA; }
  if (style === "parkett") {                                                             // Fischgrät
    const u = Math.floor((wx + wy) / 6), v = Math.floor((wx - wy + 400) / 6), d = (u + v) & 1, lx = d ? (wx + wy) % 6 : (wx - wy + 400) % 6;
    if (lx === 0) return P.parGap;
    return hash(u, v, 7) < 0.5 ? P.parA : P.parB;
  }
  const row = Math.floor(wy / 5), off = hash(row, 0, 5) * 40, seam = Math.floor((wx + off) / 28);
  if (style === "werkstatt") {
    if (wy % 5 === 0 || (wx + Math.floor(off)) % 28 === 0) return P.wsGap;
    if (hash(wx, wy, 9) > 0.985) return P.dust;
    return hash(seam, row, 2) < 0.5 ? P.wsA : P.wsB;
  }
  const hell = style === "dielenHell";
  if (wy % 5 === 0 || (wx + Math.floor(off)) % 28 === 0) return hell ? P.hellGap : P.gap;
  if ((wx + Math.floor(off)) % 28 === 3 && wy % 5 === 2) return hell ? P.hellGap : P.gap;     // Nagel
  const t = hash(seam, row, 2) + (noise(wx * 0.2, wy * 0.6, 4) - 0.5) * 0.2;
  return hell ? (t < 0.5 ? P.hellA : P.hellB) : t < 0.33 ? P.plankA : t < 0.66 ? P.plankB : P.plankC;
}

// Tapeten: Farbe je Pixel der Rückwand (lx, ly relativ zur Wand, h = Wandhöhe)
const W = {
  streifen: [C(150, 170, 196), C(132, 152, 182)], blumen: [C(236, 190, 196), C(250, 214, 216)], bretter: [C(166, 120, 82), C(146, 104, 70)],
  kacheln: [C(242, 236, 222), C(122, 170, 176)], ranken: [C(120, 160, 120), C(104, 142, 106)],
};
export function paperColor(paper: string, lx: number, ly: number, h: number): RGB {
  if (ly < 3) return ly === 2 ? C(110, 76, 52) : C(150, 104, 70);                    // Deckenleiste
  if (ly >= h - 4) return ly === h - 4 ? C(110, 76, 52) : C(172, 122, 82);           // Fußleiste
  if (paper === "streifen") return Math.floor(lx / 4) % 2 ? W.streifen[0] : W.streifen[1];
  if (paper === "blumen") { const cx = lx % 8, cy = (ly + (Math.floor(lx / 8) % 2) * 4) % 8; return cx === 4 && cy === 4 ? C(214, 110, 130) : (cx === 3 || cx === 5) && cy === 4 ? C(150, 190, 130) : W.blumen[1]; }
  if (paper === "bretter") return lx % 7 === 0 ? C(110, 76, 52) : hash(Math.floor(lx / 7), 0, 4) < 0.5 ? W.bretter[0] : W.bretter[1];
  if (paper === "kacheln") { if (ly > h * 0.55) { const gx = lx % 6, gy = ly % 6; return gx === 0 || gy === 0 ? C(200, 196, 186) : W.kacheln[1]; } return W.kacheln[0]; }
  if (ly > h * 0.55) return lx % 6 === 0 ? C(120, 82, 56) : C(156, 108, 72);           // Holzvertäfelung unten
  const cx = lx % 10, cy = ly % 10;
  return (cx === 5 && (cy === 3 || cy === 7)) || (cy === 5 && (cx === 3 || cx === 7)) ? W.ranken[1] : W.ranken[0];
}

export const objects = welt.objects.filter((o) => o.tile[0] >= IX && o.tile[0] < IX + IW && o.tile[1] >= IY && o.tile[1] < IY + IH);
export const resources = welt.resource_nodes.filter((n) => n.location_id.startsWith("house."));
export const OUTSIDE: RGB = WPA.wild3;
