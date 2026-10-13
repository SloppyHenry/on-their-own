// Bodentextur von Mockup A: wTexel (Wiese, Wege, runder Platz, See mit Ufer, Steg, Garten mit Beeten, Vorplatz am Haus), dann
// Grasbüschel, Blumen, Seerosen, Keimlinge und eingebackene Schatten – Zeile für Zeile wie createWorld in world.js.
import { WPA } from "../art/palette";
import { hash, noise, rng, type RGB } from "../art/pen";
import type { Look } from "./look";

export interface Caster { x: number; y: number; w: number }

function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

/** Farbe und Art je Texel (0 Gras, 1 Weg, 2 Wasser, 3 Pflaster, 4 Beet, 5 Steg, 6 Sand, 7 Wildnis). */
export function texel(L: Look, tx: number, ty: number): [RGB, number] {
  const [OX, OY] = L.texture.offset, S = L.shapes, vx = tx - OX, vy = ty - OY;
  const n = noise(tx * 0.13, ty * 0.13, 1), h = hash(tx, ty, 2), g = n * 0.75 + h * 0.25;
  const edge = noise(ty * 0.06, tx * 0.02, 12) * 14, inV = vx >= -6 - edge && vx < 262 + edge && vy >= -4 - edge * 0.5;
  if (!inV) return [g < 0.36 ? WPA.wild3 : g < 0.66 ? WPA.wild2 : WPA.wild1, 7];
  let col = g < 0.32 ? WPA.grass3 : g < 0.64 ? WPA.grass2 : WPA.grass1, type = 0;
  if ((tx + ty * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
  const a = (vx - S.lake.x) / S.lake.rx, b = (vy - S.lake.y) / S.lake.ry, lv = a * a + b * b + (noise(vx * 0.09, vy * 0.09, 7) - 0.5) * 0.45;
  if (lv < 1) { type = 2; col = lv < 0.35 ? WPA.waterDeep : lv < 0.62 ? WPA.water3 : lv < 0.86 ? WPA.water2 : WPA.water1; if (lv > 0.95) col = WPA.foam; }
  else if (lv < 1.13) { type = 6; col = h < 0.5 ? WPA.path1 : WPA.path2; }
  const D = S.dock;
  if (vx >= D.x0 && vx < D.x1 && vy >= D.y0 && vy < D.y1) {
    type = 5; col = (vx - D.x0) % 4 === 3 ? WPA.wood3 : vy === D.y0 || vy === D.y1 - 1 ? WPA.wood2 : h < 0.5 ? WPA.wood1 : WPA.wood2;
  }
  if (type === 0 || type === 6) {
    const Q = S.square, dq = Math.hypot(vx - Q.x, (vy - Q.y) * 1.08);
    if (dq < Q.r) {
      type = 3;
      if (dq > Q.r - 2) col = WPA.stone3;
      else {
        const row = Math.floor(vy / 4), off = row & 1 ? 2 : 0, cx = Math.floor((vx + off) / 5);
        if (vy % 4 === 0 || (vx + off) % 5 === 0) col = WPA.cob3;
        else if (vy % 4 === 1 && (vx + off) % 5 === 1) col = WPA.cobHi;
        else col = hash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1;
      }
    } else {
      let dp = 1e9;
      for (const pl of S.paths) for (let j = 0; j < pl.length - 1; j++) dp = Math.min(dp, seg(vx, vy, pl[j][0], pl[j][1], pl[j + 1][0], pl[j + 1][1]));
      if (dp < 5.2) { type = 1; col = noise(tx * 0.3, ty * 0.3, 4) < 0.45 ? WPA.path2 : WPA.path1; if (h > 0.965) col = WPA.pebble; }
      else if (dp < 6.4 && type === 0) col = WPA.grassDark;
    }
    const G = S.garden;
    if (type === 0 && vx >= G.x0 && vx < G.x1 && vy >= G.y0 && vy < G.y1) {
      col = g < 0.5 ? WPA.grass1 : WPA.grassLight;
      for (const bd of S.beds) {
        if (vx >= bd[0] && vx < bd[0] + bd[2] && vy >= bd[1] && vy < bd[1] + bd[3]) {
          type = 4; col = (vy - bd[1]) % 3 === 0 ? WPA.soil2 : WPA.soil1;
          if (vx === bd[0] || vx === bd[0] + bd[2] - 1 || vy === bd[1] + bd[3] - 1) col = WPA.wood3;
        }
      }
    }
    if (vx >= S.house.x - 36 && vx < S.house.x + 36 && vy >= S.house.y - 30 && vy < S.house.y) col = WPA.path3;
  }
  return [col, type];
}

export interface Texture { tex: Uint8ClampedArray; type: Uint8Array; w: number; h: number }

/** Textur mit allem, was A hineinmalt. `casters`: Schattenwerfer (Dorfkoordinaten, Spritebreite) wie die Objekte in A. */
export function buildTexture(L: Look, casters: Caster[]): Texture {
  const [W, H] = L.texture.size, [OX, OY] = L.texture.offset, S = L.shapes;
  const tex = new Uint8ClampedArray(W * H * 3), type = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [c, t] = texel(L, x, y), i = y * W + x; tex[i * 3] = c[0]; tex[i * 3 + 1] = c[1]; tex[i * 3 + 2] = c[2]; type[i] = t; }
  const set = (x: number, y: number, c: RGB) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const j = y * W + x; tex[j * 3] = c[0]; tex[j * 3 + 1] = c[1]; tex[j * 3 + 2] = c[2]; };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 255 : type[y * W + x]);
  const R = rng(5);
  for (let i = 0; i < 1400; i++) { const x = Math.floor(R() * W), y = Math.floor(R() * H), t = at(x, y); if (t === 0 || t === 7) { const dk = t === 7 ? WPA.wild3 : WPA.grassDark; set(x, y - 1, dk); set(x - 1, y, dk); set(x + 1, y, dk); } }
  const FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
  for (let i = 0; i < 260; i++) {
    const fx = Math.floor(R() * W), fy = Math.floor(R() * H), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
    for (let j = 0; j < n2; j++) {
      const px = fx + Math.round((R() - 0.5) * 9), py = fy + Math.round((R() - 0.5) * 7), tt = at(px, py);
      if (tt !== 0 && tt !== 7) continue;
      if (big) { set(px - 1, py, fc); set(px + 1, py, fc); set(px, py - 1, fc); set(px, py + 1, fc); set(px, py, WPA.fY); } else set(px, py, fc);
    }
  }
  for (let i = 0; i < 12; i++) {
    const lx = OX + S.lake.x + Math.round((R() - 0.5) * 60), ly = OY + S.lake.y + Math.round((R() - 0.5) * 50);
    if (at(lx, ly) === 2 && at(lx + 2, ly) === 2) { set(lx, ly, WPA.leaf2); set(lx + 1, ly, WPA.leaf2); set(lx + 2, ly, WPA.leaf3); set(lx + 1, ly - 1, WPA.leaf2); if (R() < 0.5) set(lx + 1, ly - 1, WPA.fP); }
  }
  S.beds.forEach((b, i) => {
    for (let x = b[0] + 3; x < b[0] + b[2] - 2; x += 4) {
      const bx = x + OX, by = b[1] + 4 + OY;
      if (i === 1) { set(bx, by, WPA.leaf1); set(bx + 1, by, WPA.leaf2); set(bx, by + 1, WPA.leaf2); set(bx + 1, by + 1, WPA.leaf3); set(bx - 1, by, WPA.leaf3); set(bx + 2, by + 1, WPA.leaf3); }
      else { set(bx, by, WPA.leaf2); set(bx - 1, by - 1, WPA.leaf1); set(bx + 1, by - 1, WPA.leaf1); set(bx, by + 1, WPA.leaf3); }
    }
  });
  for (const c of casters) {
    const rx = c.w * 0.42, ry = Math.max(2, c.w * 0.16), cx = c.x + OX + rx * 0.3, cy = c.y + OY + 0.5;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 || x < 0 || y < 0 || x >= W || y >= H) continue;
      const q = (y * W + x) * 3; tex[q] *= 0.72; tex[q + 1] *= 0.72 * 1.02; tex[q + 2] *= 0.72 * 1.12;
    }
  }
  return { tex, type, w: W, h: H };
}
