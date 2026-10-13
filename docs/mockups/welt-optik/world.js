// SIMULACRA Welt-Mockup: Pixelwelt flach (mode "flat") oder mit gewölbter Tiefe (mode "mashup").
var W_LW = 320, W_LH = 200, W_SC = 4;
var W_TW = 384, W_TH = 288, W_OX = 64, W_OY = 96;
var W_GAMMA = 1.45, W_CX = 192;

function wHex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function wHash(x, y, s) { var n = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function wNoise(x, y, seed) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  var a = wHash(xi, yi, seed), b = wHash(xi + 1, yi, seed), c = wHash(xi, yi + 1, seed), d = wHash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function wRng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

var WP = {
  outline: '#3b2c3d',
  grass1: '#97d66e', grass2: '#7ec35c', grass3: '#68ae52', grassDark: '#539848', grassLight: '#b2e47f', wild1: '#5f9f4c', wild2: '#4f8c45', wild3: '#437c40',
  path1: '#efdaa8', path2: '#e0c48e', path3: '#c8a777', pebble: '#b49a7b',
  cob1: '#ddd4c4', cob2: '#c6bba9', cob3: '#a59a88', cobHi: '#efe9dd',
  water1: '#86dbf0', water2: '#5cc2e3', water3: '#3fa4d3', waterDeep: '#2e86c0', foam: '#eafcff',
  soil1: '#9c6b47', soil2: '#83573a',
  wood1: '#cf9159', wood2: '#a96f42', wood3: '#7c4e30',
  roof1: '#e6775c', roof2: '#cc5f48', roof3: '#a2463a',
  wall1: '#f6e9cc', wall2: '#e5d2ad', wall3: '#cbb38c',
  leaf1: '#8ad868', leaf2: '#67bb55', leaf3: '#4a9f4b', leaf4: '#327d44',
  trunk1: '#a06c45', trunk2: '#764b30',
  fP: '#ff9fc2', fY: '#ffd94f', fW: '#fffaf0', fB: '#93baff', fR: '#ff6b6b',
  stone1: '#d2cbc0', stone2: '#aca499', stone3: '#888077',
  glass: '#a6dcf2', glassLit: '#ffd88a', lamp: '#fff2c6', lampLit: '#ffd36e',
  skin: '#f7cba2', hairA: '#7a4a2b', hairM: '#3d2a3c', shirtA: '#efa24b', pantsA: '#4f6c9c', dressM: '#7fc48f', dressM2: '#5ea873'
};
var WPA = {}; for (var k in WP) WPA[k] = wHex(WP[k]);

var W_TIMES = {
  Morgen: { skyTop: '#a9cff2', skyBot: '#ffe2cb', haze: '#ffe8d6', grade: '#fff1e4', lights: 0, stars: 0, glowA: 0 },
  Mittag: { skyTop: '#6cb7f3', skyBot: '#cfefff', haze: '#e2f4ff', grade: '#ffffff', lights: 0, stars: 0, glowA: 0 },
  Abend: { skyTop: '#5d5ba8', skyBot: '#ffab79', haze: '#ffcaa2', grade: '#ffd2ad', lights: 1, stars: 0, glowA: 0.42 },
  Nacht: { skyTop: '#0f1534', skyBot: '#353b70', haze: '#3b4378', grade: '#6070b8', lights: 1, stars: 1, glowA: 0.75 }
};

// ---- Dorfplan (Dorfkoordinaten: 0..256 × 0..192) ----
var W_PATHS = [[[60, 60], [60, 80], [104, 100]], [[152, 102], [174, 97], [186, 93]], [[110, 120], [86, 146]], [[128, 130], [126, 160], [130, 200]]];
var W_SQ = { x: 128, y: 106, r: 27 };
var W_LAKE = { x: 222, y: 90, rx: 40, ry: 37 };
var W_GARDEN = { x0: 14, y0: 120, x1: 84, y1: 176 };
var W_BEDS = [[22, 127, 54, 9], [22, 141, 54, 9], [22, 155, 54, 9]];
var W_HOUSE = { x: 60, y: 60 };
var W_DOCK = { x0: 180, y0: 88, x1: 202, y1: 97 };

function wSeg(px, py, ax, ay, bx, by) { var dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); var x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y); }
function wPathDist(x, y) { var d = 1e9; for (var i = 0; i < W_PATHS.length; i++) { var pl = W_PATHS[i]; for (var j = 0; j < pl.length - 1; j++) d = Math.min(d, wSeg(x, y, pl[j][0], pl[j][1], pl[j + 1][0], pl[j + 1][1])); } return d; }
function wLake(x, y) { var a = (x - W_LAKE.x) / W_LAKE.rx, b = (y - W_LAKE.y) / W_LAKE.ry; return a * a + b * b + (wNoise(x * 0.09, y * 0.09, 7) - 0.5) * 0.45; }

// Bodentextur: Farbe und Art je Texel (0 Gras, 1 Weg, 2 Wasser, 3 Pflaster, 4 Beet, 5 Steg, 6 Sand, 7 Wildnis)
function wTexel(tx, ty) {
  var vx = tx - W_OX, vy = ty - W_OY, n = wNoise(tx * 0.13, ty * 0.13, 1), h = wHash(tx, ty, 2), g = n * 0.75 + h * 0.25;
  var edge = wNoise(ty * 0.06, tx * 0.02, 12) * 14; var inV = vx >= -6 - edge && vx < 262 + edge && vy >= -4 - edge * 0.5;
  if (!inV) return [g < 0.36 ? WPA.wild3 : g < 0.66 ? WPA.wild2 : WPA.wild1, 7];
  var col = g < 0.32 ? WPA.grass3 : g < 0.64 ? WPA.grass2 : WPA.grass1, type = 0;
  if ((tx + ty * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
  var lv = wLake(vx, vy);
  if (lv < 1) { type = 2; col = lv < 0.35 ? WPA.waterDeep : lv < 0.62 ? WPA.water3 : lv < 0.86 ? WPA.water2 : WPA.water1; if (lv > 0.95) col = WPA.foam; }
  else if (lv < 1.13) { type = 6; col = h < 0.5 ? WPA.path1 : WPA.path2; }
  if (vx >= W_DOCK.x0 && vx < W_DOCK.x1 && vy >= W_DOCK.y0 && vy < W_DOCK.y1) {
    type = 5; col = (vx - W_DOCK.x0) % 4 === 3 ? WPA.wood3 : (vy === W_DOCK.y0 || vy === W_DOCK.y1 - 1) ? WPA.wood2 : (h < 0.5 ? WPA.wood1 : WPA.wood2);
  }
  if (type === 0 || type === 6) {
    var dq = Math.hypot(vx - W_SQ.x, (vy - W_SQ.y) * 1.08);
    if (dq < W_SQ.r) {
      type = 3;
      if (dq > W_SQ.r - 2) col = WPA.stone3;
      else {
        var row = Math.floor(vy / 4), off = (row & 1) ? 2 : 0, cx = Math.floor((vx + off) / 5);
        if (vy % 4 === 0 || (vx + off) % 5 === 0) col = WPA.cob3;
        else if (vy % 4 === 1 && (vx + off) % 5 === 1) col = WPA.cobHi;
        else col = wHash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1;
      }
    } else {
      var dp = wPathDist(vx, vy);
      if (dp < 5.2) { type = 1; col = wNoise(tx * 0.3, ty * 0.3, 4) < 0.45 ? WPA.path2 : WPA.path1; if (h > 0.965) col = WPA.pebble; }
      else if (dp < 6.4 && type === 0) col = WPA.grassDark;
    }
    if (type === 0 && vx >= W_GARDEN.x0 && vx < W_GARDEN.x1 && vy >= W_GARDEN.y0 && vy < W_GARDEN.y1) {
      col = g < 0.5 ? WPA.grass1 : WPA.grassLight;
      for (var i = 0; i < W_BEDS.length; i++) {
        var b = W_BEDS[i];
        if (vx >= b[0] && vx < b[0] + b[2] && vy >= b[1] && vy < b[1] + b[3]) {
          type = 4; col = ((vy - b[1]) % 3 === 0) ? WPA.soil2 : WPA.soil1;
          if (vx === b[0] || vx === b[0] + b[2] - 1 || vy === b[1] + b[3] - 1) col = WPA.wood3;
        }
      }
    }
    if (vx >= W_HOUSE.x - 36 && vx < W_HOUSE.x + 36 && vy >= W_HOUSE.y - 30 && vy < W_HOUSE.y) col = WPA.path3;
  }
  return [col, type];
}

// ---- Pixel-Sprites ----
function wSprite(w, h, fn) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d');
  var s = {
    w: w, h: h, g: g,
    p: function (x, y, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1); },
    r: function (x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); },
    disc: function (cx, cy, rad, col) { g.fillStyle = col; for (var y = Math.floor(cy - rad); y <= cy + rad; y++) for (var x = Math.floor(cx - rad); x <= cx + rad; x++) { var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= rad * rad) g.fillRect(x, y, 1, 1); } },
    ell: function (cx, cy, rx, ry, col) { g.fillStyle = col; for (var y = Math.floor(cy - ry); y <= cy + ry; y++) for (var x = Math.floor(cx - rx); x <= cx + rx; x++) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1); } },
    outline: function (col) {
      var d = g.getImageData(0, 0, w, h), a = d.data, o = new Uint8Array(w * h), oc = wHex(col), i, x, y;
      for (i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 0 ? 1 : 0;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; if (o[i]) continue;
        if ((x > 0 && o[i - 1]) || (x < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w])) { a[i * 4] = oc[0]; a[i * 4 + 1] = oc[1]; a[i * 4 + 2] = oc[2]; a[i * 4 + 3] = 255; }
      }
      g.putImageData(d, 0, 0);
    }
  };
  fn(s); return c;
}

function wTree(variant, seed) {
  return wSprite(32, 42, function (s) {
    var R = wRng(seed);
    s.r(14, 28, 5, 12, WP.trunk1); s.r(17, 28, 2, 12, WP.trunk2); s.r(12, 38, 9, 2, WP.trunk2); s.p(13, 37, WP.trunk1);
    var L = variant === 2 ? ['#ffc6da', '#f7a0c0', '#e27da5', '#be5f88'] : [WP.leaf1, WP.leaf2, WP.leaf3, WP.leaf4];
    s.disc(16, 17, 13, L[3]); s.disc(9, 21, 7.5, L[3]); s.disc(23, 21, 7.5, L[3]);
    s.disc(15, 15, 11.5, L[2]); s.disc(9, 19, 6.2, L[2]); s.disc(22.5, 19, 6, L[2]);
    s.disc(14, 13, 9, L[1]); s.disc(20, 12, 5, L[1]); s.disc(8, 16, 4, L[1]);
    s.disc(12, 9, 4.6, L[0]); s.disc(18, 8, 2.6, L[0]);
    for (var k = 0; k < 34; k++) {
      var a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 11, x = Math.round(16 + Math.cos(a) * rr), y = Math.round(16 + Math.sin(a) * rr * 0.9);
      var shade = y > 16 ? L[3] : L[2];
      s.p(x, y, shade); s.p(x + 1, y, shade); s.p(x - 1, y - 1, y > 14 ? L[2] : L[0]);
    }
    if (variant === 1) for (var f = 0; f < 7; f++) { var ax = Math.round(7 + R() * 18), ay = Math.round(9 + R() * 14); s.r(ax, ay, 2, 2, WP.fR); s.p(ax, ay, '#ffd0c8'); }
    if (variant === 2) for (var q = 0; q < 10; q++) { s.p(Math.round(6 + R() * 20), Math.round(6 + R() * 18), WP.fW); }
    s.outline(WP.outline);
  });
}

function wPine(seed) {
  return wSprite(26, 46, function (s) {
    var C = ['#62b071', '#47975e', '#337b52', '#245f45'];
    s.r(11, 36, 4, 9, WP.trunk1); s.r(13, 36, 2, 9, WP.trunk2);
    for (var i = 0; i < 4; i++) {
      var top = 2 + i * 8, hw = 4 + i * 3, hgt = 13;
      for (var y = 0; y < hgt; y++) {
        var half = Math.round(hw * (y + 1) / hgt + 1);
        for (var x = -half; x <= half; x++) s.p(13 + x, top + y, x < -half / 3 ? C[0] : x < half / 3 ? C[1] : C[2]);
        s.p(13 - half, top + y, C[1]);
      }
      for (var x2 = -hw - 1; x2 <= hw + 1; x2 += 2) s.p(13 + x2, top + hgt - 1, C[3]);
    }
    s.outline(WP.outline);
  });
}

function wBush(seed, flowers) {
  return wSprite(20, 14, function (s) {
    var R = wRng(seed);
    s.ell(10, 8, 8.5, 5.5, WP.leaf4); s.ell(9, 7, 7.5, 4.6, WP.leaf3); s.ell(8, 6, 5, 3, WP.leaf2); s.ell(7, 5, 2.5, 1.5, WP.leaf1);
    if (flowers) for (var i = 0; i < 6; i++) { var x = Math.round(3 + R() * 14), y = Math.round(3 + R() * 7); s.p(x, y, flowers); s.p(x, y - 1, WP.fW); }
    s.outline(WP.outline);
  });
}

function wHouse(lit) {
  return wSprite(78, 80, function (s) {
    var y, x;
    s.r(55, 1, 8, 18, WP.stone2); s.r(55, 1, 3, 18, WP.stone1); s.r(54, 0, 10, 3, WP.stone3); for (y = 5; y < 18; y += 4) s.r(55, y, 8, 1, WP.stone3);
    for (y = 6; y <= 34; y++) {
      var l = Math.round(13 - (y - 6) * 11 / 28), r = Math.round(65 + (y - 6) * 11 / 28), row = (y - 6) % 5;
      for (x = l; x <= r; x++) {
        var c = row < 2 ? WP.roof1 : WP.roof2;
        if (row === 4 && ((x + Math.floor((y - 6) / 5) * 3) % 6 === 0)) c = WP.roof3;
        if (row === 4 && ((x + Math.floor((y - 6) / 5) * 3) % 6 === 1)) c = WP.roof3;
        if (x === l || x === r) c = WP.roof3;
        s.p(x, y, c);
      }
    }
    s.r(13, 5, 53, 2, WP.roof3); s.r(14, 4, 51, 1, WP.wood3);
    s.r(2, 34, 75, 2, WP.roof3);
    s.disc(39.5, 20.5, 5.5, WP.wood3); s.disc(39.5, 20.5, 4.2, lit ? WP.glassLit : WP.glass); s.r(39, 16, 1, 9, WP.wood1); s.r(35, 20, 9, 1, WP.wood1);
    if (!lit) { s.p(37, 18, '#e9f8ff'); s.p(38, 17, '#e9f8ff'); }
    s.r(6, 36, 66, 36, WP.wall1);
    for (y = 37; y < 72; y += 3) for (x = 7; x < 72; x += 7) if (wHash(x, y, 3) > 0.7) s.p(x, y, WP.wall2);
    s.r(6, 36, 66, 2, WP.wall3);
    s.r(6, 36, 2, 36, WP.wood2); s.r(37, 36, 2, 12, WP.wood2); s.r(70, 36, 2, 36, WP.wood2); s.r(6, 54, 66, 2, WP.wood2);
    var wins = [[13, 40], [50, 40]];
    for (var i = 0; i < wins.length; i++) {
      var wx = wins[i][0], wy = wins[i][1];
      s.r(wx - 1, wy - 1, 17, 14, WP.wood3); s.r(wx, wy, 15, 12, lit ? WP.glassLit : WP.glass);
      s.r(wx + 7, wy, 1, 12, WP.wood1); s.r(wx, wy + 5, 15, 1, WP.wood1);
      if (!lit) { s.p(wx + 1, wy + 1, '#eefaff'); s.p(wx + 2, wy + 1, '#eefaff'); s.p(wx + 1, wy + 2, '#eefaff'); s.p(wx + 9, wy + 7, '#eefaff'); }
      else { s.r(wx + 1, wy + 7, 5, 4, '#ffc46a'); }
      s.r(wx - 2, wy + 12, 19, 4, WP.wood2); s.r(wx - 2, wy + 12, 19, 1, WP.wood1);
      for (var f = 0; f < 7; f++) { var fx = wx - 1 + f * 2.6; s.p(fx, wy + 11, WP.leaf3); s.p(fx + 1, wy + 10, [WP.fP, WP.fY, WP.fW, WP.fR][f % 4]); s.p(fx, wy + 10, WP.leaf2); }
    }
    s.r(32, 52, 14, 20, WP.wood3); s.disc(39, 53, 7, WP.wood3);
    s.r(33, 53, 12, 19, WP.wood1); s.disc(39, 54, 6, WP.wood1);
    for (x = 35; x < 45; x += 3) s.r(x, 50, 1, 22, WP.wood2);
    s.r(42, 62, 2, 2, WP.fY);
    s.r(48, 46, 4, 6, WP.outline); s.r(49, 47, 2, 4, lit ? WP.lampLit : WP.lamp);
    for (x = 6; x < 72; x += 5) { s.r(x, 72, 5, 4, wHash(x, 1, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 72, WP.stone3); }
    s.r(6, 72, 66, 1, WP.stone3); s.r(30, 76, 18, 3, WP.stone1); s.r(30, 78, 18, 1, WP.stone2);
    s.outline(WP.outline);
  });
}

function wWell() {
  return wSprite(24, 30, function (s) {
    var x;
    s.r(4, 7, 2, 14, WP.wood2); s.r(18, 7, 2, 14, WP.wood2);
    for (var y = 0; y < 8; y++) { var hw = Math.round(3 + y * 1.35); s.r(12 - hw, y, hw * 2, 1, y < 3 ? WP.roof1 : y < 6 ? WP.roof2 : WP.roof3); }
    s.r(5, 9, 14, 1, WP.wood3); s.r(11, 9, 1, 6, '#6b5a45'); s.r(9, 14, 5, 4, WP.wood2); s.r(9, 14, 5, 1, WP.wood1);
    s.ell(12, 20, 10, 3.5, WP.stone2); s.ell(12, 20, 7.5, 2.2, '#2f5f80'); s.ell(12, 20.5, 6, 1.4, '#3f7ea6');
    for (var yy = 22; yy < 29; yy++) for (x = 2; x < 22; x++) { var c = ((yy - 22) % 3 === 0 || ((x + (Math.floor((yy - 22) / 3) % 2) * 2) % 5 === 0)) ? WP.stone3 : (x < 8 ? WP.stone1 : WP.stone2); s.p(x, yy, c); }
    s.outline(WP.outline);
  });
}

function wBench() {
  return wSprite(22, 13, function (s) {
    s.r(2, 1, 18, 2, WP.wood1); s.r(2, 3, 18, 1, WP.wood2); s.r(2, 5, 18, 1, WP.wood1);
    s.r(1, 7, 20, 2, WP.wood1); s.r(1, 9, 20, 1, WP.wood3);
    s.r(3, 1, 1, 11, WP.wood3); s.r(18, 1, 1, 11, WP.wood3);
    s.outline(WP.outline);
  });
}

function wLamp(lit) {
  return wSprite(10, 30, function (s) {
    s.r(4, 9, 2, 19, '#4b4559'); s.r(2, 27, 6, 2, '#4b4559');
    s.r(2, 2, 6, 7, '#4b4559'); s.r(3, 3, 4, 5, lit ? WP.lampLit : WP.lamp); s.r(1, 1, 8, 1, '#4b4559'); s.r(3, 0, 4, 1, '#4b4559');
    s.outline(WP.outline);
  });
}

function wBoard() {
  return wSprite(20, 22, function (s) {
    s.r(3, 2, 2, 19, WP.wood3); s.r(15, 2, 2, 19, WP.wood3);
    s.r(1, 2, 18, 12, WP.wood3); s.r(2, 3, 16, 10, WP.wood1);
    s.r(3, 4, 6, 5, WP.fW); s.r(4, 5, 4, 1, '#c9bba0'); s.r(4, 7, 3, 1, '#c9bba0'); s.p(6, 4, WP.fR);
    s.r(11, 5, 6, 6, '#ffe7a8'); s.r(12, 7, 4, 1, '#c9a96a'); s.r(12, 9, 3, 1, '#c9a96a'); s.p(14, 5, '#5c8de0');
    s.outline(WP.outline);
  });
}

function wFence() {
  return wSprite(14, 11, function (s) {
    s.r(1, 3, 3, 7, WP.wood1); s.p(2, 2, WP.wood1); s.r(3, 3, 1, 7, WP.wood2);
    s.r(10, 3, 3, 7, WP.wood1); s.p(11, 2, WP.wood1); s.r(12, 3, 1, 7, WP.wood2);
    s.r(0, 4, 14, 1, WP.wood1); s.r(0, 7, 14, 1, WP.wood1); s.r(0, 5, 14, 1, WP.wood2);
    s.outline(WP.outline);
  });
}

function wPost() { return wSprite(5, 11, function (s) { s.r(1, 2, 3, 8, WP.wood1); s.p(2, 1, WP.wood1); s.r(3, 2, 1, 8, WP.wood2); s.outline(WP.outline); }); }

function wSunflower() {
  return wSprite(11, 22, function (s) {
    s.r(5, 8, 1, 13, WP.leaf3); s.ell(3, 13, 2, 1, WP.leaf2); s.ell(8, 16, 2, 1, WP.leaf2);
    s.disc(5.5, 5.5, 4.5, WP.fY); s.disc(5.5, 5.5, 2.2, '#8a5a2b'); s.p(4, 4, '#b07a3a');
    s.outline(WP.outline);
  });
}

function wTomato(seed) {
  return wSprite(13, 15, function (s) {
    var R = wRng(seed);
    s.r(6, 1, 1, 13, WP.wood2);
    s.ell(6.5, 7, 5, 6, WP.leaf3); s.ell(5.5, 6, 3.5, 4, WP.leaf2);
    for (var i = 0; i < 5; i++) { var x = Math.round(3 + R() * 7), y = Math.round(3 + R() * 8); s.r(x, y, 2, 2, WP.fR); s.p(x, y, '#ffc0b5'); }
    s.outline(WP.outline);
  });
}

function wScarecrow() {
  return wSprite(18, 26, function (s) {
    s.r(8, 9, 2, 16, WP.wood2); s.r(2, 12, 14, 2, WP.wood2);
    s.r(4, 11, 10, 7, '#5f86c4'); s.r(7, 13, 3, 3, '#e2b25c');
    s.disc(9, 7, 3.6, '#e9d3a2'); s.p(8, 7, WP.outline); s.p(10, 7, WP.outline);
    s.r(3, 3, 12, 2, '#e8b947'); s.r(6, 0, 6, 3, '#e8b947'); s.r(6, 2, 6, 1, '#c79531');
    s.p(1, 12, '#e8b947'); s.p(16, 12, '#e8b947');
    s.outline(WP.outline);
  });
}

function wSign() {
  return wSprite(16, 18, function (s) {
    s.r(7, 4, 2, 13, WP.wood3);
    s.r(1, 3, 11, 6, WP.wood1); s.p(12, 4, WP.wood1); s.r(12, 5, 2, 2, WP.wood1); s.p(12, 7, WP.wood1);
    s.r(3, 5, 6, 1, WP.wood3); s.r(3, 7, 4, 1, WP.wood3);
    s.outline(WP.outline);
  });
}

function wMailbox() { return wSprite(8, 14, function (s) { s.r(3, 6, 2, 7, WP.wood3); s.r(1, 1, 6, 5, '#e05a5a'); s.r(1, 1, 6, 1, '#ff8a7a'); s.p(6, 2, WP.fY); s.outline(WP.outline); }); }
function wRock(seed) { return wSprite(12, 9, function (s) { s.ell(6, 5, 5, 3.5, WP.stone2); s.ell(5, 4, 3.5, 2.2, WP.stone1); s.p(4, 3, '#efeae2'); s.outline(WP.outline); }); }
function wReed() { return wSprite(8, 13, function (s) { s.r(2, 3, 1, 9, WP.leaf3); s.r(4, 1, 1, 11, WP.leaf2); s.r(6, 4, 1, 8, WP.leaf3); s.r(4, 1, 1, 4, '#8a5a35'); s.outline(WP.outline); }); }
function wBarrel() { return wSprite(11, 13, function (s) { s.ell(5.5, 6, 4.5, 5.5, WP.wood1); s.r(1, 3, 9, 1, WP.wood3); s.r(1, 8, 9, 1, WP.wood3); s.ell(5.5, 1.6, 4, 1.3, WP.wood2); s.outline(WP.outline); }); }
function wBoat() {
  return wSprite(24, 10, function (s) {
    s.ell(12, 4, 11, 4, WP.wood1); s.ell(12, 3.5, 9, 2.5, WP.wood3); s.r(11, 1, 2, 5, WP.wood2);
    s.r(1, 6, 22, 1, '#3fa4d3'); s.r(3, 7, 18, 2, '#5cc2e3');
    s.outline(WP.outline);
  });
}

function wPerson(who, frame) {
  var A = who === 'alex';
  return wSprite(A ? 19 : 15, 23, function (s) {
    var b = frame ? 1 : 0, cx = 7.5;
    if (A) {
      s.r(5, 18, 2, 3, WP.pantsA); s.r(8, 18, 2, 3, WP.pantsA); s.r(4, 21, 3, 1, '#5a3a2a'); s.r(8, 21, 3, 1, '#5a3a2a');
      s.r(4, 12 - b, 7, 7, WP.shirtA); s.r(4, 12 - b, 7, 1, '#ffc07a'); s.p(3, 14 - b, WP.skin); s.p(11, 14 - b, WP.skin);
      s.r(12, 13 - b, 5, 4, '#6aa7da'); s.r(16, 12 - b, 2, 1, '#6aa7da'); s.r(13, 12 - b, 3, 1, '#4f86b8'); s.p(18, 11 - b, '#9fd0f5');
    } else {
      s.r(5, 19, 2, 2, WP.skin); s.r(8, 19, 2, 2, WP.skin); s.r(4, 21, 3, 1, '#c95c6c'); s.r(8, 21, 3, 1, '#c95c6c');
      for (var y = 0; y < 8; y++) { var hw = 3 + Math.floor(y / 3); s.r(cx - hw, 12 - b + y, hw * 2, 1, y < 2 ? WP.dressM : (y % 3 === 2 ? WP.dressM2 : WP.dressM)); }
      s.p(2, 14 - b, WP.skin); s.p(12, 14 - b, WP.skin);
    }
    s.disc(cx, 7 - b, 5.4, WP.skin);
    if (A) { s.disc(cx, 4.5 - b, 5, WP.hairA); s.r(2, 4 - b, 11, 2, WP.hairA); s.p(3, 7 - b, WP.hairA); s.p(12, 7 - b, WP.hairA); s.p(6, 2 - b, '#9b6a44'); }
    else { s.disc(cx, 4.6 - b, 5.2, WP.hairM); s.r(2, 4 - b, 2, 9, WP.hairM); s.r(11, 4 - b, 2, 9, WP.hairM); s.r(4, 3 - b, 7, 2, WP.hairM); s.p(10, 2 - b, '#ff9fc2'); s.p(11, 3 - b, '#ff9fc2'); }
    s.r(5, 8 - b, 1, 2, '#2a1f2b'); s.r(9, 8 - b, 1, 2, '#2a1f2b'); s.p(4, 10 - b, '#ffb0a8'); s.p(10, 10 - b, '#ffb0a8');
    s.outline(WP.outline);
  });
}

// ---- Szene: Objekte (Dorfkoordinaten) ----
function wObjects() {
  var o = [], R = wRng(11), i, x, y;
  function add(kind, vx, vy, extra) { o.push({ kind: kind, vx: vx, vy: vy, extra: extra }); }
  add('house', W_HOUSE.x, W_HOUSE.y); add('mailbox', 86, 66); add('barrel', 26, 62); add('barrel', 33, 64);
  add('bushP', 44, 68); add('bushY', 76, 68); add('bush', 98, 58); add('bushW', 20, 84);
  add('lamp', 103, 86); add('lamp', 154, 128); add('lamp', 200, 88);
  add('well', W_SQ.x, W_SQ.y + 3); add('bench', 92, 112); add('board', 152, 86); add('sign', 138, 142);
  for (x = W_GARDEN.x0; x < W_GARDEN.x1 - 4; x += 12) { add('fence', x + 7, W_GARDEN.y1); add('fence', x + 7, W_GARDEN.y0); }
  for (y = W_GARDEN.y0 + 8; y < W_GARDEN.y1; y += 8) { add('post', W_GARDEN.x0, y); if (y < 138 || y > 154) add('post', W_GARDEN.x1, y); }
  add('sun', 26, 124); add('sun', 34, 123); add('sun', 42, 124);
  add('tomato', 32, 136, 1); add('tomato', 48, 136, 2); add('tomato', 64, 136, 3);
  add('scare', 78, 128);
  add('alex', 50, 140); add('mira', 110, 121);
  add('boat', 230, 106); add('reed', 186, 74); add('reed', 189, 108); add('reed', 206, 124); add('reed', 244, 122); add('reed', 254, 70);
  add('rock', 150, 172); add('rock', 210, 150); add('rock', 6, 102); add('rock', 150, 66);
  var trees = [[20, 30, 0], [104, 32, 0], [118, 58, 1], [176, 40, 0], [246, 36, 0], [8, 150, 0], [244, 170, 0], [176, 152, 1], [182, 64, 2], [30, 100, 2], [234, 186, 0], [8, 186, 0], [150, 36, 0]];
  for (i = 0; i < trees.length; i++) add(trees[i][2] === 1 ? 'treeF' : trees[i][2] === 2 ? 'treeB' : 'tree', trees[i][0], trees[i][1], i);
  for (i = 0; i < 95; i++) { x = -60 + R() * 380; y = -94 + R() * 88; add(R() < 0.45 ? 'pine' : 'tree', Math.round(x), Math.round(y), 100 + i); }
  for (i = 0; i < 26; i++) { add(R() < 0.5 ? 'pine' : 'tree', Math.round(-58 + R() * 50), Math.round(R() * 196), 300 + i); add(R() < 0.5 ? 'pine' : 'tree', Math.round(266 + R() * 52), Math.round(R() * 196), 400 + i); }
  return o;
}

function wSpriteFor(obj, lit, frame, cache) {
  var key = obj.kind + ':' + (obj.extra || 0) % 7 + ':' + (lit ? 1 : 0) + ':' + (frame || 0);
  if (cache[key]) return cache[key];
  var e = obj.extra || 0, c;
  switch (obj.kind) {
    case 'house': c = wHouse(lit); break;
    case 'tree': c = wTree(0, e % 7 + 1); break;
    case 'treeF': c = wTree(1, e % 7 + 1); break;
    case 'treeB': c = wTree(2, e % 7 + 1); break;
    case 'pine': c = wPine(e % 7); break;
    case 'bush': c = wBush(e + 3, null); break;
    case 'bushP': c = wBush(5, WP.fP); break;
    case 'bushY': c = wBush(6, WP.fY); break;
    case 'bushW': c = wBush(7, WP.fW); break;
    case 'well': c = wWell(); break;
    case 'bench': c = wBench(); break;
    case 'lamp': c = wLamp(lit); break;
    case 'board': c = wBoard(); break;
    case 'fence': c = wFence(); break;
    case 'post': c = wPost(); break;
    case 'sun': c = wSunflower(); break;
    case 'tomato': c = wTomato(e); break;
    case 'scare': c = wScarecrow(); break;
    case 'sign': c = wSign(); break;
    case 'mailbox': c = wMailbox(); break;
    case 'rock': c = wRock(e); break;
    case 'reed': c = wReed(); break;
    case 'barrel': c = wBarrel(); break;
    case 'boat': c = wBoat(); break;
    case 'alex': c = wPerson('alex', frame); break;
    case 'mira': c = wPerson('mira', frame); break;
  }
  cache[key] = c; return c;
}

// Projektion: Dorfkoordinaten → Punkt im kleinen Puffer (320×200) und Maßstab
function wProject(mode, vx, vy) {
  if (mode === 'flat') return { x: vx + 32, y: vy + 8, sc: 1, t: 0 };
  var tx = vx + W_OX, ty = vy + W_OY;
  var t = Math.pow(Math.max(0, 1 - ty / W_TH), 1 / W_GAMMA), s = 0.62 + 0.9 * t;
  var x = 160 + (tx - W_CX) / s, k = (x - 160) / 160, yh = 34 + 14 * k * k;
  return { x: x, y: W_LH - t * (W_LH - yh), sc: 1 / s, t: t };
}

// Lichtquellen: Basis (Dorfkoordinaten) und Höhe über dem Boden in Sprite-Pixeln
var W_LIGHTS = [[43, 60, 32, 1], [77, 60, 32, 1], [60, 60, 59, 0.8], [69, 60, 31, 0.7], [103, 86, 24, 1], [154, 128, 24, 1], [200, 88, 24, 1]];

function createWorld(canvas, opts) {
  var MODE = opts.mode || 'mashup', T = W_TIMES[opts.zeit] || W_TIMES.Abend, lit = !!T.lights;
  var ctx = canvas.getContext('2d');
  var low = document.createElement('canvas'); low.width = W_LW; low.height = W_LH;
  var lg = low.getContext('2d'); lg.imageSmoothingEnabled = false;
  var groundC = document.createElement('canvas'); groundC.width = W_LW; groundC.height = W_LH;
  var gg = groundC.getContext('2d');
  var tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
  var tg = tmp.getContext('2d');
  var haze = wHex(T.haze), cache = {}, x, y, i;

  var tex = new Uint8ClampedArray(W_TW * W_TH * 3), ttype = new Uint8Array(W_TW * W_TH);
  for (y = 0; y < W_TH; y++) for (x = 0; x < W_TW; x++) { var tv = wTexel(x, y), ti = y * W_TW + x; tex[ti * 3] = tv[0][0]; tex[ti * 3 + 1] = tv[0][1]; tex[ti * 3 + 2] = tv[0][2]; ttype[ti] = tv[1]; }
  function setT(tx2, ty2, col) { if (tx2 < 0 || ty2 < 0 || tx2 >= W_TW || ty2 >= W_TH) return; var j = ty2 * W_TW + tx2; tex[j * 3] = col[0]; tex[j * 3 + 1] = col[1]; tex[j * 3 + 2] = col[2]; }
  function typeAt(tx2, ty2) { if (tx2 < 0 || ty2 < 0 || tx2 >= W_TW || ty2 >= W_TH) return 255; return ttype[ty2 * W_TW + tx2]; }
  var R = wRng(5);
  for (i = 0; i < 1400; i++) { x = Math.floor(R() * W_TW); y = Math.floor(R() * W_TH); var ty0 = typeAt(x, y); if (ty0 === 0 || ty0 === 7) { var dk = ty0 === 7 ? WPA.wild3 : WPA.grassDark; setT(x, y - 1, dk); setT(x - 1, y, dk); setT(x + 1, y, dk); } }
  var FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
  for (i = 0; i < 260; i++) {
    var fx = Math.floor(R() * W_TW), fy = Math.floor(R() * W_TH), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
    for (var j = 0; j < n2; j++) {
      var px2 = fx + Math.round((R() - 0.5) * 9), py2 = fy + Math.round((R() - 0.5) * 7), tt = typeAt(px2, py2);
      if (tt !== 0 && tt !== 7) continue;
      if (big) { setT(px2 - 1, py2, fc); setT(px2 + 1, py2, fc); setT(px2, py2 - 1, fc); setT(px2, py2 + 1, fc); setT(px2, py2, WPA.fY); }
      else setT(px2, py2, fc);
    }
  }
  for (i = 0; i < 12; i++) { var lx = W_OX + W_LAKE.x + Math.round((R() - 0.5) * 60), ly = W_OY + W_LAKE.y + Math.round((R() - 0.5) * 50); if (typeAt(lx, ly) === 2 && typeAt(lx + 2, ly) === 2) { setT(lx, ly, WPA.leaf2); setT(lx + 1, ly, WPA.leaf2); setT(lx + 2, ly, WPA.leaf3); setT(lx + 1, ly - 1, WPA.leaf2); if (R() < 0.5) setT(lx + 1, ly - 1, WPA.fP); } }
  for (i = 0; i < W_BEDS.length; i++) {
    var b = W_BEDS[i];
    for (x = b[0] + 3; x < b[0] + b[2] - 2; x += 4) {
      var bx = x + W_OX, by = b[1] + 4 + W_OY;
      if (i === 1) { setT(bx, by, WPA.leaf1); setT(bx + 1, by, WPA.leaf2); setT(bx, by + 1, WPA.leaf2); setT(bx + 1, by + 1, WPA.leaf3); setT(bx - 1, by, WPA.leaf3); setT(bx + 2, by + 1, WPA.leaf3); }
      else { setT(bx, by, WPA.leaf2); setT(bx - 1, by - 1, WPA.leaf1); setT(bx + 1, by - 1, WPA.leaf1); setT(bx, by + 1, WPA.leaf3); }
    }
  }

  var objs = wObjects();
  for (i = 0; i < objs.length; i++) {
    var ob = objs[i], sp = wSpriteFor(ob, lit, 0, cache);
    if (ob.kind === 'boat') continue;
    var rx = sp.width * 0.42, ry = Math.max(2, sp.width * 0.16), cx0 = ob.vx + W_OX + rx * 0.3, cy0 = ob.vy + W_OY + 0.5;
    for (y = Math.floor(cy0 - ry); y <= cy0 + ry; y++) for (x = Math.floor(cx0 - rx); x <= cx0 + rx; x++) {
      var ddx = (x + 0.5 - cx0) / rx, ddy = (y + 0.5 - cy0) / ry;
      if (ddx * ddx + ddy * ddy > 1 || x < 0 || y < 0 || x >= W_TW || y >= W_TH) continue;
      var q = (y * W_TW + x) * 3, f = 0.72; tex[q] *= f; tex[q + 1] *= f * 1.02; tex[q + 2] *= f * 1.12;
    }
  }

  var gimg = gg.createImageData(W_LW, W_LH), gd = gimg.data, water = [], base;
  for (y = 0; y < W_LH; y++) for (x = 0; x < W_LW; x++) {
    var o = (y * W_LW + x) * 4, tx, ty, fog = 0;
    if (MODE === 'flat') { tx = x + 32; ty = y + 88; }
    else {
      var kx = (x - 160) / 160, yh = 34 + 14 * kx * kx;
      if (y < yh) { gd[o + 3] = 0; continue; }
      var t = (W_LH - y) / (W_LH - yh), s = 0.62 + 0.9 * t;
      tx = Math.floor(W_CX + (x - 160) * s); ty = Math.floor(W_TH * (1 - Math.pow(t, W_GAMMA)));
      fog = Math.pow(t, 2.2) * 0.55;
    }
    var r0, g0, b0;
    if (tx >= 0 && tx < W_TW && ty >= 0 && ty < W_TH) { var q2 = (ty * W_TW + tx) * 3; r0 = tex[q2]; g0 = tex[q2 + 1]; b0 = tex[q2 + 2]; if (ttype[ty * W_TW + tx] === 2) water.push(o, tx, ty); }
    else { var w2 = wTexel(tx, Math.max(0, ty)); r0 = w2[0][0]; g0 = w2[0][1]; b0 = w2[0][2]; }
    gd[o] = r0 + (haze[0] - r0) * fog; gd[o + 1] = g0 + (haze[1] - g0) * fog; gd[o + 2] = b0 + (haze[2] - b0) * fog; gd[o + 3] = 255;
  }
  base = new Uint8ClampedArray(gd);

  var sky = document.createElement('canvas'); sky.width = W_LW; sky.height = 70;
  var sg = sky.getContext('2d'), grad = sg.createLinearGradient(0, 0, 0, 60); grad.addColorStop(0, T.skyTop); grad.addColorStop(1, T.skyBot);
  sg.fillStyle = grad; sg.fillRect(0, 0, W_LW, 70);
  if (T.stars) { var RS = wRng(3); for (i = 0; i < 70; i++) { sg.fillStyle = RS() < 0.2 ? '#fff6c8' : '#dfe6ff'; sg.fillRect(Math.floor(RS() * W_LW), Math.floor(RS() * 40), 1, 1); } sg.fillStyle = '#fff4d6'; sg.beginPath(); sg.arc(250, 14, 6, 0, 7); sg.fill(); sg.fillStyle = T.skyTop; sg.beginPath(); sg.arc(253, 12, 5.5, 0, 7); sg.fill(); }
  var hills = document.createElement('canvas'); hills.width = W_LW; hills.height = 70;
  var hg = hills.getContext('2d'), hc = wHex(T.haze), hc2 = wHex(T.skyBot);
  for (x = 0; x < W_LW; x++) {
    var kk = (x - 160) / 160, yhx = 34 + 14 * kk * kk, top1 = yhx - 9 - 7 * wNoise(x * 0.025, 0, 3), top2 = yhx - 4 - 4 * wNoise(x * 0.05, 1, 4);
    hg.fillStyle = 'rgb(' + Math.round(hc[0] * 0.78 + hc2[0] * 0.1) + ',' + Math.round(hc[1] * 0.86 + hc2[1] * 0.08) + ',' + Math.round(hc[2] * 0.95) + ')'; hg.fillRect(x, Math.round(top1), 1, 70);
    hg.fillStyle = 'rgb(' + Math.round(hc[0] * 0.62) + ',' + Math.round(hc[1] * 0.78) + ',' + Math.round(hc[2] * 0.8) + ')'; hg.fillRect(x, Math.round(top2), 1, 70);
  }
  var clouds = document.createElement('canvas'); clouds.width = W_LW * 2; clouds.height = 40;
  var cg = clouds.getContext('2d'), cimg = cg.createImageData(W_LW * 2, 40), cd = cimg.data, cw = wHex(T.stars ? '#4a5288' : '#ffffff'), cs = wHex(T.stars ? '#3a4074' : T.skyBot);
  for (y = 0; y < 40; y++) for (x = 0; x < W_LW * 2; x++) {
    var nv = wNoise(x * 0.035, y * 0.11, 8) * 0.7 + wNoise(x * 0.09, y * 0.25, 9) * 0.3 - (Math.abs(y - 14) / 30), oo = (y * W_LW * 2 + x) * 4;
    if (nv > 0.5) { var shade = nv < 0.56 || y > 17 ? cs : cw; cd[oo] = shade[0]; cd[oo + 1] = shade[1]; cd[oo + 2] = shade[2]; cd[oo + 3] = 235; }
  }
  cg.putImageData(cimg, 0, 0);

  var order = objs.slice().sort(function (a, b2) { return a.vy - b2.vy; });
  var hasFilter = typeof ctx.filter === 'string';
  var particles = []; var RP = wRng(21);
  for (i = 0; i < 26; i++) particles.push({ x: RP() * canvas.width, y: 200 + RP() * (canvas.height - 240), p: RP() * 6.28, sp: 0.3 + RP() * 0.6, c: RP() });
  var raf = 0, start = performance.now(), last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 40) return; last = now;
    var tm = (now - start) / 1000, fr = Math.floor(tm * 2) % 2, k2;
    for (k2 = 0; k2 < water.length; k2 += 3) {
      var oi = water[k2], wx2 = water[k2 + 1], wy2 = water[k2 + 2];
      var sh = Math.sin(wx2 * 0.55 + tm * 2.1) * Math.sin(wy2 * 1.25 - tm * 1.6);
      if (sh > 0.86) { gd[oi] = 240; gd[oi + 1] = 252; gd[oi + 2] = 255; }
      else if (sh > 0.6) { gd[oi] = Math.min(255, base[oi] + 26); gd[oi + 1] = Math.min(255, base[oi + 1] + 22); gd[oi + 2] = Math.min(255, base[oi + 2] + 12); }
      else { gd[oi] = base[oi]; gd[oi + 1] = base[oi + 1]; gd[oi + 2] = base[oi + 2]; }
    }
    gg.putImageData(gimg, 0, 0);
    lg.clearRect(0, 0, W_LW, W_LH);
    if (MODE !== 'flat') {
      lg.drawImage(sky, 0, 0);
      var off = (tm * 3) % (W_LW * 2);
      lg.drawImage(clouds, -off, 2); lg.drawImage(clouds, W_LW * 2 - off, 2);
      lg.drawImage(hills, 0, 0);
    }
    lg.drawImage(groundC, 0, 0);
    for (var n = 0; n < order.length; n++) {
      var ob2 = order[n], pr = wProject(MODE, ob2.vx, ob2.vy);
      if (pr.x < -60 || pr.x > W_LW + 60 || pr.y < 0) continue;
      var anim = (ob2.kind === 'alex' || ob2.kind === 'mira') ? fr : 0, spr = wSpriteFor(ob2, lit, anim, cache);
      var sw = spr.width * pr.sc, shh = spr.height * pr.sc, bob = 0;
      if (ob2.kind === 'boat') bob = Math.sin(tm * 1.8) * 0.8 * pr.sc;
      lg.drawImage(spr, Math.round(pr.x - sw / 2), Math.round(pr.y - shh + bob), Math.round(sw), Math.round(shh));
    }
    var ch = wProject(MODE, W_HOUSE.x + 19, W_HOUSE.y);
    for (k2 = 0; k2 < 5; k2++) {
      var age = ((tm * 0.35 + k2 / 5) % 1), sx = ch.x + (Math.sin(age * 5 + k2) * 3 + age * 8) * ch.sc, sy = ch.y - (78 + age * 26) * ch.sc;
      lg.globalAlpha = (1 - age) * 0.75; lg.fillStyle = T.stars ? '#8a90b8' : '#f4f1ec';
      var rad = (1.5 + age * 3.5) * ch.sc; lg.fillRect(Math.round(sx - rad), Math.round(sy - rad), Math.round(rad * 2), Math.round(rad * 2));
    }
    lg.globalAlpha = 1;

    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(low, 0, 0, canvas.width, canvas.height);
    if (T.grade !== '#ffffff') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = T.grade; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (T.glowA) {
      ctx.globalCompositeOperation = 'lighter';
      for (k2 = 0; k2 < W_LIGHTS.length; k2++) {
        var L = W_LIGHTS[k2], lp = wProject(MODE, L[0], L[1]), gx = lp.x * W_SC, gy = (lp.y - L[2] * lp.sc) * W_SC, gr = (MODE === 'flat' ? 46 : 58 * lp.sc) * L[3];
        var rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        rg.addColorStop(0, 'rgba(255,205,120,' + T.glowA + ')'); rg.addColorStop(0.35, 'rgba(255,170,90,' + T.glowA * 0.4 + ')'); rg.addColorStop(1, 'rgba(255,150,80,0)');
        ctx.fillStyle = rg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    if (MODE !== 'flat' && hasFilter) {
      tg.clearRect(0, 0, tmp.width, tmp.height);
      tg.filter = 'blur(5px)'; tg.drawImage(canvas, 0, 0); tg.filter = 'none';
      tg.globalCompositeOperation = 'destination-in';
      var mg = tg.createLinearGradient(0, 0, 0, tmp.height);
      mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.2, 'rgba(0,0,0,0.85)'); mg.addColorStop(0.36, 'rgba(0,0,0,0)'); mg.addColorStop(0.84, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,0.75)');
      tg.fillStyle = mg; tg.fillRect(0, 0, tmp.width, tmp.height);
      tg.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0);
    }
    for (k2 = 0; k2 < particles.length; k2++) {
      var pa = particles[k2], px3 = (pa.x + Math.sin(tm * pa.sp + pa.p) * 30 + tm * 6) % canvas.width, py3 = pa.y + Math.cos(tm * pa.sp * 1.3 + pa.p) * 18;
      if (T.stars) { var fa = 0.5 + 0.5 * Math.sin(tm * 2 + pa.p * 3); ctx.fillStyle = 'rgba(214,255,140,' + fa + ')'; ctx.fillRect(Math.round(px3 / 4) * 4, Math.round(py3 / 4) * 4, 4, 4); ctx.fillStyle = 'rgba(214,255,140,' + fa * 0.25 + ')'; ctx.fillRect(Math.round(px3 / 4) * 4 - 4, Math.round(py3 / 4) * 4 - 4, 12, 12); }
      else if (opts.zeit === 'Abend') { ctx.fillStyle = pa.c < 0.5 ? '#ffc2d6' : '#fff0f5'; ctx.fillRect(Math.round(px3 / 4) * 4, Math.round(py3 / 4) * 4, 4, 4); }
      else if (k2 < 6) { var wing = Math.sin(tm * 14 + pa.p) > 0; ctx.fillStyle = pa.c < 0.5 ? '#ffffff' : '#ffd94f'; var bx3 = Math.round(px3 / 4) * 4, by3 = Math.round(py3 / 4) * 4; ctx.fillRect(bx3 - 4, by3, 4, wing ? 4 : 2); ctx.fillRect(bx3 + 4, by3, 4, wing ? 4 : 2); ctx.fillStyle = WP.outline; ctx.fillRect(bx3, by3, 4, 4); }
    }
    var vg = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.55, canvas.height * 0.45, canvas.width / 2, canvas.height * 0.55, canvas.height * 0.95);
    vg.addColorStop(0, 'rgba(30,20,40,0)'); vg.addColorStop(1, T.stars ? 'rgba(5,8,25,0.55)' : 'rgba(40,25,40,0.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  raf = requestAnimationFrame(frame);
  return { stop: function () { cancelAnimationFrame(raf); } };
}

// Bildschirmposition (1280×800) eines Punktes in Dorfkoordinaten, für Namensschilder
function wScreen(mode, vx, vy, up) {
  var p = wProject(mode, vx, vy);
  return { x: p.x * W_SC, y: (p.y - (up || 0) * p.sc) * W_SC, sc: p.sc };
}
