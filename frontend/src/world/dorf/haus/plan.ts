// Innenansicht als Puppenhaus (Mockup innen2, Frage 23): Die Räume liegen in Reihen; jede Reihe bekommt oben eine hohe Rückwand mit
// Tapete und vorn eine aufgeschnittene niedrige Wand, die Wandzeile zwischen zwei Reihen wird dafür aufgespreizt. Waagerecht bleibt
// alles, wie es auf der Karte liegt. Grundriss, Räume und Stile kommen aus der Welt (`look.interior`, Orte, Kacheln).
import type { World } from "../../../store/types";
import { hash, noise, type RGB } from "../../art/pen";
import { T, type Look } from "../look";

export const BW = 34, LEDGE = 7, GAP = 3;                            // Rückwand, vordere Schnittkante, Abstand (Pixel)

export interface Room { id: string; name: string; r: number[]; band: number; paper: string; floor: string; curtain: string }
export interface Band { y: number; h: number; top: number; floor: number }

export interface Plan {
  rect: number[];
  rooms: Room[];
  bands: Band[];
  width: number;
  height: number;
  kind(tx: number, ty: number): string;
  roomAt(tx: number, ty: number): Room | undefined;
  /** Weltpixel → Bildspalte / Bildzeile des Puppenhauses (1 Pixel = 1 Weltpixel). */
  X(wx: number): number;
  Y(wy: number): number;
  /** Bildzeile → Weltpixel (für Klicks). */
  Yinv(y: number): number;
}

export function makePlan(w: World, L: Look): Plan {
  const [ix, iy, iw, ih] = L.interior.rect, styles = L.interior.rooms ?? {};
  const kind = (tx: number, ty: number) => w.map.rows[ty]?.[tx] ?? "T";
  const locs = Object.values(w.locations).filter((l) => !l.props.fallback && l.rect[0] >= ix && l.rect[1] >= iy && l.rect[0] < ix + iw && l.rect[1] < iy + ih);
  const ys = [...new Set(locs.map((l) => l.rect[1]))].sort((a, b) => a - b);
  const bands: Band[] = [];
  let cursor = 0;
  for (const y of ys) {
    const h = Math.max(...locs.filter((l) => l.rect[1] === y).map((l) => l.rect[3]));
    bands.push({ y, h, top: cursor, floor: cursor + BW });
    cursor += BW + h * T + LEDGE + GAP;
  }
  const DEFAULT = { paper: "streifen", floor: "dielen", curtain: "#b04a4a" };
  const rooms: Room[] = locs.map((l) => ({ id: l.id, name: l.name, r: l.rect, band: ys.indexOf(l.rect[1]), ...Object.assign({}, DEFAULT, styles[l.id]) }));
  // Stützstellen der senkrechten Abbildung (Weltpixel → Bildzeile), dazwischen linear
  const pts: [number, number][] = [];
  bands.forEach((b, i) => {
    if (i === 0) pts.push([(b.y - 1) * T, b.top + BW - T]);
    pts.push([b.y * T, b.floor], [(b.y + b.h) * T, b.floor + b.h * T]);
    const next = bands[i + 1];
    pts.push(next ? [next.y * T, next.floor] : [(b.y + b.h + 1) * T, b.floor + b.h * T + T]);
  });
  const lerp = (v: number, a: [number, number][], from: 0 | 1) => {
    const to = 1 - from;
    if (v <= a[0][from]) return a[0][to] + (v - a[0][from]);
    for (let i = 0; i < a.length - 1; i++) if (v <= a[i + 1][from]) { const [p, q] = [a[i], a[i + 1]], k = (v - p[from]) / Math.max(1e-6, q[from] - p[from]); return p[to] + (q[to] - p[to]) * k; }
    const z = a[a.length - 1];
    return z[to] + (v - z[from]);
  };
  return {
    rect: L.interior.rect, rooms, bands, width: iw * T, height: cursor - GAP + 4, kind,
    roomAt: (tx, ty) => rooms.find((R) => tx >= R.r[0] && ty >= R.r[1] && tx < R.r[0] + R.r[2] && ty < R.r[1] + R.r[3]),
    X: (wx) => wx - ix * T,
    Y: (wy) => lerp(wy, pts, 0),
    Yinv: (y) => lerp(y, pts, 1),
  };
}

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
