// Boden je Bildpixel: Rückprojektion (dieselbe Formel wie projection.ts), Texel aus den Bodenblöcken, Wasserglitzern, Dunst.
// Bei kleinem Puffer (Mockup: 320 × 200) kostet das unter einer Millisekunde; gröbere Blockstufen für weite Ansichten.
import type { Mood } from "../art/palette";
import { B, FALLBACK, Ty, type Block, type Ground } from "./ground";
import type { GroundData } from "./groundData";
import { bottomY, depthSpan, GAMMA, horizon, type Camera, type Viewport } from "./projection";

const LUT_N = 4096, LUT = new Float32Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) LUT[i] = Math.pow(i / LUT_N, GAMMA);
const FOG = new Float32Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) FOG[i] = Math.pow(i / LUT_N, 2.2) * 0.55;

export class GroundPass {
  private img: ImageData | null = null;
  private out: HTMLCanvasElement;

  constructor() {
    this.out = document.createElement("canvas");
  }

  /** Zeichnet den Boden in eine eigene Fläche (oberhalb des Horizonts durchsichtig) und gibt sie zurück. */
  render(ground: Ground, data: GroundData, cam: Camera, vp: Viewport, mood: Mood, tm: number, interior: number, budgetMs: number): HTMLCanvasElement {
    const W = vp.w, H = vp.h;
    if (!this.img || this.img.width !== W || this.img.height !== H) {
      this.out.width = W; this.out.height = H;
      this.img = this.out.getContext("2d")!.createImageData(W, H);
    }
    const px = new Uint32Array(this.img.data.buffer), depth = cam.mode === "tiefe", z = cam.zoom;
    const yb = bottomY(cam, vp), D = depthSpan(cam, vp), hz = mood.haze, end = performance.now() + budgetMs;
    const yh = new Float32Array(W);
    for (let x = 0; x < W; x++) yh[x] = horizon(vp, x + 0.5);
    let lastKey = -1, last: Block | null = null, lastL = -1;
    const bldW = data.w;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = y * W + x;
      let t = 0, s: number, wy: number;
      if (depth) {
        t = (H - y - 0.5) / (H - yh[x]);
        if (t > 1) { px[o] = 0; continue; }
        const ft = t >= 0 ? LUT[(t * LUT_N) | 0] : -Math.pow(-t, GAMMA);
        s = (0.62 + 0.9 * Math.max(0, t)) / z;
        wy = yb - D * ft;
      } else { s = 1 / z; wy = cam.fy + (y + 0.5 - H / 2) * s; }
      const wx = cam.fx + (x + 0.5 - W / 2) * s;
      const L = s > 3.5 ? 2 : s > 1.75 ? 1 : 0, ix = Math.floor(wx) >> L, iy = Math.floor(wy) >> L, bx = ix >> 7, by = iy >> 7;
      const key = ((L * 8192 + (bx + 4096)) * 8192) + (by + 4096);
      if (key !== lastKey || L !== lastL) {
        last = ground.block(L, bx, by, false) ?? (performance.now() < end ? ground.block(L, bx, by, true) : null);
        lastKey = key; lastL = L;
      }
      const q = (iy - by * B) * B + (ix - bx * B);
      let c = last ? last.px[q] : FALLBACK;
      let r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      if (last && last.ty[q] === Ty.Water) {
        const fx = Math.floor(wx), fy = Math.floor(wy), sh = Math.sin(fx * 0.55 + tm * 2.1) * Math.sin(fy * 1.25 - tm * 1.6);
        if (sh > 0.86) { r = 240; g = 252; b = 255; } else if (sh > 0.6) { r = Math.min(255, r + 26); g = Math.min(255, g + 22); b = Math.min(255, b + 12); }
      }
      if (interior >= 0) {
        const tx = Math.floor(wx / 16), ty = Math.floor(wy / 16);
        if (tx < 0 || ty < 0 || tx >= bldW || ty >= data.h || data.bld[ty * bldW + tx] !== interior) { r = r * 0.22 + 14; g = g * 0.22 + 10; b = b * 0.22 + 22; }
      }
      if (depth && t > 0) { const f = FOG[(t * LUT_N) | 0]; r += (hz[0] - r) * f; g += (hz[1] - g) * f; b += (hz[2] - b) * f; }
      c = (255 << 24) | (b << 16) | (g << 8) | r;
      px[o] = c;
    }
    this.out.getContext("2d")!.putImageData(this.img, 0, 0);
    return this.out;
  }
}
