// Bodenregeln von Mockup A (wTexel), verallgemeinert auf Listen und mehrere Gebiete: Wiese, Wege, Plätze, Seen mit Ufer, Stege,
// Bäche, Brücken, Gärten mit Beeten, Vorplätze, dazu Landstraßen zwischen den Gebieten. Eine reine Funktion der Texelkoordinaten
// (Weltpixel − `texShift`); für Bild A kommt Texel für Texel dasselbe heraus wie in world.js.
import { WPA } from "../art/palette";
import { hash, noise, type RGB } from "../art/pen";
import type { Look, Region } from "./look";

function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}
/** Kleinster Abstand eines Punkts zu Linienzügen. */
export function lineDist(lines: number[][][], x: number, y: number) {
  let d = 1e9;
  for (const pl of lines) for (let j = 0; j < pl.length - 1; j++) d = Math.min(d, seg(x, y, pl[j][0], pl[j][1], pl[j + 1][0], pl[j + 1][1]));
  return d;
}
const inBox = (b: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1;

/** Gebiet, dessen Wiese (mit unruhigem Rand) den Texel enthält. */
function regionOf(L: Look, wx: number, wy: number, edge: number): Region | null {
  for (const r of L.regions) {
    const x = wx - r.frame[0], y = wy - r.frame[1], b = r.bounds;
    if (x >= b.left - 6 - edge && x < b.right + 6 + edge && y >= b.top - 4 - edge * 0.5 && (b.bottom == null || y < b.bottom + 4 + edge * 0.5)) return r;
  }
  return null;
}

/** Farbe und Art je Texel (0 Gras, 1 Weg, 2 Wasser, 3 Pflaster, 4 Beet, 5 Steg, 6 Sand, 7 Wildnis). */
export function texel(L: Look, tx: number, ty: number): [RGB, number] {
  const wx = tx + L.texShift[0], wy = ty + L.texShift[1];
  const n = noise(tx * 0.13, ty * 0.13, 1), h = hash(tx, ty, 2), g = n * 0.75 + h * 0.25;
  const edge = noise(ty * 0.06, tx * 0.02, 12) * 14, R = regionOf(L, wx, wy, edge);
  let col: RGB, type = 0;
  if (!R) {
    col = g < 0.36 ? WPA.wild3 : g < 0.66 ? WPA.wild2 : WPA.wild1; type = 7;
    return L.roads.length && lineDist(L.roads, wx, wy) < 5.2 ? [road(tx, ty, h), 1] : [col, type];
  }
  const vx = wx - R.frame[0], vy = wy - R.frame[1], S = R.shapes;
  col = g < 0.32 ? WPA.grass3 : g < 0.64 ? WPA.grass2 : WPA.grass1;
  if ((tx + ty * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
  let lv = 1e9;
  for (const k of S.lakes) { const a = (vx - k.x) / k.rx, b = (vy - k.y) / k.ry; lv = Math.min(lv, a * a + b * b + (noise(vx * 0.09, vy * 0.09, 7) - 0.5) * 0.45); }
  if (lv < 1) { type = 2; col = lv < 0.35 ? WPA.waterDeep : lv < 0.62 ? WPA.water3 : lv < 0.86 ? WPA.water2 : WPA.water1; if (lv > 0.95) col = WPA.foam; }
  else if (lv < 1.13) { type = 6; col = h < 0.5 ? WPA.path1 : WPA.path2; }
  if (S.streams.length) {
    const ds = lineDist(S.streams, vx, vy);
    if (ds < 3.6 + (noise(vx * 0.2, vy * 0.2, 5) - 0.5) * 1.2) { type = 2; col = ds < 1.5 ? WPA.waterDeep : ds < 2.4 ? WPA.water3 : ds < 3.2 ? WPA.water2 : WPA.water1; if (ds > 3.3) col = WPA.foam; }
    else if (ds < 5.4 && type !== 2) { type = 6; col = h < 0.5 ? WPA.path1 : WPA.path2; }
  }
  for (const D of S.docks) if (inBox(D, vx, vy)) {
    type = 5; col = (vx - D.x0) % 4 === 3 ? WPA.wood3 : vy === D.y0 || vy === D.y1 - 1 ? WPA.wood2 : h < 0.5 ? WPA.wood1 : WPA.wood2;
  }
  for (const B of S.bridges) if (inBox(B, vx, vy)) {
    type = 5; col = (vx - B.x0) % 4 === 3 ? WPA.wood3 : vy === B.y0 || vy === B.y1 - 1 ? WPA.wood2 : h < 0.5 ? WPA.wood1 : WPA.wood2;
  }
  if (type === 0 || type === 6) {
    let inSq = false;
    for (const Q of S.squares) {
      const dq = Math.hypot(vx - Q.x, (vy - Q.y) * 1.08);
      if (dq >= Q.r) continue;
      inSq = true; type = 3;
      if (dq > Q.r - 2) col = WPA.stone3;
      else {
        const row = Math.floor(vy / 4), off = row & 1 ? 2 : 0, cx = Math.floor((vx + off) / 5);
        if (vy % 4 === 0 || (vx + off) % 5 === 0) col = WPA.cob3;
        else if (vy % 4 === 1 && (vx + off) % 5 === 1) col = WPA.cobHi;
        else col = hash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1;
      }
      break;
    }
    if (!inSq) {
      const dp = lineDist(S.paths, vx, vy);
      if (dp < 5.2) { type = 1; col = noise(tx * 0.3, ty * 0.3, 4) < 0.45 ? WPA.path2 : WPA.path1; if (h > 0.965) col = WPA.pebble; }
      else if (dp < 6.4 && type === 0) col = WPA.grassDark;
    }
    for (const G of S.gardens) {
      if (type !== 0 || !inBox(G, vx, vy)) continue;
      col = g < 0.5 ? WPA.grass1 : WPA.grassLight;
      for (const bd of G.beds) {
        if (vx >= bd[0] && vx < bd[0] + bd[2] && vy >= bd[1] && vy < bd[1] + bd[3]) {
          type = 4; col = (vy - bd[1]) % 3 === 0 ? WPA.soil2 : WPA.soil1;
          if (vx === bd[0] || vx === bd[0] + bd[2] - 1 || vy === bd[1] + bd[3] - 1) col = WPA.wood3;
        }
      }
    }
    for (const P of S.pads) if (vx >= P[0] && vx < P[2] && vy >= P[1] && vy < P[3]) col = WPA.path3;
  }
  if ((type === 0 || type === 6) && L.roads.length && lineDist(L.roads, wx, wy) < 5.2) { type = 1; col = road(tx, ty, h); }
  return [col, type];
}

const road = (tx: number, ty: number, h: number): RGB => (h > 0.965 ? WPA.pebble : noise(tx * 0.3, ty * 0.3, 4) < 0.45 ? WPA.path2 : WPA.path1);
