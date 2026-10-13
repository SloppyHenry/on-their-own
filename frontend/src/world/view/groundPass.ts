// Boden je Bildpixel: Rückprojektion (dieselbe Formel wie projection.ts), Texel aus den Bodenblöcken, Wasserglitzern, Dunst.
// Bei kleinem Puffer (Mockup: 320 × 200) kostet das unter einer Millisekunde; gröbere Blockstufen für weite Ansichten.
import type { Mood } from "../art/palette";
import { B, FALLBACK, Ty, type Block, type Ground } from "./ground";
import type { GroundData } from "./groundData";
import { rayTable, type Camera, type Viewport } from "./projection";

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
    const px = new Uint32Array(this.img.data.buffer), depth = cam.mode === "tiefe", z = cam.zoom, hz = mood.haze, end = performance.now() + budgetMs;
    const rt = depth ? rayTable(cam, vp) : null;
    let lastKey = -1, last: Block | null = null;
    const bldW = data.w, fl = 1 / z, Lf = fl > 3.5 ? 2 : fl > 1.75 ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = y * W + x;
      let wx: number, wy: number, L = Lf, fog = 0;
      if (rt) {
        if (rt.sky[o]) { px[o] = 0; continue; }
        wx = cam.fx + rt.dx[o]; wy = cam.fy + rt.dy[o]; L = rt.lvl[o]; fog = rt.fog[o];
      } else { wx = cam.fx + (x + 0.5 - W / 2) * fl; wy = cam.fy + (y + 0.5 - H / 2) * fl; }
      const ix = Math.floor(wx) >> L, iy = Math.floor(wy) >> L, bx = ix >> 7, by = iy >> 7;
      const key = ((L * 8192 + (bx + 4096)) * 8192) + (by + 4096);
      if (key !== lastKey) {
        last = ground.block(L, bx, by, false) ?? (performance.now() < end ? ground.block(L, bx, by, true) : null);
        lastKey = key;
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
      if (fog > 0) { r += (hz[0] - r) * fog; g += (hz[1] - g) * fog; b += (hz[2] - b) * fog; }
      c = (255 << 24) | (b << 16) | (g << 8) | r;
      px[o] = c;
    }
    this.out.getContext("2d")!.putImageData(this.img, 0, 0);
    return this.out;
  }
}
