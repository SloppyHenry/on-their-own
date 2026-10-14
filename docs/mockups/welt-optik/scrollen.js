// SIMULACRA Mockup AP12, Schritt 0: Die Kamera fährt durch eine größere Welt (neun Dörfer aus Mockup A, durch Landstraßen verbunden).
// Alles stammt aus world.js (Boden, Sprites, Himmel, Effekte); neu ist nur, dass der gewölbte Boden pro Bild neu gelesen wird.
// Die Startlage der Kamera (192, 288) ist Bild A: Das Dorf in der Zelle (0, 0) ist dort Pixel für Pixel A (gleiche Textur, gleiche Schatten).
// Bewegungsarten: "frei" (scharf, Bruchteile), "schritte" (ganze Kachelschritte mit Gleiten), "weich" (beim Fahren gefiltert, im Stillstand scharf).
// Kein Produktionscode.

var S_PX = 460, S_PY = 330;                 // Zelle: ein Dorf samt Waldrand und Straße
var S_CH = 64;                              // Blockgröße des Bodens
var S_GAMMA = W_GAMMA, S_TH = W_TH;

function sMod(a, n) { return ((a % n) + n) % n; }
var S_WORLD = null;          // aktive Welt: { legacy, base(tx, ty), objects(), spriteFor(ob, lit, frame, cache), lights(ob), smoke(ob), cam, beds }

// ---- Boden ----
function sInLegacy(tx, ty) { return S_WORLD.legacy && tx >= 0 && ty >= 0 && tx < W_TW && ty < W_TH; }
function sRoad(tx, ty) {
  if (sInLegacy(tx, ty)) return false;       // Dorf A bleibt unverändert; Anschlüsse setzt später der Generator
  var cx = sMod(tx, S_PX), cy = sMod(ty, S_PY);
  return (Math.abs(cx - 192) < 5.2 && (cy >= 300 || cy < 150)) || (Math.abs(cy - 202) < 5.2 && (cx < 165 || cx >= 330));
}
function sBase(tx, ty) { return S_WORLD.base(tx, ty); }
function sBaseA(tx, ty) {
  var t = wTexel(sMod(tx, S_PX), sMod(ty, S_PY)), col = t[0], type = t[1];
  if ((type === 0 || type === 7) && sRoad(tx, ty)) {
    type = 1; col = wNoise(tx * 0.3, ty * 0.3, 4) < 0.45 ? WPA.path2 : WPA.path1; if (wHash(tx, ty, 2) > 0.965) col = WPA.pebble;
  }
  return [col, type];
}

// Die Textur von A (Zelle 0, 0) genau wie in createWorld: Texel, Gräser, Blumen, Seerosen, Beetpflanzen, Schatten.
function sLegacy(objs, cache) {
  var tex = new Uint8ClampedArray(W_TW * W_TH * 4), x, y, i;
  for (y = 0; y < W_TH; y++) for (x = 0; x < W_TW; x++) { var v = wTexel(x, y), o = (y * W_TW + x) * 4; tex[o] = v[0][0]; tex[o + 1] = v[0][1]; tex[o + 2] = v[0][2]; tex[o + 3] = v[1]; }
  function setT(tx, ty, c) { if (tx < 0 || ty < 0 || tx >= W_TW || ty >= W_TH) return; var o = (ty * W_TW + tx) * 4; tex[o] = c[0]; tex[o + 1] = c[1]; tex[o + 2] = c[2]; }
  function typeAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= W_TW || ty >= W_TH) return 255; return tex[(ty * W_TW + tx) * 4 + 3]; }
  var R = wRng(5);
  for (i = 0; i < 1400; i++) { x = Math.floor(R() * W_TW); y = Math.floor(R() * W_TH); var t0 = typeAt(x, y); if (t0 === 0 || t0 === 7) { var dk = t0 === 7 ? WPA.wild3 : WPA.grassDark; setT(x, y - 1, dk); setT(x - 1, y, dk); setT(x + 1, y, dk); } }
  var FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
  for (i = 0; i < 260; i++) {
    var fx = Math.floor(R() * W_TW), fy = Math.floor(R() * W_TH), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
    for (var j = 0; j < n2; j++) {
      var px = fx + Math.round((R() - 0.5) * 9), py = fy + Math.round((R() - 0.5) * 7), tt = typeAt(px, py);
      if (tt !== 0 && tt !== 7) continue;
      if (big) { setT(px - 1, py, fc); setT(px + 1, py, fc); setT(px, py - 1, fc); setT(px, py + 1, fc); setT(px, py, WPA.fY); } else setT(px, py, fc);
    }
  }
  for (i = 0; i < 12; i++) {
    var lx = W_OX + W_LAKE.x + Math.round((R() - 0.5) * 60), ly = W_OY + W_LAKE.y + Math.round((R() - 0.5) * 50);
    if (typeAt(lx, ly) === 2 && typeAt(lx + 2, ly) === 2) { setT(lx, ly, WPA.leaf2); setT(lx + 1, ly, WPA.leaf2); setT(lx + 2, ly, WPA.leaf3); setT(lx + 1, ly - 1, WPA.leaf2); if (R() < 0.5) setT(lx + 1, ly - 1, WPA.fP); }
  }
  sBeds(setT, 0, 0);
  for (i = 0; i < objs.length; i++) {
    var ob = objs[i]; if (ob.cell !== 0 || ob.kind === 'boat') continue;
    var sp = S_WORLD.spriteFor(ob, false, 0, cache);
    sShadow(tex, W_TW, 0, 0, W_TW, W_TH, ob.wx, ob.wy, sp.width, true);
  }
  return tex;
}
function sBeds(setT, ox, oy) {
  for (var i = 0; i < W_BEDS.length; i++) {
    var b = W_BEDS[i];
    for (var x = b[0] + 3; x < b[0] + b[2] - 2; x += 4) {
      var bx = x + W_OX + ox, by = b[1] + 4 + W_OY + oy;
      if (i === 1) { setT(bx, by, WPA.leaf1); setT(bx + 1, by, WPA.leaf2); setT(bx, by + 1, WPA.leaf2); setT(bx + 1, by + 1, WPA.leaf3); setT(bx - 1, by, WPA.leaf3); setT(bx + 2, by + 1, WPA.leaf3); }
      else { setT(bx, by, WPA.leaf2); setT(bx - 1, by - 1, WPA.leaf1); setT(bx + 1, by - 1, WPA.leaf1); setT(bx, by + 1, WPA.leaf3); }
    }
  }
}
// Schatten eines Objekts wie in A (Ellipse, 28 % dunkler) in einen Puffer, dessen Texel (x0, y0) bis (x0 + w, y0 + h) abdeckt
function sShadow(buf, bw, x0, y0, w, h, wx, wy, sw, zeroBased) {
  var rx = sw * 0.42, ry = Math.max(2, sw * 0.16), cx = wx + rx * 0.3, cy = wy + 0.5;
  for (var y = Math.floor(cy - ry); y <= cy + ry; y++) for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
    var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy > 1 || x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) continue;
    var q = ((y - y0) * bw + (x - x0)) * 4; buf[q] *= 0.72; buf[q + 1] *= 0.72 * 1.02; buf[q + 2] *= 0.72 * 1.12;
  }
}

function sMakeGround(objs, cache) {
  var legacy = S_WORLD.legacy ? sLegacy(objs, cache) : null, chunks = {}, built = 0;
  // Gröbere Stufe fürs Herauszoomen: ein Block deckt 64 × lod Texel ab und liest jeden lod-ten Texel (ohne Gräser und Schatten)
  function buildCoarse(ci, cj, lod) {
    var buf = new Uint8ClampedArray(S_CH * S_CH * 4), x0 = ci * S_CH * lod, y0 = cj * S_CH * lod;
    for (var y = 0; y < S_CH; y++) for (var x = 0; x < S_CH; x++) {
      var tx = x0 + x * lod, ty = y0 + y * lod, o = (y * S_CH + x) * 4;
      if (sInLegacy(tx, ty)) { var lo = (ty * W_TW + tx) * 4; buf[o] = legacy[lo]; buf[o + 1] = legacy[lo + 1]; buf[o + 2] = legacy[lo + 2]; buf[o + 3] = legacy[lo + 3]; }
      else { var v = sBase(tx, ty); buf[o] = v[0][0]; buf[o + 1] = v[0][1]; buf[o + 2] = v[0][2]; buf[o + 3] = v[1]; }
    }
    return buf;
  }
  function build(ci, cj) {
    var buf = new Uint8ClampedArray(S_CH * S_CH * 4), x0 = ci * S_CH, y0 = cj * S_CH, x, y, i;
    for (y = 0; y < S_CH; y++) for (x = 0; x < S_CH; x++) {
      var tx = x0 + x, ty = y0 + y, o = (y * S_CH + x) * 4;
      if (sInLegacy(tx, ty)) { var lo = (ty * W_TW + tx) * 4; buf[o] = legacy[lo]; buf[o + 1] = legacy[lo + 1]; buf[o + 2] = legacy[lo + 2]; buf[o + 3] = legacy[lo + 3]; }
      else { var v = sBase(tx, ty); buf[o] = v[0][0]; buf[o + 1] = v[0][1]; buf[o + 2] = v[0][2]; buf[o + 3] = v[1]; }
    }
    function typeAt(tx, ty) { if (tx < x0 || ty < y0 || tx >= x0 + S_CH || ty >= y0 + S_CH) return 255; return buf[((ty - y0) * S_CH + (tx - x0)) * 4 + 3]; }
    function setT(tx, ty, c) { if (tx < x0 || ty < y0 || tx >= x0 + S_CH || ty >= y0 + S_CH || sInLegacy(tx, ty)) return; var o = ((ty - y0) * S_CH + (tx - x0)) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; }
    var R = wRng((ci * 73856093) ^ (cj * 19349663) ^ 5), nT = 52, nF = 10;       // Dichte wie in A (1400 / 260 je 384 × 288)
    for (i = 0; i < nT; i++) { x = x0 + Math.floor(R() * S_CH); y = y0 + Math.floor(R() * S_CH); var t0 = typeAt(x, y); if (t0 === 0 || t0 === 7) { var dk = t0 === 7 ? WPA.wild3 : WPA.grassDark; setT(x, y - 1, dk); setT(x - 1, y, dk); setT(x + 1, y, dk); } }
    var FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
    for (i = 0; i < nF; i++) {
      var fx = x0 + Math.floor(R() * S_CH), fy = y0 + Math.floor(R() * S_CH), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
      for (var j = 0; j < n2; j++) {
        var px = fx + Math.round((R() - 0.5) * 9), py = fy + Math.round((R() - 0.5) * 7), tt = typeAt(px, py);
        if (tt !== 0 && tt !== 7) continue;
        if (big) { setT(px - 1, py, fc); setT(px + 1, py, fc); setT(px, py - 1, fc); setT(px, py + 1, fc); setT(px, py, WPA.fY); } else setT(px, py, fc);
      }
    }
    if (S_WORLD.beds) for (var cx = Math.floor((x0 - W_OX) / S_PX) - 1; cx <= Math.floor((x0 + S_CH) / S_PX); cx++) for (var cy = Math.floor((y0 - W_OY) / S_PY) - 1; cy <= Math.floor((y0 + S_CH) / S_PY); cy++) {
      if (cx === 0 && cy === 0) continue;
      sBeds(setT, cx * S_PX, cy * S_PY);
    }
    for (i = 0; i < objs.length; i++) {
      var ob = objs[i]; if (ob.cell === 0 || ob.kind === 'boat') continue;
      if (ob.wx < x0 - 40 || ob.wx > x0 + S_CH + 40 || ob.wy < y0 - 12 || ob.wy > y0 + S_CH + 12) continue;
      sShadow(buf, S_CH, x0, y0, S_CH, S_CH, ob.wx, ob.wy, S_WORLD.spriteFor(ob, false, 0, cache).width);
    }
    // Schatten der Objekte aus Zelle 0 auf Texel außerhalb von A (Bäume am Rand)
    for (i = 0; i < objs.length; i++) {
      var o0 = objs[i]; if (o0.cell !== 0 || o0.kind === 'boat') continue;
      if (o0.wx < x0 - 40 || o0.wx > x0 + S_CH + 40 || o0.wy < y0 - 12 || o0.wy > y0 + S_CH + 12) continue;
      var rx = S_WORLD.spriteFor(o0, false, 0, cache).width * 0.42, ry = Math.max(2, S_WORLD.spriteFor(o0, false, 0, cache).width * 0.16), cxx = o0.wx + rx * 0.3, cyy = o0.wy + 0.5;
      for (y = Math.floor(cyy - ry); y <= cyy + ry; y++) for (x = Math.floor(cxx - rx); x <= cxx + rx; x++) {
        var ddx = (x + 0.5 - cxx) / rx, ddy = (y + 0.5 - cyy) / ry;
        if (ddx * ddx + ddy * ddy > 1 || x < x0 || y < y0 || x >= x0 + S_CH || y >= y0 + S_CH || sInLegacy(x, y)) continue;
        var q = ((y - y0) * S_CH + (x - x0)) * 4; buf[q] *= 0.72; buf[q + 1] *= 0.72 * 1.02; buf[q + 2] *= 0.72 * 1.12;
      }
    }
    built++;
    return buf;
  }
  return {
    chunk: function (ci, cj, lod) {
      var k = lod + ':' + ci + ',' + cj;
      return chunks[k] || (chunks[k] = lod > 1 ? buildCoarse(ci, cj, lod) : build(ci, cj));
    },
    built: function () { return built; }
  };
}

// ---- Welt: neun Dörfer (3 × 3), Objekte in Weltkoordinaten ----
function sObjectsA() {
  var base = wObjects(), out = [], ci, cj, i;
  function nearRoad(wx, wy) {
    var cx = sMod(wx, S_PX), cy = sMod(wy, S_PY);
    return (Math.abs(cx - 192) < 11 && (cy >= 296 || cy < 154)) || (Math.abs(cy - 202) < 11 && (cx < 169 || cx >= 326));
  }
  for (cj = -1; cj <= 3; cj++) for (ci = -1; ci <= 3; ci++) {
    var cell = ci === 0 && cj === 0 ? 0 : 1;
    for (i = 0; i < base.length; i++) {
      var b = base[i];
      if (cell && (b.kind === 'alex' || b.kind === 'mira')) continue;
      var wx = b.vx + W_OX + ci * S_PX, wy = b.vy + W_OY + cj * S_PY;
      if (cell && !(wx >= 0 && wy >= 0 && wx < W_TW && wy < W_TH) && nearRoad(wx, wy) && /^(tree|pine|bush|rock)/.test(b.kind)) continue;
      out.push({ kind: b.kind, vx: b.vx, vy: b.vy, extra: b.extra, wx: wx, wy: wy, cell: cell });
    }
  }
  out.sort(function (a, c) { return a.wy - c.wy; });
  return out;
}

function sWorldA() {
  return {
    legacy: true, beds: true, cam: [192, 288], base: sBaseA, objects: sObjectsA,
    spriteFor: function (ob, lit, frame, cache) { return wSpriteFor(ob, lit, frame, cache); },
    lights: function (ob) { return ob.kind === 'lamp' ? [[0, 0, 24, 1]] : ob.kind === 'house' ? [[-17, 0, 32, 1], [17, 0, 32, 1], [0, 0, 59, 0.8], [9, 0, 31, 0.7]] : null; },
    smoke: function (ob) { return ob.kind === 'house' ? 19 : null; }
  };
}

// ---- Projektion mit beweglicher Kamera (camX, camY = Texel am unteren Bildrand, Mitte); Startlage (192, 288) = A ----
function sProject(cam, tx, ty, curve, zo) {
  zo = zo || 1;
  var t = Math.pow(Math.max(0, (cam.y - ty) / (S_TH * zo)), 1 / S_GAMMA), s = (0.62 + 0.9 * t) * zo;
  var x = 160 + (tx - cam.x) / s, k = (x - 160) / 160, yh = 34 + 14 * (curve == null ? 1 : curve) * k * k;
  return { x: x, y: W_LH - t * (W_LH - yh), sc: 1 / s, t: t };
}
var S_FOCUS = Math.pow((W_LH - 100) / (W_LH - 34), S_GAMMA);   // Boden in Bildmitte: S_FOCUS · S_TH Texel vor dem unteren Bildrand (bei 1×)
var S_ZOOMS = [0.25, 0.5, 1, 2, 4];

function sCreate(canvas, opts) {
  var T = W_TIMES[opts.zeit] || W_TIMES.Mittag, lit = !!T.lights, SC = 4;
  var ctx = canvas.getContext('2d');
  var low = document.createElement('canvas'); low.width = W_LW; low.height = W_LH;
  var lg = low.getContext('2d');
  var groundC = document.createElement('canvas'); groundC.width = W_LW; groundC.height = W_LH;
  var gg = groundC.getContext('2d');
  var out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
  var og = out.getContext('2d');
  var tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
  var tg = tmp.getContext('2d');
  var haze = wHex(T.haze), cache = {}, i, x, y;
  S_WORLD = opts.world || sWorldA();
  var objs = S_WORLD.objects(), ground = sMakeGround(objs, cache);

  // Abbildung Pixel → Boden, wie in createWorld (Horizontkurve, Wölbung), vorab je Pixel
  var N = W_LW * W_LH, offX = new Float32Array(N), offY = new Float32Array(N), fogA = new Float32Array(N), skyM = new Uint8Array(N), mapCurve = -1, mapZo = 1;
  function buildMap(curve, zo) {
    mapCurve = curve; mapZo = zo;
    for (var y = 0; y < W_LH; y++) for (var x = 0; x < W_LW; x++) {
      var o = y * W_LW + x, kx = (x - 160) / 160, yh = 34 + 14 * curve * kx * kx;
      if (y < yh) { skyM[o] = 1; continue; }
      skyM[o] = 0;
      var t = (W_LH - y) / (W_LH - yh), s = 0.62 + 0.9 * t;
      offX[o] = (x - 160) * s * zo; offY[o] = -S_TH * zo * Math.pow(t, S_GAMMA); fogA[o] = Math.pow(t, 2.2) * 0.55;
    }
  }
  buildMap(1, 1);
  var gimg = gg.createImageData(W_LW, W_LH), gd = gimg.data;

  var sky = document.createElement('canvas'); sky.width = W_LW; sky.height = 70;
  var sg = sky.getContext('2d'), grad = sg.createLinearGradient(0, 0, 0, 60); grad.addColorStop(0, T.skyTop); grad.addColorStop(1, T.skyBot);
  sg.fillStyle = grad; sg.fillRect(0, 0, W_LW, 70);
  if (T.stars) { var RS = wRng(3); for (i = 0; i < 70; i++) { sg.fillStyle = RS() < 0.2 ? '#fff6c8' : '#dfe6ff'; sg.fillRect(Math.floor(RS() * W_LW), Math.floor(RS() * 40), 1, 1); } sg.fillStyle = '#fff4d6'; sg.beginPath(); sg.arc(250, 14, 6, 0, 7); sg.fill(); sg.fillStyle = T.skyTop; sg.beginPath(); sg.arc(253, 12, 5.5, 0, 7); sg.fill(); }
  var hills = document.createElement('canvas'); hills.width = W_LW; hills.height = 70;
  var hg = hills.getContext('2d'), hc = wHex(T.haze), hc2 = wHex(T.skyBot);
  function drawHills(curve) {
    hg.clearRect(0, 0, W_LW, 70);
    for (var x = 0; x < W_LW; x++) {
      var kk = (x - 160) / 160, yhx = 34 + 14 * curve * kk * kk, top1 = yhx - 9 - 7 * wNoise(x * 0.025, 0, 3), top2 = yhx - 4 - 4 * wNoise(x * 0.05, 1, 4);
      hg.fillStyle = 'rgb(' + Math.round(hc[0] * 0.78 + hc2[0] * 0.1) + ',' + Math.round(hc[1] * 0.86 + hc2[1] * 0.08) + ',' + Math.round(hc[2] * 0.95) + ')'; hg.fillRect(x, Math.round(top1), 1, 70);
      hg.fillStyle = 'rgb(' + Math.round(hc[0] * 0.62) + ',' + Math.round(hc[1] * 0.78) + ',' + Math.round(hc[2] * 0.8) + ')'; hg.fillRect(x, Math.round(top2), 1, 70);
    }
  }
  drawHills(1);
  var clouds = document.createElement('canvas'); clouds.width = W_LW * 2; clouds.height = 40;
  var cg = clouds.getContext('2d'), cimg = cg.createImageData(W_LW * 2, 40), cd = cimg.data, cw = wHex(T.stars ? '#4a5288' : '#ffffff'), cs = wHex(T.stars ? '#3a4074' : T.skyBot);
  for (y = 0; y < 40; y++) for (x = 0; x < W_LW * 2; x++) {
    var nv = wNoise(x * 0.035, y * 0.11, 8) * 0.7 + wNoise(x * 0.09, y * 0.25, 9) * 0.3 - (Math.abs(y - 14) / 30), oo = (y * W_LW * 2 + x) * 4;
    if (nv > 0.5) { var shade = nv < 0.56 || y > 17 ? cs : cw; cd[oo] = shade[0]; cd[oo + 1] = shade[1]; cd[oo + 2] = shade[2]; cd[oo + 3] = 235; }
  }
  cg.putImageData(cimg, 0, 0);

  var particles = [], RP = wRng(21);
  for (i = 0; i < 26; i++) particles.push({ x: RP() * canvas.width, y: 200 + RP() * (canvas.height - 240), p: RP() * 6.28, sp: 0.3 + RP() * 0.6, c: RP() });
  var hasFilter = typeof ctx.filter === 'string';

  // ---- Zustand ----
  var st = { mode: opts.mode || 'weich', zoom: 1, zo: 1, cam: { x: S_WORLD.cam[0], y: S_WORLD.cam[1] }, target: { x: S_WORLD.cam[0], y: S_WORLD.cam[1] }, keys: {}, moving: 0, speed: 0, auto: !!opts.auto, autoStep: 0, hold: 0, drag: null };
  if (opts.cam) { st.cam.x = st.target.x = opts.cam[0]; st.cam.y = st.target.y = opts.cam[1]; }
  var mapCurve0 = 1, perf = [], last = 0, lastFrame = 0, start = performance.now(), raf = 0, prevCam = { x: st.cam.x, y: st.cam.y };

  function sample(tx, ty, lod) {
    var ch = ground.chunk(tx >> 6, ty >> 6, lod);
    return ch.subarray((((ty & 63) << 6) + (tx & 63)) * 4);
  }

  function drawGround(tm, soft) {
    var cx = st.cam.x, cy = st.cam.y, k, o, lod = st.zo;
    if (lod > 1) soft = 1;                      // herausgezoomt: immer gemischt (sonst flimmern feine Muster)
    for (o = 0; o < N; o++) {
      if (skyM[o]) { gd[o * 4 + 3] = 0; continue; }
      var fx = (cx + offX[o]) / lod, fy = (cy + offY[o]) / lod, tx = Math.floor(fx), ty = Math.floor(fy), p = sample(tx, ty, lod), r = p[0], g = p[1], b = p[2];
      if (soft > 0.003) {                       // Fahrt: vier Texel gemischt statt einem (kein Krisseln), im Stillstand wieder scharf
        var ax = fx - tx, ay = fy - ty, p2 = sample(tx + 1, ty, lod), p3 = sample(tx, ty + 1, lod), p4 = sample(tx + 1, ty + 1, lod), w1 = (1 - ax) * (1 - ay), w2 = ax * (1 - ay), w3 = (1 - ax) * ay, w4 = ax * ay;
        r += (p[0] * w1 + p2[0] * w2 + p3[0] * w3 + p4[0] * w4 - r) * soft; g += (p[1] * w1 + p2[1] * w2 + p3[1] * w3 + p4[1] * w4 - g) * soft; b += (p[2] * w1 + p2[2] * w2 + p3[2] * w3 + p4[2] * w4 - b) * soft;
      }
      if (p[3] === 2) {                         // Wasserglitzern wie in A
        var sh = Math.sin(tx * lod * 0.55 + tm * 2.1) * Math.sin(ty * lod * 1.25 - tm * 1.6);
        if (sh > 0.86) { r = 240; g = 252; b = 255; } else if (sh > 0.6) { r = Math.min(255, r + 26); g = Math.min(255, g + 22); b = Math.min(255, b + 12); }
      }
      var fog = fogA[o], q = o * 4;
      gd[q] = r + (haze[0] - r) * fog; gd[q + 1] = g + (haze[1] - g) * fog; gd[q + 2] = b + (haze[2] - b) * fog; gd[q + 3] = 255;
    }
    gg.putImageData(gimg, 0, 0);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016); last = now;
    var t0 = performance.now(), tm = (now - start) / 1000;
    // Bewegung
    var kx = (st.keys.KeyD || st.keys.ArrowRight ? 1 : 0) - (st.keys.KeyA || st.keys.ArrowLeft ? 1 : 0), ky = (st.keys.KeyS || st.keys.ArrowDown ? 1 : 0) - (st.keys.KeyW || st.keys.ArrowUp ? 1 : 0);
    var v = 90 * st.zo * (st.keys.ShiftLeft || st.keys.ShiftRight ? 2 : 1);
    if (st.auto) {
      var legs = [[1, 0, 460], [0, 1, 330], [-1, 0, 460], [0, -1, 330]], L = legs[st.autoStep % 4];
      kx = L[0]; ky = L[1]; v = 70; st.autoDone = (st.autoDone || 0) + v * dt;
      if (st.autoDone >= L[2]) { st.autoDone = 0; st.autoStep++; }
    }
    if (st.mode === 'schritte') {
      st.hold -= dt;
      if ((kx || ky) && st.hold <= 0) { st.target.x += kx * 16; st.target.y += ky * 16; st.hold = 16 / v; }
      var a = 1 - Math.exp(-dt * 12);
      st.cam.x += (st.target.x - st.cam.x) * a; st.cam.y += (st.target.y - st.cam.y) * a;
      if (Math.abs(st.target.x - st.cam.x) < 0.02 && Math.abs(st.target.y - st.cam.y) < 0.02) { st.cam.x = st.target.x; st.cam.y = st.target.y; }
    } else {
      var n = Math.hypot(kx, ky) || 1;
      st.cam.x += (kx / n) * v * dt; st.cam.y += (ky / n) * v * dt; st.target.x = st.cam.x; st.target.y = st.cam.y;
    }
    var spd = Math.hypot(st.cam.x - prevCam.x, st.cam.y - prevCam.y) / dt; prevCam.x = st.cam.x; prevCam.y = st.cam.y;
    st.moving += ((spd > 2 ? 1 : 0) - st.moving) * (1 - Math.exp(-dt * (spd > 2 ? 14 : 9)));
    var soft = st.mode === 'weich' || st.mode === 'gerade' ? (st.moving < 0.02 ? 0 : st.moving) : 0;
    var curve = st.mode === 'gerade' ? Math.round((1 - st.moving) * 50) / 50 : 1;     // Fahrt „gerade“: Horizontkrümmung verschwindet beim Fahren
    if (curve !== mapCurve || st.zo !== mapZo) { buildMap(curve, st.zo); if (curve !== mapCurve0) drawHills(curve); mapCurve0 = curve; }
    function snap(v) { var r = Math.round(v); return r + (v - r) * soft; }              // im Stillstand ganze Pixel, beim Fahren Bruchteile

    {                                                  // jedes Bild neu (A zeichnet nur 25 je Sekunde; beim Fahren wäre das ruckelig)
      var fr = Math.floor(tm * 2) % 2;
      drawGround(tm, soft);
      lg.imageSmoothingEnabled = soft > 0.05 || st.zo > 1;
      lg.clearRect(0, 0, W_LW, W_LH);
      lg.drawImage(sky, 0, 0);
      var off = (tm * 3) % (W_LW * 2);
      lg.drawImage(clouds, -off, 2); lg.drawImage(clouds, W_LW * 2 - off, 2);
      lg.drawImage(hills, 0, 0);
      lg.drawImage(groundC, 0, 0);
      var cam = st.cam, houses = [];
      for (var n2 = 0; n2 < objs.length; n2++) {
        var ob = objs[n2];
        if (ob.wy > cam.y + 6 * st.zo || ob.wy < cam.y - S_TH * st.zo - 4) continue;
        var pr = sProject(cam, ob.wx, ob.wy, curve, st.zo);
        if (pr.x < -60 || pr.x > W_LW + 60 || pr.y < 0) continue;
        var anim = (ob.kind === 'alex' || ob.kind === 'mira') ? fr : 0, spr = S_WORLD.spriteFor(ob, lit, anim, cache);
        var sw = spr.width * pr.sc, shh = spr.height * pr.sc, bob = ob.kind === 'boat' ? Math.sin(tm * 1.8) * 0.8 * pr.sc : 0;
        lg.drawImage(spr, snap(pr.x - sw / 2), snap(pr.y - shh + bob), snap(sw), snap(shh));
        if (S_WORLD.smoke(ob) != null) houses.push(ob);
      }
      for (var h = 0; h < houses.length; h++) {
        var ch = sProject(cam, houses[h].wx + S_WORLD.smoke(houses[h]), houses[h].wy, curve, st.zo);
        for (var k2 = 0; k2 < 5; k2++) {
          var age = ((tm * 0.35 + k2 / 5) % 1), sx = ch.x + (Math.sin(age * 5 + k2) * 3 + age * 8) * ch.sc, sy = ch.y - (78 + age * 26) * ch.sc, rad = (1.5 + age * 3.5) * ch.sc;
          lg.globalAlpha = (1 - age) * 0.75; lg.fillStyle = T.stars ? '#8a90b8' : '#f4f1ec';
          lg.fillRect(Math.round(sx - rad), Math.round(sy - rad), Math.round(rad * 2), Math.round(rad * 2));
        }
      }
      lg.globalAlpha = 1;

      og.imageSmoothingEnabled = false;
      og.globalCompositeOperation = 'source-over';
      og.drawImage(low, 0, 0, out.width, out.height);
      if (T.grade !== '#ffffff') { og.globalCompositeOperation = 'multiply'; og.fillStyle = T.grade; og.fillRect(0, 0, out.width, out.height); }
      if (T.glowA) {
        og.globalCompositeOperation = 'lighter';
        for (var n3 = 0; n3 < objs.length; n3++) {
          var lo = objs[n3]; if (lo.wy > cam.y + 6 * st.zo || lo.wy < cam.y - S_TH * st.zo) continue;
          var ls = S_WORLD.lights(lo);
          if (!ls) continue;
          for (var q = 0; q < ls.length; q++) {
            var Lq = ls[q], lp = sProject(cam, lo.wx + Lq[0], lo.wy, curve, st.zo), gx = lp.x * SC, gy = (lp.y - Lq[2] * lp.sc) * SC, gr = 58 * lp.sc * Lq[3];
            if (gx < -80 || gx > out.width + 80) continue;
            var rg = og.createRadialGradient(gx, gy, 0, gx, gy, gr);
            rg.addColorStop(0, 'rgba(255,205,120,' + T.glowA + ')'); rg.addColorStop(0.35, 'rgba(255,170,90,' + T.glowA * 0.4 + ')'); rg.addColorStop(1, 'rgba(255,150,80,0)');
            og.fillStyle = rg; og.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
          }
        }
      }
      og.globalCompositeOperation = 'source-over';
      if (hasFilter) {
        tg.clearRect(0, 0, tmp.width, tmp.height);
        tg.filter = 'blur(5px)'; tg.drawImage(out, 0, 0); tg.filter = 'none';
        tg.globalCompositeOperation = 'destination-in';
        var mg = tg.createLinearGradient(0, 0, 0, tmp.height);
        mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.2, 'rgba(0,0,0,0.85)'); mg.addColorStop(0.36, 'rgba(0,0,0,0)'); mg.addColorStop(0.84, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,0.75)');
        tg.fillStyle = mg; tg.fillRect(0, 0, tmp.width, tmp.height);
        tg.globalCompositeOperation = 'source-over';
        og.drawImage(tmp, 0, 0);
      }
      for (var k3 = 0; k3 < particles.length; k3++) {
        var pa = particles[k3], px3 = (pa.x + Math.sin(tm * pa.sp + pa.p) * 30 + tm * 6) % out.width, py3 = pa.y + Math.cos(tm * pa.sp * 1.3 + pa.p) * 18;
        var bx = Math.round(px3 / 4) * 4, by = Math.round(py3 / 4) * 4;
        if (T.stars) { var fa = 0.5 + 0.5 * Math.sin(tm * 2 + pa.p * 3); og.fillStyle = 'rgba(214,255,140,' + fa + ')'; og.fillRect(bx, by, 4, 4); og.fillStyle = 'rgba(214,255,140,' + fa * 0.25 + ')'; og.fillRect(bx - 4, by - 4, 12, 12); }
        else if (opts.zeit === 'Abend') { og.fillStyle = pa.c < 0.5 ? '#ffc2d6' : '#fff0f5'; og.fillRect(bx, by, 4, 4); }
        else if (k3 < 6) { var wing = Math.sin(tm * 14 + pa.p) > 0; og.fillStyle = pa.c < 0.5 ? '#ffffff' : '#ffd94f'; og.fillRect(bx - 4, by, 4, wing ? 4 : 2); og.fillRect(bx + 4, by, 4, wing ? 4 : 2); og.fillStyle = '#5a4a3a'; og.fillRect(bx, by, 4, 4); }
      }
      var vg = og.createRadialGradient(out.width / 2, out.height * 0.55, out.height * 0.45, out.width / 2, out.height * 0.55, out.height * 0.95);
      vg.addColorStop(0, 'rgba(30,20,40,0)'); vg.addColorStop(1, T.stars ? 'rgba(5,8,25,0.55)' : 'rgba(40,25,40,0.28)');
      og.fillStyle = vg; og.fillRect(0, 0, out.width, out.height);
    }
    // Anzeige in ganzzahliger Vergrößerung um die Bildmitte
    ctx.imageSmoothingEnabled = false;
    var Z = st.zoom, cw2 = canvas.width / Z, ch2 = canvas.height / Z;
    ctx.drawImage(out, (canvas.width - cw2) / 2, (canvas.height - ch2) / 2, cw2, ch2, 0, 0, canvas.width, canvas.height);
    perf.push(performance.now() - t0); if (perf.length > 120) perf.shift();
    if (opts.onFrame) opts.onFrame(st, perf, ground.built());
  }

  var offs = [];
  function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); offs.push(function () { el.removeEventListener(ev, fn, o); }); }
  function key(e, down) { if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { st.keys[e.code] = down; st.auto = false; e.preventDefault(); } }
  on(window, 'keydown', function (e) { key(e, true); });
  on(window, 'keyup', function (e) { key(e, false); });
  on(canvas, 'pointerdown', function (e) { st.drag = { x: e.clientX, y: e.clientY }; st.auto = false; canvas.setPointerCapture(e.pointerId); });
  on(canvas, 'pointerup', function () { st.drag = null; });
  on(canvas, 'pointermove', function (e) {
    if (!st.drag) return;
    var k = canvas.width / canvas.getBoundingClientRect().width, dx = (e.clientX - st.drag.x) * k / (SC * st.zoom), dy = (e.clientY - st.drag.y) * k / (SC * st.zoom);
    st.drag.x = e.clientX; st.drag.y = e.clientY;
    st.cam.x -= dx * 1.05 * st.zo; st.cam.y -= dy * 1.1 * st.zo; st.target.x = st.cam.x; st.target.y = st.cam.y;
  });
  // Zoom in ganzen Stufen: 1/4×, 1/2× (Boden gröber, Bild zeigt mehr Welt), 1×, 2×, 4× (Ausschnitt vergrößert). Die Bildmitte bleibt am Ort.
  function setZoom(v) {
    var zoNew = v < 1 ? Math.round(1 / v) : 1, focus = st.cam.y - S_TH * st.zo * S_FOCUS;
    st.zo = zoNew; st.zoom = v > 1 ? v : 1; st.target.y = st.cam.y = focus + S_TH * zoNew * S_FOCUS;
    if (opts.onZoom) opts.onZoom(v);
  }
  function step(d) { var i = S_ZOOMS.indexOf(st.zo > 1 ? 1 / st.zo : st.zoom); setZoom(S_ZOOMS[Math.max(0, Math.min(S_ZOOMS.length - 1, i + d))]); }
  // Mausrad und Trackpad: genau eine Stufe je Raste oder Wisch (das Nachlaufen eines Wischs zählt nicht noch einmal)
  var wheelAt = -1e9;
  on(canvas, 'wheel', function (e) {
    e.preventDefault();
    var now = performance.now(), dy = e.deltaY * (e.deltaMode === 1 ? 30 : 1);
    if (now - wheelAt < 350 || Math.abs(dy) < 4) { if (Math.abs(dy) >= 4) wheelAt = now; return; }
    wheelAt = now; step(dy > 0 ? -1 : 1);
  }, { passive: false });
  on(window, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'BracketRight') step(1);
    else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Slash') step(-1);
    else if (e.key === '0') setZoom(1);
  });
  if (opts.keepZoom) { st.zo = opts.keepZoom.zo; st.zoom = opts.keepZoom.zoom; } else setZoom(opts.zoom || 1);
  raf = requestAnimationFrame(frame);
  return { setZoom: setZoom, step: step, state: st, stop: function () { cancelAnimationFrame(raf); offs.forEach(function (f) { f(); }); }, ground: ground, perf: perf };
}
