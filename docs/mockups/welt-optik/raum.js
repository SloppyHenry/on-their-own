// SIMULACRA Welt-Mockup 3D: weiche Spielzeugwelt (kleiner Software-Renderer auf Canvas 2D, ohne Bibliothek). Braucht world.js (Dorfplan, Zufall).
var R3_W = 1280, R3_H = 800, R3_K = 0.00032, R3_F = 400 / Math.tan(17 * Math.PI / 180);
var R3_C = [0, 178, 252], R3_TGT = [0, 0, -22];

function r3Sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function r3Dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function r3Cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function r3Norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
var R3_FWD = r3Norm(r3Sub(R3_TGT, R3_C)), R3_RIGHT = r3Norm(r3Cross(R3_FWD, [0, 1, 0])), R3_UP = r3Cross(R3_RIGHT, R3_FWD);

// Welt → Bildschirm, mit gewölbtem Boden (je weiter weg, desto tiefer)
function r3Project(p) {
  var u = R3_C[2] - p[2], y = p[1] - (u > 0 ? R3_K * u * u : 0);
  var d = [p[0] - R3_C[0], y - R3_C[1], p[2] - R3_C[2]], zv = r3Dot(d, R3_FWD);
  return [R3_W / 2 + r3Dot(d, R3_RIGHT) * R3_F / zv, R3_H / 2 - r3Dot(d, R3_UP) * R3_F / zv, zv];
}
// Dorfkoordinaten (wie in der Pixelwelt) → Welt
function r3V(vx, vy, h) { return [vx - 128, h || 0, vy - 96]; }
function r3Screen(vx, vy, h) { var p = r3Project(r3V(vx, vy, h)); return { x: p[0], y: p[1] }; }

// ---- Formen ----
function r3Ico(sub) {
  var t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(r3Norm);
  var f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (var s = 0; s < sub; s++) {
    var nf = [], cache = {};
    var mid = function (a, b) { var k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] === undefined) { v.push(r3Norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); cache[k] = v.length - 1; } return cache[k]; };
    for (var i = 0; i < f.length; i++) { var a = f[i][0], b = f[i][1], c = f[i][2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return f.map(function (tri) { return [v[tri[0]], v[tri[1]], v[tri[2]]]; });
}
var R3_ICO = [r3Ico(0), r3Ico(1), r3Ico(2)];
function r3Cyl(n, r1, r2, h) {
  var t = [], i;
  for (i = 0; i < n; i++) {
    var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    var b0 = [Math.cos(a0) * r1, 0, Math.sin(a0) * r1], b1 = [Math.cos(a1) * r1, 0, Math.sin(a1) * r1], t0 = [Math.cos(a0) * r2, h, Math.sin(a0) * r2], t1 = [Math.cos(a1) * r2, h, Math.sin(a1) * r2];
    t.push([b0, b1, t1]); if (r2 > 0) t.push([b0, t1, t0]);
    if (r2 > 0) t.push([[0, h, 0], t0, t1]);
    t.push([[0, 0, 0], b1, b0]);
  }
  return t;
}
function r3Box(w, h, d) {
  var x = w / 2, z = d / 2, P = [[-x, 0, -z], [x, 0, -z], [x, h, -z], [-x, h, -z], [-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]];
  var F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]], t = [];
  F.forEach(function (q) { t.push([P[q[0]], P[q[1]], P[q[2]]], [P[q[0]], P[q[2]], P[q[3]]]); });
  return t;
}
function r3Prism(w, h, d) { // Satteldach, First entlang x
  var x = w / 2, z = d / 2, A = [-x, 0, -z], B = [x, 0, -z], C = [x, 0, z], D = [-x, 0, z], E = [-x, h, 0], Fp = [x, h, 0];
  return [[D, C, Fp], [D, Fp, E], [B, A, E], [B, E, Fp], [A, D, E], [C, B, Fp], [A, B, C], [A, C, D]];
}

function R3Scene() { this.tris = []; }
// Form mit Farbe einsetzen: Skalierung s, Drehung um y (rad), Verschiebung p; emit: leuchtet selbst; bias: früher/später zeichnen
R3Scene.prototype.add = function (shape, col, s, rot, p, emit, bias) {
  var cr = Math.cos(rot || 0), sr = Math.sin(rot || 0), sc = s.length ? s : [s, s, s], c = col;
  var center = [p[0], p[1] + sc[1] * 0.5, p[2]];
  for (var i = 0; i < shape.length; i++) {
    var tri = shape[i], out = [];
    for (var j = 0; j < 3; j++) { var q = tri[j], x = q[0] * sc[0], y = q[1] * sc[1], z = q[2] * sc[2]; out.push([x * cr - z * sr + p[0], y + p[1], x * sr + z * cr + p[2]]); }
    this.tris.push({ v: out, col: c, emit: !!emit, center: center, bias: bias || 0 });
  }
};

function r3Hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

var R3_TIMES = {
  Morgen: { light: [1, 0.9, 0.8], dir: [-0.7, 0.5, 0.5], amb: '#d9b8c8', ambK: 0.55, skyTop: '#a9cff2', skyBot: '#ffe2cb', haze: '#ffe6d6', lit: 0, glowA: 0, stars: 0 },
  Mittag: { light: [1, 0.98, 0.92], dir: [-0.45, 0.85, 0.35], amb: '#bcd6f2', ambK: 0.52, skyTop: '#6cb7f3', skyBot: '#d4f0ff', haze: '#e4f4ff', lit: 0, glowA: 0, stars: 0 },
  Abend: { light: [1.15, 0.8, 0.56], dir: [-0.8, 0.45, 0.35], amb: '#8a80c0', ambK: 0.62, skyTop: '#5d5ba8', skyBot: '#ffab79', haze: '#ffc29a', lit: 1, glowA: 0.45, stars: 0 },
  Nacht: { light: [0.5, 0.58, 0.9], dir: [0.6, 0.6, 0.4], amb: '#2c3468', ambK: 0.75, skyTop: '#0f1534', skyBot: '#353b70', haze: '#353d72', lit: 1, glowA: 0.8, stars: 1 }
};

// Boden als weiche Karte (1,5 px je Welteinheit), Bereich x −448..448, z −512..192
var R3_GS = 1.5, R3_GX0 = -448, R3_GZ0 = -512, R3_GW = 896, R3_GD = 704;
function r3GroundMap(T) {
  var c = document.createElement('canvas'); c.width = R3_GW * R3_GS; c.height = R3_GD * R3_GS;
  var g = c.getContext('2d'), S = R3_GS;
  function X(vx) { return (vx - 128 - R3_GX0) * S; } function Z(vy) { return (vy - 96 - R3_GZ0) * S; }
  g.fillStyle = '#5f9f4c'; g.fillRect(0, 0, c.width, c.height);
  var R = wRng(41), i;
  for (i = 0; i < 900; i++) { g.fillStyle = ['#67a853', '#5a9848', '#6fb058', '#548f44'][i % 4]; g.globalAlpha = 0.5; g.beginPath(); g.arc(R() * c.width, R() * c.height, 8 + R() * 30, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // Dorfwiese
  g.fillStyle = '#86c962'; g.beginPath(); g.ellipse(X(128), Z(98), 190 * S, 128 * S, 0, 0, 7); g.fill();
  for (i = 0; i < 500; i++) { g.fillStyle = ['#8fd068', '#7cc05a', '#95d670'][i % 3]; g.globalAlpha = 0.55; g.beginPath(); g.arc(X(-40 + R() * 340), Z(-20 + R() * 230), 4 + R() * 16, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // Garten
  g.fillStyle = '#9bd877'; g.beginPath(); g.roundRect(X(12), Z(118), 74 * S, 60 * S, 10 * S); g.fill();
  // Wege
  g.lineCap = 'round'; g.lineJoin = 'round';
  var paths = W_PATHS;
  g.strokeStyle = '#c9ab7c'; g.lineWidth = 14 * S; paths.forEach(function (pl) { g.beginPath(); pl.forEach(function (pt, k) { k ? g.lineTo(X(pt[0]), Z(pt[1])) : g.moveTo(X(pt[0]), Z(pt[1])); }); g.stroke(); });
  g.strokeStyle = '#ecd7a6'; g.lineWidth = 11 * S; paths.forEach(function (pl) { g.beginPath(); pl.forEach(function (pt, k) { k ? g.lineTo(X(pt[0]), Z(pt[1])) : g.moveTo(X(pt[0]), Z(pt[1])); }); g.stroke(); });
  // Platz
  g.fillStyle = '#b9ad99'; g.beginPath(); g.ellipse(X(128), Z(106), 29 * S, 27 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#e2d9c8'; g.beginPath(); g.ellipse(X(128), Z(106), 26.5 * S, 24.5 * S, 0, 0, 7); g.fill();
  for (i = 0; i < 70; i++) { var a = R() * 6.28, rr = Math.sqrt(R()) * 23; g.fillStyle = R() < 0.5 ? '#d3c9b6' : '#efe8da'; g.beginPath(); g.roundRect(X(128 + Math.cos(a) * rr) - 3 * S, Z(106 + Math.sin(a) * rr) - 2 * S, 6 * S, 4 * S, 1.5 * S); g.fill(); }
  // See: Sandufer, Wasser mit Tiefenverlauf, Schaumrand
  function lakePath(scale) { g.beginPath(); for (var k = 0; k <= 64; k++) { var an = k / 64 * Math.PI * 2, wob = 1 + (wNoise(Math.cos(an) * 2 + 5, Math.sin(an) * 2 + 5, 7) - 0.5) * 0.25; var px = X(W_LAKE.x + Math.cos(an) * W_LAKE.rx * wob * scale), pz = Z(W_LAKE.y + Math.sin(an) * W_LAKE.ry * wob * scale); k ? g.lineTo(px, pz) : g.moveTo(px, pz); } g.closePath(); }
  g.fillStyle = '#efdcae'; lakePath(1.12); g.fill();
  var lg2 = g.createRadialGradient(X(W_LAKE.x), Z(W_LAKE.y), 4, X(W_LAKE.x), Z(W_LAKE.y), W_LAKE.rx * S);
  lg2.addColorStop(0, '#2f86c2'); lg2.addColorStop(0.6, '#47a9d8'); lg2.addColorStop(1, '#7fd8f0');
  g.fillStyle = lg2; lakePath(1); g.fill();
  g.strokeStyle = 'rgba(240,253,255,0.9)'; g.lineWidth = 2.2 * S; lakePath(0.97); g.stroke();
  // Blumen
  var FC = ['#ff9fc2', '#ffd94f', '#fffaf0', '#93baff'];
  for (i = 0; i < 110; i++) {
    var fx = X(-30 + R() * 330), fz = Z(-10 + R() * 210), col = FC[i % 4];
    for (var j = 0; j < 5; j++) { g.fillStyle = col; g.beginPath(); g.arc(fx + (R() - 0.5) * 7 * S, fz + (R() - 0.5) * 5 * S, 0.9 * S, 0, 7); g.fill(); }
  }
  return c;
}

function r3Build(T) {
  var S = new R3Scene(), lit = !!T.lit, i, x, y;
  var LEAF = ['#7ccb5e', '#62b152', '#4f9c4a'], PINE = '#3f8f5a';
  function tree(vx, vy, kind, big) {
    var p = r3V(vx, vy, 0), k = big || 1;
    S.add(r3Cyl(6, 2.4 * k, 1.8 * k, 12 * k), '#9c6b45', 1, 0, p);
    if (kind === 'pine') { for (var t = 0; t < 3; t++) S.add(r3Cyl(8, (11 - t * 3) * k, 0, 11 * k), PINE, 1, t, [p[0], p[1] + (10 + t * 7) * k, p[2]]); return; }
    var leaf = kind === 'blossom' ? '#f7a8c6' : kind === 'fruit' ? '#6cbf55' : LEAF[Math.abs(vx * 7 + vy) % 3];
    var sub = Math.abs(vy) > 10 && vy < 0 ? 1 : 2;
    S.add(R3_ICO[sub], leaf, [12 * k, 10.5 * k, 12 * k], 0, [p[0], p[1] + 21 * k, p[2]]);
    S.add(R3_ICO[1], leaf, [8 * k, 7 * k, 8 * k], 0, [p[0] - 7 * k, p[1] + 16 * k, p[2] + 3 * k]);
    S.add(R3_ICO[1], leaf, [7 * k, 6 * k, 7 * k], 0, [p[0] + 7 * k, p[1] + 17 * k, p[2] + 2 * k]);
    if (kind === 'fruit') for (var f = 0; f < 6; f++) { var an = f * 1.1; S.add(R3_ICO[0], '#ff6b6b', 1.6, 0, [p[0] + Math.cos(an) * 10 * k, p[1] + (17 + (f % 3) * 4) * k, p[2] + Math.abs(Math.sin(an)) * 10 * k]); }
  }
  function bush(vx, vy, flower) { var p = r3V(vx, vy, 0); S.add(R3_ICO[1], '#5aa84f', [7, 5, 6], 0, [p[0], p[1] + 2, p[2]]); if (flower) for (var f = 0; f < 5; f++) S.add(R3_ICO[0], flower, 1.1, 0, [p[0] - 4 + f * 2, p[1] + 5.5 + (f % 2), p[2] + 4]); }
  function lamp(vx, vy) { var p = r3V(vx, vy, 0); S.add(r3Cyl(6, 0.8, 0.8, 22), '#4b4559', 1, 0, p); S.add(r3Cyl(6, 2.2, 2.2, 1.2), '#4b4559', 1, 0, p); S.add(R3_ICO[1], lit ? '#ffd36e' : '#fff2c6', 2.6, 0, [p[0], p[1] + 24, p[2]], lit); S.add(r3Cyl(6, 3, 0, 2.5), '#4b4559', 1, 0, [p[0], p[1] + 26, p[2]]); }
  function person(vx, vy, who) {
    var p = r3V(vx, vy, 0), A = who === 'alex';
    S.add(r3Cyl(6, 1.1, 1.1, 4), A ? '#4f6c9c' : '#f7cba2', 1, 0, [p[0] - 1.6, p[1], p[2]]); S.add(r3Cyl(6, 1.1, 1.1, 4), A ? '#4f6c9c' : '#f7cba2', 1, 0, [p[0] + 1.6, p[1], p[2]]);
    S.add(r3Cyl(10, A ? 3.6 : 4.8, A ? 3.2 : 2.6, 7), A ? '#efa24b' : '#7fc48f', 1, 0, [p[0], p[1] + 3.6, p[2]]);
    S.add(R3_ICO[2], '#f7cba2', [5.6, 5.4, 5.4], 0, [p[0], p[1] + 15.5, p[2]]);
    S.add(R3_ICO[2], A ? '#7a4a2b' : '#3d2a3c', [5.9, 4.6, 5.7], 0, [p[0], p[1] + 18, p[2] - 1.3]);
    if (!A) { S.add(R3_ICO[1], '#3d2a3c', [3, 5, 3], 0, [p[0] - 4.4, p[1] + 13, p[2] - 1]); S.add(R3_ICO[1], '#3d2a3c', [3, 5, 3], 0, [p[0] + 4.4, p[1] + 13, p[2] - 1]); S.add(R3_ICO[0], '#ff9fc2', 1.3, 0, [p[0] + 4, p[1] + 21, p[2] + 1]); }
    if (A) { S.add(r3Cyl(8, 2.2, 2.2, 3.4), '#6aa7da', 1, 0, [p[0] + 6, p[1] + 5, p[2] + 1.5]); S.add(r3Cyl(6, 0.5, 0.4, 4), '#6aa7da', 1, -0.6, [p[0] + 8, p[1] + 7.5, p[2] + 1.5]); }
  }
  // Haus
  var h = r3V(W_HOUSE.x, W_HOUSE.y - 16, 0);
  S.add(r3Box(56, 3, 34), '#aca499', 1, 0, h);
  S.add(r3Box(52, 25, 30), '#f6e9cc', 1, 0, [h[0], 3, h[2]]);
  S.add(r3Prism(60, 18, 38), '#e6775c', 1, 0, [h[0], 28, h[2]]);
  S.add(r3Box(62, 1.4, 40), '#a2463a', 1, 0, [h[0], 27, h[2]]);
  S.add(r3Box(7, 16, 7), '#aca499', 1, 0, [h[0] + 15, 36, h[2] - 6]);
  var fz = h[2] + 15, wc = lit ? '#ffd88a' : '#a6dcf2';
  S.add(r3Box(11, 9, 0.6), '#7c4e30', 1, 0, [h[0] - 15, 13, fz + 0.3], false, 40); S.add(r3Box(9, 7, 0.4), wc, 1, 0, [h[0] - 15, 14, fz + 0.8], lit, 41);
  S.add(r3Box(11, 9, 0.6), '#7c4e30', 1, 0, [h[0] + 15, 13, fz + 0.3], false, 40); S.add(r3Box(9, 7, 0.4), wc, 1, 0, [h[0] + 15, 14, fz + 0.8], lit, 41);
  S.add(r3Box(0.8, 7, 0.3), '#cf9159', 1, 0, [h[0] - 15, 14, fz + 1.1], false, 42); S.add(r3Box(0.8, 7, 0.3), '#cf9159', 1, 0, [h[0] + 15, 14, fz + 1.1], false, 42);
  S.add(r3Box(9, 13, 0.6), '#b9784a', 1, 0, [h[0], 3, fz + 0.3], false, 40); S.add(r3Box(1, 1, 0.4), '#ffd94f', 1, 0, [h[0] + 2.8, 9, fz + 0.8], false, 42);
  S.add(r3Box(14, 1.5, 4), '#d2cbc0', 1, 0, [h[0], 0, fz + 2.2], false, 10);
  S.add(r3Box(14, 2, 3), '#a96f42', 1, 0, [h[0] - 15, 10.5, fz + 1.6], false, 43); S.add(r3Box(14, 2, 3), '#a96f42', 1, 0, [h[0] + 15, 10.5, fz + 1.6], false, 43);
  for (i = 0; i < 5; i++) { S.add(R3_ICO[0], ['#ff9fc2', '#ffd94f', '#fffaf0', '#ff6b6b', '#ff9fc2'][i], 1.2, 0, [h[0] - 20 + i * 2.5, 12.8, fz + 2.2], false, 44); S.add(R3_ICO[0], ['#ffd94f', '#ff9fc2', '#fffaf0', '#ffd94f', '#ff6b6b'][i], 1.2, 0, [h[0] + 10 + i * 2.5, 12.8, fz + 2.2], false, 44); }
  S.add(R3_ICO[0], lit ? '#ffd36e' : '#fff2c6', 1.3, 0, [h[0] + 7.5, 15, fz + 1], lit, 44);
  for (i = 0; i < 4; i++) S.add(r3Box(61, 0.6, 0.6), '#c55a46', 1, 0, [h[0], 31 + i * 3.8, h[2] + 18.2 - i * 4.4], false, 5);
  // Brunnen
  var w = r3V(W_SQ.x, W_SQ.y, 0);
  S.add(r3Cyl(14, 8, 8, 6), '#c9c2b6', 1, 0, w); S.add(r3Cyl(14, 6.5, 6.5, 0.3), '#2f6f98', 1, 0, [w[0], 6, w[2]]);
  S.add(r3Box(1.4, 16, 1.4), '#a96f42', 1, 0, [w[0] - 7, 0, w[2]]); S.add(r3Box(1.4, 16, 1.4), '#a96f42', 1, 0, [w[0] + 7, 0, w[2]]);
  S.add(r3Prism(19, 6, 12), '#e6775c', 1, 0, [w[0], 16, w[2]]); S.add(r3Cyl(8, 2, 1.7, 3), '#a96f42', 1, 0, [w[0], 9, w[2]]);
  // Bank, Brett, Schild
  var bpos = r3V(92, 112, 0); S.add(r3Box(18, 1.5, 5), '#cf9159', 1, 0.3, [bpos[0], 4, bpos[2]]); S.add(r3Box(18, 4, 1.2), '#cf9159', 1, 0.3, [bpos[0] - 0.8, 6, bpos[2] - 2.4]); S.add(r3Box(1.4, 4, 4.5), '#7c4e30', 1, 0.3, [bpos[0] - 7, 0, bpos[2]]); S.add(r3Box(1.4, 4, 4.5), '#7c4e30', 1, 0.3, [bpos[0] + 7, 0, bpos[2]]);
  var nb = r3V(152, 86, 0); S.add(r3Box(16, 11, 1.4), '#cf9159', 1, 0, [nb[0], 8, nb[2]]); S.add(r3Box(5, 6, 0.4), '#fffaf0', 1, 0, [nb[0] - 3, 10, nb[2] + 0.9]); S.add(r3Box(5, 5, 0.4), '#ffe7a8', 1, 0, [nb[0] + 3.5, 10.5, nb[2] + 0.9]); S.add(r3Box(1.4, 9, 1.4), '#7c4e30', 1, 0, [nb[0] - 6, 0, nb[2]]); S.add(r3Box(1.4, 9, 1.4), '#7c4e30', 1, 0, [nb[0] + 6, 0, nb[2]]);
  var sg = r3V(138, 142, 0); S.add(r3Box(1.4, 12, 1.4), '#7c4e30', 1, 0, sg); S.add(r3Box(11, 4, 1), '#cf9159', 1, 0, [sg[0] + 3, 9, sg[2]]);
  lamp(103, 86); lamp(154, 128); lamp(200, 88);
  // Garten: Hochbeete, Zaun, Pflanzen, Vogelscheuche
  W_BEDS.forEach(function (b, bi) {
    var c = r3V(b[0] + b[2] / 2, b[1] + b[3] / 2, 0);
    S.add(r3Box(b[2], 2.5, b[3]), '#a96f42', 1, 0, c); S.add(r3Box(b[2] - 2, 0.3, b[3] - 2), '#7f553a', 1, 0, [c[0], 2.5, c[2]]);
    for (x = 4; x < b[2] - 2; x += 6) S.add(R3_ICO[bi === 1 ? 1 : 0], bi === 1 ? '#a8de86' : '#6cbf55', bi === 1 ? [2.6, 1.8, 2.6] : [1.6, 2.4, 1.6], 0, [c[0] - b[2] / 2 + x, 3.2, c[2]]);
  });
  for (x = W_GARDEN.x0; x <= W_GARDEN.x1; x += 7) { var fs = r3V(x, W_GARDEN.y1, 0), fn = r3V(x, W_GARDEN.y0, 0); S.add(r3Cyl(6, 0.9, 0.9, 6), '#cf9159', 1, 0, fs); S.add(r3Cyl(6, 0.9, 0.9, 6), '#cf9159', 1, 0, fn); }
  for (y = W_GARDEN.y0; y <= W_GARDEN.y1; y += 7) { S.add(r3Cyl(6, 0.9, 0.9, 6), '#cf9159', 1, 0, r3V(W_GARDEN.x0, y, 0)); if (y < 138 || y > 154) S.add(r3Cyl(6, 0.9, 0.9, 6), '#cf9159', 1, 0, r3V(W_GARDEN.x1, y, 0)); }
  var gs = r3V((W_GARDEN.x0 + W_GARDEN.x1) / 2, W_GARDEN.y1, 0), gn = r3V((W_GARDEN.x0 + W_GARDEN.x1) / 2, W_GARDEN.y0, 0);
  S.add(r3Box(W_GARDEN.x1 - W_GARDEN.x0, 1, 0.8), '#cf9159', 1, 0, [gs[0], 4, gs[2]]); S.add(r3Box(W_GARDEN.x1 - W_GARDEN.x0, 1, 0.8), '#cf9159', 1, 0, [gn[0], 4, gn[2]]);
  [[26, 124], [34, 123], [42, 124]].forEach(function (q) { var p = r3V(q[0], q[1], 0); S.add(r3Cyl(5, 0.5, 0.5, 14), '#4a9f4b', 1, 0, p); S.add(r3Cyl(12, 3.6, 3.6, 0.8), '#ffd94f', 1, 0, [p[0], 14, p[2] + 0.5]); S.add(r3Cyl(10, 1.6, 1.6, 1.2), '#8a5a2b', 1, 0, [p[0], 14.2, p[2] + 0.6]); });
  [[32, 136], [48, 136], [64, 136]].forEach(function (q) { var p = r3V(q[0], q[1], 0); S.add(R3_ICO[1], '#4a9f4b', [4, 5, 4], 0, [p[0], 4, p[2]]); for (var f = 0; f < 4; f++) S.add(R3_ICO[0], '#ff6b6b', 1.3, 0, [p[0] - 2 + f * 1.4, 6 + (f % 2) * 2, p[2] + 3]); });
  var sc = r3V(78, 128, 0); S.add(r3Box(1.2, 14, 1.2), '#a96f42', 1, 0, sc); S.add(r3Box(12, 1.2, 1.2), '#a96f42', 1, 0, [sc[0], 10, sc[2]]); S.add(r3Box(7, 6, 3), '#5f86c4', 1, 0, [sc[0], 7, sc[2]]); S.add(R3_ICO[1], '#e9d3a2', 3, 0, [sc[0], 15, sc[2]]); S.add(r3Cyl(10, 4.8, 0, 3.5), '#e8b947', 1, 0, [sc[0], 16.5, sc[2]]);
  // See: Steg, Boot, Schilf
  var d0 = r3V(W_DOCK.x0, (W_DOCK.y0 + W_DOCK.y1) / 2, 0), dl = W_DOCK.x1 - W_DOCK.x0;
  S.add(r3Box(dl, 1, 9), '#cf9159', 1, 0, [d0[0] + dl / 2, 1.2, d0[2]]);
  for (x = 0; x <= dl; x += 7) { S.add(r3Cyl(6, 0.9, 0.9, 2.6), '#7c4e30', 1, 0, [d0[0] + x, -0.5, d0[2] - 4]); S.add(r3Cyl(6, 0.9, 0.9, 2.6), '#7c4e30', 1, 0, [d0[0] + x, -0.5, d0[2] + 4]); }
  var bt = r3V(230, 106, 0); S.add(R3_ICO[1], '#cf9159', [11, 2.6, 5], 0.15, [bt[0], 0.4, bt[2]]); S.add(R3_ICO[1], '#7c4e30', [9, 0.8, 3.6], 0.15, [bt[0], 2.6, bt[2]]);
  [[186, 74], [189, 108], [206, 124], [244, 122], [254, 70]].forEach(function (q) { var p = r3V(q[0], q[1], 0); for (var r = 0; r < 3; r++) S.add(r3Cyl(4, 0.5, 0, 8 + r * 2), '#4a9f4b', 1, 0, [p[0] - 1.5 + r * 1.5, 0, p[2]]); S.add(r3Cyl(5, 0.8, 0.8, 2.5), '#8a5a35', 1, 0, [p[0], 9, p[2]]); });
  [[150, 172], [210, 150], [6, 102], [150, 66]].forEach(function (q, k) { var p = r3V(q[0], q[1], 0); S.add(R3_ICO[1], '#b6aea3', [5, 3, 4], k, [p[0], 0, p[2]]); });
  // Büsche, Briefkasten, Fässer
  bush(44, 68, '#ff9fc2'); bush(76, 68, '#ffd94f'); bush(98, 58, null); bush(20, 84, '#fffaf0');
  var mb = r3V(86, 66, 0); S.add(r3Box(1.2, 8, 1.2), '#7c4e30', 1, 0, mb); S.add(r3Box(4, 3.5, 6), '#e05a5a', 1, 0, [mb[0], 8, mb[2]]);
  [[26, 62], [33, 64]].forEach(function (q) { S.add(r3Cyl(10, 3.4, 3.4, 7), '#cf9159', 1, 0, r3V(q[0], q[1], 0)); });
  // Bäume im Dorf und Wald drumherum
  var trees = [[20, 30, 'tree'], [104, 32, 'tree'], [118, 58, 'fruit'], [176, 40, 'tree'], [246, 36, 'tree'], [8, 150, 'tree'], [244, 170, 'tree'], [176, 152, 'fruit'], [182, 64, 'blossom'], [30, 100, 'blossom'], [234, 186, 'tree'], [8, 186, 'tree'], [150, 36, 'tree']];
  trees.forEach(function (t) { tree(t[0], t[1], t[2], 1); });
  var RR = wRng(11);
  for (i = 0; i < 70; i++) { var tx = -80 + RR() * 420, ty = -150 + RR() * 140; tree(Math.round(tx), Math.round(ty), RR() < 0.4 ? 'pine' : 'tree', 1.1 + RR() * 0.4); }
  for (i = 0; i < 18; i++) { tree(Math.round(-70 + RR() * 56), Math.round(RR() * 190), RR() < 0.5 ? 'pine' : 'tree', 1.05); tree(Math.round(268 + RR() * 60), Math.round(RR() * 190), RR() < 0.5 ? 'pine' : 'tree', 1.05); }
  person(50, 140, 'alex'); person(110, 121, 'mira');
  return S;
}

var R3_SHADOWS = [[W_HOUSE.x, W_HOUSE.y - 16, 40, 24], [W_SQ.x, W_SQ.y, 11, 8], [50, 140, 6, 3], [110, 121, 6, 3], [92, 112, 10, 4], [152, 86, 9, 3]];

function createWorld3D(canvas, opts) {
  var T = R3_TIMES[opts.zeit] || R3_TIMES.Mittag, ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, i;
  var baseC = document.createElement('canvas'); baseC.width = W; baseC.height = H; var bg = baseC.getContext('2d');
  var scene = r3Build(T);
  // Bodenkarte mit weichen Schatten
  var gm = r3GroundMap(T), gmg = gm.getContext('2d');
  function shadow(vx, vy, rx, rz) { var cx = (vx - 128 - R3_GX0) * R3_GS + rx * 0.4 * R3_GS, cz = (vy - 96 - R3_GZ0) * R3_GS + rz * 0.15 * R3_GS; gmg.save(); gmg.translate(cx, cz); gmg.scale(1, rz / rx); var rg = gmg.createRadialGradient(0, 0, 0, 0, 0, rx * R3_GS); rg.addColorStop(0, 'rgba(30,40,60,0.38)'); rg.addColorStop(0.7, 'rgba(30,40,60,0.22)'); rg.addColorStop(1, 'rgba(30,40,60,0)'); gmg.fillStyle = rg; gmg.beginPath(); gmg.arc(0, 0, rx * R3_GS, 0, 7); gmg.fill(); gmg.restore(); }
  R3_SHADOWS.forEach(function (s) { shadow(s[0], s[1], s[2], s[3]); });
  var seen = {};
  scene.tris.forEach(function (t) {
    if (t.col !== '#9c6b45' || t.v[0][1] >= 0.1 || t.v[1][1] >= 0.1) return;
    var c = t.center, k = Math.round(c[0]) + ',' + Math.round(c[2]); if (seen[k]) return; seen[k] = 1; shadow(c[0] + 128, c[2] + 96, 15, 8);
  });
  var gd = gmg.getImageData(0, 0, gm.width, gm.height).data, GWp = gm.width, GHp = gm.height;

  // Himmel
  var sk = bg.createLinearGradient(0, 0, 0, H * 0.45); sk.addColorStop(0, T.skyTop); sk.addColorStop(1, T.skyBot);
  bg.fillStyle = sk; bg.fillRect(0, 0, W, H);
  if (T.stars) { var RS = wRng(3); for (i = 0; i < 120; i++) { bg.fillStyle = RS() < 0.2 ? '#fff6c8' : '#dfe6ff'; var ss = RS() < 0.15 ? 3 : 2; bg.fillRect(RS() * W, RS() * H * 0.3, ss, ss); } bg.fillStyle = '#fff4d6'; bg.beginPath(); bg.arc(1010, 70, 26, 0, 7); bg.fill(); bg.fillStyle = T.skyTop; bg.beginPath(); bg.arc(1022, 62, 23, 0, 7); bg.fill(); }
  else { var RC = wRng(9); for (i = 0; i < 7; i++) { var cx = RC() * W, cy = 40 + RC() * 90; bg.fillStyle = 'rgba(255,255,255,0.85)'; for (var j = 0; j < 5; j++) { bg.beginPath(); bg.arc(cx + j * 26 - 50, cy - Math.sin(j / 4 * Math.PI) * 18, 22 + Math.sin(j) * 6, 0, 7); bg.fill(); } } }
  // Boden: Strahl trifft die gewölbte Fläche y = −K·u²
  var img = bg.getImageData(0, 0, W, H), d = img.data, haze = r3Hex(T.haze), x, y;
  var L = r3Norm(T.dir), amb = r3Hex(T.amb);
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var dir = [R3_FWD[0] * R3_F + R3_RIGHT[0] * (x - W / 2) + R3_UP[0] * (H / 2 - y), R3_FWD[1] * R3_F + R3_RIGHT[1] * (x - W / 2) + R3_UP[1] * (H / 2 - y), R3_FWD[2] * R3_F + R3_RIGHT[2] * (x - W / 2) + R3_UP[2] * (H / 2 - y)];
    var a = R3_K * dir[2] * dir[2], b = dir[1], c = R3_C[1], disc = b * b - 4 * a * c;
    if (b >= 0 || disc < 0) continue;
    var t = a > 1e-12 ? (-b - Math.sqrt(disc)) / (2 * a) : -c / b;
    var wx = R3_C[0] + t * dir[0], wz = R3_C[2] + t * dir[2];
    var gx = Math.floor((wx - R3_GX0) * R3_GS), gz = Math.floor((wz - R3_GZ0) * R3_GS), o = (y * W + x) * 4, r0, g0, b0;
    if (gx >= 0 && gz >= 0 && gx < GWp && gz < GHp) { var q = (gz * GWp + gx) * 4; r0 = gd[q]; g0 = gd[q + 1]; b0 = gd[q + 2]; } else { r0 = 80; g0 = 140; b0 = 68; }
    // Licht auf dem Boden (Normale der Wölbung)
    var u = R3_C[2] - wz, nrm = r3Norm([0, 1, -2 * R3_K * u]), df = Math.max(0, r3Dot(nrm, L)), lf = 0.25 + 0.6 * df;
    r0 = Math.min(255, r0 * (amb[0] / 255 * T.ambK * 0.6 + T.light[0] * lf)); g0 = Math.min(255, g0 * (amb[1] / 255 * T.ambK * 0.6 + T.light[1] * lf)); b0 = Math.min(255, b0 * (amb[2] / 255 * T.ambK * 0.6 + T.light[2] * lf));
    var dist = t * Math.hypot(dir[0], dir[1], dir[2]), fog = Math.min(0.7, Math.max(0, (dist - 300) / 420));
    d[o] = r0 + (haze[0] - r0) * fog; d[o + 1] = g0 + (haze[1] - g0) * fog; d[o + 2] = b0 + (haze[2] - b0) * fog; d[o + 3] = 255;
  }
  bg.putImageData(img, 0, 0);
  // Formen: hinten zuerst, Rückseiten weg, Toon-Licht in drei Stufen
  var items = [];
  for (i = 0; i < scene.tris.length; i++) {
    var tr = scene.tris[i], v = tr.v, n = r3Norm(r3Cross(r3Sub(v[1], v[0]), r3Sub(v[2], v[0])));
    var cen = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3];
    if (r3Dot(n, r3Sub(cen, tr.center)) < 0) n = [-n[0], -n[1], -n[2]];
    if (r3Dot(n, r3Sub(R3_C, cen)) <= 0) continue;
    var p0 = r3Project(v[0]), p1 = r3Project(v[1]), p2 = r3Project(v[2]);
    if (p0[2] < 1 || p1[2] < 1 || p2[2] < 1) continue;
    items.push({ p: [p0, p1, p2], z: (p0[2] + p1[2] + p2[2]) / 3 - tr.bias, n: n, col: tr.col, emit: tr.emit });
  }
  items.sort(function (A, B) { return B.z - A.z; });
  var cc = {};
  for (i = 0; i < items.length; i++) {
    var it = items[i], fill;
    if (it.emit) fill = it.col;
    else {
      var df2 = r3Dot(it.n, L), band = df2 > 0.55 ? 1 : df2 > 0.15 ? 0.66 : 0.34, rim = Math.max(0, 1 - Math.abs(r3Dot(it.n, R3_FWD))) * 0.12;
      var base = cc[it.col] || (cc[it.col] = r3Hex(it.col));
      var fo = Math.max(0, (it.z - 330) / 520) * 0.6, rr = [], kk;
      for (kk = 0; kk < 3; kk++) { var lv = base[kk] * (amb[kk] / 255 * T.ambK + T.light[kk] * band * 0.7) + 255 * rim * T.light[kk]; rr.push(Math.round(lv + (haze[kk] - lv) * Math.min(0.65, fo))); }
      fill = 'rgb(' + Math.min(255, rr[0]) + ',' + Math.min(255, rr[1]) + ',' + Math.min(255, rr[2]) + ')';
    }
    bg.fillStyle = fill; bg.strokeStyle = fill; bg.lineWidth = 0.8;
    bg.beginPath(); bg.moveTo(it.p[0][0], it.p[0][1]); bg.lineTo(it.p[1][0], it.p[1][1]); bg.lineTo(it.p[2][0], it.p[2][1]); bg.closePath(); bg.fill(); bg.stroke();
  }
  // Gesichter: Augen und Wangen auf die Köpfe
  [[50, 140], [110, 121]].forEach(function (q) {
    var hc = r3V(q[0], q[1], 15.5), f = r3Project([hc[0], hc[1], hc[2] + 5.2]), sc2 = R3_F / f[2];
    [-1, 1].forEach(function (sgn) {
      var e = r3Project([hc[0] + sgn * 2, hc[1] - 0.2, hc[2] + 5]);
      bg.fillStyle = '#2a1f2b'; bg.beginPath(); bg.ellipse(e[0], e[1], 0.8 * sc2, 1.25 * sc2, 0, 0, 7); bg.fill();
      bg.fillStyle = '#ffffff'; bg.beginPath(); bg.arc(e[0] - 0.25 * sc2, e[1] - 0.45 * sc2, 0.3 * sc2, 0, 7); bg.fill();
      var ch = r3Project([hc[0] + sgn * 3.3, hc[1] - 1.8, hc[2] + 4.4]);
      bg.fillStyle = 'rgba(255,140,140,0.55)'; bg.beginPath(); bg.ellipse(ch[0], ch[1], 1 * sc2, 0.6 * sc2, 0, 0, 7); bg.fill();
    });
  });
  // Abendstimmung und Lichtschein
  if (T.glowA) {
    bg.globalCompositeOperation = 'lighter';
    var lights = [[W_HOUSE.x - 15, W_HOUSE.y + 0.5, 17.5, 1], [W_HOUSE.x + 15, W_HOUSE.y + 0.5, 17.5, 1], [W_HOUSE.x + 7.5, W_HOUSE.y + 1, 16, 0.6], [103, 86, 24, 1], [154, 128, 24, 1], [200, 88, 24, 1]];
    lights.forEach(function (lt) { var p = r3Project(r3V(lt[0], lt[1], lt[2])), r = 3400 / p[2] * lt[3]; var rg = bg.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); rg.addColorStop(0, 'rgba(255,205,120,' + T.glowA + ')'); rg.addColorStop(0.35, 'rgba(255,170,90,' + T.glowA * 0.38 + ')'); rg.addColorStop(1, 'rgba(255,150,80,0)'); bg.fillStyle = rg; bg.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); });
    bg.globalCompositeOperation = 'source-over';
  }
  // Tilt-Shift
  if (typeof bg.filter === 'string') {
    var tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; var tg = tmp.getContext('2d');
    tg.filter = 'blur(4px)'; tg.drawImage(baseC, 0, 0); tg.filter = 'none'; tg.globalCompositeOperation = 'destination-in';
    var mg = tg.createLinearGradient(0, 0, 0, H); mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.22, 'rgba(0,0,0,0.8)'); mg.addColorStop(0.38, 'rgba(0,0,0,0)'); mg.addColorStop(0.86, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,0.7)');
    tg.fillStyle = mg; tg.fillRect(0, 0, W, H); bg.drawImage(tmp, 0, 0);
  }
  var vg = bg.createRadialGradient(W / 2, H * 0.55, H * 0.45, W / 2, H * 0.55, H * 0.95); vg.addColorStop(0, 'rgba(30,20,40,0)'); vg.addColorStop(1, T.stars ? 'rgba(5,8,25,0.5)' : 'rgba(40,25,40,0.22)');
  bg.fillStyle = vg; bg.fillRect(0, 0, W, H);

  // Bewegung: Glitzern auf dem See, Schmetterlinge oder Glühwürmchen
  var glints = [], RG = wRng(77);
  for (i = 0; i < 40; i++) { var an = RG() * 6.28, rr2 = Math.sqrt(RG()) * 0.85; var gp = r3Project(r3V(W_LAKE.x + Math.cos(an) * W_LAKE.rx * rr2, W_LAKE.y + Math.sin(an) * W_LAKE.ry * rr2, 0.1)); glints.push([gp[0], gp[1], RG() * 6.28, 600 / gp[2]]); }
  var flies = []; for (i = 0; i < 18; i++) flies.push([RG() * W, 260 + RG() * 440, RG() * 6.28, 0.3 + RG() * 0.6]);
  var raf = 0, start = performance.now(), last = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 40) return; last = now;
    var tm = (now - start) / 1000;
    ctx.drawImage(baseC, 0, 0);
    for (var g2 = 0; g2 < glints.length; g2++) { var gl = glints[g2], a2 = Math.max(0, Math.sin(tm * 1.7 + gl[2])); if (a2 < 0.6) continue; ctx.fillStyle = 'rgba(255,255,255,' + (a2 - 0.6) * 2.2 + ')'; ctx.beginPath(); ctx.ellipse(gl[0], gl[1], gl[3] * 2.2, gl[3] * 0.7, 0, 0, 7); ctx.fill(); }
    for (var f2 = 0; f2 < flies.length; f2++) {
      var fl = flies[f2], fx = (fl[0] + Math.sin(tm * fl[3] + fl[2]) * 40 + tm * 8) % W, fy = fl[1] + Math.cos(tm * fl[3] * 1.3 + fl[2]) * 22;
      if (T.stars) { var fa = 0.5 + 0.5 * Math.sin(tm * 2 + fl[2] * 3); var rg2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10); rg2.addColorStop(0, 'rgba(220,255,150,' + fa + ')'); rg2.addColorStop(1, 'rgba(220,255,150,0)'); ctx.fillStyle = rg2; ctx.fillRect(fx - 10, fy - 10, 20, 20); }
      else if (f2 < 6) { var wing = Math.abs(Math.sin(tm * 12 + fl[2])); ctx.fillStyle = f2 % 2 ? '#ffd94f' : '#ffffff'; ctx.beginPath(); ctx.ellipse(fx - 4, fy, 4, 3 * wing + 0.6, -0.4, 0, 7); ctx.ellipse(fx + 4, fy, 4, 3 * wing + 0.6, 0.4, 0, 7); ctx.fill(); }
    }
  }
  raf = requestAnimationFrame(frame);
  return { stop: function () { cancelAnimationFrame(raf); } };
}
