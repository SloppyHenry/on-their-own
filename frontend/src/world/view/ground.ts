// Bodentextur wie wTexel in Mockup A, aber aus dem Kachelraster: weiche Ufer mit Schaum, Wege mit dunklem Saum, Pflaster mit Rand,
// heller Garten, Beete, Steg, Grasbüschel, Blumen und Schatten. Erzeugt in Blöcken (auch in gröberen Stufen für weite Ansichten).
import { WPA } from "../art/palette";
import { hash, noise, rng, type RGB } from "../art/pen";
import { GroundData, K, S, T } from "./groundData";

export const enum Ty { Grass = 0, Path = 1, Water = 2, Cobble = 3, Soil = 4, Wood = 5, Shore = 6, Wild = 7, Floor = 8, Wall = 9 }
export const B = 128;                                   // Texel je Blockkante
export interface Caster { x: number; y: number; w: number }  // Schattenwerfer: Fußpunkt und Breite des Sprites (Weltpixel)
export interface Block { px: Uint32Array; ty: Uint8Array }

const pack = (c: RGB) => (255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
export const FALLBACK = pack(WPA.grass2);
const C = (r: number, g: number, b: number): RGB => [r, g, b];
const FLOOR = { tileA: C(233, 226, 211), tileB: C(207, 199, 184), ws1: C(110, 80, 56), ws2: C(140, 106, 76), ws3: C(128, 96, 74), plank2: C(195, 134, 79), wallTop: C(139, 109, 85), rugA: C(196, 80, 90), rugB: C(168, 64, 76), rugEdge: C(242, 210, 138) };

export class Ground {
  private blocks = new Map<string, Block>();
  private casters = new Map<string, Caster[]>();         // je Block der Stufe 0
  private interior = -1;

  constructor(private g: GroundData, private yards: { x: number; y: number }[]) {}

  /** Innenansicht eines Gebäudes (Index in g.buildings) oder -1 für draußen. */
  setInterior(i: number) { this.interior = i; }

  setCasters(list: Caster[]) {
    const next = new Map<string, Caster[]>();
    for (const c of list) {
      const rx = c.w * 0.42, x0 = Math.floor((c.x - rx) / B), x1 = Math.floor((c.x + rx * 1.3) / B), y0 = Math.floor((c.y - 8) / B), y1 = Math.floor((c.y + 8) / B);
      for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) { const k = `${bx},${by}`; (next.get(k) ?? next.set(k, []).get(k)!).push(c); }
    }
    const sig = (a?: Caster[]) => (a ?? []).map((c) => `${c.x},${c.y},${c.w}`).sort().join(";");
    const dirty = new Set<string>();
    for (const k of new Set([...next.keys(), ...this.casters.keys()])) if (sig(next.get(k)) !== sig(this.casters.get(k))) dirty.add(k);
    this.casters = next;
    if (!dirty.size) return;
    for (const key of [...this.blocks.keys()]) {
      const [L, bx, by] = key.split(":").map(Number), s = 1 << L;
      for (const d of dirty) { const [dx, dy] = d.split(",").map(Number); if (Math.floor((dx * B) / (B * s)) === bx && Math.floor((dy * B) / (B * s)) === by) { this.blocks.delete(key); break; } }
    }
  }

  private inInterior(bx: number, by: number, L: number) {
    if (this.interior < 0) return false;
    const b = this.g.buildings[this.interior]?.bbox, s = B << L;
    return !!b && (b.x1 + 1) * T > bx * s && b.x0 * T < (bx + 1) * s && (b.y1 + 1) * T > by * s && b.y0 * T < (by + 1) * s;
  }

  /** Block der Stufe L (0 = voll, 1 = halbe, 2 = viertel Auflösung); `make=false` liefert nur Fertiges. */
  block(L: number, bx: number, by: number, make: boolean): Block | null {
    const key = `${L}:${bx}:${by}:${this.inInterior(bx, by, L) ? this.interior : "-"}`;
    let b = this.blocks.get(key);
    if (!b && make) { b = this.build(L, bx, by); this.blocks.set(key, b); if (this.blocks.size > 900) this.blocks.delete(this.blocks.keys().next().value!); }
    return b ?? null;
  }

  private build(L: number, bx: number, by: number): Block {
    const px = new Uint32Array(B * B), ty = new Uint8Array(B * B), s = 1 << L, ox = bx * B * s, oy = by * B * s;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
      const [c, t] = this.texel(ox + i * s, oy + j * s), q = j * B + i;
      px[q] = pack(c); ty[q] = t;
    }
    const set = (i: number, j: number, c: RGB) => { if (i >= 0 && j >= 0 && i < B && j < B) px[j * B + i] = pack(c); };
    const typeAt = (i: number, j: number) => (i >= 0 && j >= 0 && i < B && j < B ? ty[j * B + i] : 255);
    if (L === 0) {                                                  // Grasbüschel und Blumen wie im Mockup (gleiche Dichte)
      const R = rng(((bx * 73856093) ^ (by * 19349663)) >>> 0);
      for (let n = 0; n < 207; n++) {
        const i = Math.floor(R() * B), j = Math.floor(R() * B), t0 = typeAt(i, j);
        if (t0 === Ty.Grass || t0 === Ty.Wild) { const dk = t0 === Ty.Wild ? WPA.wild3 : WPA.grassDark; set(i, j - 1, dk); set(i - 1, j, dk); set(i + 1, j, dk); }
      }
      const FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
      for (let n = 0; n < 38; n++) {
        const fx = Math.floor(R() * B), fy = Math.floor(R() * B), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
        for (let k = 0; k < n2; k++) {
          const a = fx + Math.round((R() - 0.5) * 9), b = fy + Math.round((R() - 0.5) * 7);
          if (typeAt(a, b) !== Ty.Grass) continue;
          if (big) { set(a - 1, b, fc); set(a + 1, b, fc); set(a, b - 1, fc); set(a, b + 1, fc); set(a, b, WPA.fY); } else set(a, b, fc);
        }
      }
    }
    const seen = new Set<Caster>();                                 // Schatten wie im Mockup: Ellipse rechts versetzt, bläulich abgedunkelt
    for (let cy = Math.floor(oy / B); cy <= Math.floor((oy + B * s - 1) / B); cy++) for (let cx = Math.floor(ox / B); cx <= Math.floor((ox + B * s - 1) / B); cx++) {
      for (const c of this.casters.get(`${cx},${cy}`) ?? []) {
        if (seen.has(c)) continue;
        seen.add(c);
        const rx = c.w * 0.42, ry = Math.max(2, c.w * 0.16), x0 = c.x + rx * 0.3, y0 = c.y + 0.5;
        for (let y = Math.floor((y0 - ry - oy) / s); y <= (y0 + ry - oy) / s; y++) for (let x = Math.floor((x0 - rx - ox) / s); x <= (x0 + rx - ox) / s; x++) {
          if (x < 0 || y < 0 || x >= B || y >= B) continue;
          const dx = (ox + (x + 0.5) * s - x0) / rx, dy = (oy + (y + 0.5) * s - y0) / ry;
          if (dx * dx + dy * dy > 1 || ty[y * B + x] === Ty.Water) continue;
          const q = y * B + x, v = px[q], r = v & 255, gg = (v >> 8) & 255, bb = (v >> 16) & 255;
          px[q] = (255 << 24) | (Math.min(255, bb * 0.72 * 1.12) << 16) | (Math.min(255, gg * 0.72 * 1.02) << 8) | (r * 0.72);
        }
      }
    }
    return { px, ty };
  }

  /** Ein Bodenpixel an Weltpixel (wx, wy). */
  texel(wx: number, wy: number): [RGB, Ty] {
    const g = this.g, n = noise(wx * 0.13, wy * 0.13, 1), h = hash(wx, wy, 2), gg = n * 0.75 + h * 0.25;
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T), i = g.idx(tx, ty), raw = g.k(tx, ty), bi = i >= 0 ? g.bld[i] : -1;
    if (bi >= 0 && bi === this.interior) return this.floor(wx, wy, i, raw, h);
    const qx = wx + (noise(wx * 0.07, wy * 0.07, 21) - 0.5) * 12, qy = wy + (noise(wx * 0.07, wy * 0.07, 22) - 0.5) * 12;
    const kAt = (x: number, y: number) => { const a = Math.floor(x / T), b = Math.floor(y / T), j = g.idx(a, b); return j >= 0 && g.bld[j] >= 0 ? K.Grass : g.k(a, b); };
    const sAt = (x: number, y: number) => { const j = g.idx(Math.floor(x / T), Math.floor(y / T)); return j >= 0 && g.bld[j] < 0 ? g.style[j] : S.None; };
    const qk = kAt(qx, qy);
    if (raw === K.Floor && bi < 0) {                                // Steg: freistehender Boden
      const lx = ((wx % T) + T) % T, ly = ((wy % T) + T) % T;
      return [lx % 4 === 3 ? WPA.wood3 : ly === 0 || ly === 15 ? WPA.wood2 : h < 0.5 ? WPA.wood1 : WPA.wood2, Ty.Wood];
    }
    if (raw === K.Tree && qk === K.Tree) return [gg < 0.36 ? WPA.wild3 : gg < 0.66 ? WPA.wild2 : WPA.wild1, Ty.Wild];
    if (raw === K.Other && bi < 0) { const c = g.other.get(i)!; return [[c[0] * (0.92 + h * 0.12), c[1] * (0.92 + h * 0.12), c[2] * (0.92 + h * 0.12)], Ty.Grass]; }
    let col = gg < 0.32 ? WPA.grass3 : gg < 0.64 ? WPA.grass2 : WPA.grass1;
    if ((wx + wy * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
    if (qk === K.Water) { const lv = g.shore(qx, qy); return [lv < 0.12 ? WPA.foam : lv < 0.6 ? WPA.water1 : lv < 1.3 ? WPA.water2 : lv < 2.4 ? WPA.water3 : WPA.waterDeep, Ty.Water]; }
    if (qk === K.Sand) return [h < 0.5 ? WPA.path1 : WPA.path2, Ty.Shore];
    if (sAt(qx, qy) === S.Cobble) {
      const ring = [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([a, b]) => sAt(qx + a, qy + b) !== S.Cobble);
      if (ring) return [WPA.stone3, Ty.Cobble];
      const row = Math.floor(wy / 4), off = row & 1 ? 2 : 0, cx = Math.floor((wx + off) / 5), m4 = ((wy % 4) + 4) % 4, m5 = (((wx + off) % 5) + 5) % 5;
      if (m4 === 0 || m5 === 0) return [WPA.cob3, Ty.Cobble];
      if (m4 === 1 && m5 === 1) return [WPA.cobHi, Ty.Cobble];
      return [hash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1, Ty.Cobble];
    }
    if (qk === K.Path || qk === K.Door) return [noise(wx * 0.3, wy * 0.3, 4) < 0.45 ? WPA.path2 : h > 0.965 ? WPA.pebble : WPA.path1, Ty.Path];
    let type = Ty.Grass;
    if ([[3, 0], [-3, 0], [0, 3], [0, -3]].some(([a, b]) => kAt(qx + a, qy + b) === K.Path)) col = WPA.grassDark;
    const st = i >= 0 && bi < 0 ? g.style[i] : S.None;
    if (st === S.Garden && col !== WPA.grassDark) col = gg < 0.5 ? WPA.grass1 : WPA.grassLight;
    if (i >= 0 && g.seedbed[i]) {
      const lx = ((wx % T) + T) % T, ly = ((wy % T) + T) % T;
      if (lx >= 1 && lx < 15 && ly >= 3 && ly < 14) { type = Ty.Soil; col = (ly - 3) % 3 === 0 ? WPA.soil2 : WPA.soil1; if (lx === 1 || lx === 14 || ly === 13) col = WPA.wood3; }
    }
    for (const y of this.yards) if (Math.abs(wx - y.x) < 36 && wy >= y.y - 30 && wy < y.y) { col = WPA.path3; type = Ty.Path; }
    return [col, type];
  }

  /** Innenansicht: Böden je Raumstil, Teppich, Mauerkronen, Türschwellen. */
  private floor(wx: number, wy: number, i: number, k: K, h: number): [RGB, Ty] {
    const g = this.g;
    if (k === K.Wall) return [FLOOR.wallTop, Ty.Wall];
    if (g.rug[i]) {
      const lx = ((wx % T) + T) % T, ly = ((wy % T) + T) % T, x = i % g.w, y = (i / g.w) | 0;
      const edge = (!g.rug[i - 1] && lx < 2) || (!g.rug[i + 1] && lx > 13) || (!g.rug[i - g.w] && ly < 2) || (!g.rug[i + g.w] && ly > 13);
      if (edge) return [FLOOR.rugEdge, Ty.Floor];
      return [(wx + wy + x + y) % 6 < 3 ? FLOOR.rugA : FLOOR.rugB, Ty.Floor];
    }
    const st = g.style[i];
    if (st === S.Tile) return [(Math.floor(wx / 8) + Math.floor(wy / 8)) & 1 ? FLOOR.tileA : FLOOR.tileB, Ty.Floor];
    if (st === S.Workshop) return [((wy % 5) + 5) % 5 === 0 ? FLOOR.ws1 : h < 0.5 ? FLOOR.ws2 : FLOOR.ws3, Ty.Floor];
    if (((wy % 4) + 4) % 4 === 0) return [WPA.wood3, Ty.Floor];
    return [Math.floor(wx / 12 + Math.floor(wy / 4) * 0.5) & 1 ? WPA.wood1 : FLOOR.plank2, Ty.Floor];
  }
}
