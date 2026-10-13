// Mockup „Ruhige Ansicht“: die Startwelt (64 × 40 Kacheln, wie echt.js und world_default.json), Begehbarkeit und Wegsuche.
// Kein Produktionscode.

export const T = 16, MW = 64, MH = 40, M = 320;            // Kachel, Kartengröße, Waldrand jenseits der Karte (Weltpixel)

export const ROWS = ["TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TT.............................T..............................TT", "TTT................T.................................T........TT", "TT..########################..................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________+,,................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________#.............................T....TT", "TT..####+####+########+#####..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________+____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..################+#######........,.........................TT", "TT..................,...............,..........T..............TT", "TT....T.............,...............,................T..T.....TT", "TTTT.T.TT.T.TT..TT..,...............,.........................TT", "TT...T.TTTT.T..T.TTT,...............,.........................TT", "TT..T..T..T....T.T..,.....,,,,,,,,,,,,,,,.T.........sssssss..TTT", "TTT.T....T........T.,.....,,,,,,,,,,,,,,,.....T...ss~~~~~~~ss.TT", "TT...T..T.TTT.TT..T.,.....,,,,,,,,,,,,,,,........s~~~~~~~~~~~sTT", "TT..........TTT..TT.,.....,,,,,,,,,,,,,,,.......s~~~~~~~~~~~~~TT", "TTT.............T.TT,,,,,,,,,,,,,,,,,,,,,,,,,,,s~~~~~~~~~~~~~~TT", "TTTTTT,,,,,,,,,,,,,,,.....,,,,,,,,,,,,,,,......s~~~~~~~~~~~~~~TT", "TT.TTT......TTTT.TT.......,,,,,,,,,,,,,,,.....ss~~~~~~~~~~~~~~TT", "TT.T.T......T...TT........,,,,,,,,,,,,,,,....._______~~~~~~~~~TT", "TT..........T......T......,,,,,,,,,,,,,,,.....ss~~~~~~~~~~~~~~TT", "TTTTTT......T.....T............................s~~~~~~~~~~~~~~TT", "TTT......TTT..T...T............................s~~~~~~~~~~~~~~TT", "TTTT.......TTTT.T.T...............T.............s~~~~~~~~~~~~~TT", "TTT........T.TT.T.....................T.....T....s~~~~~~~~~~~sTT", "TTT...T.TT......................................T.ss~~~~~~~ss.TT", "TT.......T...TT.TTT.................................sssssss...TT", "TT..T..T..T.....T..T..........................................TT", "TTTT.T..TT..T...TTT....T......................................TT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"];

/** Grundriss des Hauses in Kacheln (x1, y1 ausschließlich); draußen steht dort das Haus aus Mockup A auf einer Wiese. */
export const BLD = { x0: 4, y0: 4, x1: 28, y1: 17 };
export const FRONT = { tx: 20, ty: 16 };                    // Haustür innen; draußen davor Kachel (20, 17)
export const DOOR = { x: FRONT.tx * T + 8, y: BLD.y1 * T };  // Fußpunkt des Hauses draußen
export const GARDEN = [30, 4, 17, 12], SQUARE = [26, 21, 15, 9];
export const SEED = [[32, 7], [34, 7], [36, 7], [32, 10], [34, 10], [36, 10]];

export type Floor = "holz" | "werkstatt" | "fliesen";
export const ROOMS: { id: string; name: string; r: number[]; floor: Floor }[] = [
  { id: "bedroom_a", name: "Zimmer Alex", r: [5, 5, 6, 5], floor: "holz" },
  { id: "bedroom_b", name: "Zimmer Mira", r: [12, 5, 6, 5], floor: "holz" },
  { id: "workshop", name: "Werkstatt", r: [19, 5, 8, 5], floor: "werkstatt" },
  { id: "kitchen", name: "Küche", r: [5, 11, 9, 5], floor: "fliesen" },
  { id: "living", name: "Wohnzimmer", r: [15, 11, 12, 5], floor: "holz" },
];
export const RUG = [18, 12, 6, 3];                            // Teppich im Wohnzimmer

export const inRect = (r: number[], tx: number, ty: number) => tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3];
export const inBld = (tx: number, ty: number) => tx >= BLD.x0 && ty >= BLD.y0 && tx < BLD.x1 && ty < BLD.y1;

/** Kachelzeichen; außerhalb der Karte Wald. */
export function raw(tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return "T";
  return ROWS[ty][tx];
}

/** Draußen ist der Grundriss Wiese ('Y'), damit Weg und Platz nicht unter dem Haus hindurchlaufen. */
export const outside = (tx: number, ty: number) => (inBld(tx, ty) ? "Y" : raw(tx, ty));

export function walkable(tx: number, ty: number, inside: boolean): boolean {
  const c = raw(tx, ty);
  if (inside) return inBld(tx, ty) && (c === "_" || c === "+");
  return !inBld(tx, ty) && c !== "T" && c !== "~";
}

export interface Step { tx: number; ty: number; inside: boolean }

/** Breitensuche über Kacheln, 8 Richtungen ohne Eckenschneiden. */
export function findPath(from: Step, tx: number, ty: number): Step[] | null {
  const inside = from.inside;
  if (!walkable(tx, ty, inside)) return null;
  const W = MW, prev = new Int32Array(MW * MH).fill(-1), start = from.ty * W + from.tx, goal = ty * W + tx, q = [start];
  prev[start] = start;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % W, cy = (c / W) | 0;
    if (c === goal) break;
    for (const [dx, dy] of D) {
      const nx = cx + dx, ny = cy + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || prev[n] >= 0 || !walkable(nx, ny, inside)) continue;
      if (dx && dy && (!walkable(cx + dx, cy, inside) || !walkable(cx, cy + dy, inside))) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (prev[goal] < 0) return null;
  const out: Step[] = [];
  for (let c = goal; c !== start; c = prev[c]) out.push({ tx: c % W, ty: (c / W) | 0, inside });
  return out.reverse();
}

/** Weg auch durch die Haustür: drinnen bis zur Tür, dann draußen weiter (oder umgekehrt). */
export function route(from: Step, tx: number, ty: number, inside: boolean): Step[] | null {
  if (from.inside === inside) return findPath(from, tx, ty);
  const door: Step = { tx: FRONT.tx, ty: FRONT.ty, inside: true }, yard: Step = { tx: FRONT.tx, ty: FRONT.ty + 1, inside: false };
  const a = findPath(from, from.inside ? door.tx : yard.tx, from.inside ? door.ty : yard.ty);
  const b = findPath(from.inside ? yard : door, tx, ty);
  if (!a || !b) return null;
  return [...a, from.inside ? yard : door, ...b];
}

/** Zufälliges begehbares Ziel in der Nähe (für das Herumschlendern). */
export function nearby(from: Step, r: number, R: () => number): Step | null {
  for (let i = 0; i < 30; i++) {
    const tx = from.tx + Math.round((R() - 0.5) * 2 * r), ty = from.ty + Math.round((R() - 0.5) * 2 * r);
    if (walkable(tx, ty, from.inside)) return { tx, ty, inside: from.inside };
  }
  return null;
}
