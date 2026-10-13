// SIMULACRA Mockup AP13: Haus der Startwelt in der Tiefenansicht, geschlossen und drei Varianten für „innen“.
// Kein Produktionscode. Erprobt nebenbei die Projektion mit beweglicher Kamera (Fokus, Zoom) für beide Richtungen.
var H_LW = 320, H_LH = 200, H_G = 1.45, H_T = 16;
var H_ROWS = ["TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TT.............................T..............................TT", "TTT................T.................................T........TT", "TT..########################..................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________+,,................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________#.............................T....TT", "TT..####+####+########+#####..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________+____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..################+#######........,.........................TT", "TT..................,...............,..........T..............TT", "TT....T.............,...............,................T..T.....TT", "TTTT.T.TT.T.TT..TT..,...............,.........................TT", "TT...T.TTTT.T..T.TTT,...............,.........................TT", "TT..T..T..T....T.T..,.....,,,,,,,,,,,,,,,.T.........sssssss..TTT", "TTT.T....T........T.,.....,,,,,,,,,,,,,,,.....T...ss~~~~~~~ss.TT", "TT...T..T.TTT.TT..T.,.....,,,,,,,,,,,,,,,........s~~~~~~~~~~~sTT", "TT..........TTT..TT.,.....,,,,,,,,,,,,,,,.......s~~~~~~~~~~~~~TT", "TTT.............T.TT,,,,,,,,,,,,,,,,,,,,,,,,,,,s~~~~~~~~~~~~~~TT", "TTTTTT,,,,,,,,,,,,,,,.....,,,,,,,,,,,,,,,......s~~~~~~~~~~~~~~TT"];
var H_ROOMS = [[5, 5, 6, 5, 'planks'], [12, 5, 6, 5, 'planks'], [19, 5, 8, 5, 'workshop'], [5, 11, 9, 5, 'tile'], [15, 11, 12, 5, 'planks']];
var H_BLD = { x0: 4, y0: 4, x1: 28, y1: 17 };                 // Kachelgrenzen (x1, y1 exklusiv)
var H_OBJ = [['bed', 6, 6, 'alex'], ['chest', 10, 6], ['bed', 13, 6, 'mira'], ['desk', 16, 6], ['workbench', 20, 6], ['stove', 6, 12], ['tap', 10, 15], ['sofa', 17, 13], ['table', 21, 13], ['bookshelf', 25, 11], ['fireplace', 26, 13], ['well', 40, 9], ['bench', 40, 12], ['well', 33, 25], ['bench', 30, 23], ['board', 38, 22]];
var H_SEED = [[32, 7], [34, 7], [36, 7], [32, 10], [34, 10], [36, 10]];
var H_EAVE = 26, H_RIDGE = 15, H_STUB = 5, H_BACK = 22;      // Höhen in Weltpixeln

// ---- Projektion mit Kamera: Fokuspunkt (Weltpixel) und Zoom; Hin- und Rückweg aus denselben Formeln ----
function hCam(fx, fy, z) { var D = H_LH * 1.44 / z; return { fx: fx, fy: fy, z: z, D: D, yb: fy + D * Math.pow(0.42, H_G) }; }
function hHor(xs) { var k = (xs - H_LW / 2) / (H_LW / 2); return H_LH * (0.17 + 0.07 * k * k); }
function hRow(c, wy) { var f = Math.max(0, c.yb - wy), t = Math.pow(f / c.D, 1 / H_G); return { t: t, s: (0.62 + 0.9 * t) / c.z }; }
function hProj(c, wx, wy, h) {
  var r = hRow(c, wy), xs = H_LW / 2 + (wx - c.fx) / r.s, yg = H_LH - r.t * (H_LH - hHor(xs));
  return { x: xs, y: yg - (h || 0) / r.s, sc: 1 / r.s, t: r.t };
}
function hUnproj(c, xs, ys) {
  var yh = hHor(xs), t = (H_LH - ys) / (H_LH - yh);
  if (t > 1) return null;
  var s = (0.62 + 0.9 * t) / c.z;
  return { x: c.fx + (xs - H_LW / 2) * s, y: c.yb - c.D * Math.pow(Math.max(0, t), H_G), t: t };
}

function hTile(tx, ty) { if (tx < 0 || ty < 0 || tx >= 64) return 'T'; return ty < H_ROWS.length ? H_ROWS[ty][tx] : '.'; }
function hRoom(tx, ty) { for (var i = 0; i < H_ROOMS.length; i++) { var r = H_ROOMS[i]; if (tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3]) return r; } return null; }
function hInBld(tx, ty) { return tx >= H_BLD.x0 && ty >= H_BLD.y0 && tx < H_BLD.x1 && ty < H_BLD.y1; }

// ---- Boden je Weltpixel ----
function hGround(wx, wy) {
  var tx = Math.floor(wx / H_T), ty = Math.floor(wy / H_T), u = ((wx % H_T) + H_T) % H_T | 0, v = ((wy % H_T) + H_T) % H_T | 0;
  var ch = hTile(tx, ty), n = wNoise(wx * 0.13, wy * 0.13, 1), h = wHash(wx | 0, wy | 0, 2), g = n * 0.75 + h * 0.25;
  if (ch === '_' || ch === '+') {
    var room = hRoom(tx, ty), st = room ? room[4] : (hInBld(tx, ty) ? 'planks' : 'dock');
    if (st === 'tile') return ((Math.floor(wx / 8) + Math.floor(wy / 8)) & 1) ? '#e9e2d3' : '#cfc7b8';
    if (st === 'workshop') return (wy | 0) % 5 === 0 ? '#6e5038' : h < 0.5 ? '#8c6a4c' : '#80604a';
    if (tx >= 16 && tx <= 24 && ty >= 12 && ty <= 14) return (u === 0 && tx === 16) || (u === 15 && tx === 24) || (v === 1 && ty === 12) || (v === 14 && ty === 14) ? '#f2d28a' : ((wx + wy) | 0) % 6 < 3 ? '#c4505a' : '#a8404c';
    if ((wy | 0) % 4 === 0) return WP.wood3;
    return ((Math.floor(wx / 12 + Math.floor(wy / 4) * 0.5)) & 1) ? WP.wood1 : '#c3864f';
  }
  if (ch === '#') return '#8b6d55';
  if (ch === '~') return g < 0.4 ? WP.water3 : g < 0.7 ? WP.water2 : WP.water1;
  if (ch === 's') return h < 0.5 ? WP.path1 : '#f3e2b6';
  if (ch === ',') return wNoise(wx * 0.3, wy * 0.3, 4) < 0.45 ? WP.path2 : (h > 0.97 ? WP.pebble : WP.path1);
  for (var i = 0; i < H_SEED.length; i++) if (tx === H_SEED[i][0] && ty === H_SEED[i][1] && u > 1 && u < 15 && v > 2 && v < 14) return v % 3 === 0 ? WP.soil2 : (u === 8 && v === 7 ? WP.leaf2 : WP.soil1);
  if (ch === 'T') return g < 0.4 ? WP.wild3 : g < 0.7 ? WP.wild2 : WP.wild1;
  var col = g < 0.32 ? WP.grass3 : g < 0.64 ? WP.grass2 : WP.grass1;
  if (h > 0.985) return [WP.fP, WP.fY, WP.fW, WP.fB][(wx * 7 + wy) & 3];
  return col;
}

function hSky(lg, c) {
  var grad = lg.createLinearGradient(0, 0, 0, 60); grad.addColorStop(0, '#6cb7f3'); grad.addColorStop(1, '#cfefff');
  lg.fillStyle = grad; lg.fillRect(0, 0, H_LW, 70);
  for (var x = 0; x < H_LW; x++) {
    var yh = hHor(x), top1 = yh - 9 - 7 * wNoise(x * 0.025, 0, 3), top2 = yh - 4 - 4 * wNoise(x * 0.05, 1, 4);
    lg.fillStyle = '#b3cbd6'; lg.fillRect(x, Math.round(top1), 1, 70); lg.fillStyle = '#8db39a'; lg.fillRect(x, Math.round(top2), 1, 70);
  }
}

function hGroundPass(lg, c) {
  var img = lg.getImageData(0, 0, H_LW, H_LH), d = img.data, haze = wHex('#e2f4ff');
  for (var y = 0; y < H_LH; y++) for (var x = 0; x < H_LW; x++) {
    var w = hUnproj(c, x + 0.5, y + 0.5);
    if (!w) continue;
    var col = wHex(hGround(w.x, w.y)), fog = Math.pow(w.t, 2.2) * 0.55, o = (y * H_LW + x) * 4;
    d[o] = col[0] + (haze[0] - col[0]) * fog; d[o + 1] = col[1] + (haze[1] - col[1]) * fog; d[o + 2] = col[2] + (haze[2] - col[2]) * fog; d[o + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
}

// ---- Aufrechte Flächen: senkrechte Wand (Südseite) und waagerechte Fläche in Höhe h, exakt je Bildpixel ----
function hFace(lg, c, x0, x1, wy, h0, h1, colFn) {
  var r = hRow(c, wy), a = H_LW / 2 + (x0 - c.fx) / r.s, b = H_LW / 2 + (x1 - c.fx) / r.s;
  for (var xs = Math.floor(a); xs < Math.ceil(b); xs++) {
    if (xs < 0 || xs >= H_LW) continue;
    var wx = c.fx + (xs + 0.5 - H_LW / 2) * r.s, yg = H_LH - r.t * (H_LH - hHor(xs + 0.5));
    if (wx < x0 || wx >= x1) continue;
    var hTop = typeof h1 === 'function' ? h1(wx) : h1;
    for (var ys = Math.floor(yg - hTop / r.s); ys < Math.ceil(yg - h0 / r.s); ys++) {
      var col = colFn(wx - x0, (yg - ys - 0.5) * r.s, wx);
      if (col) { lg.fillStyle = col; lg.fillRect(xs, ys, 1, 1); }
    }
  }
}
function hCap(lg, c, x0, x1, y0, y1, hFn, colFn) {
  var prev = {};
  for (var wy = y0; wy < y1; wy += 0.5) {
    var r = hRow(c, wy), a = H_LW / 2 + (x0 - c.fx) / r.s, b = H_LW / 2 + (x1 - c.fx) / r.s;
    for (var xs = Math.max(0, Math.floor(a)); xs < Math.min(H_LW, Math.ceil(b)); xs++) {
      var wx = c.fx + (xs + 0.5 - H_LW / 2) * r.s;
      if (wx < x0 || wx >= x1) continue;
      var h = hFn(wx, wy); if (h == null) { delete prev[xs]; continue; }
      var col = colFn(wx, wy, h); if (!col) continue;
      var ys = Math.round(H_LH - r.t * (H_LH - hHor(xs + 0.5)) - h / r.s), p = prev[xs] != null ? prev[xs] : ys;
      lg.fillStyle = col; lg.fillRect(xs, Math.min(ys, p), 1, Math.abs(ys - p) + 1); prev[xs] = ys;
    }
  }
}

// ---- Gebäudeteile ----
function hWallCol(u, h, H, front, tx) {
  if (h < 2.5) return front ? WP.stone2 : '#9a8a78';
  if (h > H - 1.5) return WP.wood2;
  if (!front) return h > H - 6 ? '#e8d6b4' : '#f0e2c4';
  if (u < 1 && tx % 4 === 0) return WP.wood2;
  return h > H - 4 ? WP.wall2 : WP.wall1;
}
function hFacade(lg, c, tx, ty, H, lit) {
  var x0 = tx * H_T, door = hTile(tx, ty) === '+', win = !door && tx % 3 === 1 && tx > H_BLD.x0 && tx < H_BLD.x1 - 1;
  hFace(lg, c, x0, x0 + H_T, (ty + 1) * H_T, 0, H, function (u, h) {
    if (door && u > 2.5 && u < 13.5 && h < 19) return u < 3.5 || u > 12.5 || h > 18 ? WP.wood3 : (Math.floor(u) % 3 === 0 ? WP.wood2 : WP.wood1);
    if (win && u > 3 && u < 13 && h > 8 && h < 19) return u < 4 || u > 12 || h < 9 || h > 18 ? WP.wood3 : (Math.abs(u - 8) < 0.6 || Math.abs(h - 13.5) < 0.6 ? WP.wood1 : (lit ? WP.glassLit : WP.glass));
    if (win && u > 2 && u < 14 && h > 6.5 && h < 8.5) return WP.wood2;
    return hWallCol(u, h, H, true, tx);
  });
}
function hWallBlock(lg, c, tx, ty, H, front) {
  var x0 = tx * H_T, y0 = ty * H_T;
  hFace(lg, c, x0, x0 + H_T, y0 + H_T, 0, H, function (u, h) { return hWallCol(u, h, H, front, tx); });
  hCap(lg, c, x0, x0 + H_T, y0, y0 + H_T, function () { return H; }, function (wx, wy) { var u = wx - x0, v = wy - y0; return u < 1 || u >= 15 || v < 1 || v >= 15 ? WP.wood3 : '#b58a62'; });
}
function hRoofH(wy) { var y0 = H_BLD.y0 * H_T, y1 = H_BLD.y1 * H_T, mid = (y0 + y1) / 2, half = (y1 - y0) / 2; return H_EAVE + H_RIDGE * (1 - Math.abs(wy - mid) / half); }
function hRoofCol(wx, wy) {
  var y0 = H_BLD.y0 * H_T, y1 = H_BLD.y1 * H_T, mid = (y0 + y1) / 2, front = wy >= mid, d = Math.abs(wy - mid), row = Math.floor(d / 6), within = d - row * 6;
  if (d < 1.5 || wx < H_BLD.x0 * H_T - 1 || wx > H_BLD.x1 * H_T || wy < y0 - 2 || wy > y1 + 1) return WP.roof3;
  if (within < 1) return Math.floor(wx / 9 + row * 0.5) % 2 ? WP.roof3 : (front ? WP.roof2 : WP.roof3);
  if (within < 1.8 && (Math.floor(wx + row * 4.5) % 9) < 1) return WP.roof3;
  return front ? (within < 3 ? WP.roof1 : WP.roof2) : WP.roof2;
}
function hChimney(lg, c) {
  var x0 = 24 * H_T + 2, wy = 9 * H_T, base = hRoofH(wy);
  hFace(lg, c, x0, x0 + 9, wy, base - 4, base + 14, function (u, h) { return h > base + 11 ? WP.stone3 : (Math.floor(h) % 4 === 0 ? WP.stone3 : (u < 3 ? WP.stone1 : WP.stone2)); });
  hCap(lg, c, x0, x0 + 9, wy - 6, wy, function () { return base + 14; }, function () { return '#4b4559'; });
}

// Zeichenliste eines Panels: alles mit Fußpunkt (Welt-y), gemalt von hinten nach vorn
function hItems(c, variant, openRect) {
  var items = [], tx, ty, open = function (x, y) { return variant === 'offen' || variant === 'durchsicht' || (variant === 'raum' && x >= openRect[0] && y >= openRect[1] && x < openRect[2] && y < openRect[3]); };
  function add(y, fn) { items.push({ y: y, fn: fn }); }
  for (ty = 0; ty < H_ROWS.length; ty++) for (tx = 0; tx < 64; tx++) {
    var ch = hTile(tx, ty);
    if (ch === 'T') (function (tx, ty) { var hh = wHash(tx, ty, 5), spr = hh < 0.4 ? wPine(tx % 7) : wTree(hh > 0.9 ? 1 : 0, (tx * 3 + ty) % 7 + 1); var fade = variant !== 'zu' && ty >= H_BLD.y1 && hCovers(c, spr, tx * H_T + 8, (ty + 1) * H_T - 2); add((ty + 1) * H_T - 2, function (lg) { hSprite(lg, c, spr, tx * H_T + 8 + (hh - 0.5) * 6, (ty + 1) * H_T - 2, fade ? 0.3 : 1); }); })(tx, ty);
    if ((ch === '#' || ch === '+') && hInBld(tx, ty)) (function (tx, ty, ch) {
      var south = ty === H_BLD.y1 - 1, north = ty === H_BLD.y0;
      add((ty + 1) * H_T - 0.05, function (lg) {
        if (!open(tx, ty)) { if (south) hFacade(lg, c, tx, ty, H_EAVE, false); return; }
        if (ch === '+') return;
        if (variant === 'raum' && ty === openRect[1]) { hFace(lg, c, tx * H_T, (tx + 1) * H_T, (ty + 1) * H_T, 0, hRoofH((ty + 1) * H_T), function (u, h) { return h > H_EAVE ? '#6a4a40' : hWallCol(u, h, H_EAVE, false, tx); }); return; }
        if (variant === 'raum' && tx === openRect[0]) { hWallBlock(lg, c, tx, ty, H_EAVE, false); return; }
        hWallBlock(lg, c, tx, ty, north ? H_BACK : H_STUB, !north);
      });
    })(tx, ty, ch);
  }
  for (ty = H_BLD.y0; ty < H_BLD.y1; ty++) (function (ty) {
    add((ty + 1) * H_T + (ty === H_BLD.y1 - 1 ? 3 : -0.02), function (lg) {
      var y0 = ty === H_BLD.y0 ? ty * H_T - 3 : ty * H_T, y1 = ty === H_BLD.y1 - 1 ? (ty + 1) * H_T + 3 : (ty + 1) * H_T;
      hCap(lg, c, H_BLD.x0 * H_T - 3, H_BLD.x1 * H_T + 3, y0, y1, function (wx, wy) {
        var tx2 = Math.floor(wx / H_T), ty2 = Math.min(H_BLD.y1 - 1, Math.max(H_BLD.y0, Math.floor(wy / H_T)));
        return open(Math.min(H_BLD.x1 - 1, Math.max(H_BLD.x0, tx2)), ty2) ? null : hRoofH(wy);
      }, hRoofCol);
      if (ty === 9 && !open(24, 9)) hChimney(lg, c);
    });
  })(ty);
  for (var i = 0; i < H_OBJ.length; i++) (function (o) { var spr = hFurniture(o[0], o[3]); add((o[2] + 1) * H_T - 1, function (lg) { hSprite(lg, c, spr, o[1] * H_T + 8, (o[2] + 1) * H_T - 1); }); })(H_OBJ[i]);
  if (!window.H_NOFENCE) for (var g = 0; g < 17; g++) { (function (x, y) { add(y, function (lg) { hSprite(lg, c, wFence(), x, y); }); })(30 * H_T + g * H_T + 8, 4 * H_T + 4); (function (x, y) { add(y, function (lg) { hSprite(lg, c, wFence(), x, y); }); })(30 * H_T + g * H_T + 8, 16 * H_T - 1); }
  var people = [['alex', 18, 14, 'down', 0], ['mira', 9, 13, 'left', 1], ['alex', 22, 9, 'right', 2]];
  if (variant !== 'zu') people = people.slice(0, 2);
  else people = [['mira', 22, 19, 'up', 1]];
  for (var p = 0; p < people.length; p++) (function (q) { var spr = fFigure(q[0], q[3], q[4]); add(q[2] * H_T + 14, function (lg) { hSprite(lg, c, spr, q[1] * H_T + 8, q[2] * H_T + 14); }); })(people[p]);
  return items.sort(function (a, b) { return a.y - b.y; });
}
// Verdeckt das Sprite (vor dem Haus stehend) den Grundriss des Hauses auf dem Bildschirm?
function hCovers(c, spr, wx, wy) {
  var p = hProj(c, wx, wy, 0), w = spr.width * p.sc / 2, top = p.y - spr.height * p.sc;
  var a = hProj(c, H_BLD.x0 * H_T, H_BLD.y1 * H_T, 0), b = hProj(c, H_BLD.x1 * H_T, H_BLD.y1 * H_T, 0);
  return p.x + w > a.x && p.x - w < b.x && top < Math.max(a.y, b.y);
}
function hSprite(lg, c, spr, wx, wy, alpha) {
  var p = hProj(c, wx, wy, 0), w = spr.width * p.sc, h = spr.height * p.sc;
  if (p.x + w < 0 || p.x - w > H_LW) return;
  lg.globalAlpha = alpha == null ? 1 : alpha;
  lg.drawImage(spr, Math.round(p.x - w / 2), Math.round(p.y - h), Math.round(w), Math.round(h));
  lg.globalAlpha = 1;
}

function hRender(canvas, variant, cam, openRect) {
  var low = document.createElement('canvas'); low.width = H_LW; low.height = H_LH;
  var lg = low.getContext('2d'); lg.imageSmoothingEnabled = false;
  hSky(lg, cam); hGroundPass(lg, cam);
  var items = hItems(cam, variant === 'durchsicht' ? 'offen' : variant, openRect);
  for (var i = 0; i < items.length; i++) items[i].fn(lg);
  if (variant === 'durchsicht') {
    var ghost = document.createElement('canvas'); ghost.width = H_LW; ghost.height = H_LH;
    var gg = ghost.getContext('2d'); gg.imageSmoothingEnabled = false;
    hCap(gg, cam, H_BLD.x0 * H_T - 3, H_BLD.x1 * H_T + 3, H_BLD.y0 * H_T - 3, H_BLD.y1 * H_T + 3, function (wx, wy) { return hRoofH(wy); }, hRoofCol);
    for (var tx = H_BLD.x0; tx < H_BLD.x1; tx++) hFacade(gg, cam, tx, H_BLD.y1 - 1, H_EAVE, false);
    lg.globalAlpha = 0.28; lg.drawImage(ghost, 0, 0); lg.globalAlpha = 1;
    hOutline(lg, ghost);
  }
  var ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, canvas.width, canvas.height);
}
function hOutline(lg, layer) {
  var d = layer.getContext('2d').getImageData(0, 0, H_LW, H_LH).data;
  lg.fillStyle = 'rgba(255,248,236,0.9)';
  for (var y = 1; y < H_LH - 1; y++) for (var x = 1; x < H_LW - 1; x++) {
    var a = d[(y * H_LW + x) * 4 + 3] > 0;
    if (a && (!d[(y * H_LW + x - 1) * 4 + 3] || !d[(y * H_LW + x + 1) * 4 + 3] || !d[((y - 1) * H_LW + x) * 4 + 3] || !d[((y + 1) * H_LW + x) * 4 + 3])) lg.fillRect(x, y, 1, 1);
  }
}
