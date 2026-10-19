// SIMULACRA Mockup AP16: Haus von innen einrichten. Die Möbel sind hier schematisch gezeichnet (im Spiel kommen die Sprites aus „innen2“ und die
// Objektarten mit ihren Handlungen aus AP15); gezeigt wird das Werkzeug: Katalog, Raster, Platzieren, Drehen, Wandschmuck, Farben, Prüfung.
var I = {};
(function () {
  var TW = 16, TH = 12, COLS = 10, ROWS = 6, WALLH = 44, SC = 6, FX = 48, WY = 90;                // Kachel 16 × 12 (Puppenhaus-Aufsicht), Maßstab 6
  I.COLS = COLS; I.ROWS = ROWS; I.SC = SC; I.FX = FX; I.WY = WY; I.TW = TW; I.TH = TH; I.WALLH = WALLH;
  I.W = FX * 2 + COLS * TW * SC; I.H = WY + (WALLH + ROWS * TH) * SC + 40;
  I.PAPERS = [['Creme', '#f1e3c4'], ['Rosé', '#f0cfc9'], ['Salbei', '#cfe3c4'], ['Himmel', '#c9dff0'], ['Senf', '#f1d98a'], ['Flieder', '#ddd0ee']];
  I.FLOORS = [['Dielen hell', ['#d9ad75', '#cf9f66']], ['Dielen dunkel', ['#a9744a', '#9a683f']], ['Fliesen', ['#e4dccd', '#d3c9b6']], ['Stein', ['#b9b2a6', '#a8a094']]];
  I.CURTAINS = [['Rot', '#e6775c'], ['Blau', '#7fa8dc'], ['Grün', '#92bd6c'], ['Gelb', '#e3c274']];
  function spr(w, h, fn) { return wSprite(w, h, function (s) { fn(s); s.outline(WP.outline); }); }
  var P = WP;
  I.CAT = [
    { k: 'bett', name: 'Bett', w: 2, h: 1, use: 1, draw: function () { return spr(32, 26, function (s) { s.r(0, 6, 32, 20, P.wood2); s.r(0, 0, 5, 26, P.wood3); s.r(3, 9, 27, 13, '#f4efe6'); s.r(3, 9, 10, 7, '#fffaf0'); s.r(14, 12, 16, 10, '#e6775c'); }); } },
    { k: 'tisch', name: 'Tisch', w: 2, h: 1, use: 1, draw: function () { return spr(32, 20, function (s) { s.r(0, 0, 32, 8, P.wood1); s.r(0, 8, 32, 2, P.wood3); s.r(2, 10, 3, 10, P.wood3); s.r(27, 10, 3, 10, P.wood3); }); } },
    { k: 'stuhl', name: 'Stuhl', w: 1, h: 1, use: 0, draw: function () { return spr(12, 20, function (s) { s.r(1, 0, 10, 9, P.wood2); s.r(0, 9, 12, 4, P.wood1); s.r(1, 13, 2, 7, P.wood3); s.r(9, 13, 2, 7, P.wood3); }); } },
    { k: 'herd', name: 'Herd', w: 1, h: 1, use: 1, draw: function () { return spr(16, 28, function (s) { s.r(3, 0, 10, 5, '#8a8494'); s.r(0, 5, 16, 23, '#6b6573'); s.r(2, 9, 12, 9, '#4a4452'); s.r(5, 12, 6, 4, '#ffb766'); s.r(2, 21, 12, 2, '#8a8494'); }); } },
    { k: 'regal', name: 'Regal', w: 2, h: 1, use: 1, draw: function () { return spr(32, 36, function (s) { s.r(0, 0, 32, 36, P.wood2); [3, 14, 25].forEach(function (y, n) { s.r(2, y, 28, 9, '#5d4636'); for (var x = 3; x < 28; x += 5) s.r(x, y + 1 + (x % 3), 4, 8 - (x % 3), ['#e6775c', '#7fa8dc', '#e3c274', '#92bd6c'][(x + n) % 4]); }); }); } },
    { k: 'truhe', name: 'Truhe', w: 1, h: 1, use: 1, draw: function () { return spr(18, 14, function (s) { s.r(0, 3, 18, 11, P.wood2); s.r(0, 0, 18, 4, P.wood1); s.r(7, 5, 4, 4, '#ffd36e'); }); } },
    { k: 'sofa', name: 'Sofa', w: 2, h: 1, use: 1, draw: function () { return spr(32, 24, function (s) { s.r(0, 0, 32, 11, '#7fa8dc'); s.r(3, 11, 26, 9, '#9bbdea'); s.r(0, 6, 5, 16, '#5f8bc4'); s.r(27, 6, 5, 16, '#5f8bc4'); s.r(2, 21, 3, 3, P.wood3); s.r(27, 21, 3, 3, P.wood3); }); } },
    { k: 'sessel', name: 'Sessel', w: 1, h: 1, use: 1, draw: function () { return spr(16, 22, function (s) { s.r(1, 0, 14, 10, '#e3c274'); s.r(3, 10, 10, 8, '#f0d58f'); s.r(0, 6, 4, 13, '#c9a455'); s.r(12, 6, 4, 13, '#c9a455'); }); } },
    { k: 'werkbank', name: 'Werkbank', w: 2, h: 1, use: 1, draw: function () { return spr(32, 26, function (s) { s.r(0, 5, 32, 6, P.wood1); s.r(0, 11, 32, 3, P.wood3); s.r(2, 14, 3, 12, P.wood3); s.r(27, 14, 3, 12, P.wood3); s.r(5, 0, 2, 6, '#aca499'); s.r(4, 0, 4, 2, P.wood3); s.r(20, 2, 8, 3, '#aca499'); }); } },
    { k: 'kamin', name: 'Kamin', w: 2, h: 1, use: 1, draw: function () { return spr(32, 38, function (s) { s.r(0, 0, 32, 38, '#aca499'); s.r(3, 3, 26, 3, '#d2cbc0'); s.r(8, 14, 16, 24, '#2b2233'); s.r(12, 26, 8, 10, '#ffb766'); s.r(14, 22, 4, 6, '#ffd36e'); }); } },
    { k: 'lampe', name: 'Stehlampe', w: 1, h: 1, use: -1, draw: function () { return spr(10, 36, function (s) { s.r(4, 10, 2, 24, P.wood3); s.r(0, 0, 10, 11, '#fff2c6'); s.r(1, 33, 8, 3, P.wood3); }); } },
    { k: 'pflanze', name: 'Pflanze', w: 1, h: 1, use: -1, draw: function () { return spr(14, 24, function (s) { s.disc(7, 8, 6.5, P.leaf2); s.disc(5, 6, 3.5, P.leaf1); s.r(3, 15, 8, 9, '#cf9159'); s.r(3, 15, 8, 2, P.wood3); }); } },
    { k: 'teppichR', name: 'Teppich rot', w: 2, h: 2, use: -1, rug: true, draw: function () { return spr(32, 24, function (s) { s.r(0, 0, 32, 24, '#c8584a'); s.r(3, 3, 26, 18, '#e8b9a0'); s.r(6, 6, 20, 12, '#c8584a'); }); } },
    { k: 'teppichB', name: 'Teppich blau', w: 2, h: 2, use: -1, rug: true, draw: function () { return spr(32, 24, function (s) { s.r(0, 0, 32, 24, '#5f8bc4'); s.r(3, 3, 26, 18, '#d9e6f2'); s.r(6, 6, 20, 12, '#5f8bc4'); }); } },
    { k: 'fenster', name: 'Fenster', w: 1, h: 0, wall: true, draw: function () { return spr(22, 28, function (s) { s.r(0, 0, 22, 28, P.wood1); s.r(3, 3, 16, 22, P.glass); s.r(10, 3, 2, 22, P.wood1); s.r(3, 13, 16, 2, P.wood1); s.r(4, 4, 5, 8, '#e4f5fb'); }); } },
    { k: 'bild', name: 'Bild', w: 1, h: 0, wall: true, draw: function () { return spr(16, 14, function (s) { s.r(0, 0, 16, 14, P.wood2); s.r(2, 2, 12, 10, '#a6dcf2'); s.r(2, 8, 12, 4, P.leaf2); s.disc(10, 5, 1.6, '#ffd94f'); }); } }
  ];
  I.cat = {}; I.CAT.forEach(function (c) { I.cat[c.k] = c; c.sprite = c.draw(); });
  I.ROOMS = {
    schlaf: { name: 'Zimmer Alex (Schlafzimmer)', must: ['bett', 'Bett'], paper: 0, floor: 0, curtain: 1,
      items: [['bett', 7, 0], ['truhe', 5, 0], ['regal', 2, 0], ['tisch', 3, 3], ['stuhl', 2, 3], ['lampe', 9, 2], ['pflanze', 9, 0], ['teppichR', 4, 2]], wall: [['fenster', 5], ['bild', 7]] },
    kueche: { name: 'Küche', must: ['herd', 'Herd'], paper: 4, floor: 2, curtain: 0,
      items: [['herd', 3, 0], ['regal', 5, 0], ['truhe', 8, 0], ['tisch', 4, 3], ['stuhl', 3, 4], ['stuhl', 6, 3], ['pflanze', 9, 2]], wall: [['fenster', 4], ['bild', 8]] },
    wohn: { name: 'Wohnzimmer', must: ['sofa', 'Sofa'], paper: 2, floor: 1, curtain: 2,
      items: [['kamin', 4, 0], ['sofa', 2, 3], ['sessel', 6, 3], ['regal', 7, 0], ['lampe', 9, 1], ['teppichB', 2, 2]], wall: [['fenster', 2], ['bild', 7]] },
    werk: { name: 'Werkstatt', must: ['werkbank', 'Werkbank'], paper: 3, floor: 3, curtain: 3,
      items: [['werkbank', 3, 0], ['werkbank', 6, 0], ['truhe', 8, 2], ['truhe', 0, 3], ['regal', 0, 0]], wall: [['fenster', 5]] }
  };
  I.KEYS = ['schlaf', 'kueche', 'wohn', 'werk'];
  I.committed = []; I.draft = [];                       // Aktionen {id, t:'in', room, op, …} (gleiche Listen wie im Dorf: G.committed, G.draft)

  /** Raum aus Vorgabe + Aktionen (übernommene und Entwurf). */
  I.effective = function (room, acts) {
    var R = I.ROOMS[room], E = { room: room, paper: R.paper, floor: R.floor, curtain: R.curtain, items: [], wall: [] }, n = 0;
    R.items.forEach(function (i) { E.items.push({ id: room + 'v' + (n++), k: i[0], tx: i[1], ty: i[2], flip: false }); });
    R.wall.forEach(function (w) { E.wall.push({ id: room + 'v' + (n++), k: w[0], col: w[1] }); });
    var dead = {}; acts.forEach(function (x) { if (x.a.t === 'in' && x.a.room === room && x.a.op === 'del') dead[x.a.target] = 1; });
    E.items = E.items.filter(function (i) { return !dead[i.id]; }); E.wall = E.wall.filter(function (i) { return !dead[i.id]; });
    acts.forEach(function (x) {
      var a = x.a; if (a.t !== 'in' || a.room !== room || dead[a.id]) return;
      if (a.op === 'add') (I.cat[a.k].wall ? E.wall : E.items).push(I.cat[a.k].wall ? { id: a.id, k: a.k, col: a.col, draft: x.d } : { id: a.id, k: a.k, tx: a.tx, ty: a.ty, flip: !!a.flip, draft: x.d });
      else if (a.op === 'style') E[a.key] = a.val;
    });
    return E;
  };
  I.footprint = function (it) { var c = I.cat[it.k]; return [it.tx, it.ty, it.tx + c.w, it.ty + c.h]; };
  function solid(it) { var c = I.cat[it.k]; return !c.rug && !c.wall; }
  /** Grund, warum `k` an (tx, ty) nicht steht, sonst null. */
  I.canPlace = function (E, k, tx, ty, self) {
    var c = I.cat[k];
    if (c.wall) { if (tx < 0 || tx >= COLS) return 'Außerhalb der Wand'; if (tx === 1) return 'Dort ist die Tür'; return E.wall.some(function (w) { return w !== self && w.col === tx; }) ? 'An der Wand hängt schon etwas' : null; }
    if (tx < 0 || ty < 0 || tx + c.w > COLS || ty + c.h > ROWS) return 'Außerhalb des Raums';
    if (c.rug) return null;
    for (var i = 0; i < E.items.length; i++) {
      var o = E.items[i]; if (o === self || !solid(o)) continue;
      var f = I.footprint(o);
      if (tx < f[2] && tx + c.w > f[0] && ty < f[3] && ty + c.h > f[1]) return I.cat[o.k].name + ' steht dort';
    }
    if (tx <= 1 && tx + c.w > 1 && ty <= 1) return 'Vor der Tür bleibt es frei';
    return null;
  };
  I.itemAt = function (E, col, row) {
    for (var i = E.items.length - 1; i >= 0; i--) { var f = I.footprint(E.items[i]); if (col >= f[0] && col < f[2] && row >= f[1] && row < f[3]) return E.items[i]; }
    return null;
  };
  I.check = function (E) {
    var out = [], bl = {}, i, c;
    E.items.forEach(function (o) { if (!solid(o)) return; var f = I.footprint(o); for (var y = f[1]; y < f[3]; y++) for (var x = f[0]; x < f[2]; x++) bl[x + ',' + y] = 1; });
    var seen = {}, q = [[1, 0]]; seen['1,0'] = 1;
    while (q.length) { var p = q.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var x = p[0] + d[0], y = p[1] + d[1], k = x + ',' + y; if (x < 0 || y < 0 || x >= COLS || y >= ROWS || seen[k] || bl[k]) return; seen[k] = 1; q.push([x, y]); }); }
    out.push({ ok: !bl['1,0'] && !bl['1,1'], text: 'Die Tür ist frei' });
    var lost = [];
    E.items.forEach(function (o) {
      var c2 = I.cat[o.k]; if (!solid(o) || c2.use < 0) return;
      var f = I.footprint(o), cand = [];
      for (var x = f[0]; x < f[2]; x++) { cand.push([x, f[3]]); cand.push([x, f[1] - 1]); }
      for (var y = f[1]; y < f[3]; y++) { cand.push([f[0] - 1, y]); cand.push([f[2], y]); }
      if (!cand.some(function (t) { return seen[t[0] + ',' + t[1]]; })) lost.push(c2.name + (o.draft ? ' (neu)' : ''));
    });
    out.push({ ok: !lost.length, text: lost.length ? 'Nicht erreichbar (kein freier Platz davor): ' + lost.join(', ') : 'Alle Möbel lassen sich erreichen und benutzen' });
    var R = I.ROOMS[E.room], has = E.items.some(function (o) { return o.k === R.must[0]; });
    out.push({ ok: has, text: has ? R.name + ': ' + R.must[1] + ' vorhanden' : R.name + ' braucht ' + R.must[1] + ' (Regel der Raumart)' });
    return { list: out, ok: out.every(function (x) { return x.ok; }) };
  };

  // ---- Zeichnen ---------------------------------------------------------------------------------------------------------
  I.px = function (col, row) { return [FX + col * TW * SC, WY + (WALLH + row * TH) * SC]; };
  I.cellAt = function (x, y) {
    var col = Math.floor((x - FX) / (TW * SC)), row = Math.floor((y - WY - WALLH * SC) / (TH * SC));
    return { col: col, row: row, inFloor: col >= 0 && col < COLS && row >= 0 && row < ROWS, inWall: col >= 0 && col < COLS && y >= WY && y < WY + WALLH * SC };
  };
  function dashed(g, x, y, w, h) { g.save(); g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = '#b79cff'; g.strokeRect(x, y, w, h); g.restore(); }
  function put(g, sprite, x, y, flip, alpha) {                                    // Sprite mit Unterkante bei y, mittig bei x, im Maßstab SC
    var w = sprite.width * SC, h = sprite.height * SC;
    g.save(); g.imageSmoothingEnabled = false; if (alpha != null) g.globalAlpha = alpha;
    if (flip) { g.translate(x + w / 2, 0); g.scale(-1, 1); g.drawImage(sprite, -w, y - h, w, h); } else g.drawImage(sprite, x - w / 2, y - h, w, h);
    g.restore();
  }
  I.put = put;
  I.draw = function (g, E, o) {
    var W = I.W, H = I.H, paper = I.PAPERS[E.paper][1], fl = I.FLOORS[E.floor][1], cur = I.CURTAINS[E.curtain][1], c, r, i;
    g.fillStyle = '#1a1322'; g.fillRect(0, 0, W, H);
    var wx = FX, wy = WY, ww = COLS * TW * SC, wh = WALLH * SC;
    g.fillStyle = paper; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = 'rgba(0,0,0,0.06)'; for (c = 0; c < COLS * 4; c += 2) g.fillRect(wx + c * 4 * SC, wy, 4 * SC, wh);
    g.fillStyle = 'rgba(60,40,30,0.35)'; g.fillRect(wx, wy + wh - 6 * SC, ww, 6 * SC);                                  // Fußleiste
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) { var p = I.px(c, r); g.fillStyle = fl[(c + r) % 2]; g.fillRect(p[0], p[1], TW * SC, TH * SC); g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(p[0], p[1] + TH * SC - 2, TW * SC, 2); }
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, wy, FX, wh + ROWS * TH * SC); g.fillRect(wx + ww, wy, FX, wh + ROWS * TH * SC);   // Seitenwände im Schatten
    // Tür auf der Rückwand (Spalte 1)
    var dx = I.px(1, 0)[0] + TW * SC / 2, dy = wy + wh;
    put(g, spr(16, 36, function (s) { s.r(0, 0, 16, 36, P.wood2); s.r(2, 2, 12, 32, P.wood1); s.p(12, 20, '#ffd36e'); }), dx, dy, false);
    // Wandschmuck
    E.wall.forEach(function (w) {
      var s = I.cat[w.k].sprite, x = I.px(w.col, 0)[0] + TW * SC / 2, yb = wy + (w.k === 'fenster' ? 36 : 28) * SC;
      if (w.k === 'fenster') { g.fillStyle = cur; g.fillRect(x - 15 * SC, yb - 34 * SC, 5 * SC, 34 * SC); g.fillRect(x + 10 * SC, yb - 34 * SC, 5 * SC, 34 * SC); }
      put(g, s, x, yb, false, w.draft ? 0.85 : null);
      if (w.draft) dashed(g, x - s.width * SC / 2 - 4, yb - s.height * SC - 4, s.width * SC + 8, s.height * SC + 8);
    });
    // Teppiche, dann Möbel nach Tiefe
    var order = E.items.slice().sort(function (a, b) { var ra = I.cat[a.k].rug ? -1 : 0, rb = I.cat[b.k].rug ? -1 : 0; return ra !== rb ? ra - rb : (a.ty + I.cat[a.k].h) - (b.ty + I.cat[b.k].h); });
    order.forEach(function (it) {
      var cd = I.cat[it.k], pp = I.px(it.tx, it.ty + cd.h), x = pp[0] + cd.w * TW * SC / 2, s = cd.sprite;
      if (cd.rug) { var q = I.px(it.tx, it.ty); g.save(); if (it.draft) g.globalAlpha = 0.85; g.drawImage(s, q[0], q[1], cd.w * TW * SC, cd.h * TH * SC); g.restore(); if (it.draft) dashed(g, q[0], q[1], cd.w * TW * SC, cd.h * TH * SC); return; }
      put(g, s, x, pp[1], it.flip, it.draft ? 0.85 : null);
      if (it.draft) dashed(g, x - s.width * SC / 2 - 4, pp[1] - s.height * SC - 4, s.width * SC + 8, s.height * SC + 8);
    });
    if (o.grid) { g.strokeStyle = 'rgba(255,248,236,0.22)'; g.lineWidth = 1; for (c = 0; c <= COLS; c++) { g.beginPath(); g.moveTo(FX + c * TW * SC, wy + wh); g.lineTo(FX + c * TW * SC, wy + wh + ROWS * TH * SC); g.stroke(); } for (r = 0; r <= ROWS; r++) { g.beginPath(); g.moveTo(FX, wy + wh + r * TH * SC); g.lineTo(FX + ww, wy + wh + r * TH * SC); g.stroke(); } }
    g.fillStyle = '#fff8ec'; g.font = '600 22px ui-rounded, system-ui, sans-serif'; g.fillText(I.ROOMS[E.room].name, FX, wy - 18);
    if (o.abend) { g.fillStyle = 'rgba(90,50,120,0.22)'; g.fillRect(0, 0, W, H); }
  };
})();
