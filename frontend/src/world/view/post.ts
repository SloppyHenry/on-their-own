// Nachbearbeitung in voller Auflösung wie frame() in Mockup A: Lichtschein (additiv), Teilchen, Wetter, Vignette.
// Farbstimmung (multiply) und Tilt-Shift (Unschärfe mit Verlaufsmaske) übernimmt CSS, siehe WorldCanvas.
import { rng } from "../art/pen";
import { WP, type Mood } from "../art/palette";

export function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number, lights: { x: number; y: number; r: number }[], pf: number, mood: Mood) {
  ctx.clearRect(0, 0, w, h);
  if (mood.glowA < 0.02) return;
  for (const L of lights) {
    const gx = L.x * pf, gy = L.y * pf, gr = L.r * pf;
    if (gx + gr < 0 || gy + gr < 0 || gx - gr > w || gy - gr > h || gr < 1) continue;
    const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    rg.addColorStop(0, `rgba(255,205,120,${mood.glowA})`); rg.addColorStop(0.35, `rgba(255,170,90,${mood.glowA * 0.4})`); rg.addColorStop(1, "rgba(255,150,80,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
}

const P = (() => { const R = rng(21); return Array.from({ length: 26 }, () => ({ x: R(), y: R(), p: R() * 6.28, sp: 0.3 + R() * 0.6, c: R() })); })();
const DROPS = Array.from({ length: 220 }, (_, i) => ({ x: ((i * 97) % 1000) / 1000, y: ((i * 61) % 1000) / 1000, v: 0.55 + ((i * 13) % 10) / 22 }));

export interface Atmo { w: number; h: number; mood: Mood; weather: string; t: number; dt: number; particles: boolean; pf: number }

export function drawAtmo(ctx: CanvasRenderingContext2D, a: Atmo) {
  const { w, h, mood, t, pf } = a;
  ctx.clearRect(0, 0, w, h);
  const q = (v: number) => Math.round(v / pf) * pf;
  if (a.particles && a.weather !== "rain" && a.weather !== "storm") {
    for (let k = 0; k < P.length; k++) {
      const pa = P[k], bx = (pa.x * w + Math.sin(t * pa.sp + pa.p) * 30 + t * 6) % w, by = 0.25 * h + pa.y * (h * 0.7) + Math.cos(t * pa.sp * 1.3 + pa.p) * 18, x = q(bx), y = q(by);
      if (mood.stars > 0.5) {
        const fa = 0.5 + 0.5 * Math.sin(t * 2 + pa.p * 3);
        ctx.fillStyle = `rgba(214,255,140,${fa})`; ctx.fillRect(x, y, pf, pf);
        ctx.fillStyle = `rgba(214,255,140,${fa * 0.25})`; ctx.fillRect(x - pf, y - pf, pf * 3, pf * 3);
      } else if (mood.glowA > 0.2) { ctx.fillStyle = pa.c < 0.5 ? "#ffc2d6" : "#fff0f5"; ctx.fillRect(x, y, pf, pf); }
      else if (k < 6) {
        const wing = Math.sin(t * 14 + pa.p) > 0;
        ctx.fillStyle = pa.c < 0.5 ? "#ffffff" : "#ffd94f";
        ctx.fillRect(x - pf, y, pf, wing ? pf : pf / 2); ctx.fillRect(x + pf, y, pf, wing ? pf : pf / 2);
        ctx.fillStyle = WP.outline; ctx.fillRect(x, y, pf, pf);
      }
    }
  }
  weather(ctx, a);
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.45, w / 2, h * 0.55, h * 0.95);
  vg.addColorStop(0, "rgba(30,20,40,0)");
  vg.addColorStop(1, mood.stars > 0.5 ? "rgba(5,8,25,0.55)" : `rgba(40,25,40,${0.28 + 0.27 * mood.stars})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

export function weather(ctx: CanvasRenderingContext2D, a: Atmo) {
  const { w, h, dt } = a;
  if (a.weather === "rain" || a.weather === "storm" || a.weather === "snow") {
    const snow = a.weather === "snow";
    ctx.fillStyle = snow ? "rgba(235,240,250,.08)" : "rgba(40,60,90,.12)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = snow ? "rgba(255,255,255,.9)" : "rgba(205,225,255,.6)";
    for (const d of DROPS) {
      d.y += d.v * dt * (snow ? 0.12 : 0.9);
      d.x -= d.v * dt * (snow ? 0.03 : 0.22);
      if (d.y > 1) { d.y -= 1.05; d.x += 0.2; }
      if (d.x < -0.05) d.x += 1.1;
      const x = Math.round((d.x * w) / a.pf) * a.pf, y = Math.round((d.y * h) / a.pf) * a.pf;
      if (snow) ctx.fillRect(x, y, a.pf, a.pf); else { ctx.fillRect(x, y, a.pf / 2, a.pf * 2); ctx.fillRect(x - a.pf / 2, y + a.pf * 2, a.pf / 2, a.pf); }
    }
  } else if (a.weather === "fog") {
    const k = 1 - a.mood.stars * 0.7;
    ctx.fillStyle = `rgba(${Math.round(220 * k)},${Math.round(228 * k)},${Math.round(236 * k + 20 * a.mood.stars)},.3)`;
    ctx.fillRect(0, 0, w, h);
  }
}
