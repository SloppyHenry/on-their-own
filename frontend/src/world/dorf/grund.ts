// Der Boden in Blöcken zu 64 × 64 Texel, bei Bedarf gebacken und gemerkt. Der Block von Bild A (`look.legacy`) wird genau wie in createWorld
// gebacken (Zufall in einer Folge über die ganze Fläche, Schatten der festen Dinge), alle anderen Blöcke würfeln ihren Zufall (Gräser, Blumen,
// Seerosen) aus ihren Koordinaten. Herausgezoomt (lod 2, 4) liest ein Block jeden lod-ten Texel, ohne Zufall und Schatten.
import { WPA } from "../art/palette";
import { rng, type RGB } from "../art/pen";
import type { Look } from "./look";
import { texel } from "./boden";

/** Fester Schattenwerfer: Fußpunkt in Weltpixeln und Spritebreite. */
export interface Caster { x: number; y: number; w: number }
export const CH = 64;

const FLOWERS = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];

export class Ground {
  built = 0;
  private chunks = new Map<string, Uint8ClampedArray>();
  private legacy: Uint8ClampedArray | null = null;
  private casters: Caster[] = [];
  private key = "";

  constructor(readonly L: Look) {}

  /** Schattenwerfer setzen; liefert, ob sich etwas geändert hat (dann werden die Blöcke neu gebacken). */
  setCasters(c: Caster[]): boolean {
    const key = c.map((x) => `${x.x},${x.y},${x.w}`).join(";");
    if (key === this.key) return false;
    this.key = key; this.casters = c; this.chunks.clear(); this.legacy = null;
    return true;
  }

  /** Block (ci, cj) in Stufe lod: rgba je Texel, `a` ist die Art (0 Gras … 7 Wildnis). */
  chunk(ci: number, cj: number, lod: number): Uint8ClampedArray {
    const k = `${lod}:${ci},${cj}`;
    let b = this.chunks.get(k);
    if (!b) { b = lod > 1 ? this.coarse(ci, cj, lod) : this.fine(ci, cj); this.chunks.set(k, b); this.built++; }
    return b;
  }

  // ---- Block von Bild A ---------------------------------------------------------------------
  private legacyTex(): Uint8ClampedArray {
    if (this.legacy) return this.legacy;
    const L = this.L, lg = L.legacy!, [x0, y0, W, H] = lg.rect, R = L.regions.find((r) => r.id === lg.region)!, S = R.shapes;
    const tex = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [c, t] = texel(L, x0 + x, y0 + y), i = (y * W + x) * 4; tex[i] = c[0]; tex[i + 1] = c[1]; tex[i + 2] = c[2]; tex[i + 3] = t; }
    const set = (tx: number, ty: number, c: RGB) => { const x = tx - x0, y = ty - y0; if (x < 0 || y < 0 || x >= W || y >= H) return; const j = (y * W + x) * 4; tex[j] = c[0]; tex[j + 1] = c[1]; tex[j + 2] = c[2]; };
    const at = (tx: number, ty: number) => { const x = tx - x0, y = ty - y0; return x < 0 || y < 0 || x >= W || y >= H ? 255 : tex[(y * W + x) * 4 + 3]; };
    const rnd = rng(5);
    for (let i = 0; i < 1400; i++) { const x = x0 + Math.floor(rnd() * W), y = y0 + Math.floor(rnd() * H), t = at(x, y); if (t === 0 || t === 7) { const dk = t === 7 ? WPA.wild3 : WPA.grassDark; set(x, y - 1, dk); set(x - 1, y, dk); set(x + 1, y, dk); } }
    for (let i = 0; i < 260; i++) {
      const fx = x0 + Math.floor(rnd() * W), fy = y0 + Math.floor(rnd() * H), fc = FLOWERS[Math.floor(rnd() * 4)], big = rnd() < 0.35, n2 = 2 + Math.floor(rnd() * 4);
      for (let j = 0; j < n2; j++) {
        const px = fx + Math.round((rnd() - 0.5) * 9), py = fy + Math.round((rnd() - 0.5) * 7), tt = at(px, py);
        if (tt !== 0 && tt !== 7) continue;
        if (big) { set(px - 1, py, fc); set(px + 1, py, fc); set(px, py - 1, fc); set(px, py + 1, fc); set(px, py, WPA.fY); } else set(px, py, fc);
      }
    }
    const ox = R.frame[0] - L.texShift[0], oy = R.frame[1] - L.texShift[1];            // Dorf (0, 0) in Texeln
    const lake = S.lakes[0];
    for (let i = 0; i < 12 && lake; i++) {
      const lx = ox + lake.x + Math.round((rnd() - 0.5) * 60), ly = oy + lake.y + Math.round((rnd() - 0.5) * 50);
      if (at(lx, ly) === 2 && at(lx + 2, ly) === 2) { set(lx, ly, WPA.leaf2); set(lx + 1, ly, WPA.leaf2); set(lx + 2, ly, WPA.leaf3); set(lx + 1, ly - 1, WPA.leaf2); if (rnd() < 0.5) set(lx + 1, ly - 1, WPA.fP); }
    }
    for (const g of S.gardens.slice(0, 1)) crops(g.beds, ox, oy, set);
    for (const c of this.casters) shade(tex, W, x0, y0, W, H, c, L);
    return (this.legacy = tex);
  }

  // ---- gewöhnlicher Block -----------------------------------------------------------------
  private fine(ci: number, cj: number): Uint8ClampedArray {
    const L = this.L, lg = L.legacy, x0 = ci * CH, y0 = cj * CH, buf = new Uint8ClampedArray(CH * CH * 4);
    const lt = lg && (x0 < lg.rect[0] + lg.rect[2] && x0 + CH > lg.rect[0] && y0 < lg.rect[1] + lg.rect[3] && y0 + CH > lg.rect[1]) ? this.legacyTex() : null;
    const inLegacy = (tx: number, ty: number) => !!lg && tx >= lg.rect[0] && ty >= lg.rect[1] && tx < lg.rect[0] + lg.rect[2] && ty < lg.rect[1] + lg.rect[3];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
      const tx = x0 + x, ty = y0 + y, o = (y * CH + x) * 4;
      if (lt && inLegacy(tx, ty)) { const j = ((ty - lg!.rect[1]) * lg!.rect[2] + (tx - lg!.rect[0])) * 4; buf[o] = lt[j]; buf[o + 1] = lt[j + 1]; buf[o + 2] = lt[j + 2]; buf[o + 3] = lt[j + 3]; }
      else { const [c, t] = texel(L, tx, ty); buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = t; }
    }
    if (lg?.plainOutside) return buf;
    const typeAt = (tx: number, ty: number) => (tx < x0 || ty < y0 || tx >= x0 + CH || ty >= y0 + CH ? 255 : buf[((ty - y0) * CH + (tx - x0)) * 4 + 3]);
    const set = (tx: number, ty: number, c: RGB) => { if (tx < x0 || ty < y0 || tx >= x0 + CH || ty >= y0 + CH || inLegacy(tx, ty)) return; const o = ((ty - y0) * CH + (tx - x0)) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; };
    const rnd = rng(((ci * 73856093) ^ (cj * 19349663) ^ 5) >>> 0);
    for (let i = 0; i < 52; i++) { const x = x0 + Math.floor(rnd() * CH), y = y0 + Math.floor(rnd() * CH), t = typeAt(x, y); if (t === 0 || t === 7) { const dk = t === 7 ? WPA.wild3 : WPA.grassDark; set(x, y - 1, dk); set(x - 1, y, dk); set(x + 1, y, dk); } }
    for (let i = 0; i < 10; i++) {
      const fx = x0 + Math.floor(rnd() * CH), fy = y0 + Math.floor(rnd() * CH), fc = FLOWERS[Math.floor(rnd() * 4)], big = rnd() < 0.35, n2 = 2 + Math.floor(rnd() * 4);
      for (let j = 0; j < n2; j++) {
        const px = fx + Math.round((rnd() - 0.5) * 9), py = fy + Math.round((rnd() - 0.5) * 7), tt = typeAt(px, py);
        if (tt !== 0 && tt !== 7) continue;
        if (big) { set(px - 1, py, fc); set(px + 1, py, fc); set(px, py - 1, fc); set(px, py + 1, fc); set(px, py, WPA.fY); } else set(px, py, fc);
      }
    }
    L.regions.forEach((R) => {
      const ox = R.frame[0] - L.texShift[0], oy = R.frame[1] - L.texShift[1];
      R.shapes.gardens.forEach((g, i) => { if (!(lg && R.id === lg.region && i === 0)) crops(g.beds, ox, oy, set); });
      R.shapes.lakes.forEach((k, i) => {
        if (lg && R.id === lg.region && i === 0) return;
        const rr = rng((i * 7919 + R.frame[0] * 31 + R.frame[1]) >>> 0);
        for (let n = 0; n < 12; n++) {
          const lx = ox + k.x + Math.round((rr() - 0.5) * 1.5 * k.rx), ly = oy + k.y + Math.round((rr() - 0.5) * 1.4 * k.ry), fl = rr() < 0.5;
          if (typeAt(lx, ly) === 2 && typeAt(lx + 2, ly) === 2) { set(lx, ly, WPA.leaf2); set(lx + 1, ly, WPA.leaf2); set(lx + 2, ly, WPA.leaf3); set(lx + 1, ly - 1, WPA.leaf2); if (fl) set(lx + 1, ly - 1, WPA.fP); }
        }
      });
    });
    for (const c of this.casters) {
      const rx = c.w * 0.42, cx = c.x - L.texShift[0] + rx * 0.3;
      if (cx + rx < x0 || cx - rx > x0 + CH || c.y - L.texShift[1] + c.w * 0.16 + 3 < y0 || c.y - L.texShift[1] - c.w * 0.16 - 3 > y0 + CH) continue;
      shade(buf, CH, x0, y0, CH, CH, c, L, inLegacy);
    }
    return buf;
  }

  private coarse(ci: number, cj: number, lod: number): Uint8ClampedArray {
    const L = this.L, lg = L.legacy, x0 = ci * CH * lod, y0 = cj * CH * lod, buf = new Uint8ClampedArray(CH * CH * 4);
    const lt = lg ? this.legacyTex() : null;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
      const tx = x0 + x * lod, ty = y0 + y * lod, o = (y * CH + x) * 4;
      if (lt && lg && tx >= lg.rect[0] && ty >= lg.rect[1] && tx < lg.rect[0] + lg.rect[2] && ty < lg.rect[1] + lg.rect[3]) { const j = ((ty - lg.rect[1]) * lg.rect[2] + (tx - lg.rect[0])) * 4; buf[o] = lt[j]; buf[o + 1] = lt[j + 1]; buf[o + 2] = lt[j + 2]; buf[o + 3] = lt[j + 3]; }
      else { const [c, t] = texel(L, tx, ty); buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = t; }
    }
    return buf;
  }
}

/** Pflanzen auf den Beeten wie in A (Gemüse, im zweiten Beet Salat). `ox`, `oy`: Dorf (0, 0) in Texeln. */
function crops(beds: number[][], ox: number, oy: number, set: (x: number, y: number, c: RGB) => void) {
  beds.forEach((b, i) => {
    for (let x = b[0] + 3; x < b[0] + b[2] - 2; x += 4) {
      const bx = x + ox, by = b[1] + 4 + oy;
      if (i === 1) { set(bx, by, WPA.leaf1); set(bx + 1, by, WPA.leaf2); set(bx, by + 1, WPA.leaf2); set(bx + 1, by + 1, WPA.leaf3); set(bx - 1, by, WPA.leaf3); set(bx + 2, by + 1, WPA.leaf3); }
      else { set(bx, by, WPA.leaf2); set(bx - 1, by - 1, WPA.leaf1); set(bx + 1, by - 1, WPA.leaf1); set(bx, by + 1, WPA.leaf3); }
    }
  });
}

/** Schatten eines festen Dings wie in A (Ellipse, 28 % dunkler) in einen Puffer, der die Texel (x0, y0) bis (x0 + w, y0 + h) abdeckt. */
function shade(buf: Uint8ClampedArray, bw: number, x0: number, y0: number, w: number, h: number, c: Caster, L: Look, skip?: (tx: number, ty: number) => boolean) {
  const rx = c.w * 0.42, ry = Math.max(2, c.w * 0.16), cx = c.x - L.texShift[0] + rx * 0.3, cy = c.y - L.texShift[1] + 0.5;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy > 1 || x < x0 || y < y0 || x >= x0 + w || y >= y0 + h || skip?.(x, y)) continue;
    const q = ((y - y0) * bw + (x - x0)) * 4;
    buf[q] *= 0.72; buf[q + 1] *= 0.72 * 1.02; buf[q + 2] *= 0.72 * 1.12;
  }
}
