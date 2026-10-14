// Ein Bild wie frame() in Mockup A: Himmel, Wolken, Hügel, Boden mit Dunst und Wasserglitzern, alle Dinge nach Tiefe sortiert,
// Rauch – im kleinen Puffer. Dann in ganzzahliger Vergrößerung S: Farbstimmung, Lichtschein, Tilt-Shift, Teilchen, Vignette.
// AP12a: Der Boden wird aus Blöcken gelesen (`Ground`) und bei bewegter Kamera in jedem Bild neu; Dinge stehen in Weltpixeln.
import { css, type Mood } from "../art/palette";
import { canvas, noise, rng } from "../art/pen";
import { WP } from "../art/palette";
import type { Target } from "../view/scene";
import { TH, frameFor, groundMap, horizonA, project, type Frame, type Mode, type P } from "./abbild";
import { CH, Ground, type Caster } from "./grund";
import type { Look } from "./look";

export interface Thing {
  /** Fußpunkt in Weltpixeln. */
  vx: number;
  vy: number;
  spr: HTMLCanvasElement;
  target?: Target;
  /** Boot schaukelt; Figuren werfen einen mitwandernden Schatten und tragen Werkzeug. */
  bob?: boolean;
  figure?: { lift: number; tool: HTMLCanvasElement | null; toolAngle: number; ring: string | null; zzz: boolean };
  hover?: HTMLCanvasElement | null;
  alpha?: number;
}
export interface Drawn { x: number; y: number; w: number; h: number; spr: HTMLCanvasElement; target?: Target }

const PARTS = (() => { const R = rng(21); return Array.from({ length: 26 }, () => ({ x: R(), y: R(), p: R() * 6.28, sp: 0.3 + R() * 0.6, c: R() })); })();
const MASK: [number, number][] = [[0, 1], [0.2, 0.85], [0.36, 0], [0.84, 0], [1, 0.75]];

/** Sprite in ganzen Pufferpixeln vergrößert oder verkleinert (wie drawImage im kleinen Puffer), gemerkt je Größe. */
let scaledCache = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>(), scaledCount = 0;
function scaled(src: HTMLCanvasElement, w: number, h: number, smooth: boolean): HTMLCanvasElement {
  if (w < 1 || h < 1 || (w === src.width && h === src.height)) return src;
  if (scaledCount > 6000) { scaledCache = new WeakMap(); scaledCount = 0; }
  let m = scaledCache.get(src);
  if (!m) { m = new Map(); scaledCache.set(src, m); }
  const key = (w * 4096 + h) * 2 + (smooth ? 1 : 0);
  let c = m.get(key);
  if (!c) {
    c = canvas(w, h);
    const x = c.getContext("2d")!;
    x.imageSmoothingEnabled = smooth; x.drawImage(src, 0, 0, w, h);
    m.set(key, c); scaledCount++;
  }
  return c;
}

export class Dorfbild {
  readonly ground: Ground;
  private f: Frame | null = null;
  private map: ReturnType<typeof groundMap> | null = null;
  private groundKey = "";
  private gimg: ImageData | null = null;
  private base: Uint8ClampedArray | null = null;
  private water: number[] = [];
  private skyKey = "";
  private skyC = canvas(1, 1);
  private clouds = canvas(1, 1);
  private hills = canvas(1, 1);
  private cam: [number, number];
  readonly low = canvas(1, 1);
  private groundC = canvas(1, 1);
  readonly out = canvas(1, 1);
  private tmp = canvas(1, 1);
  /** Dinge im kleinen Puffer (Stillstand); sonst stehen sie schon auf `out`. */
  private lowDone = true;
  /** Sichtbare Bodenblöcke als eine Fläche (siehe `area`). */
  private areaC: { key: string; tex: Uint8ClampedArray; w: number; x0: number; y0: number } | null = null;

  constructor(readonly look: Look) {
    this.ground = new Ground(look);
    this.cam = [look.home[0] - look.texShift[0], look.home[1] - look.texShift[1]];
  }

  get frame() { return this.f!; }

  /** Schatten wie in A: aus festen Dingen (Deko, Brunnen, Bank, Brett …) in den Boden gebacken. */
  setCasters(c: Caster[]) { if (this.ground.setCasters(c)) { this.groundKey = ""; this.areaC = null; } }

  /** Kamera: Boden am unteren Bildrand in der Mitte (Texelkoordinaten). */
  setCamera(x: number, y: number) { this.cam = [x, y]; if (this.f) { this.f.cx = x; this.f.cy = y; } }
  get camera(): [number, number] { return this.cam; }

  /** Puffergröße (lw × lh), Vergrößerung S (Gerätepixel je Pufferpixel), Ansicht, Herauszoomen (1, 2, 4) und Wölbung. */
  layout(mode: Mode, lw: number, lh: number, S: number, zo = 1, curve = 1) {
    const f = this.f;
    if (f && f.mode === mode && f.lw === lw && f.lh === lh && this.out.width === lw * S && f.zo === zo && f.curve === curve) { f.cx = this.cam[0]; f.cy = this.cam[1]; return; }
    const size = !f || f.lw !== lw || f.lh !== lh || this.out.width !== lw * S;
    this.f = frameFor(mode, lw, lh, this.look.texShift, this.cam, zo, curve);
    this.map = groundMap(this.f);
    if (size) {
      for (const c of [this.low, this.groundC]) { c.width = lw; c.height = lh; }
      this.out.width = lw * S; this.out.height = lh * S;
    }
    this.groundKey = ""; this.skyKey = "";
  }

  /** Boden für die aktuelle Kamera aus den Blöcken lesen (`soft` > 0: vier Texel gemischt, siehe Kamerafahrt). */
  private readGround(m: Mood, soft: number) {
    const f = this.f!, M = this.map!, G = this.ground, lod = f.zo, key = `${f.mode}|${f.lw}x${f.lh}|${lod}|${f.curve}|${f.cx.toFixed(4)},${f.cy.toFixed(4)}|${soft.toFixed(3)}|${m.haze.map(Math.round).join(",")}|${G.built}`;
    if (key === this.groundKey) return;
    this.groundKey = key;
    const img = new ImageData(f.lw, f.lh), d = img.data, haze = m.haze, y0 = f.cy - TH * f.zo, mix = lod > 1 ? 1 : soft;
    const A = this.area(lod, Math.floor((f.cx + M.ext[0]) / lod), Math.floor((y0 + M.ext[1]) / lod), Math.floor((f.cx + M.ext[2]) / lod) + 1, Math.floor((y0 + M.ext[3]) / lod) + 1);
    const tex = A.tex, AW = A.w, X0 = A.x0, Y0 = A.y0, row = AW * 4;
    this.water = [];
    for (let i = 0; i < f.lw * f.lh; i++) {
      if (M.sky[i]) continue;
      const o = i * 4, fx = (f.cx + M.ox[i]) / lod, fy = (y0 + M.oy[i]) / lod, tx = Math.floor(fx), ty = Math.floor(fy), fog = M.fog[i];
      const q = ((ty - Y0) * AW + (tx - X0)) * 4;
      let r = tex[q], g = tex[q + 1], b = tex[q + 2];
      if (mix > 0.003) {                                            // Fahrt: vier Texel gemischt
        const ax = fx - tx, ay = fy - ty, w1 = (1 - ax) * (1 - ay), w2 = ax * (1 - ay), w3 = (1 - ax) * ay, w4 = ax * ay, q3 = q + row;
        r += (r * w1 + tex[q + 4] * w2 + tex[q3] * w3 + tex[q3 + 4] * w4 - r) * mix;
        g += (g * w1 + tex[q + 5] * w2 + tex[q3 + 1] * w3 + tex[q3 + 5] * w4 - g) * mix;
        b += (b * w1 + tex[q + 6] * w2 + tex[q3 + 2] * w3 + tex[q3 + 6] * w4 - b) * mix;
      }
      if (tex[q + 3] === 2) this.water.push(o, tx * lod, ty * lod);
      d[o] = r + (haze[0] - r) * fog; d[o + 1] = g + (haze[1] - g) * fog; d[o + 2] = b + (haze[2] - b) * fog; d[o + 3] = 255;
    }
    this.gimg = img; this.base = new Uint8ClampedArray(d);
  }

  /** Die Bodenblöcke, die die Texel (tx0, ty0) bis (tx1, ty1) abdecken, als eine Fläche (neu nur, wenn andere Blöcke gebraucht werden). */
  private area(lod: number, tx0: number, ty0: number, tx1: number, ty1: number) {
    const a0 = tx0 >> 6, b0 = ty0 >> 6, a1 = tx1 >> 6, b1 = ty1 >> 6, key = `${lod}|${a0},${b0},${a1},${b1}`, A = this.areaC;
    if (A && A.key === key) return A;
    const w = (a1 - a0 + 1) * CH, h = (b1 - b0 + 1) * CH, tex = A && A.tex.length >= w * h * 4 ? A.tex : new Uint8ClampedArray(w * h * 4);
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      const c = this.ground.chunk(a, b, lod), x = (a - a0) * CH;
      for (let y = 0; y < CH; y++) tex.set(c.subarray(y * CH * 4, (y + 1) * CH * 4), (((b - b0) * CH + y) * w + x) * 4);
    }
    return (this.areaC = { key, tex, w, x0: a0 * CH, y0: b0 * CH });
  }

  private sky(m: Mood, key: string) {
    if (key === this.skyKey) return;
    this.skyKey = key;
    const f = this.f!, lw = f.lw, top = Math.max(0, f.yo), H = top + 70, night = m.stars > 0.5;
    this.skyC.width = lw; this.skyC.height = H;
    const sg = this.skyC.getContext("2d")!, grad = sg.createLinearGradient(0, top, 0, top + 60);
    grad.addColorStop(0, css(m.skyTop)); grad.addColorStop(1, css(m.skyBot));
    sg.fillStyle = grad; sg.fillRect(0, 0, lw, H);
    if (m.stars > 0.05) {
      const RS = rng(3);
      sg.globalAlpha = Math.min(1, m.stars);
      for (let i = 0; i < 70; i++) { sg.fillStyle = RS() < 0.2 ? "#fff6c8" : "#dfe6ff"; sg.fillRect(Math.floor(RS() * 320) + f.xo, Math.floor(RS() * 40) + f.yo, 1, 1); }
      const RX = rng(4);
      for (let i = 0; i < (70 * Math.max(0, lw - 320 + top * 2)) / 320; i++) { sg.fillStyle = RX() < 0.2 ? "#fff6c8" : "#dfe6ff"; const x = Math.floor(RX() * lw), y = Math.floor(RX() * (top + 40)); if (x < f.xo || x >= f.xo + 320 || y < f.yo) sg.fillRect(x, y, 1, 1); }
      sg.fillStyle = "#fff4d6"; sg.beginPath(); sg.arc(250 + f.xo, 14 + f.yo, 6, 0, 7); sg.fill();
      sg.fillStyle = css(m.skyTop); sg.beginPath(); sg.arc(253 + f.xo, 12 + f.yo, 5.5, 0, 7); sg.fill();
      sg.globalAlpha = 1;
    }
    this.hills.width = lw; this.hills.height = H;
    const hg = this.hills.getContext("2d")!, hc = m.haze, hc2 = m.skyBot;
    for (let x = 0; x < lw; x++) {
      const ax = x - f.xo, yh = horizonA(ax, f.curve) + f.yo, top1 = yh - 9 - 7 * noise(ax * 0.025, 0, 3), top2 = yh - 4 - 4 * noise(ax * 0.05, 1, 4);
      hg.fillStyle = css([hc[0] * 0.78 + hc2[0] * 0.1, hc[1] * 0.86 + hc2[1] * 0.08, hc[2] * 0.95]); hg.fillRect(x, Math.round(top1), 1, H);
      hg.fillStyle = css([hc[0] * 0.62, hc[1] * 0.78, hc[2] * 0.8]); hg.fillRect(x, Math.round(top2), 1, H);
    }
    const cw = Math.max(640, lw * 2);
    this.clouds.width = cw; this.clouds.height = 40;
    const cg = this.clouds.getContext("2d")!, ci = cg.createImageData(cw, 40), cd = ci.data;
    const c1 = night ? [74, 82, 136] : [255, 255, 255], c2 = night ? [58, 64, 116] : m.skyBot;
    for (let y = 0; y < 40; y++) for (let x = 0; x < cw; x++) {
      const nv = noise(x * 0.035, y * 0.11, 8) * 0.7 + noise(x * 0.09, y * 0.25, 9) * 0.3 - Math.abs(y - 14) / 30, o = (y * cw + x) * 4;
      if (nv <= 0.5) continue;
      const s = nv < 0.56 || y > 17 ? c2 : c1;
      cd[o] = s[0]; cd[o + 1] = s[1]; cd[o + 2] = s[2]; cd[o + 3] = 235;
    }
    cg.putImageData(ci, 0, 0);
  }

  p(wx: number, wy: number): P { return project(this.f!, wx, wy); }

  /** Kleiner Puffer: Himmel und Boden, dazu alle Dinge nach Tiefe sortiert und Rauch. Liefert, was gezeichnet wurde (für Klicks).
   *  `soft` > 0: Kamera fährt (Boden gemischt). Dann stehen die Dinge nicht im kleinen Puffer, sondern scharf und in ganzen Pufferpixeln groß
   *  auf der vergrößerten Fläche, verschoben in Gerätepixeln (S je Pufferpixel): Sie gleiten, ohne zu verschwimmen oder zu flackern.
   *  Im Stillstand alles im kleinen Puffer auf ganzen Pixeln, genau wie A. `smokes`: Schornsteine (Weltpixel). `over`: zuletzt darüber
   *  (Mitspieler-Vorschau), in Pufferkoordinaten. */
  drawLow(things: Thing[], m: Mood, tm: number, skyKey: string, smokes: [number, number][], soft = 0, S = 1, over?: (g: CanvasRenderingContext2D) => void): Drawn[] {
    const f = this.f!, lg = this.low.getContext("2d")!, drawn: Drawn[] = [];
    this.readGround(m, soft);
    const d = this.gimg!.data, base = this.base!;
    for (let k = 0; k < this.water.length; k += 3) {
      const oi = this.water[k], sh = Math.sin(this.water[k + 1] * 0.55 + tm * 2.1) * Math.sin(this.water[k + 2] * 1.25 - tm * 1.6);
      if (sh > 0.86) { d[oi] = 240; d[oi + 1] = 252; d[oi + 2] = 255; }
      else if (sh > 0.6) { d[oi] = Math.min(255, base[oi] + 26); d[oi + 1] = Math.min(255, base[oi + 1] + 22); d[oi + 2] = Math.min(255, base[oi + 2] + 12); }
      else { d[oi] = base[oi]; d[oi + 1] = base[oi + 1]; d[oi + 2] = base[oi + 2]; }
    }
    this.groundC.getContext("2d")!.putImageData(this.gimg!, 0, 0);
    lg.imageSmoothingEnabled = f.zo > 1;
    lg.clearRect(0, 0, f.lw, f.lh);
    if (f.mode === "tiefe") {
      this.sky(m, skyKey);
      lg.drawImage(this.skyC, 0, 0);
      const cw = this.clouds.width, off = (tm * 3) % cw;
      lg.drawImage(this.clouds, -off, 2 + f.yo); lg.drawImage(this.clouds, cw - off, 2 + f.yo);
      lg.drawImage(this.hills, 0, 0);
    }
    lg.drawImage(this.groundC, 0, 0);
    this.lowDone = soft === 0;
    let g = lg, snap = Math.round, spr = (c: HTMLCanvasElement, _w: number, _h: number) => c;
    if (soft > 0) {                                                 // Fahrt: weiter auf der vergrößerten Fläche
      const C = this.out, oc = C.getContext("2d")!, smooth = f.zo > 1;
      oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalCompositeOperation = "source-over"; oc.globalAlpha = 1; oc.imageSmoothingEnabled = false;
      oc.drawImage(this.low, 0, 0, C.width, C.height);
      oc.setTransform(S, 0, 0, S, 0, 0);
      g = oc;
      snap = (v: number) => { const r = Math.round(v); return Math.round((r + (v - r) * soft) * S) / S; };   // gleitet beim Anhalten auf ganze Pixel
      spr = (c, w, h) => scaled(c, w, h, smooth);
    }
    const beyond = (on: boolean) => {                              // hinter dem Horizont: nur zeichnen, was über der Horizontlinie ist
      if (!on) { g.restore(); return; }
      g.save(); g.beginPath(); g.moveTo(-60, -60);
      for (let x = -60; x <= f.lw + 60; x += 2) g.lineTo(x, horizonA(x - f.xo, f.curve) + f.yo);
      g.lineTo(f.lw + 60, -60); g.closePath(); g.clip();
    };
    for (const t of [...things].sort((a, b) => a.vy - b.vy)) {
      const pr = this.p(t.vx, t.vy), far = f.mode === "tiefe" && pr.t > 1;
      if (pr.x < -60 || pr.x > f.lw + 60 || pr.y < 0 || pr.y - t.spr.height * pr.sc > f.lh) continue;
      if (far && pr.y - t.spr.height * pr.sc >= horizonA(pr.x - f.xo, f.curve) + f.yo) continue;     // ganz versunken
      if (far) beyond(true);
      const fig = t.figure;
      if (fig) {                                                    // Schatten wie in A, mitwandernd
        g.globalCompositeOperation = "multiply"; g.fillStyle = "rgb(184,188,206)";
        const rx = t.spr.width * 0.42 * pr.sc, ry = Math.max(2, t.spr.width * 0.16) * pr.sc;
        g.beginPath(); g.ellipse(snap(pr.x + rx * 0.3), snap(pr.y), rx, ry, 0, 0, 7); g.fill();
        g.globalCompositeOperation = "source-over";
        if (fig.ring) { g.strokeStyle = fig.ring; g.lineWidth = 1; g.globalAlpha = 0.55 + Math.sin(tm * 3) * 0.25; g.beginPath(); g.ellipse(snap(pr.x) + 0.5, snap(pr.y) + 0.5, 9 * pr.sc, 3.5 * pr.sc, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
      }
      const sw = t.spr.width * pr.sc, sh = t.spr.height * pr.sc, bob = t.bob ? Math.sin(tm * 1.8) * 0.8 * pr.sc : 0, lift = (fig?.lift ?? 0) * pr.sc;
      const w = Math.round(sw), h = Math.round(sh), dx = snap(pr.x - sw / 2), dy = snap(pr.y - sh + bob - lift);
      if (t.hover) { g.globalAlpha = 0.9; const hv = spr(t.hover, w, h); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(hv, dx + ox, dy + oy, w, h); }
      g.globalAlpha = t.alpha ?? 1;
      g.drawImage(spr(t.spr, w, h), dx, dy, w, h);
      g.globalAlpha = 1;
      drawn.push({ x: dx, y: dy, w, h, spr: t.spr, target: t.target });
      if (fig?.tool) {
        g.save(); g.translate(snap(pr.x + 6 * pr.sc), snap(pr.y - (9 + (fig.lift ?? 0)) * pr.sc)); g.rotate(fig.toolAngle);
        const tw = Math.round(8 * pr.sc);
        g.drawImage(spr(fig.tool, tw, tw), Math.round(-2 * pr.sc), Math.round(-6 * pr.sc), tw, tw); g.restore();
      }
      if (fig?.zzz) { g.fillStyle = "#fff8ec"; g.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(tm * 2)); g.fillRect(snap(pr.x + 5 * pr.sc), snap(pr.y - 26 * pr.sc - ((tm * 4) % 3)), 3, 1); g.globalAlpha = 1; }
      if (far) beyond(false);
    }
    for (const [sx0, sy0] of smokes) {
      const ch = this.p(sx0, sy0), far = f.mode === "tiefe" && ch.t > 1;
      if (ch.x < -60 || ch.x > f.lw + 60) continue;
      if (far) beyond(true);
      for (let k = 0; k < 5; k++) {
        const age = (tm * 0.35 + k / 5) % 1, sx = ch.x + (Math.sin(age * 5 + k) * 3 + age * 8) * ch.sc, sy = ch.y - (78 + age * 26) * ch.sc, rad = (1.5 + age * 3.5) * ch.sc;
        g.globalAlpha = (1 - age) * 0.75; g.fillStyle = m.stars > 0.5 ? "#8a90b8" : "#f4f1ec";
        g.fillRect(snap(sx - rad), snap(sy - rad), Math.round(rad * 2), Math.round(rad * 2));
      }
      if (far) beyond(false);
    }
    g.globalAlpha = 1;
    over?.(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return drawn;
  }

  /** Nachbearbeitung wie in A auf der ganzzahlig vergrößerten Fläche (S Gerätepixel je Pufferpixel). */
  post(m: Mood, tm: number, S: number, lights: number[][], effects: { tilt: boolean; particles: boolean; daytime: string }) {
    const f = this.f!, C = this.out, ctx = C.getContext("2d")!, q = S / 4;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    if (this.lowDone) ctx.drawImage(this.low, 0, 0, C.width, C.height);      // beim Fahren schon in drawLow übertragen
    if (m.grade.some((c) => c < 254.5)) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = css(m.grade); ctx.fillRect(0, 0, C.width, C.height); }
    if (m.glowA > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      for (const L of lights) {
        const lp = this.p(L[0], L[1]);
        if (f.mode === "tiefe" && lp.t > 1) continue;                // hinter dem Horizont
        const gx = lp.x * S, gy = (lp.y - L[2] * lp.sc) * S, gr = (f.mode === "flach" ? 46 : 58 * lp.sc) * L[3] * q;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        rg.addColorStop(0, `rgba(255,205,120,${m.glowA})`); rg.addColorStop(0.35, `rgba(255,170,90,${m.glowA * 0.4})`); rg.addColorStop(1, "rgba(255,150,80,0)");
        ctx.fillStyle = rg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    if (effects.tilt && f.mode === "tiefe") {                    // Tilt-Shift: Unschärfe 5 px (bei A-Größe), Verlaufsmaske wie in A
      const T = this.tmp, half = 2;
      T.width = Math.ceil(C.width / half); T.height = Math.ceil(C.height / half);
      const tg = T.getContext("2d")!;
      tg.clearRect(0, 0, T.width, T.height);
      tg.filter = `blur(${(5 * q) / half}px)`; tg.drawImage(C, 0, 0, T.width, T.height); tg.filter = "none";
      tg.globalCompositeOperation = "destination-in";
      const y0 = f.yo * 4 * q / half, hA = (200 * 4 * q) / half, mg = tg.createLinearGradient(0, y0, 0, y0 + hA);
      for (const [s, a] of MASK) mg.addColorStop(s, `rgba(0,0,0,${a})`);
      tg.fillStyle = mg; tg.fillRect(0, 0, T.width, T.height);
      tg.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true; ctx.drawImage(T, 0, 0, C.width, C.height); ctx.imageSmoothingEnabled = false;
    }
    if (effects.particles) {
      const Wc = f.lw * 4, top = f.yo * 4, B = S;
      for (let k = 0; k < PARTS.length; k++) {
        const pa = PARTS[k], px = (((pa.x * Wc + Math.sin(tm * pa.sp + pa.p) * 30 + tm * 6) % Wc) + Wc) % Wc, py = top + 200 + pa.y * (800 - 240) + Math.cos(tm * pa.sp * 1.3 + pa.p) * 18;
        const bx = Math.round(px / 4) * B, by = Math.round(py / 4) * B;
        if (m.stars > 0.5) { const fa = 0.5 + 0.5 * Math.sin(tm * 2 + pa.p * 3); ctx.fillStyle = `rgba(214,255,140,${fa})`; ctx.fillRect(bx, by, B, B); ctx.fillStyle = `rgba(214,255,140,${fa * 0.25})`; ctx.fillRect(bx - B, by - B, 3 * B, 3 * B); }
        else if (effects.daytime === "Abend") { ctx.fillStyle = pa.c < 0.5 ? "#ffc2d6" : "#fff0f5"; ctx.fillRect(bx, by, B, B); }
        else if (k < 6) { const wing = Math.sin(tm * 14 + pa.p) > 0; ctx.fillStyle = pa.c < 0.5 ? "#ffffff" : "#ffd94f"; ctx.fillRect(bx - B, by, B, wing ? B : B / 2); ctx.fillRect(bx + B, by, B, wing ? B : B / 2); ctx.fillStyle = WP.outline; ctx.fillRect(bx, by, B, B); }
      }
    }
    const vg = ctx.createRadialGradient(C.width / 2, C.height * 0.55, C.height * 0.45, C.width / 2, C.height * 0.55, C.height * 0.95);
    vg.addColorStop(0, "rgba(30,20,40,0)"); vg.addColorStop(1, m.stars > 0.5 ? "rgba(5,8,25,0.55)" : "rgba(40,25,40,0.28)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, C.width, C.height);
  }
}
