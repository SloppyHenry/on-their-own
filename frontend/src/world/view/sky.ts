// Himmel, Sterne, Mond, ziehende Wolken und Hügel am Horizont wie in Mockup A; Farben aus der Stimmung, Bewölkung aus dem Wetter.
import { css, type Mood } from "../art/palette";
import { canvas, noise, rng } from "../art/pen";
import { horizon, type Viewport } from "./projection";

const COVER: Record<string, number> = { cloudy: 0.12, rain: 0.2, storm: 0.26, fog: 0.08, snow: 0.16 };

export class Sky {
  private clouds: HTMLCanvasElement | null = null;
  private hills: HTMLCanvasElement | null = null;
  private key = "";

  private rebuild(vp: Viewport, m: Mood, weather: string) {
    const night = m.stars > 0.5, cover = COVER[weather] ?? 0, ch = Math.round(vp.h * 0.2);
    const cl = canvas(vp.w * 2, ch), cg = cl.getContext("2d")!, img = cg.createImageData(cl.width, ch), d = img.data;
    const light = night ? [74, 82, 136] : m.stars > 0 ? [255, 255, 255].map((v, i) => v + ([74, 82, 136][i] - v) * m.stars) : [255, 255, 255];
    const shade = night ? [58, 64, 116] : m.skyBot.map((v, i) => v + ([58, 64, 116][i] - v) * m.stars);
    const sy = 200 / vp.h, sx = 320 / Math.max(320, vp.w);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cl.width; x++) {
      const yy = y * sy, xx = x * sx;
      const nv = noise(xx * 0.035, yy * 0.11, 8) * 0.7 + noise(xx * 0.09, yy * 0.25, 9) * 0.3 - Math.abs(yy - 14) / 30 + cover, o = (y * cl.width + x) * 4;
      if (nv <= 0.5) continue;
      const c = nv < 0.56 || yy > 17 ? shade : light;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 235;
    }
    cg.putImageData(img, 0, 0);
    const hl = canvas(vp.w, Math.ceil(vp.h * 0.35)), hg = hl.getContext("2d")!, hc = m.haze, hc2 = m.skyBot;
    for (let x = 0; x < vp.w; x++) {
      const yh = horizon(vp, x), k = 200 / vp.h, top1 = yh - (9 + 7 * noise(x * sx * 0.025, 0, 3)) / k, top2 = yh - (4 + 4 * noise(x * sx * 0.05, 1, 4)) / k;
      hg.fillStyle = css([hc[0] * 0.78 + hc2[0] * 0.1, hc[1] * 0.86 + hc2[1] * 0.08, hc[2] * 0.95]); hg.fillRect(x, Math.round(top1), 1, hl.height);
      hg.fillStyle = css([hc[0] * 0.62, hc[1] * 0.78, hc[2] * 0.8]); hg.fillRect(x, Math.round(top2), 1, hl.height);
    }
    this.clouds = cl;
    this.hills = hl;
  }

  /** Zeichnet den Hintergrund oberhalb des Bodens; `t` in Sekunden (Wolkenzug). */
  draw(g: CanvasRenderingContext2D, vp: Viewport, m: Mood, weather: string, t: number, minuteBucket: number) {
    const key = `${vp.w}x${vp.h}|${minuteBucket}|${weather}`;
    if (key !== this.key) { this.rebuild(vp, m, weather); this.key = key; }
    const skyH = Math.ceil(vp.h * 0.35), grad = g.createLinearGradient(0, 0, 0, vp.h * 0.3);
    grad.addColorStop(0, css(m.skyTop)); grad.addColorStop(1, css(m.skyBot));
    g.fillStyle = grad;
    g.fillRect(0, 0, vp.w, skyH);
    if (m.stars > 0.05) {
      const R = rng(3), k = vp.w / 320;
      g.globalAlpha = m.stars;
      for (let i = 0; i < 70 * k; i++) { g.fillStyle = R() < 0.2 ? "#fff6c8" : "#dfe6ff"; g.fillRect(Math.floor(R() * vp.w), Math.floor(R() * vp.h * 0.2), 1, 1); }
      const mx = vp.w * 0.78, my = vp.h * 0.07, r = vp.h * 0.03;
      g.fillStyle = "#fff4d6"; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill();
      g.fillStyle = css(m.skyTop); g.beginPath(); g.arc(mx + r * 0.5, my - r * 0.33, r * 0.92, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    const cl = this.clouds!, off = (t * 3) % cl.width;
    g.drawImage(cl, -off, Math.round(vp.h * 0.01)); g.drawImage(cl, cl.width - off, Math.round(vp.h * 0.01));
    g.drawImage(this.hills!, 0, 0);
  }
}
