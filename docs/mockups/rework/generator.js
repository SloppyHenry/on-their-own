// Skizze des neuen Generators (AP18f): Dorfform, Gebäude je Art, Seen, Bach/Fluss, Wald, Gärten, Felder, Wege.
// Zeichnet nur einen schematischen Plan (eine Kachel = ein Punkt); im Spiel entsteht daraus look v2 und das echte Bild.
// Gleicher Seed + gleiche Stellgrößen = gleiches Dorf.
const GEN0 = { seed: 4711, form: "zufall", size: "mittel", house: 5, shop: 1, workshop: 1, barn: 1, stable: 0, lakes: 1, water: "bach", forest: "mittel", trees: 2, gardens: 2, fields: 1, roads: "geschwungen" };
const FORMS = [["zufall", "Zufall"], ["strasse", "Straßendorf"], ["haufen", "Haufendorf"], ["anger", "Anger (rund)"], ["fluss", "Am Fluss"], ["streu", "Streusiedlung"]];
const SIZES = { klein: [64, 40], mittel: [96, 60], gross: [128, 80] };
const BUILD = { house: [5, 4, "Wohnhäuser"], shop: [6, 4, "Läden"], workshop: [5, 4, "Werkstätten"], barn: [7, 5, "Scheunen"], stable: [6, 4, "Ställe"] };
const ROOFS = { house: ["#d65a40", "#5470c8", "#e0b440", "#b9563a"], shop: ["#3f7fd0"], workshop: ["#8a5a3c"], barn: ["#a8402f"], stable: ["#9a6a3a"] };
const T = { gras: 0, wald: 1, weg: 2, wasser: 3, ufer: 4, platz: 5, garten: 6, feld: 7, haus: 8, bruecke: 9, anger: 10, baum: 11 };

function rngOf(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noiseOf(r, W, H, step) {
  const gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2, g = Array.from({ length: gw * gh }, r);
  return (x, y) => { const fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, s = (t) => t * t * (3 - 2 * t);
    const v = (i, j) => g[(j * gw + i) % g.length], a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * s(tx), b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * s(tx); return a + (b - a) * s(ty); };
}

function generate(p) {
  const r = rngOf(p.seed * 7919 + 13), [W, H] = SIZES[p.size], m = new Uint8Array(W * H), roof = {}, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : m[y * W + x]);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = t; };
  const form = p.form === "zufall" ? FORMS[1 + Math.floor(r() * 5)][0] : p.form, curvy = p.roads === "geschwungen";
  const cx = Math.round(W / 2 + (r() - .5) * W * .25), cy = Math.round(H / 2 + (r() - .5) * H * .2);
  const disk = (x, y, rad, t, keepWater) => { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad + rad) {
    const c = at(x + i, y + j); if (c === -1) continue; if (c === T.wasser && t === T.weg) set(x + i, y + j, T.bruecke); else if (!(keepWater && c === T.wasser) && c !== T.bruecke) set(x + i, y + j, t); } };
  const line = (pts, w = 1) => { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s++) disk(Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n), w - 1 + (w > 1 ? 0 : 0), T.weg); } };
  const wobble = (x0, y0, ang, len, amp) => { const pts = [[x0, y0]], ph = r() * 6; let x = x0, y = y0;
    for (let s = 1; s <= len; s++) { const a = ang + (curvy ? Math.sin(s / 6 + ph) * amp : 0); x += Math.cos(a); y += Math.sin(a); pts.push([Math.round(x), Math.round(y)]); } return pts; };
  // Wasserlauf zuerst (Straßen bekommen dort Brücken)
  const water = form === "fluss" && p.water === "kein" ? "bach" : p.water;
  if (water !== "kein") { const w = water === "fluss" ? 2 : 1; let x = form === "fluss" ? cx + Math.round((r() - .5) * 8) : Math.round(W * (.15 + r() * .7)); const ph = r() * 6;
    for (let y = 0; y < H; y++) { x += Math.round(Math.sin(y / 7 + ph) * .9 + (r() - .5) * 1.2); for (let i = -w + 1; i < w; i++) set(x + i, y, T.wasser); if (w > 1) { set(x - w, y, T.ufer); set(x + w, y, T.ufer); } } }
  const roads = [];
  if (form === "strasse") { const pts = []; const A = curvy ? 3 + r() * 4 : .4, ph = r() * 6; for (let x = 0; x < W; x++) pts.push([x, Math.round(cy + Math.sin(x / 11 + ph) * A)]); roads.push(pts);
    for (let k = 0; k < 2; k++) { const s = pts[Math.round(W * (.3 + r() * .4))]; roads.push(wobble(s[0], s[1], (r() < .5 ? -1 : 1) * Math.PI / 2, 8 + r() * 10, .5)); } }
  if (form === "haufen" || form === "streu") { const n = form === "haufen" ? 3 + Math.floor(r() * 3) : 2, a0 = r() * 6;
    for (let k = 0; k < n; k++) { const len = k === 0 ? W : 12 + r() * 20, pts = wobble(cx, cy, a0 + k * (Math.PI * 2 / n) + (r() - .5) * .8, len, .6); roads.push(pts);
      if (form === "haufen" && r() < .6) { const mid = pts[Math.floor(pts.length / 2)]; roads.push(wobble(mid[0], mid[1], a0 + k * 1.3 + 1.2, 6 + r() * 8, .4)); } } }
  if (form === "anger") { const rx = 11 + Math.floor(r() * 5), ry = 6 + Math.floor(r() * 3), ring = [];
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) < .8) set(cx + i, cy + j, T.anger);
    for (let s = 0; s <= 64; s++) { const a = s / 64 * Math.PI * 2; ring.push([Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry)]); } roads.push(ring);
    roads.push(wobble(cx + rx, cy, (r() - .5) * .6, W, .3), wobble(cx - rx, cy, Math.PI + (r() - .5) * .6, W, .3)); }
  if (form === "fluss") { let rx = -1; for (let x = 0; x < W; x++) if (at(x, cy) === T.wasser) { rx = x; break; } const side = r() < .5 ? -1 : 1, pts = [];
    for (let y = 0; y < H; y++) { let wx = -1; for (let x = 0; x < W; x++) if (at(x, y) === T.wasser) { wx = x; break; } pts.push([(wx < 0 ? rx : wx) + side * 6, y]); } roads.push(pts, wobble(0, cy, 0, W, .25)); }
  roads.forEach((pts) => line(pts, 1));
  if (form !== "anger") disk(cx, cy, 3, T.platz, true); else disk(cx + Math.round((r() - .5) * 6), cy - 1, 2, T.platz, true);
  // Gebäude: entlang der Straßen, auf beiden Seiten; Streusiedlung frei verteilt mit eigenem Pfad
  const free = (x, y, w, h, pad = 1) => { for (let j = -pad; j < h + pad; j++) for (let i = -pad; i < w + pad; i++) { const c = at(x + i, y + j); if (c !== T.gras && c !== T.wald && !(pad && (j < 0 || j >= h || i < 0 || i >= w) && c === T.weg)) return false; } return true; };
  const roadCells = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x] === T.weg) roadCells.push([x, y]);
  const placed = { house: 0, shop: 0, workshop: 0, barn: 0, stable: 0 }, houses = [];
  const kinds = []; for (const k of Object.keys(BUILD)) for (let i = 0; i < p[k]; i++) kinds.push(k);
  kinds.sort(() => r() - .5).sort((a, b) => (a === "shop" ? -1 : 0) - (b === "shop" ? -1 : 0));
  for (const k of kinds) { const [bw, bh] = BUILD[k];
    for (let t = 0; t < 400; t++) { let x, y;
      if (form === "streu") { const a = r() * 6.28, d = 6 + r() * Math.min(W, H) * .42; x = Math.round(cx + Math.cos(a) * d * 1.4) - (bw >> 1); y = Math.round(cy + Math.sin(a) * d) - bh; }
      else { const near = k === "shop" ? roadCells.filter(([a, b]) => Math.abs(a - cx) + Math.abs(b - cy) < 12) : roadCells; const c = (near.length ? near : roadCells)[Math.floor(r() * (near.length || roadCells.length))];
        if (!c) break; const up = r() < .5; x = c[0] - (bw >> 1) + Math.round((r() - .5) * 2); y = up ? c[1] - bh - 1 : c[1] + 2; }
      if (!free(x, y, bw, bh)) continue;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) set(x + i, y + j, T.haus);
      const col = ROOFS[k][Math.floor(r() * ROOFS[k].length)]; houses.push({ x, y, w: bw, h: bh, k, col }); placed[k]++; roof[`${x},${y}`] = col; break; } }
  // Türpfade: kürzester Weg von der Tür (unten Mitte) zur nächsten Straße, um Häuser herum
  for (const h of houses) { const sx = h.x + (h.w >> 1), sy = h.y + h.h; if (at(sx, sy) === T.weg) continue;
    const prev = new Int32Array(W * H).fill(-1), q = [sy * W + sx]; prev[q[0]] = q[0]; let goal = -1;
    for (let qi = 0; qi < q.length && goal < 0; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const nx = x + dx, ny = y + dy, n = ny * W + nx, v = at(nx, ny);
        if (v === -1 || prev[n] >= 0 || v === T.haus || v === T.wasser) continue; prev[n] = c; if (v === T.weg || v === T.platz || v === T.bruecke) { goal = c; break; } q.push(n); } }
    for (let c = goal; c >= 0 && c !== prev[c]; c = prev[c]) m[c] = T.weg; if (goal >= 0) m[sy * W + sx] = T.weg; }
  // Seen, Gärten, Felder auf freiem Land
  let lakes = 0; for (let n = 0; n < p.lakes; n++) for (let t = 0; t < 200; t++) {
    const rx = 3 + Math.floor(r() * 6), ry = 2 + Math.floor(r() * 4), x = Math.floor(r() * W), y = Math.floor(r() * H), wob = noiseOf(r, 24, 24, 4);
    if (form === "anger" && n === 0) { if (t > 0) break; for (let j = -2; j <= 2; j++) for (let i = -4; i <= 4; i++) if (i * i / 16 + j * j / 4 < 1 && at(cx + i, cy + j) === T.anger) set(cx + i, cy + j, T.wasser); lakes++; break; }
    let ok = true; for (let j = -ry - 3; j <= ry + 3 && ok; j++) for (let i = -rx - 3; i <= rx + 3; i++) { const c = at(x + i, y + j); if (c === -1 || (c !== T.gras && c !== T.wald)) { ok = false; break; } } if (!ok) continue;
    for (let j = -ry - 1; j <= ry + 1; j++) for (let i = -rx - 1; i <= rx + 1; i++) { const d = (i * i) / (rx * rx) + (j * j) / (ry * ry) + (wob(i + 12, j + 12) - .5) * .7; if (d < 1) set(x + i, y + j, T.wasser); else if (d < 1.45) set(x + i, y + j, T.ufer); }
    lakes++; break; }
  let gardens = 0; for (let n = 0; n < p.gardens; n++) for (let t = 0; t < 200; t++) { const h = houses[Math.floor(r() * houses.length)]; if (!h) break;
    const x = h.x + (r() < .5 ? -8 : h.w + 1), y = h.y + Math.round((r() - .5) * 3); if (!free(x, y, 7, 5)) continue; for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) set(x + i, y + j, T.garten); gardens++; break; }
  let fields = 0; for (let n = 0; n < p.fields; n++) for (let t = 0; t < 300; t++) { const w = 10 + Math.floor(r() * 5), h = 5 + Math.floor(r() * 3), x = Math.floor(r() * (W - w)), y = Math.floor(r() * (H - h));
    if (Math.hypot(x + w / 2 - cx, (y + h / 2 - cy) * 1.5) < 16 || !free(x, y, w, h, 2)) continue; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, T.feld); fields++; break; }
  // Wald: Rauschen plus Rand, nie dicht an Bebautem; einzelne Bäume im Dorf
  const nz = noiseOf(r, W, H, 9), nz2 = noiseOf(r, W, H, 4), th = { licht: .66, mittel: .55, dicht: .44 }[p.forest];
  const near = new Uint8Array(W * H).fill(9), q = []; for (let i = 0; i < W * H; i++) if (m[i] !== T.gras && m[i] !== T.anger) { near[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; if (near[c] >= 4) continue; for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const n = (y + dy) * W + x + dx; if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || near[n] <= near[c] + 1) continue; near[n] = near[c] + 1; q.push(n); } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (m[i] !== T.gras) continue; const edge = Math.max(0, 1 - Math.min(x, y, W - 1 - x, H - 1 - y) / 9) * .35;
    if (near[i] > 2 && nz(x, y) * .7 + nz2(x, y) * .3 + edge > th) m[i] = T.wald; else if (near[i] >= 1 && near[i] <= 3 && r() < .012 * p.trees) m[i] = T.baum; }
  return { W, H, m, roof, houses, form, placed, lakes, gardens, fields, water };
}

const COL = { 0: ["#6fb04a", "#66a744"], 1: ["#2f7a3c", "#3d8c45"], 2: ["#dcc38e", "#d3b981"], 3: ["#4aa3df", "#5cb3ea"], 4: ["#e6d39a", "#dccb8f"], 5: ["#b9b2a6", "#aaa398"], 6: ["#8a5a3c", "#6fae4b"],
  7: ["#d8b450", "#c9a240"], 9: ["#9a6a3a", "#b07d48"], 10: ["#86c25a", "#7bb851"], 11: ["#2f7a3c", "#6fb04a"] };
function drawPlan(cv, g, px) {
  cv.width = g.W * px; cv.height = g.H * px; const c = cv.getContext("2d");
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) { const t = g.m[y * g.W + x], h = ((x * 73856093) ^ (y * 19349663)) & 7; if (t === T.haus) continue;
    const [a, b] = COL[t]; c.fillStyle = t === 6 ? (y % 2 ? a : b) : t === 7 ? (x % 2 ? a : b) : t === 11 ? b : h < 2 ? b : a; c.fillRect(x * px, y * px, px, px);
    if (t === 11 || (t === 1 && h === 0)) { c.fillStyle = "#245f2f"; c.fillRect(x * px + px * .2, y * px + px * .2, px * .6, px * .6); } if (t === 3 && h === 0 && px > 3) { c.fillStyle = "#cfeeff"; c.fillRect(x * px + 1, y * px + 1, px * .4, 1); } }
  for (const h of g.houses) { const X = h.x * px, Y = h.y * px, w = h.w * px, hh = h.h * px; c.fillStyle = "#0004"; c.fillRect(X + px * .4, Y + px * .4, w, hh);
    c.fillStyle = "#f3e6cc"; c.fillRect(X, Y + hh * .55, w, hh * .45); c.fillStyle = h.col; c.fillRect(X, Y, w, hh * .6); c.fillStyle = "#0003"; c.fillRect(X, Y, w, Math.max(1, px * .5));
    c.fillStyle = "#6b4226"; c.fillRect(X + w / 2 - px * .45, Y + hh - px * 1.1, px * .9, px * 1.1); if (h.k === "shop") { for (let i = 0; i < h.w; i++) { c.fillStyle = i % 2 ? "#fff8ec" : "#3f7fd0"; c.fillRect(X + i * px, Y + hh * .55, px, px * .5); } } }
}

function genField(S, k, label, max) { const v = S.gen[k]; return `<div class="gfield"><span>${label}</span><span class="step"><button class="b icon" data-act="gen" data-k="${k}" data-v="${Math.max(0, v - 1)}">−</button><b>${v}</b><button class="b icon" data-act="gen" data-k="${k}" data-v="${Math.min(max, v + 1)}">＋</button></span></div>`; }
function genSeg(S, k, opts) { return `<span class="seg">${opts.map(([v, l]) => `<button class="${S.gen[k] === v ? "on" : ""}" data-act="gen" data-k="${k}" data-v="${v}">${l}</button>`).join("")}</span>`; }

function generatorPane(S, inFlow) {
  const g = S.gen;
  return `<div class="pbody gen"><div class="gform">
      <div class="gfield"><span>Seed</span><span style="display:flex;gap:6px"><input value="${g.seed}" style="width:84px" data-act="seed"><button class="b" data-act="gen" data-k="seed" data-v="roll">🎲 Würfeln</button></span></div>
      <div class="sub">Dorfform</div><div class="formgrid">${FORMS.map(([v, l]) => `<button class="b ${g.form === v ? "on" : ""}" data-act="gen" data-k="form" data-v="${v}">${l}</button>`).join("")}</div>
      <div class="sub">Karte</div>${genSeg(S, "size", [["klein", "Klein"], ["mittel", "Mittel"], ["gross", "Groß"]])} ${genSeg(S, "roads", [["gerade", "Wege gerade"], ["geschwungen", "geschwungen"]])}
      <div class="sub">Gebäude</div>${Object.entries(BUILD).map(([k, [, , l]]) => genField(S, k, l, k === "house" ? 12 : 4)).join("")}
      <div class="sub">Wasser</div>${genField(S, "lakes", "Seen", 4)}<div class="gfield"><span>Wasserlauf</span>${genSeg(S, "water", [["kein", "keiner"], ["bach", "Bach"], ["fluss", "Fluss"]])}</div>
      <div class="sub">Natur und Land</div><div class="gfield"><span>Wald</span>${genSeg(S, "forest", [["licht", "licht"], ["mittel", "mittel"], ["dicht", "dicht"]])}</div>
      ${genField(S, "trees", "Bäume im Dorf", 5)}${genField(S, "gardens", "Gärten", 5)}${genField(S, "fields", "Felder", 4)}</div>
    <div class="gview"><canvas data-gen="big"></canvas><div class="gstat" data-gen="stat"></div>
      <div class="sub">Andere Seeds mit denselben Stellgrößen</div><div class="gthumbs">${[1, 2, 3, 4].map((d) => `<button class="gthumb" data-act="gen" data-k="seed" data-v="${g.seed + d * 97}"><canvas data-gen="${g.seed + d * 97}"></canvas><small>Seed ${g.seed + d * 97}</small></button>`).join("")}</div>
      <div class="foot"><button class="b" data-act="back">← ${inFlow ? "Welt" : "Welten"}</button><span class="sp"></span><small>Schematischer Plan · im Spiel: echte Vorschau in Tiefe/Flach</small>
        ${inFlow ? `<button class="b">Im Editor nachbessern</button><button class="b gold" data-act="push" data-id="bewohner">Diese Welt nehmen →</button>` : `<button class="b">Als Welt speichern</button><button class="b gold" data-act="go" data-id="editor">Im Editor öffnen →</button>`}</div></div></div>`;
}

function drawGenerator(root, S) {
  root.querySelectorAll("canvas[data-gen]").forEach((cv) => { const big = cv.dataset.gen === "big", g = generate(big ? S.gen : { ...S.gen, seed: Number(cv.dataset.gen) });
    drawPlan(cv, g, big ? Math.floor(640 / g.W) : Math.max(1, Math.floor(150 / g.W)));
    if (big) { const st = root.querySelector("[data-gen=stat]"), formName = FORMS.find(([v]) => v === g.form)[1], pl = g.placed, want = Object.keys(BUILD).reduce((a, k) => a + S.gen[k], 0), got = Object.values(pl).reduce((a, b) => a + b, 0);
      st.innerHTML = `<b>${formName}</b>${S.gen.form === "zufall" ? " (gewürfelt)" : ""} · ${g.W} × ${g.H} · ${got} Gebäude${got < want ? ` <span style="color:var(--warn)">(${want - got} passten nicht)</span>` : ""} · ${g.lakes} ${g.lakes === 1 ? "See" : "Seen"} · ${g.water === "kein" ? "kein Wasserlauf" : g.water === "bach" ? "Bach" : "Fluss"} · ${g.gardens} Gärten · ${g.fields} Felder`; } });
}
