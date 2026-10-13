// SIMULACRA Mockup AP13: die echte Startwelt (64 × 40 Kacheln) mit Technik, Sprites und Effekten aus Mockup A, unverändert übernommen.
// Kein Produktionscode. Braucht world.js (Sprites, Farben, Rauschen, Tageszeiten) und haus.js (Projektion mit Kamera).
var E_ROWS = ["TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TT.............................T..............................TT", "TTT................T.................................T........TT", "TT..########################..................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________+,,................................TT", "TT..#______#______#________#..................................TT", "TT..#______#______#________#.............................T....TT", "TT..####+####+########+#####..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________+____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..#_________#____________#..................................TT", "TT..################+#######........,.........................TT", "TT..................,...............,..........T..............TT", "TT....T.............,...............,................T..T.....TT", "TTTT.T.TT.T.TT..TT..,...............,.........................TT", "TT...T.TTTT.T..T.TTT,...............,.........................TT", "TT..T..T..T....T.T..,.....,,,,,,,,,,,,,,,.T.........sssssss..TTT", "TTT.T....T........T.,.....,,,,,,,,,,,,,,,.....T...ss~~~~~~~ss.TT", "TT...T..T.TTT.TT..T.,.....,,,,,,,,,,,,,,,........s~~~~~~~~~~~sTT", "TT..........TTT..TT.,.....,,,,,,,,,,,,,,,.......s~~~~~~~~~~~~~TT", "TTT.............T.TT,,,,,,,,,,,,,,,,,,,,,,,,,,,s~~~~~~~~~~~~~~TT", "TTTTTT,,,,,,,,,,,,,,,.....,,,,,,,,,,,,,,,......s~~~~~~~~~~~~~~TT", "TT.TTT......TTTT.TT.......,,,,,,,,,,,,,,,.....ss~~~~~~~~~~~~~~TT", "TT.T.T......T...TT........,,,,,,,,,,,,,,,....._______~~~~~~~~~TT", "TT..........T......T......,,,,,,,,,,,,,,,.....ss~~~~~~~~~~~~~~TT", "TTTTTT......T.....T............................s~~~~~~~~~~~~~~TT", "TTT......TTT..T...T............................s~~~~~~~~~~~~~~TT", "TTTT.......TTTT.T.T...............T.............s~~~~~~~~~~~~~TT", "TTT........T.TT.T.....................T.....T....s~~~~~~~~~~~sTT", "TTT...T.TT......................................T.ss~~~~~~~ss.TT", "TT.......T...TT.TTT.................................sssssss...TT", "TT..T..T..T.....T..T..........................................TT", "TTTT.T..TT..T...TTT....T......................................TT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"];
var E_M = 256, E_W = 64 * 16 + 2 * E_M, E_H = 40 * 16 + 2 * E_M;
var E_BLD = { x0: 4, y0: 4, x1: 28, y1: 17 }, E_DOOR = { x: 20 * 16 + 8, y: 17 * 16 };
var E_GARDEN = [30, 4, 17, 12], E_SQUARE = [26, 21, 15, 9];
var E_SEED = [[32, 7], [34, 7], [36, 7], [32, 10], [34, 10], [36, 10]];

function eCh(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= 64 || ty >= 40) return 'T';
  if (tx >= E_BLD.x0 && ty >= E_BLD.y0 && tx < E_BLD.x1 && ty < E_BLD.y1) return 'Y';   // Grundriss des Hauses: draußen Wiese
  return E_ROWS[ty][tx];
}
function eIn(r, x, y) { return x >= r[0] * 16 && y >= r[1] * 16 && x < (r[0] + r[2]) * 16 && y < (r[1] + r[3]) * 16; }

// Abstand zum Ufer je Wasserkachel (in Kacheln), weich abgetastet: ergibt Tiefe und Schaum wie wLake im Mockup
var E_DIST = (function () {
  var d = new Float32Array(64 * 40), q = [], x, y;
  for (y = 0; y < 40; y++) for (x = 0; x < 64; x++) { var w = E_ROWS[y][x] === '~'; d[y * 64 + x] = w ? 1e9 : 0; if (!w) q.push([x, y]); }
  while (q.length) { var p = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var a = p[0] + o[0], b = p[1] + o[1]; if (a < 0 || b < 0 || a >= 64 || b >= 40) return; var k = b * 64 + a; if (d[k] > d[p[1] * 64 + p[0]] + 1) { d[k] = d[p[1] * 64 + p[0]] + 1; q.push([a, b]); } }); }
  return d;
})();
function eDist(x, y) {
  var fx = x / 16 - 0.5, fy = y / 16 - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
  function at(a, b) { return a < 0 || b < 0 || a >= 64 || b >= 40 ? 0 : E_DIST[b * 64 + a]; }
  return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v - 0.5;
}

// Bodentexel wie wTexel im Mockup, aber aus den Kacheln; Ränder von Wasser, Weg und Platz werden mit Rauschen weich verschoben
function eTexel(px, py) {
  var wx = px - E_M, wy = py - E_M, n = wNoise(px * 0.13, py * 0.13, 1), h = wHash(px, py, 2), g = n * 0.75 + h * 0.25;
  var qx = wx + (wNoise(wx * 0.07, wy * 0.07, 21) - 0.5) * 12, qy = wy + (wNoise(wx * 0.07, wy * 0.07, 22) - 0.5) * 12;
  var tx = Math.floor(wx / 16), ty = Math.floor(wy / 16), raw = eCh(tx, ty), ch = eCh(Math.floor(qx / 16), Math.floor(qy / 16));
  if (raw === '_') { var dx = wx - 46 * 16, dy = wy - 28 * 16; return [dx % 4 === 3 ? WPA.wood3 : (dy === 0 || dy === 15) ? WPA.wood2 : (h < 0.5 ? WPA.wood1 : WPA.wood2), 5]; }
  if (ch === 'T' && raw === 'T') return [g < 0.36 ? WPA.wild3 : g < 0.66 ? WPA.wild2 : WPA.wild1, 7];
  var col = g < 0.32 ? WPA.grass3 : g < 0.64 ? WPA.grass2 : WPA.grass1, type = 0;
  if ((px + py * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
  if (ch === '~') { var lv = eDist(qx, qy); return [lv < 0.12 ? WPA.foam : lv < 0.6 ? WPA.water1 : lv < 1.3 ? WPA.water2 : lv < 2.4 ? WPA.water3 : WPA.waterDeep, 2]; }
  if (ch === 's') return [h < 0.5 ? WPA.path1 : WPA.path2, 6];
  if (eIn(E_SQUARE, qx, qy)) {
    var edge = !eIn(E_SQUARE, qx - 3, qy) || !eIn(E_SQUARE, qx + 3, qy) || !eIn(E_SQUARE, qx, qy - 3) || !eIn(E_SQUARE, qx, qy + 3);
    if (edge) return [WPA.stone3, 3];
    var row = Math.floor(wy / 4), off = (row & 1) ? 2 : 0, cx = Math.floor((wx + off) / 5);
    if (wy % 4 === 0 || (wx + off) % 5 === 0) return [WPA.cob3, 3];
    if (wy % 4 === 1 && (wx + off) % 5 === 1) return [WPA.cobHi, 3];
    return [wHash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1, 3];
  }
  if (ch === ',') return [wNoise(px * 0.3, py * 0.3, 4) < 0.45 ? WPA.path2 : (h > 0.965 ? WPA.pebble : WPA.path1), 1];
  if ([[3, 0], [-3, 0], [0, 3], [0, -3]].some(function (o) { return eCh(Math.floor((qx + o[0]) / 16), Math.floor((qy + o[1]) / 16)) === ','; })) col = WPA.grassDark;
  if (eIn(E_GARDEN, wx, wy) && col !== WPA.grassDark) {
    col = g < 0.5 ? WPA.grass1 : WPA.grassLight;
    for (var i = 0; i < E_SEED.length; i++) {
      var bx = wx - E_SEED[i][0] * 16, by = wy - E_SEED[i][1] * 16;
      if (bx >= -6 && bx < 22 && by >= 3 && by < 13) { type = 4; col = (by - 3) % 3 === 0 ? WPA.soil2 : WPA.soil1; if (bx === -6 || bx === 21 || by === 12) col = WPA.wood3; }
    }
  }
  if (Math.abs(wx - E_DOOR.x) < 36 && wy >= E_DOOR.y - 30 && wy < E_DOOR.y) col = WPA.path3;
  return [col, type];
}

// Zeichenliste: Bäume auf T-Kacheln und Wald jenseits der Karte, Objekte aus dem Zustand, Deko (erfunden, im Mockup vorhanden)
function eObjects() {
  var o = [], R = wRng(11), x, y;
  function add(kind, vx, vy, extra, deco) { o.push({ kind: kind, vx: vx, vy: vy, extra: extra || 0, deco: !!deco }); }
  for (y = -16; y < 40 + 16; y++) for (x = -20; x < 64 + 20; x++) {
    if (eCh(x, y) !== 'T') continue;
    var hh = wHash(x, y, 5), out = x < 0 || y < 0 || x >= 64 || y >= 40;
    if (out && hh < 0.25) continue;
    add(hh < 0.45 ? 'pine' : hh > 0.94 && !out ? 'treeF' : hh > 0.9 && !out ? 'treeB' : 'tree', x * 16 + 8 + (wHash(x, y, 6) - 0.5) * 8, (y + 1) * 16 - 2 + (wHash(x, y, 7) - 0.5) * 6, x * 7 + y);
  }
  add('house', E_DOOR.x, E_DOOR.y);
  add('well', 40 * 16 + 8, 10 * 16 - 1); add('bench', 40 * 16 + 8, 13 * 16 - 1); add('well', 33 * 16 + 8, 26 * 16 - 1); add('bench', 30 * 16 + 8, 24 * 16 - 1); add('board', 38 * 16 + 8, 23 * 16 - 1);
  var g = E_GARDEN, gx0 = g[0] * 16, gx1 = (g[0] + g[2]) * 16, gy0 = g[1] * 16, gy1 = (g[1] + g[3]) * 16;
  for (x = gx0; x < gx1 - 4; x += 12) { if (Math.abs(x + 7 - (36 * 16 + 8)) > 9) add('fence', x + 7, gy1); add('fence', x + 7, gy0); }
  for (y = gy0 + 8; y < gy1; y += 8) { if (y < 7 * 16 || y > 8 * 16 + 4) add('post', gx0, y); add('post', gx1, y); }
  // Deko wie im Mockup A; steht nicht im Weltzustand (Frage im Statusbericht)
  [['mailbox', E_DOOR.x + 30, E_DOOR.y + 6], ['barrel', E_DOOR.x - 52, E_DOOR.y - 4], ['barrel', E_DOOR.x - 45, E_DOOR.y - 2], ['bushP', E_DOOR.x - 24, E_DOOR.y + 6], ['bushY', E_DOOR.x + 18, E_DOOR.y + 6],
   ['lamp', E_DOOR.x + 22, E_DOOR.y + 40], ['lamp', 26 * 16, 21 * 16], ['lamp', 41 * 16, 21 * 16], ['lamp', 46 * 16, 27 * 16], ['sign', 37 * 16 + 4, 20 * 16 + 8], ['boat', 55 * 16, 29 * 16 + 4],
   ['scare', 44 * 16, 13 * 16], ['sun', 31 * 16 + 4, 6 * 16], ['sun', 31 * 16 + 12, 6 * 16 + 2], ['sun', 31 * 16 + 20, 6 * 16], ['tomato', 39 * 16, 8 * 16, 1], ['tomato', 39 * 16 + 14, 8 * 16 + 2, 2]
  ].forEach(function (d) { add(d[0], d[1], d[2], d[3], true); });
  for (y = 18; y < 38; y++) for (x = 44; x < 63; x++) {
    if (E_ROWS[y][x] === '~' || E_ROWS[y][x] === 'T') continue;
    var nearW = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) { return (E_ROWS[y + q[1]] || '')[x + q[0]] === '~'; });
    if (nearW && wHash(x, y, 8) < 0.3) add('reed', x * 16 + 8, y * 16 + 10, 0, true);
  }
  for (var i = 0; i < 40; i++) { x = Math.floor(R() * 64); y = Math.floor(R() * 40); if (eCh(x, y) === '.' && R() < 0.5) add('rock', x * 16 + 8, y * 16 + 12, i, true); }
  add('alex', 33 * 16 + 8, 9 * 16 + 4); add('mira', 31 * 16 + 4, 24 * 16 + 8);
  return o;
}

var E_HOUSE_LIGHTS = [[-17, 0, 32, 1], [17, 0, 32, 1], [0, 0, 59, 0.8], [9, 0, 31, 0.7]];

function eRender(canvas, zeit, cam) {
  var T = W_TIMES[zeit], lit = !!T.lights, cache = {}, haze = wHex(T.haze), x, y, i;
  var tex = new Uint8ClampedArray(E_W * E_H * 3), ttype = new Uint8Array(E_W * E_H);
  for (y = 0; y < E_H; y++) for (x = 0; x < E_W; x++) { var tv = eTexel(x, y), ti = y * E_W + x; tex[ti * 3] = tv[0][0]; tex[ti * 3 + 1] = tv[0][1]; tex[ti * 3 + 2] = tv[0][2]; ttype[ti] = tv[1]; }
  function setT(a, b, c) { if (a < 0 || b < 0 || a >= E_W || b >= E_H) return; var j = b * E_W + a; tex[j * 3] = c[0]; tex[j * 3 + 1] = c[1]; tex[j * 3 + 2] = c[2]; }
  function typeAt(a, b) { return a < 0 || b < 0 || a >= E_W || b >= E_H ? 255 : ttype[b * E_W + a]; }
  var R = wRng(5), k0 = E_W * E_H / (384 * 288);
  for (i = 0; i < 1400 * k0; i++) { x = Math.floor(R() * E_W); y = Math.floor(R() * E_H); var t0 = typeAt(x, y); if (t0 === 0 || t0 === 7) { var dk = t0 === 7 ? WPA.wild3 : WPA.grassDark; setT(x, y - 1, dk); setT(x - 1, y, dk); setT(x + 1, y, dk); } }
  var FL = [WPA.fP, WPA.fY, WPA.fW, WPA.fB];
  for (i = 0; i < 260 * k0; i++) {
    var fx = Math.floor(R() * E_W), fy = Math.floor(R() * E_H), fc = FL[Math.floor(R() * 4)], big = R() < 0.35, n2 = 2 + Math.floor(R() * 4);
    for (var j = 0; j < n2; j++) { var a = fx + Math.round((R() - 0.5) * 9), b = fy + Math.round((R() - 0.5) * 7); if (typeAt(a, b) !== 0) continue; if (big) { setT(a - 1, b, fc); setT(a + 1, b, fc); setT(a, b - 1, fc); setT(a, b + 1, fc); setT(a, b, WPA.fY); } else setT(a, b, fc); }
  }
  var objs = eObjects();
  for (i = 0; i < objs.length; i++) {                                                       // Schatten in den Boden, wie im Mockup
    var ob = objs[i], sp = wSpriteFor(ob, lit, 0, cache);
    if (ob.kind === 'boat') continue;
    var rx = sp.width * 0.42, ry = Math.max(2, sp.width * 0.16), cx0 = ob.vx + E_M + rx * 0.3, cy0 = ob.vy + E_M + 0.5;
    for (y = Math.floor(cy0 - ry); y <= cy0 + ry; y++) for (x = Math.floor(cx0 - rx); x <= cx0 + rx; x++) {
      var ddx = (x + 0.5 - cx0) / rx, ddy = (y + 0.5 - cy0) / ry;
      if (ddx * ddx + ddy * ddy > 1 || x < 0 || y < 0 || x >= E_W || y >= E_H) continue;
      var q = (y * E_W + x) * 3; tex[q] *= 0.72; tex[q + 1] *= 0.72 * 1.02; tex[q + 2] *= 0.72 * 1.12;
    }
  }
  var low = document.createElement('canvas'); low.width = H_LW; low.height = H_LH;
  var lg = low.getContext('2d'); lg.imageSmoothingEnabled = false;
  eSky(lg, T);
  var img = lg.getImageData(0, 0, H_LW, H_LH), gd = img.data;
  for (y = 0; y < H_LH; y++) for (x = 0; x < H_LW; x++) {
    var w = hUnproj(cam, x + 0.5, y + 0.5); if (!w) continue;
    var px = Math.floor(w.x) + E_M, py = Math.floor(w.y) + E_M, o = (y * H_LW + x) * 4, r0, g0, b0, fog = Math.pow(Math.max(0, w.t), 2.2) * 0.55;
    if (px >= 0 && py >= 0 && px < E_W && py < E_H) { var q2 = (py * E_W + px) * 3; r0 = tex[q2]; g0 = tex[q2 + 1]; b0 = tex[q2 + 2]; if (ttype[py * E_W + px] === 2) { var sh = Math.sin(px * 0.55 + 2.1) * Math.sin(py * 1.25 - 1.6); if (sh > 0.86) { r0 = 240; g0 = 252; b0 = 255; } } }
    else { var gg2 = wNoise(px * 0.13, py * 0.13, 1); var wc = gg2 < 0.36 ? WPA.wild3 : gg2 < 0.66 ? WPA.wild2 : WPA.wild1; r0 = wc[0]; g0 = wc[1]; b0 = wc[2]; }
    gd[o] = r0 + (haze[0] - r0) * fog; gd[o + 1] = g0 + (haze[1] - g0) * fog; gd[o + 2] = b0 + (haze[2] - b0) * fog; gd[o + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
  objs.sort(function (p1, p2) { return p1.vy - p2.vy; }).forEach(function (ob2) {
    var pr = hProj(cam, ob2.vx, ob2.vy, 0); if (pr.t < -0.35 || pr.x < -60 || pr.x > H_LW + 60 || pr.y < 0) return;
    var spr = wSpriteFor(ob2, lit, 0, cache), sw = spr.width * pr.sc, shh = spr.height * pr.sc;
    lg.drawImage(spr, Math.round(pr.x - sw / 2), Math.round(pr.y - shh), Math.round(sw), Math.round(shh));
  });
  var lights = E_HOUSE_LIGHTS.map(function (L) { return [E_DOOR.x + L[0], E_DOOR.y, L[2], L[3]]; });
  objs.forEach(function (ob3) { if (ob3.kind === 'lamp') lights.push([ob3.vx, ob3.vy, 24, 1]); });
  ePost(canvas, low, T, zeit, cam, lights);
}

function eSky(lg, T) {
  var grad = lg.createLinearGradient(0, 0, 0, 60); grad.addColorStop(0, T.skyTop); grad.addColorStop(1, T.skyBot);
  lg.fillStyle = grad; lg.fillRect(0, 0, H_LW, 70);
  var x, y, i;
  if (T.stars) { var RS = wRng(3); for (i = 0; i < 70; i++) { lg.fillStyle = RS() < 0.2 ? '#fff6c8' : '#dfe6ff'; lg.fillRect(Math.floor(RS() * H_LW), Math.floor(RS() * 40), 1, 1); } lg.fillStyle = '#fff4d6'; lg.beginPath(); lg.arc(250, 14, 6, 0, 7); lg.fill(); lg.fillStyle = T.skyTop; lg.beginPath(); lg.arc(253, 12, 5.5, 0, 7); lg.fill(); }
  var cw = wHex(T.stars ? '#4a5288' : '#ffffff'), cs = wHex(T.stars ? '#3a4074' : T.skyBot), ci = lg.getImageData(0, 2, H_LW, 40), cd = ci.data;
  for (y = 0; y < 40; y++) for (x = 0; x < H_LW; x++) {
    var nv = wNoise(x * 0.035, y * 0.11, 8) * 0.7 + wNoise(x * 0.09, y * 0.25, 9) * 0.3 - (Math.abs(y - 14) / 30), oo = (y * H_LW + x) * 4;
    if (nv > 0.5) { var shade = nv < 0.56 || y > 17 ? cs : cw; cd[oo] = shade[0] * 0.92 + cd[oo] * 0.08; cd[oo + 1] = shade[1] * 0.92 + cd[oo + 1] * 0.08; cd[oo + 2] = shade[2] * 0.92 + cd[oo + 2] * 0.08; }
  }
  lg.putImageData(ci, 0, 2);
  var hc = wHex(T.haze), hc2 = wHex(T.skyBot);
  for (x = 0; x < H_LW; x++) {
    var yh = hHor(x), top1 = yh - 9 - 7 * wNoise(x * 0.025, 0, 3), top2 = yh - 4 - 4 * wNoise(x * 0.05, 1, 4);
    lg.fillStyle = 'rgb(' + Math.round(hc[0] * 0.78 + hc2[0] * 0.1) + ',' + Math.round(hc[1] * 0.86 + hc2[1] * 0.08) + ',' + Math.round(hc[2] * 0.95) + ')'; lg.fillRect(x, Math.round(top1), 1, 70);
    lg.fillStyle = 'rgb(' + Math.round(hc[0] * 0.62) + ',' + Math.round(hc[1] * 0.78) + ',' + Math.round(hc[2] * 0.8) + ')'; lg.fillRect(x, Math.round(top2), 1, 70);
  }
}

// Nachbearbeitung genau wie frame() in world.js: Farbstimmung, Lichtschein, Tilt-Shift, Teilchen, Vignette
function ePost(canvas, low, T, zeit, cam, lights) {
  var ctx = canvas.getContext('2d'), SC = canvas.width / H_LW, k2;
  ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(low, 0, 0, canvas.width, canvas.height);
  if (T.grade !== '#ffffff') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = T.grade; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (T.glowA) {
    ctx.globalCompositeOperation = 'lighter';
    for (k2 = 0; k2 < lights.length; k2++) {
      var L = lights[k2], lp = hProj(cam, L[0], L[1], 0), gx = lp.x * SC, gy = (lp.y - L[2] * lp.sc) * SC, gr = 58 * lp.sc * L[3];
      var rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rg.addColorStop(0, 'rgba(255,205,120,' + T.glowA + ')'); rg.addColorStop(0.35, 'rgba(255,170,90,' + T.glowA * 0.4 + ')'); rg.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = rg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  var tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height; var tg = tmp.getContext('2d');
  tg.filter = 'blur(5px)'; tg.drawImage(canvas, 0, 0); tg.filter = 'none';
  tg.globalCompositeOperation = 'destination-in';
  var mg = tg.createLinearGradient(0, 0, 0, tmp.height);
  mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.2, 'rgba(0,0,0,0.85)'); mg.addColorStop(0.36, 'rgba(0,0,0,0)'); mg.addColorStop(0.84, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,0.75)');
  tg.fillStyle = mg; tg.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, 0, 0);
  var RP = wRng(21), tm = 3.2;
  for (k2 = 0; k2 < 26; k2++) {
    var pa = { x: RP() * canvas.width, y: 200 + RP() * (canvas.height - 240), p: RP() * 6.28, sp: 0.3 + RP() * 0.6, c: RP() };
    var px3 = (pa.x + Math.sin(tm * pa.sp + pa.p) * 30 + tm * 6) % canvas.width, py3 = pa.y + Math.cos(tm * pa.sp * 1.3 + pa.p) * 18, bx3 = Math.round(px3 / 4) * 4, by3 = Math.round(py3 / 4) * 4;
    if (T.stars) { var fa = 0.5 + 0.5 * Math.sin(tm * 2 + pa.p * 3); ctx.fillStyle = 'rgba(214,255,140,' + fa + ')'; ctx.fillRect(bx3, by3, 4, 4); ctx.fillStyle = 'rgba(214,255,140,' + fa * 0.25 + ')'; ctx.fillRect(bx3 - 4, by3 - 4, 12, 12); }
    else if (zeit === 'Abend') { ctx.fillStyle = pa.c < 0.5 ? '#ffc2d6' : '#fff0f5'; ctx.fillRect(bx3, by3, 4, 4); }
    else if (k2 < 6) { var wing = Math.sin(tm * 14 + pa.p) > 0; ctx.fillStyle = pa.c < 0.5 ? '#ffffff' : '#ffd94f'; ctx.fillRect(bx3 - 4, by3, 4, wing ? 4 : 2); ctx.fillRect(bx3 + 4, by3, 4, wing ? 4 : 2); ctx.fillStyle = WP.outline; ctx.fillRect(bx3, by3, 4, 4); }
  }
  var vg = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.55, canvas.height * 0.45, canvas.width / 2, canvas.height * 0.55, canvas.height * 0.95);
  vg.addColorStop(0, 'rgba(30,20,40,0)'); vg.addColorStop(1, T.stars ? 'rgba(5,8,25,0.55)' : 'rgba(40,25,40,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
}
