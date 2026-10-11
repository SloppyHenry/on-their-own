// Statische Welt des Mockups: Boden, Häuser, Bäume, Requisiten. Wird einmal in `base` gezeichnet. Stil: gemütliches Farmdorf, 16-px-Kacheln.
const T = 16, W = 36, H = 24;
const base = document.createElement('canvas'); base.width = W * T; base.height = H * T;
const b = base.getContext('2d');
const lights = [], smokes = [], waterTiles = [];
const OUT = '#2b3a24';
const rnd = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 1442695041) >>> 0; n = ((n ^ (n >>> 13)) * 1274126177) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const F = (c, x, y, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); };
const disc = (cx, cy, r, c) => { b.fillStyle = c; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * .8) b.fillRect(cx + dx, cy + dy, 1, 1); };
const pick = (a, r) => a[Math.min(a.length - 1, Math.floor(r * a.length))];

// ---- Gelände -------------------------------------------------------------
const kind = Array.from({ length: H }, () => Array(W).fill('grass'));
const occ = Array.from({ length: H }, () => Array(W).fill(false));
const fillK = (x0, y0, x1, y1, k) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (kind[y] && kind[y][x]) { kind[y][x] = k; occ[y][x] = true; } };
const block = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (occ[y] && occ[y][x] !== undefined) occ[y][x] = true; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = ((x + .5 - 28) / 6) ** 2 + ((y + .5 - 5.5) / 3.5) ** 2;
  if (d <= 1) { kind[y][x] = 'water'; occ[y][x] = true; waterTiles.push([x, y]); } else if (d <= 1.5) { kind[y][x] = 'sand'; occ[y][x] = true; }
}
fillK(0, 13, 35, 14, 'path'); fillK(6, 9, 7, 12, 'path'); fillK(16, 8, 17, 9, 'path'); fillK(9, 15, 9, 20, 'path');
fillK(4, 20, 9, 20, 'path'); fillK(29, 15, 30, 16, 'path'); fillK(12, 10, 23, 17, 'cobble');
block(2, 3, 11, 9); block(13, 2, 21, 8); block(1, 15, 8, 20); block(24, 16, 34, 23);

// ---- Boden ---------------------------------------------------------------
function ground(x, y) {
  const k = kind[y][x], px = x * T, py = y * T, r = s => rnd(x, y, s);
  if (k === 'grass') {
    F(pick(['#69a74a', '#6fae4f', '#75b655'], (Math.sin(x * .55 + y * .3) + Math.sin(y * .8 - x * .2) + 2) / 4), px, py, T, T);
    for (let i = 0; i < 5; i++) { const gx = px + r(10 + i) * 14 | 0, gy = py + r(20 + i) * 13 | 0; F(i % 2 ? '#559a3c' : '#8fd06a', gx, gy, 1, 2); F(i % 2 ? '#559a3c' : '#8fd06a', gx + 1, gy + 1, 1, 1); }
    if (r(40) < .07) { const c = pick(['#fff3d6', '#f2d24b', '#f08ab0', '#b99cf0'], r(41)), fx = px + 3 + r(42) * 9 | 0, fy = py + 3 + r(43) * 9 | 0; F('#3f7e3a', fx, fy + 1, 1, 2); F(c, fx - 1, fy, 3, 1); F(c, fx, fy - 1, 1, 3); F('#f6b73c', fx, fy, 1, 1); }
  } else if (k === 'sand') {
    F('#e3cf94', px, py, T, T); for (let i = 0; i < 6; i++) F(i % 2 ? '#cdb878' : '#f2e3b0', px + r(i) * 15 | 0, py + r(i + 9) * 15 | 0, 1, 1);
  } else if (k === 'water') {
    F(pick(['#3a88c9', '#3f8fd0', '#4296d6'], (Math.sin(x * .9 + y * .5) + 1) / 2), px, py, T, T);
  } else if (k === 'path') {
    F(pick(['#c9a066', '#c29a60', '#cfa86f'], r(3)), px, py, T, T);
    for (let i = 0; i < 4; i++) { const sx = px + r(i + 30) * 14 | 0, sy = py + r(i + 50) * 14 | 0; F('#a97f4b', sx, sy, 2, 1); F('#dcb985', sx, sy + 1, 1, 1); }
  } else if (k === 'cobble') {
    F('#8a7f74', px, py, T, T);
    for (let row = 0; row < 2; row++) for (let c = 0; c < 2; c++) {
      const sx = px + c * 8 + (row ? 4 : 0) - (row && c === 0 ? 0 : 0), sy = py + row * 8, sh = pick(['#c9bfae', '#bdb3a2', '#d1c8b8', '#b5ab9b'], r(row * 2 + c + 60));
      F(sh, sx + 1, sy + 1, 6, 6); F('#e6ddcc', sx + 1, sy + 1, 6, 1); F('#968c7c', sx + 1, sy + 6, 6, 1);
    }
  }
}
function edges(x, y) {   // Wegränder: dunkler Streifen und Grasfransen zur Wiese hin
  const k = kind[y][x], px = x * T, py = y * T;
  if (k === 'path' || k === 'cobble') {
    [[0, -1, px, py - 1, T, 1], [0, 1, px, py + T, T, 1], [-1, 0, px - 1, py, 1, T], [1, 0, px + T, py, 1, T]].forEach(([dx, dy, ex, ey, w, h]) => {
      const n = kind[y + dy] && kind[y + dy][x + dx]; if (n !== 'grass') return;
      for (let i = 0; i < T; i += 2) { const ox = w > 1 ? ex + i : ex, oy = h > 1 ? ey + i : ey; F(((i / 2 + x + y) % 3) ? '#4f8f3a' : '#8fd06a', ox, oy, w > 1 ? 2 : 1, h > 1 ? 2 : 1); }
    });
  }
  if (k === 'water') [[0, -1, px, py, T, 1], [0, 1, px, py + T - 1, T, 1], [-1, 0, px, py, 1, T], [1, 0, px + T - 1, py, 1, T]].forEach(([dx, dy, ex, ey, w, h]) => {
    if (kind[y + dy] && kind[y + dy][x + dx] === 'sand') F('rgba(255,255,255,.55)', ex, ey, w, h);
  });
}

// ---- Objekte (nach Grundlinie sortiert) -----------------------------------
const objs = [];
const add = (y, fn) => objs.push({ y, fn });

function house(x, y, w, h, o) {
  add(y + h, () => {
    const px = x * T, py = y * T, pw = w * T, ph = h * T, wh = 2 * T, rh = ph - wh + 6, wy = py + ph - wh;
    F('rgba(30,40,20,.35)', px + 3, py + ph - 3, pw + 5, 7);                 // Schatten
    F(OUT, px - 1, py - 1, pw + 2, ph + 1);                                     // Kontur
    F(o.wall, px, wy, pw, wh); for (let i = 3; i < wh; i += 5) F(o.wallD, px, wy + i, pw, 1);
    F(o.beam, px, wy, 3, wh); F(o.beam, px + pw - 3, wy, 3, wh); F(o.beam, px + pw / 2 - 1, wy, 2, wh);
    F('#7b7a82', px, py + ph - 4, pw, 4); for (let i = 0; i < pw; i += 6) F('#9a99a2', px + i, py + ph - 4, 5, 2);
    for (let yy = 0; yy < rh; yy += 4) {                                          // Dachschindeln
      const off = (yy / 4 % 2) * 4;
      for (let xx = -off; xx < pw; xx += 8) {
        const cx = Math.max(0, xx), cw = Math.min(pw, xx + 8) - cx; if (cw <= 0) continue;
        F(((xx / 8 + yy / 4) | 0) % 3 === 0 ? o.roofL : o.roof, px + cx, py + yy, cw, 3); F(o.roofD, px + cx, py + yy + 3, cw, 1); F(o.roofD, px + cx, py + yy, 1, 3);
      }
    }
    F(o.roofL, px, py, pw, 2); F(o.roofD, px, py + rh - 1, pw, 1); F('rgba(40,25,20,.35)', px, py + rh, pw, 3);
    const cxm = px + pw - 16;
    F(OUT, cxm - 1, py - 8, 9, 14); F('#8a7a74', cxm, py - 7, 7, 12); F('#a8978f', cxm, py - 7, 2, 12); F('#4b4440', cxm - 1, py - 9, 9, 3); smokes.push([cxm + 3, py - 10]);
    (o.win || []).forEach(wx => {
      const ax = px + wx, ay = wy + 8;
      F(OUT, ax - 5, ay - 2, 20, 15); F(o.shut, ax - 4, ay - 1, 3, 12); F(o.shut, ax + 11, ay - 1, 3, 12);
      F('#5b402c', ax - 1, ay - 1, 12, 12); F('#9fd0ee', ax, ay, 10, 10); F('#d9f0fa', ax + 1, ay + 1, 4, 2); F('#5b402c', ax + 4, ay, 2, 10); F('#5b402c', ax, ay + 4, 10, 2);
      F('#7a5230', ax - 2, ay + 11, 14, 3); for (let i = 0; i < 6; i++) F(['#f08ab0', '#fff3d6', '#f2d24b'][i % 3], ax - 1 + i * 2, ay + 9 + (i % 2), 2, 2);
      lights.push({ x: ax, y: ay, w: 10, h: 10, r: 38 });
    });
    const dx = px + o.door * T + 2, dy = py + ph - 19;
    F(OUT, dx - 2, dy - 2, 16, 21); F('#6a4424', dx, dy, 12, 19); F('#84562e', dx + 1, dy + 1, 4, 17); F('#84562e', dx + 7, dy + 1, 4, 17);
    F('#f3cf6a', dx + 9, dy + 10, 2, 2); F('#9a99a2', dx - 3, py + ph - 2, 18, 3);
    if (o.sign) { F('#6b4a2f', dx + 18, dy + 2, 1, 8); F('#d9b378', dx + 14, dy, 9, 5); F('#5b402c', dx + 16, dy + 2, 5, 1); }
    if (o.big) { F('#5b402c', dx + 12, dy, 1, 19); F('#6a4424', dx + 13, dy, 12, 19); F('#84562e', dx + 14, dy + 1, 4, 17); F('#84562e', dx + 20, dy + 1, 4, 17); }
  });
}
const WALL1 = { wall: '#ead7b0', wallD: '#dcc79b', beam: '#8a5a32', roof: '#b24a3a', roofL: '#c65b48', roofD: '#7b2f27', shut: '#4a7a58' };
house(3, 4, 7, 5, { ...WALL1, win: [14, 70], door: 3, sign: true });
house(14, 3, 6, 5, { ...WALL1, wall: '#e8d1c0', wallD: '#d6baa8', roof: '#4f6f9a', roofL: '#6585b3', roofD: '#2f4668', shut: '#b24a3a', win: [10, 62], door: 2 });
house(2, 16, 5, 4, { wall: '#c39a6c', wallD: '#a98053', beam: '#6a4424', roof: '#7a5a3a', roofL: '#93704a', roofD: '#4b3524', shut: '#6a4424', win: [6], door: 2, big: true });

function oak(cx, by, big) {
  add(by / T, () => {
    const r = big ? 11 : 8;
    b.fillStyle = 'rgba(30,45,20,.3)'; for (let dy = -2; dy <= 2; dy++) b.fillRect(cx - r + 1 + Math.abs(dy) * 2, by - 1 + dy, 2 * r - Math.abs(dy) * 4, 1);
    F(OUT, cx - 3, by - 11, 6, 11); F('#6b4a2f', cx - 2, by - 10, 4, 10); F('#8b6340', cx - 2, by - 10, 1, 10);
    const cy = by - 11 - r + 4;
    disc(cx, cy + 1, r + 1, OUT); disc(cx, cy, r, '#2f6b3a'); disc(cx - 1, cy - 1, r - 2, '#3e8a42'); disc(cx - 2, cy - 3, r - 5, '#58a64f'); disc(cx - 3, cy - 4, Math.max(2, r - 8), '#82cc66');
    for (let i = 0; i < r * 2; i++) { const a = rnd(cx, by, i) * 6.28, d = rnd(by, cx, i) * (r - 2); F(i % 2 ? '#2f6b3a' : '#9ad97a', cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2, 1); }
  });
}
function pine(cx, by) {
  add(by / T, () => {
    b.fillStyle = 'rgba(30,45,20,.3)'; b.fillRect(cx - 6, by - 2, 14, 3);
    F(OUT, cx - 2, by - 5, 5, 5); F('#6b4a2f', cx - 1, by - 4, 3, 4);
    for (let i = 0; i < 4; i++) { const w = 8 + i * 4, y = by - 8 - (3 - i) * 7 + 6; for (let k = 0; k < 8; k++) { const ww = Math.round(w * (k + 1) / 8); F(OUT, cx - ww / 2 - 1, y + k - 7, ww + 2, 1); F(k < 5 ? '#2f7a45' : '#276a3b', cx - ww / 2, y + k - 7, ww, 1); F('#4fa05a', cx - ww / 2, y + k - 7, Math.max(1, ww / 3 | 0), 1); } }
  });
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (occ[y][x]) continue; const edge = x < 2 || x > W - 3 || y < 2 || y > H - 3;
  if (rnd(x, y, 7) < (edge ? .5 : .045)) { const cx = x * T + 4 + rnd(x, y, 8) * 8 | 0, by = y * T + 16; (rnd(x, y, 9) < .3 ? pine : oak)(cx, by, rnd(x, y, 5) < .5); }
}

// ---- Requisiten ------------------------------------------------------------
const prop = (y, fn) => add(y, fn);
function well(x, y) { prop(y + 2, () => { const px = x * T, py = y * T; F('rgba(30,40,20,.3)', px + 2, py + 28, 32, 5); F(OUT, px, py + 10, 32, 20); F('#8e9198', px + 1, py + 11, 30, 18); F('#b9bcc2', px + 1, py + 11, 30, 3); F('#2f6fa8', px + 5, py + 15, 22, 9); F('#59a0da', px + 7, py + 16, 9, 2); for (let i = 0; i < 30; i += 6) F('#74777f', px + i, py + 26, 1, 3); F('#6b4a2f', px + 3, py - 4, 3, 22); F('#6b4a2f', px + 26, py - 4, 3, 22); F(OUT, px - 2, py - 10, 36, 8); F('#b24a3a', px - 1, py - 9, 34, 6); F('#c65b48', px - 1, py - 9, 34, 2); F('#7b2f27', px - 1, py - 4, 34, 1); F('#c9a066', px + 15, py - 2, 2, 12); F('#8a5a32', px + 13, py + 9, 6, 4); }); }
function bench(x, y) { prop(y + 1, () => { const px = x * T, py = y * T; F('rgba(30,40,20,.3)', px, py + 15, 32, 3); F('#5b402c', px + 2, py + 8, 3, 8); F('#5b402c', px + 26, py + 8, 3, 8); F('#b98a58', px, py + 6, 18, 4); F('#d3a672', px, py + 6, 18, 1); F('#8a5a32', px, py + 10, 14, 2); F('#b98a58', px + 20, py + 6, 2, 4); F('#e8d9a8', px + 18, py + 2, 12, 2); F('#b98a58', px + 4, py - 3, 24, 3); F('#8a5a32', px + 1, py - 3, 2, 10); F('#8a5a32', px + 28, py - 3, 2, 10); }); }
function logs(x, y, n = 3) { prop(y + 1, () => { const px = x * T, py = y * T + 12; F('rgba(30,40,20,.3)', px, py + 3, n * 8 + 4, 3); for (let r = 0; r < n; r++) for (let c = 0; c < n - r; c++) { const cx = px + 4 + c * 8 + r * 4, cy = py - r * 6; disc(cx, cy, 3, '#5b3a22'); disc(cx, cy, 2, '#d9ac6e'); F('#a8763c', cx, cy, 1, 1); } }); }
function stall(x, y) { prop(y + 2, () => { const px = x * T, py = y * T, w = 48; F('rgba(30,40,20,.3)', px, py + 30, w + 4, 4); F('#5b402c', px + 1, py + 6, 3, 26); F('#5b402c', px + w - 4, py + 6, 3, 26); F(OUT, px - 2, py - 2, w + 4, 12); for (let i = 0; i < w; i += 6) { F(i % 12 ? '#f2e6c9' : '#c4524a', px + i, py - 1, 6, 9); F('#8a2f2a', px + i, py + 7, 6, 1); } F('#8a5a32', px + 2, py + 18, w - 4, 8); F('#a97542', px + 2, py + 18, w - 4, 2);
  [[6, '#d84a3a'], [14, '#f2c14e'], [22, '#8dc77b']].forEach(([o, c]) => { F('#7b5532', px + o, py + 14, 8, 5); for (let k = 0; k < 3; k++) disc(px + o + 2 + k * 2, py + 13, 1, c); }); F('#e6c27a', px + 34, py + 13, 8, 5); F('#c79a53', px + 35, py + 13, 6, 2); }); }
function lantern(x, y) { prop(y + 1, () => { const px = x * T, py = y * T; F('#2e2e36', px + 7, py + 4, 2, 12); F(OUT, px + 3, py - 1, 10, 8); F('#3a3a44', px + 4, py, 8, 2); F('#ffd98a', px + 5, py + 2, 6, 4); lights.push({ x: px + 5, y: py + 2, w: 6, h: 4, r: 52 }); }); }
function fence(x0, y0, x1, y1, gapX) { const px0 = x0 * T, py0 = y0 * T, px1 = (x1 + 1) * T, py1 = (y1 + 1) * T;
  const rail = (ax, ay, w, h) => { F(OUT, ax, ay - 1, w, h + 2); F('#c99a5b', ax, ay, w, h); }, post = (ax, ay) => { F(OUT, ax - 1, ay - 7, 5, 11); F('#b98a58', ax, ay - 6, 3, 9); F('#d9b378', ax, ay - 6, 1, 9); };
  prop(y0 + 1, () => { rail(px0, py0 - 2, px1 - px0, 2); for (let x = px0; x <= px1; x += 16) post(x, py0 + 4); });
  prop(y1 + 1, () => { for (let x = px0; x < px1; x += 16) { if (gapX !== undefined && x >= gapX * T && x < (gapX + 2) * T) continue; rail(x, py1 - 4, 16, 2); post(x, py1 + 3); } post(px1, py1 + 3); });
  prop(y0 + 2, () => { for (let y = py0; y < py1; y += 16) { rail(px0 - 1, y + 2, 2, 14); rail(px1, y + 2, 2, 14); } }); }
function beds(x, y, w, stage) { prop(y + 1, () => { const px = x * T, py = y * T; F(OUT, px, py, w * T, 18); F('#6a4630', px + 1, py + 1, w * T - 2, 16);
  for (let i = 0; i < w * T - 2; i += 4) F('#523522', px + 2 + i, py + 2, 1, 14);
  for (let i = 0; i < w * 2; i++) { const cx = px + 4 + i * 8, cy = py + 9;
    if (stage === 0) { F('#6bbf4f', cx, cy, 1, 2); F('#8fd96a', cx - 1, cy - 1, 1, 1); F('#8fd96a', cx + 1, cy - 1, 1, 1); }
    if (stage === 1) { F('#3f8a3a', cx - 2, cy - 2, 5, 4); F('#6bbf4f', cx - 1, cy - 3, 3, 3); }
    if (stage === 2) { F('#d8782f', cx - 1, cy + 1, 3, 3); F('#3f8a3a', cx - 2, cy - 4, 1, 4); F('#58a64f', cx, cy - 5, 1, 5); F('#3f8a3a', cx + 2, cy - 4, 1, 4); }
    if (stage === 3) { disc(cx, cy, 3, '#2f6b3a'); disc(cx, cy, 2, '#8dc77b'); F('#c6ec9c', cx - 1, cy - 1, 2, 1); }
    if (stage === 4) { F('#3f8a3a', cx, cy - 2, 1, 9); disc(cx, cy - 5, 3, '#f2c14e'); disc(cx, cy - 5, 1, '#6a4630'); } } }); }
function sign(x, y) { prop(y + 1, () => { const px = x * T, py = y * T; F('#5b402c', px + 7, py + 2, 2, 14); F(OUT, px, py + 1, 16, 5); F('#d9b378', px + 1, py + 2, 14, 3); F(OUT, px + 3, py + 7, 13, 5); F('#d9b378', px + 4, py + 8, 11, 3); }); }
function flowerPatch(x, y, n) { prop(y + .5, () => { for (let i = 0; i < n; i++) { const fx = x * T + rnd(x, y, i) * 20 | 0, fy = y * T + 4 + rnd(y, x, i) * 10 | 0, c = pick(['#f08ab0', '#fff3d6', '#f2d24b', '#b99cf0', '#f26b5b'], rnd(i, x, y)); F('#3f7e3a', fx, fy + 1, 1, 3); F(c, fx - 1, fy, 3, 1); F(c, fx, fy - 1, 1, 3); F('#f6b73c', fx, fy, 1, 1); } }); }
function bush(x, y) { prop(y + 1, () => { const px = x * T + 8, py = y * T + 14; disc(px, py - 4, 7, OUT); disc(px, py - 4, 6, '#2f6b3a'); disc(px - 1, py - 6, 4, '#4f9d4b'); [[-3, -4], [2, -6], [3, -2], [-1, -1]].forEach(([dx, dy]) => F('#d9453a', px + dx, py + dy, 2, 2)); }); }
function rock(x, y) { prop(y + 1, () => { const px = x * T, py = y * T + 8; F(OUT, px + 1, py + 1, 12, 8); F('#9a9ca4', px + 2, py + 2, 10, 6); F('#c4c6cc', px + 3, py + 2, 5, 2); F('#74767e', px + 2, py + 7, 10, 1); }); }
function dock(x, y) { prop(y + 1, () => { const px = x * T, py = y * T; for (let i = 0; i < 4; i++) { F(OUT, px + i * 16, py + 2, 16, 14); F(i % 2 ? '#b98a58' : '#c99a5b', px + i * 16 + 1, py + 3, 14, 12); F('#8a5a32', px + i * 16, py + 9, 16, 1); } F('#5b402c', px, py + 16, 3, 4); F('#5b402c', px + 61, py + 16, 3, 4); }); }
function can(x, y) { prop(y + 1, () => { const px = x * T + 3, py = y * T + 8; F(OUT, px, py, 10, 8); F('#4f86c6', px + 1, py + 1, 8, 6); F('#7fb0e8', px + 1, py + 1, 8, 1); F(OUT, px + 9, py - 2, 5, 3); F('#4f86c6', px + 10, py - 1, 3, 1); }); }

well(17, 11); bench(13, 12); logs(13, 15); stall(20, 15); lantern(12, 9); lantern(23, 9); lantern(12, 17); lantern(23, 17);
fence(25, 17, 33, 22, 29); beds(26, 18, 7, 3); beds(26, 20, 7, 0); can(24, 20); sign(9, 12); dock(21, 5);
flowerPatch(5, 9, 9); flowerPatch(14, 8, 8); flowerPatch(1, 12, 6); bush(11, 8); bush(21, 8); bush(7, 14 + 1); rock(10, 15); rock(31, 20); flowerPatch(34, 15, 6);

function buildStatic() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground(x, y);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) edges(x, y);
  objs.sort((a, c) => a.y - c.y).forEach(o => o.fn());
}
