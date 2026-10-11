// Bildschirmeffekte: Nachtabdunklung mit warmen Lichtern, Regen, Nebel. Gezeichnet in Bildschirmkoordinaten auf eine eigene Fläche.
export interface Light {
  x: number;
  y: number;
  r: number;
  strength: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EffectInput {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dark: number;                // 0 Tag … 1 Nacht
  lights: Light[];
  rooms: Rect[];               // erleuchtete Innenräume (Bildschirmkoordinaten)
  weather: string;
  t: number;
  dt: number;
}

const drops = Array.from({ length: 220 }, (_, i) => ({ x: (i * 97) % 1000 / 1000, y: (i * 61) % 1000 / 1000, v: 0.55 + ((i * 13) % 10) / 22 }));

export function drawEffects(e: EffectInput): void {
  const { ctx, w, h } = e;
  ctx.clearRect(0, 0, w, h);
  if (e.dark > 0.02) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(12,20,58,${e.dark * 0.72})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    for (const r of e.rooms) { ctx.fillStyle = `rgba(0,0,0,${e.dark * 0.62})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    for (const l of e.lights) {
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(1, e.dark * 1.3 * l.strength)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalCompositeOperation = "lighter";
    for (const r of e.rooms) { ctx.fillStyle = `rgba(255,170,70,${0.07 * e.dark})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    for (const l of e.lights) {
      const f = 0.85 + Math.sin(e.t * 7 + l.x) * 0.08, g = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r * 0.8);
      g.addColorStop(0, `rgba(255,170,70,${0.36 * e.dark * f * l.strength})`);
      g.addColorStop(1, "rgba(255,170,70,0)");
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  if (e.weather === "rain" || e.weather === "storm") {
    ctx.fillStyle = "rgba(40,60,90,.12)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(205,225,255,.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      d.y += d.v * e.dt * 0.9;
      d.x -= d.v * e.dt * 0.22;
      if (d.y > 1) { d.y -= 1.05; d.x += 0.2; }
      if (d.x < -0.05) d.x += 1.1;
      ctx.moveTo(d.x * w, d.y * h);
      ctx.lineTo(d.x * w + 2, d.y * h + 8);
    }
    ctx.stroke();
  } else if (e.weather === "fog") {
    const k = 1 - e.dark * 0.7;                       // nachts ein dunkler, bläulicher Nebel statt eines hellen Schleiers
    ctx.fillStyle = `rgba(${Math.round(220 * k)},${Math.round(228 * k)},${Math.round(236 * k + 20 * e.dark)},.28)`;
    ctx.fillRect(0, 0, w, h);
  } else if (e.weather === "cloudy") {
    ctx.fillStyle = "rgba(60,70,90,.08)";
    ctx.fillRect(0, 0, w, h);
  }
}
