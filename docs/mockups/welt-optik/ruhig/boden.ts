// Mockup „Ruhige Ansicht“: Boden einmal als Textur (1 Texel = 1 Weltpixel), Regeln wie eTexel in echt.js bzw. Ground in der App.
// Die Textur wird beim Zeichnen nur ganzzahlig vergrößert und ganzpixlig verschoben – darum flimmert nichts. Kein Produktionscode.
import { WPA } from "../../../../frontend/src/world/art/palette";
import { canvas, hash, noise, rng, type RGB } from "../../../../frontend/src/world/art/pen";
import { BLD, DOOR, GARDEN, M, MH, MW, ROOMS, RUG, SEED, SQUARE, T, inRect, outside, raw } from "./karte";

export const GW = MW * T + 2 * M, GH = MH * T + 2 * M;
const inPx = (r: number[], x: number, y: number) => x >= r[0] * T && y >= r[1] * T && x < (r[0] + r[2]) * T && y < (r[1] + r[3]) * T;
const C = (r: number, g: number, b: number): RGB => [r, g, b];
const FLOOR = { tileA: C(233, 226, 211), tileB: C(207, 199, 184), ws1: C(110, 80, 56), ws2: C(140, 106, 76), ws3: C(128, 96, 74), plank2: C(195, 134, 79), wallTop: C(139, 109, 85), rugA: C(196, 80, 90), rugB: C(168, 64, 76), rugEdge: C(242, 210, 138) };

// Abstand zum Ufer je Wasserkachel, weich abgetastet: Tiefe und Schaum wie wLake im Mockup
const DIST = (() => {
  const d = new Float32Array(MW * MH), q: number[][] = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const w = raw(x, y) === "~"; d[y * MW + x] = w ? 1e9 : 0; if (!w) q.push([x, y]); }
  for (let h = 0; h < q.length; h++) {
    const [px, py] = q[h];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = px + ox, b = py + oy;
      if (a < 0 || b < 0 || a >= MW || b >= MH) continue;
      const k = b * MW + a;
      if (d[k] > d[py * MW + px] + 1) { d[k] = d[py * MW + px] + 1; q.push([a, b]); }
    }
  }
  return d;
})();
function dist(x: number, y: number) {
  const fx = x / T - 0.5, fy = y / T - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
  const at = (a: number, b: number) => (a < 0 || b < 0 || a >= MW || b >= MH ? 0 : DIST[b * MW + a]);
  return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v - 0.5;
}

// Typen: 0 Wiese, 1 Weg, 2 Wasser, 3 Pflaster, 4 Beet, 5 Steg, 6 Sand, 7 Wildwiese
function texel(px: number, py: number): [RGB, number] {
  const wx = px - M, wy = py - M, n = noise(px * 0.13, py * 0.13, 1), h = hash(px, py, 2), g = n * 0.75 + h * 0.25;
  const qx = wx + (noise(wx * 0.07, wy * 0.07, 21) - 0.5) * 12, qy = wy + (noise(wx * 0.07, wy * 0.07, 22) - 0.5) * 12;
  const tx = Math.floor(wx / T), ty = Math.floor(wy / T), r = outside(tx, ty), ch = outside(Math.floor(qx / T), Math.floor(qy / T));
  if (r === "_") { const dy = wy - 28 * T; return [wx % 4 === 3 ? WPA.wood3 : dy === 0 || dy === 15 ? WPA.wood2 : h < 0.5 ? WPA.wood1 : WPA.wood2, 5]; }
  if (ch === "T" && r === "T") return [g < 0.36 ? WPA.wild3 : g < 0.66 ? WPA.wild2 : WPA.wild1, 7];
  let col = g < 0.32 ? WPA.grass3 : g < 0.64 ? WPA.grass2 : WPA.grass1, type = 0;
  if ((px + py * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
  if (ch === "~") { const lv = dist(qx, qy); return [lv < 0.12 ? WPA.foam : lv < 0.6 ? WPA.water1 : lv < 1.3 ? WPA.water2 : lv < 2.4 ? WPA.water3 : WPA.waterDeep, 2]; }
  if (ch === "s") return [h < 0.5 ? WPA.path1 : WPA.path2, 6];
  if (inPx(SQUARE, qx, qy)) {
    const edge = !inPx(SQUARE, qx - 3, qy) || !inPx(SQUARE, qx + 3, qy) || !inPx(SQUARE, qx, qy - 3) || !inPx(SQUARE, qx, qy + 3);
    if (edge) return [WPA.stone3, 3];
    const row = Math.floor(wy / 4), off = row & 1 ? 2 : 0, cx = Math.floor((wx + off) / 5);
    if (wy % 4 === 0 || (wx + off) % 5 === 0) return [WPA.cob3, 3];
    if (wy % 4 === 1 && (wx + off) % 5 === 1) return [WPA.cobHi, 3];
    return [hash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1, 3];
  }
  if (ch === ",") return [noise(px * 0.3, py * 0.3, 4) < 0.45 ? WPA.path2 : h > 0.965 ? WPA.pebble : WPA.path1, 1];
  if ([[3, 0], [-3, 0], [0, 3], [0, -3]].some(([ox, oy]) => outside(Math.floor((qx + ox) / T), Math.floor((qy + oy) / T)) === ",")) col = WPA.grassDark;
  if (inPx(GARDEN, wx, wy) && col !== WPA.grassDark) {
    col = g < 0.5 ? WPA.grass1 : WPA.grassLight;
    for (const [sx, sy] of SEED) {
      const bx = wx - sx * T, by = wy - sy * T;
      if (bx >= -6 && bx < 22 && by >= 3 && by < 13) { type = 4; col = (by - 3) % 3 === 0 ? WPA.soil2 : WPA.soil1; if (bx === -6 || bx === 21 || by === 12) col = WPA.wood3; }
    }
  }
  if (Math.abs(wx - DOOR.x) < 36 && wy >= DOOR.y - 30 && wy < DOOR.y) col = WPA.path3;
  return [col, type];
}

export interface Shadow { x: number; y: number; w: number }

/** Boden draußen mit Grasbüscheln, Blumen, Wasserglanz und eingebackenen Schatten der festen Dinge. */
export function groundTexture(shadows: Shadow[]): HTMLCanvasElement {
  const c = canvas(GW, GH), g = c.getContext("2d")!, img = g.createImageData(GW, GH), d = img.data, ty = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const [col, t] = texel(x, y), o = (y * GW + x) * 4;
    let [r, gg, b] = col;
    if (t === 2 && Math.sin(x * 0.55 + 2.1) * Math.sin(y * 1.25 - 1.6) > 0.86) { r = 240; gg = 252; b = 255; }
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; ty[y * GW + x] = t;
  }
  const set = (x: number, y: number, col: RGB) => { if (x < 0 || y < 0 || x >= GW || y >= GH) return; const o = (y * GW + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; };
  const typeAt = (x: number, y: number) => (x < 0 || y < 0 || x >= GW || y >= GH ? 255 : ty[y * GW + x]);
  const R = rng(5), k = (GW * GH) / (384 * 288);
  for (let i = 0; i < 1400 * k; i++) {
    const x = Math.floor(R() * GW), y = Math.floor(R() * GH), t = typeAt(x, y);
    if (t === 0 || t === 7) { const dk = t === 7 ? WPA.wild3 : WPA.grassDark; set(x, y - 1, dk); set(x - 1, y, dk); set(x + 1, y, dk); }
  }
  const FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
  for (let i = 0; i < 260 * k; i++) {
    const fx = Math.floor(R() * GW), fy = Math.floor(R() * GH), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
    for (let j = 0; j < n2; j++) {
      const a = fx + Math.round((R() - 0.5) * 9), b = fy + Math.round((R() - 0.5) * 7);
      if (typeAt(a, b) !== 0) continue;
      if (big) { set(a - 1, b, fc); set(a + 1, b, fc); set(a, b - 1, fc); set(a, b + 1, fc); set(a, b, WPA.fY); } else set(a, b, fc);
    }
  }
  for (const s of shadows) {                                  // Schatten wie im Mockup: Ellipse rechts versetzt, bläulich abgedunkelt
    const rx = s.w * 0.42, ry = Math.max(2, s.w * 0.16), cx = s.x + M + rx * 0.3, cy = s.y + M + 0.5;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const ex = (x + 0.5 - cx) / rx, ey = (y + 0.5 - cy) / ry;
      if (ex * ex + ey * ey > 1 || x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const o = (y * GW + x) * 4; d[o] *= 0.72; d[o + 1] *= 0.72 * 1.02; d[o + 2] *= 0.72 * 1.12;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Innenboden des Hauses (Grundriss in Weltpixeln ab BLD.x0/y0): Dielen, Werkstattbretter, Küchenfliesen, Teppich, Schwellen. */
export function floorTexture(): HTMLCanvasElement {
  const w = (BLD.x1 - BLD.x0) * T, h = (BLD.y1 - BLD.y0) * T, c = canvas(w, h), g = c.getContext("2d")!, img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x + BLD.x0 * T, wy = y + BLD.y0 * T, tx = Math.floor(wx / T), ty = Math.floor(wy / T), ch = raw(tx, ty), hh = hash(wx, wy, 2);
    const lx = wx % T, ly = wy % T, room = ROOMS.find((r) => inRect(r.r, tx, ty));
    let col: RGB;
    if (ch === "#") col = FLOOR.wallTop;
    else if (ch === "+") col = ly % 4 === 0 ? WPA.wood3 : WPA.wood1;
    else if (inRect(RUG, tx, ty)) {
      const edge = (tx === RUG[0] && lx < 2) || (tx === RUG[0] + RUG[2] - 1 && lx > 13) || (ty === RUG[1] && ly < 2) || (ty === RUG[1] + RUG[3] - 1 && ly > 13);
      col = edge ? FLOOR.rugEdge : (wx + wy + tx + ty) % 6 < 3 ? FLOOR.rugA : FLOOR.rugB;
    } else if (room?.floor === "fliesen") col = (Math.floor(wx / 8) + Math.floor(wy / 8)) & 1 ? FLOOR.tileA : FLOOR.tileB;
    else if (room?.floor === "werkstatt") col = wy % 5 === 0 ? FLOOR.ws1 : hh < 0.5 ? FLOOR.ws2 : FLOOR.ws3;
    else col = wy % 4 === 0 ? WPA.wood3 : Math.floor(wx / 12 + Math.floor(wy / 4) * 0.5) & 1 ? WPA.wood1 : FLOOR.plank2;
    const o = (y * w + x) * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
