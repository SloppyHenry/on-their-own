// Bewegte Schicht des Mockups: Wasser, Rauch, Schmetterlinge, Figuren, Tag/Nacht, Regen. Zeichnet jedes Bild über `base`.
buildStatic();
const cv = document.getElementById('cv'); cv.width = W * T; cv.height = H * T;
const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
const ov = document.createElement('canvas'); ov.width = cv.width; ov.height = cv.height; const o = ov.getContext('2d');
const SPR = { alex: [charSprite('alex', 0), charSprite('alex', 1)], mira: [charSprite('mira', 0), charSprite('mira', 1)] };
const state = { light: 1, rain: true };
const G = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// Mira geht den Weg vom Haus zum Marktstand und zurück
const route = [[16.5, 8.3], [16.5, 10.2], [16.5, 13.4], [19.5, 13.4], [21.5, 14.4]];
const seg = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1])), total = seg.reduce((a, c) => a + c, 0);
function miraAt(t) {
  const speed = 1.4, cyc = 2 * total / speed + 6, u = t % cyc; let d, walking = true;
  if (u < total / speed) d = u * speed; else if (u < total / speed + 3) { d = total; walking = false; } else if (u < 2 * total / speed + 3) d = total - (u - total / speed - 3) * speed; else { d = 0; walking = false; }
  let i = 0, rem = d; while (i < seg.length - 1 && rem > seg[i]) { rem -= seg[i]; i++; }
  const f = Math.min(1, rem / seg[i]), a = route[i], c = route[i + 1];
  return { x: (a[0] + (c[0] - a[0]) * f) * T, y: (a[1] + (c[1] - a[1]) * f) * T, step: walking ? Math.floor(d * 2.2) % 2 : 0, walking };
}
function figure(who, x, y, frame, bob) {
  g.fillStyle = 'rgba(30,40,20,.35)'; for (let dy = -1; dy <= 1; dy++) g.fillRect(x - 6 + Math.abs(dy) * 2, y - 1 + dy, 12 - Math.abs(dy) * 4, 1);
  g.drawImage(SPR[who][frame], Math.round(x - 6), Math.round(y - 17 - bob));
}
function hammer(x, y, t) {
  const ph = (t * 2.2) % 1, ang = ph < .7 ? -1.2 + ph * 0.3 : -1 + (ph - .7) / .3 * 1.3;
  g.save(); g.translate(Math.round(x + 5), Math.round(y - 10)); g.rotate(ang);
  G('#8b6340', 0, -1, 8, 2); G('#aeb4bd', 7, -3, 4, 6); G('#d8dde3', 7, -3, 4, 1); g.restore();
  if (ph > .93 || ph < .05) { G('#ffe27a', x + 8, y - 5, 2, 2); G('#fff', x + 10, y - 7, 1, 1); G('#ffe27a', x + 6, y - 7, 1, 1); }
}
const drops = Array.from({ length: 130 }, (_, i) => ({ x: rnd(i, 1) * cv.width, y: rnd(i, 2) * cv.height, v: 150 + rnd(i, 3) * 90 }));
const flies = [[27, 20.5, '#f2a0c8'], [8, 11, '#9ec8f2'], [18, 8.5, '#f2d24b']];
let last = 0;
const stage = document.getElementById('stage');
const el = id => document.getElementById(id);
const place = (n, x, y) => { n.style.left = (x / cv.width * 100) + '%'; n.style.top = (y / cv.height * 100) + '%'; };

function frame(ms) {
  const t = ms / 1000, dt = Math.min(.05, t - last); last = t;
  g.drawImage(base, 0, 0);
  waterTiles.forEach(([x, y], i) => {                                   // Wasserglitzern und Wellen
    const s = Math.sin(t * 1.6 + rnd(x, y, 4) * 6.28), px = x * T + rnd(x, y, 5) * 10, py = y * T + rnd(x, y, 6) * 12;
    if (s > .82) G('#e8f6ff', px, py, 3, 1); else if (s < -.88) G('#2f78b8', px, py, 4, 1);
    if (((x + y) & 1) && Math.sin(t * .9 + x) > .6) G('rgba(255,255,255,.25)', x * T + 2, y * T + 8, 8, 1);
  });
  smokes.forEach(([sx, sy], k) => { for (let i = 0; i < 6; i++) { const a = (t * .35 + i / 6 + k * .3) % 1, r = 2 + a * 4; g.fillStyle = `rgba(235,235,240,${(1 - a) * .65})`; g.fillRect(Math.round(sx + Math.sin(a * 7 + i) * 3 + a * 9 - r / 2), Math.round(sy - a * 30), r, r); } });
  flies.forEach(([fx, fy, c], i) => { const x = fx * T + Math.sin(t * .8 + i * 2) * 28, y = fy * T + Math.cos(t * 1.1 + i) * 14, w = Math.sin(t * 18 + i) > 0 ? 3 : 1; G(c, x - w, y, w, 2); G(c, x + 1, y, w, 2); G('#3a2a20', x, y, 1, 2); });

  const A = { x: 14 * T + 8, y: 13 * T + 16 }, M = miraAt(t);
  const ringY = A.y - 1; g.strokeStyle = '#e0a458'; g.globalAlpha = .55 + Math.sin(t * 3) * .25; g.beginPath(); g.ellipse(A.x, ringY, 10, 4, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
  if (Math.hypot(A.x - M.x, A.y - M.y) < 6 * T) { g.setLineDash([2, 3]); g.lineDashOffset = -t * 6; g.strokeStyle = 'rgba(240,200,130,.8)'; g.beginPath(); g.moveTo(A.x, A.y - 18); g.lineTo(M.x, M.y - 18); g.stroke(); g.setLineDash([]); }
  figure('alex', A.x, A.y, Math.floor(t * 2.2) % 2 ? 0 : 0, 0); hammer(A.x, A.y, t);
  figure('mira', M.x, M.y, M.step, M.walking ? (M.step ? 1 : 0) : 0);

  // Licht: Nacht als blaue Abdunklung, Fenster und Laternen leuchten warm
  const dark = 1 - state.light;
  if (dark > .01) {
    o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, ov.width, ov.height);
    o.fillStyle = `rgba(12,20,58,${dark * .72})`; o.fillRect(0, 0, ov.width, ov.height);
    o.globalCompositeOperation = 'destination-out';
    lights.forEach(l => { const cx = l.x + l.w / 2, cy = l.y + l.h / 2, gr = o.createRadialGradient(cx, cy, 2, cx, cy, l.r); gr.addColorStop(0, `rgba(0,0,0,${Math.min(1, dark * 1.3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = gr; o.fillRect(cx - l.r, cy - l.r, l.r * 2, l.r * 2); });
    g.drawImage(ov, 0, 0);
    g.globalCompositeOperation = 'lighter';
    lights.forEach(l => { const cx = l.x + l.w / 2, cy = l.y + l.h / 2, fl = .85 + Math.sin(t * 7 + l.x) * .08, gr = g.createRadialGradient(cx, cy, 1, cx, cy, l.r * .8); gr.addColorStop(0, `rgba(255,170,70,${.42 * dark * fl})`); gr.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gr; g.fillRect(cx - l.r, cy - l.r, l.r * 2, l.r * 2); });
    g.globalCompositeOperation = 'source-over';
    lights.forEach(l => { g.fillStyle = `rgba(255,214,120,${Math.min(1, dark * 1.4)})`; g.fillRect(l.x, l.y, l.w, l.h); });
  }
  if (state.rain) {
    g.fillStyle = 'rgba(40,60,90,.12)'; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(205,225,255,.55)'; g.lineWidth = 1; g.beginPath();
    drops.forEach(d => { d.y += d.v * dt; d.x -= d.v * dt * .25; if (d.y > cv.height) { d.y = -6; d.x = Math.random() * (cv.width + 60); } g.moveTo(d.x, d.y); g.lineTo(d.x + 1.5, d.y + 5); }); g.stroke();
  }
  place(el('tagAlex'), A.x, A.y + 3); place(el('tagMira'), M.x, M.y + 3); place(el('bubble'), A.x, A.y - 24);
  requestAnimationFrame(frame);
}
initPixelUI();
requestAnimationFrame(frame);

const sl = el('light'), phaseIcon = el('phase');
function setLight() {
  state.light = sl.value / 100; el('lv').textContent = sl.value + ' %';
  const v = state.light, n = v > .55 ? 'sun' : 'moon'; phaseIcon.dataset.ic = n; phaseIcon.style.setProperty('--m', `url(${iconURL(n)})`);
}
sl.oninput = setLight; el('rain').onchange = e => { state.rain = e.target.checked; };
