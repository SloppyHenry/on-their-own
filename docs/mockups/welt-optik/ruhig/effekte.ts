// Mockup „Ruhige Ansicht“: Effekte aus Mockup A (eSky, ePost in echt.js) – Himmel mit Wolken, Sternen, Mond und Hügeln,
// Teilchen (Schmetterlinge, Blütenblätter, Glühwürmchen), Vignette, Tilt-Shift. Alles hängt an der Welt bzw. steht still im Bild;
// nichts wird pro Bild neu abgetastet. Kein Produktionscode.
import { WP, css, type Mood } from "../../../../frontend/src/world/art/palette";
import { canvas, noise, rng } from "../../../../frontend/src/world/art/pen";

export class Himmel {
  private clouds = canvas(1, 1);
  private key = "";

  private build(W: number, H: number, m: Mood) {
    const night = m.stars > 0.5, u = H / 200, ch = Math.round(42 * u), cl = canvas(W * 2, ch), cg = cl.getContext("2d")!, img = cg.createImageData(cl.width, ch), d = img.data;
    const light = night ? [74, 82, 136] : [255, 255, 255], shade = night ? [58, 64, 116] : m.skyBot;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cl.width; x++) {
      const yy = y / u, xx = x / u, nv = noise(xx * 0.035, yy * 0.11, 8) * 0.7 + noise(xx * 0.09, yy * 0.25, 9) * 0.3 - Math.abs(yy - 14) / 30, o = (y * cl.width + x) * 4;
      if (nv <= 0.5) continue;
      const c = nv < 0.56 || yy > 17 ? shade : light;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 235;
    }
    cg.putImageData(img, 0, 0);
    this.clouds = cl;
  }

  /** Himmel bis zum Horizont yH; `pan` = Kameraversatz in Pixeln (Wolken und Hügel ziehen langsamer mit). */
  draw(g: CanvasRenderingContext2D, W: number, H: number, yH: number, m: Mood, zeit: string, t: number, pan: number) {
    const key = `${W}x${H}|${zeit}`;
    if (key !== this.key) { this.build(W, H, m); this.key = key; }
    const u = H / 200, grad = g.createLinearGradient(0, 0, 0, yH);
    grad.addColorStop(0, css(m.skyTop)); grad.addColorStop(1, css(m.skyBot));
    g.fillStyle = grad; g.fillRect(0, 0, W, yH + 2);
    if (m.stars > 0.05) {
      const R = rng(3);
      g.globalAlpha = m.stars;
      for (let i = 0; i < (70 * W) / (320 * u); i++) { g.fillStyle = R() < 0.2 ? "#fff6c8" : "#dfe6ff"; g.fillRect(Math.floor(R() * W), Math.floor(R() * yH * 0.8), Math.ceil(u), Math.ceil(u)); }
      const mx = W * 0.78, my = H * 0.07, r = H * 0.03;
      g.fillStyle = "#fff4d6"; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill();
      g.fillStyle = css(m.skyTop); g.beginPath(); g.arc(mx + r * 0.5, my - r * 0.33, r * 0.92, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    const cw = this.clouds.width, off = (((t * 3 * u + pan * 0.08) % cw) + cw) % cw;
    g.drawImage(this.clouds, -off, Math.round(2 * u)); g.drawImage(this.clouds, cw - off, Math.round(2 * u));
    const hc = m.haze, hc2 = m.skyBot, c1 = css([hc[0] * 0.78 + hc2[0] * 0.1, hc[1] * 0.86 + hc2[1] * 0.08, hc[2] * 0.95]), c2 = css([hc[0] * 0.62, hc[1] * 0.78, hc[2] * 0.8]);
    const step = Math.max(1, Math.round(u));
    for (let x = 0; x < W; x += step) {
      const xx = (x + pan * 0.25) / u;
      g.fillStyle = c1; g.fillRect(x, Math.round(yH - (9 + 7 * noise(xx * 0.025, 0, 3)) * u), step, Math.round(20 * u));
      g.fillStyle = c2; g.fillRect(x, Math.round(yH - (4 + 4 * noise(xx * 0.05, 1, 4)) * u), step, Math.round(20 * u));
    }
  }
}

interface Teil { x: number; y: number; p: number; sp: number; c: number }
const TEILE: Teil[] = (() => { const R = rng(21); return Array.from({ length: 26 }, () => ({ x: R(), y: R(), p: R() * 6.28, sp: 0.3 + R() * 0.6, c: R() })); })();

/** Teilchen wie in Mockup A: tags Schmetterlinge, abends Blütenblätter, nachts Glühwürmchen. Ein Block = ein Weltpixel (z). */
export function teilchen(g: CanvasRenderingContext2D, W: number, H: number, yTop: number, m: Mood, zeit: string, t: number, panX: number, panY: number, z: number, dpr: number) {
  const top = yTop + 20 * dpr, span = H - top - 40 * dpr;
  if (span <= 0) return;
  for (let i = 0; i < TEILE.length; i++) {
    const a = TEILE[i], ax = a.x * W + Math.sin(t * a.sp + a.p) * 30 * dpr + t * 6 * dpr - panX, ay = a.y * span + Math.cos(t * a.sp * 1.3 + a.p) * 18 * dpr - panY;
    const x = Math.round((((ax % W) + W) % W) / z) * z, y = top + Math.round((((ay % span) + span) % span) / z) * z;
    if (m.stars > 0.5) {
      const f = 0.5 + 0.5 * Math.sin(t * 2 + a.p * 3);
      g.fillStyle = `rgba(214,255,140,${f})`; g.fillRect(x, y, z, z);
      g.fillStyle = `rgba(214,255,140,${f * 0.25})`; g.fillRect(x - z, y - z, 3 * z, 3 * z);
    } else if (zeit === "Abend") { g.fillStyle = a.c < 0.5 ? "#ffc2d6" : "#fff0f5"; g.fillRect(x, y, z, z); }
    else if (i < 6) {
      const wing = Math.sin(t * 14 + a.p) > 0, wh = wing ? z : Math.ceil(z / 2);
      g.fillStyle = a.c < 0.5 ? "#ffffff" : "#ffd94f"; g.fillRect(x - z, y, z, wh); g.fillRect(x + z, y, z, wh);
      g.fillStyle = WP.outline; g.fillRect(x, y, z, z);
    }
  }
}

export function vignette(g: CanvasRenderingContext2D, W: number, H: number, m: Mood) {
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.45, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, "rgba(30,20,40,0)"); vg.addColorStop(1, m.stars > 0.5 ? "rgba(5,8,25,0.55)" : "rgba(40,25,40,0.28)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

/** Tilt-Shift als Unschärfe-Ebene über dem Bild (wie in der App): scharf in der Mitte, weich zum Rand. */
export function tiltMask(el: HTMLElement, mode: "aus" | "eben" | "tiefe") {
  el.style.display = mode === "aus" ? "none" : "";
  const m = mode === "tiefe"
    ? "linear-gradient(to bottom, #000 0%, rgba(0,0,0,.85) 14%, rgba(0,0,0,.35) 32%, transparent 48%, transparent 86%, rgba(0,0,0,.6) 100%)"
    : "linear-gradient(to bottom, #000 0%, rgba(0,0,0,.85) 12%, transparent 30%, transparent 84%, rgba(0,0,0,.75) 100%)";
  el.style.maskImage = m;
  el.style.setProperty("-webkit-mask-image", m);
}
