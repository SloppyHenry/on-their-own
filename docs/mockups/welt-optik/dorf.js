// SIMULACRA Mockup AP12, Schritt 0: ein Dorf aus einem Seed, gesetzt aus den Bausteinen von bausteine.js und mit dem Bodenregelwerk von A (wTexel),
// verallgemeinert auf Listen (mehrere Wege, Bach, Brücke, Vorplätze). Nur eine Skizze des Generators, kein Produktionscode.
// Dorfkoordinaten wie in A: Dorf (0, 0) liegt bei Texel (W_OX, W_OY); Platz, Hauptstraße, Häuserzeile im Norden, Garten, Scheune und See im Süden.

function dDist(polys, x, y) {
  var d = 1e9;
  for (var i = 0; i < polys.length; i++) for (var j = 0; j < polys[i].length - 1; j++) d = Math.min(d, wSeg(x, y, polys[i][j][0], polys[i][j][1], polys[i][j + 1][0], polys[i][j + 1][1]));
  return d;
}

// Boden wie wTexel, mit Listen statt Einzelstücken. V: { sq, lake, dock, paths, stream, bridge, garden, beds, pads }
function dTexel(V, tx, ty) {
  var vx = tx - W_OX, vy = ty - W_OY, n = wNoise(tx * 0.13, ty * 0.13, 1), h = wHash(tx, ty, 2), g = n * 0.75 + h * 0.25;
  var edge = wNoise(ty * 0.06, tx * 0.02, 12) * 14, inV = vx >= (V.left || 0) - 6 - edge && vx < 262 + edge && vy >= -4 - edge * 0.5;
  var col, type = 0, dp = dDist(V.paths, vx, vy), i;
  if (!inV) { col = g < 0.36 ? WPA.wild3 : g < 0.66 ? WPA.wild2 : WPA.wild1; type = 7; }
  else {
    col = g < 0.32 ? WPA.grass3 : g < 0.64 ? WPA.grass2 : WPA.grass1;
    if ((tx + ty * 2) % 9 === 0 && h > 0.55) col = WPA.grassLight;
  }
  if (inV && V.lake) {
    var L = V.lake, a = (vx - L.x) / L.rx, b = (vy - L.y) / L.ry, lv = a * a + b * b + (wNoise(vx * 0.09, vy * 0.09, 7) - 0.5) * 0.45;
    if (lv < 1) { type = 2; col = lv < 0.35 ? WPA.waterDeep : lv < 0.62 ? WPA.water3 : lv < 0.86 ? WPA.water2 : WPA.water1; if (lv > 0.95) col = WPA.foam; }
    else if (lv < 1.13) { type = 6; col = h < 0.5 ? WPA.path1 : WPA.path2; }
  }
  if (V.stream) {
    var ds = dDist([V.stream], vx, vy);
    if (ds < 3.6 + (wNoise(vx * 0.2, vy * 0.2, 5) - 0.5) * 1.2) { type = 2; col = ds < 1.5 ? WPA.waterDeep : ds < 2.4 ? WPA.water3 : ds < 3.2 ? WPA.water2 : WPA.water1; if (ds > 3.3) col = WPA.foam; }
    else if (ds < 5.4 && type !== 2) { type = 6; col = h < 0.5 ? WPA.path1 : WPA.path2; }
  }
  if (V.dock && vx >= V.dock.x0 && vx < V.dock.x1 && vy >= V.dock.y0 && vy < V.dock.y1) {
    type = 5; col = (vx - V.dock.x0) % 4 === 3 ? WPA.wood3 : (vy === V.dock.y0 || vy === V.dock.y1 - 1) ? WPA.wood2 : (h < 0.5 ? WPA.wood1 : WPA.wood2);
  }
  var Br = V.bridge;
  if (Br && vx >= Br.x0 && vx < Br.x1 && vy >= Br.y0 && vy < Br.y1) {
    type = 5; col = (vx - Br.x0) % 4 === 3 ? WPA.wood3 : (vy === Br.y0 || vy === Br.y1 - 1) ? WPA.wood2 : (h < 0.5 ? WPA.wood1 : WPA.wood2);
  }
  if (type === 0 || type === 6 || type === 7) {
    var Q = V.sq, dq = Math.hypot(vx - Q.x, (vy - Q.y) * 1.08);
    if (inV && dq < Q.r) {
      type = 3;
      if (dq > Q.r - 2) col = WPA.stone3;
      else {
        var row = Math.floor(vy / 4), off = (row & 1) ? 2 : 0, cx = Math.floor((vx + off) / 5);
        if (vy % 4 === 0 || (vx + off) % 5 === 0) col = WPA.cob3; else if (vy % 4 === 1 && (vx + off) % 5 === 1) col = WPA.cobHi; else col = wHash(cx, row, 9) < 0.35 ? WPA.cob2 : WPA.cob1;
      }
    } else if (dp < 5.2) { type = 1; col = wNoise(tx * 0.3, ty * 0.3, 4) < 0.45 ? WPA.path2 : WPA.path1; if (h > 0.965) col = WPA.pebble; }
    else if (dp < 6.4 && type === 0) col = WPA.grassDark;
    var G = V.garden;
    if (type === 0 && G && vx >= G.x0 && vx < G.x1 && vy >= G.y0 && vy < G.y1) {
      col = g < 0.5 ? WPA.grass1 : WPA.grassLight;
      for (i = 0; i < V.beds.length; i++) {
        var bd = V.beds[i];
        if (vx >= bd[0] && vx < bd[0] + bd[2] && vy >= bd[1] && vy < bd[1] + bd[3]) {
          type = 4; col = (vy - bd[1]) % 3 === 0 ? WPA.soil2 : WPA.soil1;
          if (vx === bd[0] || vx === bd[0] + bd[2] - 1 || vy === bd[1] + bd[3] - 1) col = WPA.wood3;
          var k = vx - (bd[0] + 3), ky = vy - (bd[1] + 4);                           // Pflanzen wie in A (Gemüse im ersten, Salat im zweiten Beet)
          if (k >= 0 && vx < bd[0] + bd[2] - 2 && k % 4 === 0 && ky === 0) col = WPA.leaf2;
          if (k >= 0 && vx < bd[0] + bd[2] - 2 && k % 4 === 0 && ky === 1) col = WPA.leaf3;
          if (k >= 0 && vx < bd[0] + bd[2] - 2 && ((k + 1) % 4 === 0 || (k - 1) % 4 === 0) && ky === -1) col = WPA.leaf1;
        }
      }
    }
    for (i = 0; i < V.pads.length; i++) { var P = V.pads[i]; if (type === 0 && vx >= P[0] && vx < P[2] && vy >= P[1] && vy < P[3]) col = WPA.path3; }
  }
  return [col, type];
}

var D_SIZE = { house58: 70, house66: 78, house90: 102, shop: 84, workshop: 92, barn: 100, stable: 96 };

function dorfWelt(seed) {
  var R = wRng(seed * 7919 + 13), R2 = wRng(seed * 104729 + 11), O = [];
  function rnd(a, b) { return a + R() * (b - a); }
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  function add(kind, vx, vy, extra) { O.push({ kind: kind, vx: Math.round(vx), vy: Math.round(vy), extra: extra || 0 }); }
  var east = seed % 2 === 1;                                    // See im Osten wie in A, sonst im Süden unter der Hauptstraße
  var sq = { x: Math.round(rnd(110, 146)), y: Math.round(rnd(104, 114)), r: Math.round(rnd(22, 27)) }, y0 = sq.y;

  // Wege: Hauptstraße West–Ost (bei See im Osten nur bis zum See), Südstraße
  var extL = 100, west = [[-extL - 60, y0 + rnd(-6, 6)], [20, y0 + rnd(-5, 5)], [sq.x - sq.r + 4, y0]];
  var eastRoad = east ? [[sq.x + sq.r - 4, y0], [sq.x + sq.r + 20, y0 + 4], [176, y0 + 8]] : [[sq.x + sq.r - 4, y0], [215, y0 + rnd(-5, 5)], [300, y0 + rnd(-5, 5)]];
  var south = [[sq.x, y0 + sq.r - 4], [sq.x + rnd(-8, 8), y0 + 50], [sq.x + rnd(-6, 6), 200], [sq.x + rnd(-6, 6), 280]];
  var paths = [west, eastRoad, south];
  function roadY(x) { var m = west.concat(eastRoad.slice(1)); for (var i = 0; i < m.length - 1; i++) if (x >= m[i][0] && x <= m[i + 1][0]) return m[i][1] + (m[i + 1][1] - m[i][1]) * (x - m[i][0]) / Math.max(1, m[i + 1][0] - m[i][0]); return y0; }

  // Südzeile: Garten links; bei See im Süden der See rechts (die Südstraße dazwischen), sonst See im Osten wie in A
  var G, beds = [], farm = [], pads = [], gdx = Math.round(rnd(-4, 6)), gdy = Math.round(rnd(-2, 6)), lake;
  G = { x0: 14 + gdx, y0: 120 + gdy, x1: 84 + gdx, y1: 176 + gdy };
  if (east) lake = { x: 226, y: Math.round(rnd(86, 98)), rx: Math.round(rnd(34, 40)), ry: Math.round(rnd(30, 36)) };
  else lake = { x: Math.round(rnd(184, 214)), y: 164, rx: 40, ry: 24 };
  var dock = { x0: lake.x - lake.rx - 4, y0: lake.y - 2, x1: lake.x - lake.rx + 18, y1: lake.y + 7 };
  if (east) paths.push([[dock.x0 - 6, lake.y + 2], [dock.x0 - 6, y0 + 8]]);

  // Bach aus dem Nordwald in den See; bei See im Süden kreuzt er die Hauptstraße unter einer Brücke
  var sx = Math.round(lake.x + rnd(-0.25, 0.25) * lake.rx), stream = [], top = lake.y - lake.ry + 8;
  for (var k = 0; k <= 5; k++) stream.push([sx + (k < 5 ? Math.sin(k * 1.3 + seed) * 6 : 0), -70 + k * (top + 70) / 5]);
  function syAt(y) { for (var i = 0; i < stream.length - 1; i++) if (y >= stream[i][1] && y <= stream[i + 1][1]) return stream[i][0] + (stream[i + 1][0] - stream[i][0]) * (y - stream[i][1]) / (stream[i + 1][1] - stream[i][1]); return sx; }
  var bridge = null;
  if (!east) { var bxc = syAt(y0 + 4), by = roadY(bxc); bridge = { x0: Math.round(bxc - 9), x1: Math.round(bxc + 9), y0: Math.round(by - 6), y1: Math.round(by + 6) }; }

  // Garten wie in A (Zaun, drei Beete, Sonnenblumen, Tomaten, Vogelscheuche)
  {
    beds = [[22, 127, 54, 9], [22, 141, 54, 9], [22, 155, 54, 9]].map(function (b) { return [b[0] + gdx, b[1] + gdy, b[2], b[3]]; });
    for (var x = G.x0; x < G.x1 - 4; x += 12) { add('fence', x + 7, G.y1); add('fence', x + 7, G.y0); }
    for (var yy = G.y0 + 8; yy < G.y1; yy += 8) { add('post', G.x0, yy); if (yy < 138 + gdy || yy > 154 + gdy) add('post', G.x1, yy); }
    add('sun', 26 + gdx, 124 + gdy); add('sun', 34 + gdx, 123 + gdy); add('sun', 42 + gdx, 124 + gdy);
    add('tomato', 32 + gdx, 136 + gdy, 1); add('tomato', 48 + gdx, 136 + gdy, 2); add('tomato', 64 + gdx, 136 + gdy, 3); add('scare', 78 + gdx, 128 + gdy);
    paths.push([[G.x1, 146 + gdy], [G.x1 + 10, 146 + gdy], [G.x1 + 14, y0 + 10], [G.x1 + 14, roadY(G.x1 + 14)]]);
  }
  farm.forEach(function (f) {
    add(f.kind, f.cx, f.base); add('bhay', f.cx + f.w / 2 - 6, f.base + 4); add('bhay', f.cx - f.w / 2 + 8, f.base + 6, 1);
    pads.push([f.cx - f.w / 2 + 3, f.base - 22, f.cx + f.w / 2 - 3, f.base]);
    paths.push([[f.cx, f.base + 3], [f.cx, f.base + 12], [sq.x + 2, f.base + 12]]);
  });

  // Häuserzeile im Norden: Wohnhäuser, Werkstatt, Laden; Bach und See bleiben frei
  var buildings = [], lamps = [], mixes = ['house', 'house', 'house'].concat(['shop', 'workshop', 'barn', 'stable'].sort(function () { return R() - 0.5; }).slice(0, 2));
  for (i = mixes.length - 1; i > 0; i--) { var j2 = Math.floor(R() * (i + 1)), t2 = mixes[i]; mixes[i] = mixes[j2]; mixes[j2] = t2; }
  var roofs = ['rot', 'blau', 'stroh', 'moos', 'schiefer', 'holz'], walls = ['creme', 'rosa', 'gelb', 'blau', 'holz'], xmax = east ? lake.x - lake.rx - 14 : 258, xc = Math.round(-extL + rnd(4, 12));
  mixes.forEach(function (m) {
    var kind, w, ww = 0;
    if (m === 'house') { ww = pick([58, 66, 66, 90]); w = ww + 12; kind = 'bh:' + ww + ':' + pick(roofs) + ':' + pick(walls); }
    else if (m === 'shop') { w = 84; kind = 'bs'; } else if (m === 'barn') { w = 100; kind = 'bb'; } else if (m === 'stable') { w = 96; kind = 'bt'; } else { w = 92; kind = 'bw'; }
    if (xc + w > xmax && m !== 'house') { m = 'house'; ww = 58; w = 70; kind = 'bh:58:' + pick(roofs) + ':' + pick(walls); }
    else if (xc + w > xmax && w > 70) { ww = 58; w = 70; kind = 'bh:58:' + pick(roofs) + ':' + pick(walls); }
    function hit(x1, ww1) { return !east && x1 < sx + 8 && x1 + ww1 > sx - 8; }              // Bach bleibt frei
    var x1 = xc;
    if (hit(x1, w) && m === 'house' && w > 70 && !hit(x1, 70)) { ww = 58; w = 70; kind = 'bh:58:' + pick(roofs) + ':' + pick(walls); }
    if (hit(x1, w)) x1 = Math.round(sx + 8);
    if (x1 + w > xmax) { if (m === 'house' && w > 70 && x1 + 70 <= xmax) { ww = 58; w = 70; kind = 'bh:58:' + pick(roofs) + ':' + pick(walls); } else return; }
    xc = x1;
    var cx = xc + w / 2;
    var base = Math.round(y0 - 46 - rnd(0, 10));
    buildings.push({ kind: kind, cx: cx, base: base, w: w, m: m }); add(kind, cx, base);
    paths.push([[cx, base + 3], [cx + rnd(-2, 2), base + 22], [cx + rnd(-4, 4), roadY(cx) - 4], [cx, roadY(cx)]]);
    pads.push([cx - w / 2 + 3, base - 26, cx + w / 2 - 3, base]);
    if (m === 'house') { add(pick(['bushP', 'bushY', 'bushW']), cx - 16, base + 8); add(pick(['bushP', 'bushY', 'bushW']), cx + 17, base + 8); add('mailbox', cx + w / 2 - 4, base + 6); }
    else if (m === 'stable') { add('bhay', cx + w / 2 - 4, base + 6); add('bhay', cx - w / 2 + 8, base + 8, 1); add('barrel', cx - w / 2 - 4, base + 6); }
    else if (m === 'barn') { add('bhay', cx + w / 2 + 2, base + 6); add('bhay', cx - w / 2 + 10, base + 8, 1); add('bhay', cx + w / 2 - 10, base + 10, 2); }
    else if (m === 'workshop') { add('blog', cx + w / 2 + 6, base + 4); add('bcr', cx - w / 2 + 6, base + 8); add('barrel', cx + w / 2 - 8, base + 8); }
    else { add('bcr', cx + w / 2 - 6, base + 8); add('bushY', cx - w / 2 + 6, base + 8); }
    xc = Math.round(cx + w / 2 + rnd(3, 9));
  });

  // Platz: Brunnen, Bank, Brett, zwei Marktstände, Laternen entlang der Straße, Wegweiser an den Ausfahrten
  add('well', sq.x, sq.y + 3); add('bench', sq.x - sq.r - 10, sq.y + 6); add('board', sq.x + sq.r + 4, sq.y - 20);
  add('bm:' + (seed % 3), sq.x - 17, sq.y - 11); add('bm:' + ((seed + 1) % 3), sq.x + 18, sq.y - 11); add('bcr', sq.x - 4, sq.y - 8); add('barrel', sq.x + 29, sq.y - 6);
  [-100, -50, 50, 100].forEach(function (d) { var lx = sq.x + d; if ((east ? lx < lake.x - lake.rx - 28 : Math.abs(lx - sx) > 16) && lx > 6) { add('lamp', lx, roadY(lx) - 8); lamps.push(lx); } });
  add('sign', -extL - 14, y0 + 18); if (!east) add('sign', 262, y0 + 18);
  add('alex', sq.x - 30, sq.y + 14); add('mira', sq.x + 26, sq.y + 20);
  if (bridge) [[bridge.x0 + 1, bridge.y0 + 2], [bridge.x1 - 1, bridge.y0 + 2], [bridge.x0 + 1, bridge.y1 + 3], [bridge.x1 - 1, bridge.y1 + 3]].forEach(function (p) { add('post', p[0], p[1]); });

  // See: Schilf am Ufer, Boot
  for (var s2 = 0; s2 < 5; s2++) { var an = rnd(-0.4, 2.6) + (east ? 0.3 : 3.14); add('reed', lake.x + Math.cos(an) * lake.rx * 1.02, lake.y + Math.sin(an) * lake.ry * 1.02 + 4); }
  add('boat', lake.x + 8, lake.y + 14);

  function bbox(b) { return { x0: b.cx - b.w / 2 - 6, x1: b.cx + b.w / 2 + 6, y0: b.base - 8, y1: b.base + 30 }; }
  var blocks = buildings.concat(farm).map(bbox);
  function free(x, y, pad) {
    if (dDist(paths, x, y) < pad || dDist([stream], x, y) < pad - 2) return false;
    if (Math.pow((x - lake.x) / (lake.rx + pad), 2) + Math.pow((y - lake.y) / (lake.ry + pad * 0.8), 2) < 1) return false;
    if (x > G.x0 - pad && x < G.x1 + pad && y > G.y0 - pad && y < G.y1 + pad) return false;
    if (Math.hypot(x - sq.x, (y - sq.y) * 1.08) < sq.r + pad) return false;
    for (var i = 0; i < blocks.length; i++) { var b = blocks[i]; if (x > b.x0 - pad * 0.3 && x < b.x1 + pad * 0.3 && y > b.y0 - 2 && y < b.y1 + pad * 0.4) return false; }
    return true;
  }
  var rocks = 0; for (var t3 = 0; t3 < 60 && rocks < 4; t3++) { var rx = rnd(0, 250), ry = rnd(60, 190); if (free(rx, ry, 14)) { add('rock', rx, ry, rocks); rocks++; } }
  function tree(x, y, e) { if (free(x, y, 11)) add(R2() < 0.45 ? 'pine' : 'tree', x, y, e); }
  var i2;
  for (i2 = 0; i2 < 95 + Math.round(extL * 0.25); i2++) { var fx = -60 - extL + R2() * (380 + extL), fy = -94 + R2() * 88; if (dDist([stream], fx, fy) > 9 && dDist(paths, fx, fy) > 12 && !(fy > -20 && fx > 0 && fx < 258 && !free(fx, fy, 4) && false)) add(R2() < 0.45 ? 'pine' : 'tree', Math.round(fx), Math.round(fy), 100 + i2); }
  for (i2 = 0; i2 < 26; i2++) {
    var lx2 = -58 - extL + R2() * 50, ly2 = R2() * 196, rx2 = 266 + R2() * 52, ry2 = R2() * 196, p1 = R2() < 0.5, p2 = R2() < 0.5;
    if (dDist(paths, lx2, ly2) > 14) add(p1 ? 'pine' : 'tree', Math.round(lx2), Math.round(ly2), 300 + i2);
    if (dDist(paths, rx2, ry2) > 14 && dDist([stream], rx2, ry2) > 9) add(p2 ? 'pine' : 'tree', Math.round(rx2), Math.round(ry2), 400 + i2);
  }
  var tries = 0, nt = 0; while (nt < 10 && tries++ < 120) { var tx2 = rnd(0, 256), ty2 = rnd(20, 196); if (free(tx2, ty2, 16)) { tree(tx2, ty2, 40 + nt); nt++; } }
  for (i2 = 0; i2 < 14; i2++) { var bx2 = rnd(-40 - extL, 300), by2 = rnd(196, 215); if (dDist(paths, bx2, by2) > 14 && dDist([stream], bx2, by2) > 10 && free(bx2, by2, 6)) add(R2() < 0.45 ? 'pine' : 'tree', bx2, by2, 500 + i2); }

  var V = { left: -extL, sq: sq, lake: lake, dock: dock, paths: paths, stream: stream, bridge: bridge, garden: G, beds: beds, pads: pads };
  var objsOut = O.map(function (o) { return { kind: o.kind, vx: o.vx, vy: o.vy, extra: o.extra, wx: o.vx + W_OX, wy: o.vy + W_OY, cell: 1 }; }).sort(function (a, c) { return a.wy - c.wy; });
  var names = buildings.map(function (b) { return b.m === 'house' ? 'Haus' : b.m === 'shop' ? 'Laden' : b.m === 'barn' ? 'Scheune' : b.m === 'stable' ? 'Stall' : 'Werkstatt'; });
  return {
    data: { V: V, objects: O, buildings: buildings, extL: extL, sq: sq, east: east },
    legacy: false, cam: [192, 288], summary: (east ? 'See im Osten' : 'See im Süden mit Brücke') + ': ' + names.join(', '),
    base: function (tx, ty) { return dTexel(V, tx, ty); }, objects: function () { return objsOut; },
    spriteFor: bSpriteFor,
    lights: function (ob) {
      var p = ob.kind.split(':');
      return ob.kind === 'lamp' ? [[0, 0, 24, 1]] : p[0] === 'bh' ? [[-p[1] * 0.26, 0, 32, 1], [p[1] * 0.26, 0, 32, 1], [0, 0, 59, 0.8]] : p[0] === 'bw' ? [[-16, 0, 28, 1], [21, 0, 28, 1]] : p[0] === 'bs' ? [[-14, 0, 28, 1], [3, 0, 28, 0.6]] : null;
    },
    smoke: function (ob) { var p = ob.kind.split(':'); return p[0] === 'bh' ? 20 : p[0] === 'bw' ? 24 : null; }
  };
}
