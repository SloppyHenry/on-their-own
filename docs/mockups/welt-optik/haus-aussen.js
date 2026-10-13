// SIMULACRA Mockup AP13 (Antwort auf Frage 18): Haus draußen wie in Mockup A, Anzeige „jemand ist drin“, nach Klick Innenansicht.
// Kein Produktionscode. Nutzt world.js (Sprites, Farben), figuren.js und haus.js (Projektion, Boden, Innenräume).

// Hausfassade im Stil von wHouse (Mockup A), aber mit beliebig vielen Fenstern; die Tür sitzt in der Mitte.
function hHouseWide(nWin, lit) {
  var slot = 24, W = 12 + nWin * slot + 20, door = Math.round(W / 2);
  return { door: door, spr: wSprite(W, 80, function (s) {
    var y, x, cx = W - 23;
    s.r(cx, 1, 8, 18, WP.stone2); s.r(cx, 1, 3, 18, WP.stone1); s.r(cx - 1, 0, 10, 3, WP.stone3); for (y = 5; y < 18; y += 4) s.r(cx, y, 8, 1, WP.stone3);
    for (y = 6; y <= 34; y++) {
      var l = Math.round(13 - (y - 6) * 11 / 28), r = Math.round(W - 13 + (y - 6) * 11 / 28), row = (y - 6) % 5;
      for (x = l; x <= r; x++) {
        var c = row < 2 ? WP.roof1 : WP.roof2, k = (x + Math.floor((y - 6) / 5) * 3) % 6;
        if (row === 4 && (k === 0 || k === 1)) c = WP.roof3;
        if (x === l || x === r) c = WP.roof3;
        s.p(x, y, c);
      }
    }
    s.r(13, 5, W - 26, 2, WP.roof3); s.r(14, 4, W - 28, 1, WP.wood3); s.r(2, 34, W - 4, 2, WP.roof3);
    s.disc(door + 0.5, 20.5, 5.5, WP.wood3); s.disc(door + 0.5, 20.5, 4.2, lit ? WP.glassLit : WP.glass); s.r(door, 16, 1, 9, WP.wood1); s.r(door - 4, 20, 9, 1, WP.wood1);
    s.r(6, 36, W - 12, 36, WP.wall1);
    for (y = 37; y < 72; y += 3) for (x = 7; x < W - 6; x += 7) if (wHash(x, y, 3) > 0.7) s.p(x, y, WP.wall2);
    s.r(6, 36, W - 12, 2, WP.wall3); s.r(6, 36, 2, 36, WP.wood2); s.r(W - 8, 36, 2, 36, WP.wood2); s.r(6, 54, W - 12, 2, WP.wood2);
    s.r(door - 9, 36, 2, 18, WP.wood2); s.r(door + 8, 36, 2, 18, WP.wood2);
    for (var i = 0; i < nWin; i++) {
      var wx = i < nWin / 2 ? 11 + i * slot : door + 12 + (i - Math.ceil(nWin / 2)) * slot, wy = 40;
      s.r(wx - 1, wy - 1, 17, 14, WP.wood3); s.r(wx, wy, 15, 12, lit ? WP.glassLit : WP.glass);
      s.r(wx + 7, wy, 1, 12, WP.wood1); s.r(wx, wy + 5, 15, 1, WP.wood1);
      if (lit) s.r(wx + 1, wy + 7, 5, 4, '#ffc46a'); else { s.p(wx + 1, wy + 1, '#eefaff'); s.p(wx + 2, wy + 1, '#eefaff'); s.p(wx + 1, wy + 2, '#eefaff'); }
      s.r(wx - 2, wy + 12, 19, 4, WP.wood2); s.r(wx - 2, wy + 12, 19, 1, WP.wood1);
      for (var f = 0; f < 7; f++) { var fx = wx - 1 + f * 2.6; s.p(fx, wy + 11, WP.leaf3); s.p(fx + 1, wy + 10, [WP.fP, WP.fY, WP.fW, WP.fR][f % 4]); s.p(fx, wy + 10, WP.leaf2); }
    }
    s.r(door - 7, 52, 14, 20, WP.wood3); s.disc(door, 53, 7, WP.wood3); s.r(door - 6, 53, 12, 19, WP.wood1); s.disc(door, 54, 6, WP.wood1);
    for (x = door - 4; x < door + 6; x += 3) s.r(x, 50, 1, 22, WP.wood2);
    s.r(door + 3, 62, 2, 2, WP.fY);
    s.r(door + 9, 46, 4, 6, WP.outline); s.r(door + 10, 47, 2, 4, lit ? WP.lampLit : WP.lamp);
    for (x = 6; x < W - 6; x += 5) { s.r(x, 72, 5, 4, wHash(x, 1, 4) < 0.5 ? WP.stone1 : WP.stone2); s.p(x, 72, WP.stone3); }
    s.r(6, 72, W - 12, 1, WP.stone3); s.r(door - 9, 76, 18, 3, WP.stone1); s.r(door - 9, 78, 18, 1, WP.stone2);
    s.outline(WP.outline);
  }) };
}

// Draußen: Der Grundriss des Gebäudes wird zum Grundstück (Wiese, Büsche, Weg zur Tür), darauf das Haus aus Mockup A.
function hYardRows() {
  return H_ROWS.map(function (row, ty) {
    return row.split('').map(function (ch, tx) { return hInBld(tx, ty) ? (tx === 20 && ty >= 15 ? ',' : '.') : ch; }).join('');
  });
}
function hRenderAussen(canvas, cam, inside) {
  var keep = H_ROWS; H_ROWS = hYardRows();
  var low = document.createElement('canvas'); low.width = H_LW; low.height = H_LH;
  var lg = low.getContext('2d'); lg.imageSmoothingEnabled = false;
  hSky(lg, cam); hGroundPass(lg, cam);
  var items = [], lit = inside.length > 0, house = hHouseWide(4, lit), doorX = 20 * H_T + 8, base = H_BLD.y1 * H_T;
  function add(y, spr, x, a) { items.push({ y: y, fn: function (g) { hSprite(g, cam, spr, x, y, a); } }); }
  for (var ty = 0; ty < H_ROWS.length; ty++) for (var tx = 0; tx < 64; tx++) if (H_ROWS[ty][tx] === 'T') { var hh = wHash(tx, ty, 5); add((ty + 1) * H_T - 2, hh < 0.4 ? wPine(tx % 7) : wTree(hh > 0.9 ? 1 : 0, (tx * 3 + ty) % 7 + 1), tx * H_T + 8 + (hh - 0.5) * 6); }
  items.push({ y: base, fn: function (g) { hSprite(g, cam, house.spr, doorX + house.spr.width / 2 - house.door, base); } });
  var decor = [['tree', 6, 6, 1], ['tree', 10, 8, 3], ['pine', 13, 5, 2], ['tree', 26, 6, 4], ['pine', 24, 9, 5], ['treeF', 8, 12, 2], ['bushP', 15, 16], ['bushY', 25, 16], ['bushW', 6, 16], ['bush', 11, 15], ['barrel', 14, 16], ['mailbox', 22, 17], ['bush', 27, 13]];
  decor.forEach(function (d) {
    var spr = d[0] === 'tree' ? wTree(0, d[3]) : d[0] === 'treeF' ? wTree(1, d[3]) : d[0] === 'pine' ? wPine(d[3]) : d[0] === 'barrel' ? wBarrel() : d[0] === 'mailbox' ? wMailbox() : wBush(d[1] + d[2], { bushP: WP.fP, bushY: WP.fY, bushW: WP.fW }[d[0]] || null);
    add(d[2] * H_T + 15, spr, d[1] * H_T + 8);
  });
  H_OBJ.forEach(function (o) { if (!hInBld(o[1], o[2])) add((o[2] + 1) * H_T - 1, hFurniture(o[0], o[3]), o[1] * H_T + 8); });
  for (var g = 0; g < 17; g++) { add(4 * H_T + 4, wFence(), 30 * H_T + g * H_T + 8); add(16 * H_T - 1, wFence(), 30 * H_T + g * H_T + 8); }
  add(19 * H_T + 14, fFigure('mira', 'up', 1), 22 * H_T + 8);
  items.sort(function (a, b) { return a.y - b.y; }).forEach(function (it) { it.fn(lg); });
  H_ROWS = keep;
  var ctx = canvas.getContext('2d'), k = canvas.width / H_LW; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, canvas.width, canvas.height);
  if (!lit) return;
  // Anzeige „im Haus“: warme Fenster (im Sprite) und ein Schild über dem Dach mit den Köpfen der Bewohner darin
  var top = hProj(cam, doorX, base, 84), x = top.x * k, y = top.y * k;
  var label = inside.map(function (q) { return q[1]; }).join(' · '), w = 64 + inside.length * 30 + label.length * 7.4;
  ctx.fillStyle = 'rgba(43,34,51,0.86)'; hPill(ctx, x - w / 2, y - 40, w, 34); ctx.fill();
  inside.forEach(function (q, i) { ctx.drawImage(fFigure(q[0], 'down', 'stand'), 0, 0, 16, 12, x - w / 2 + 10 + i * 30, y - 37, 28, 21); });
  ctx.fillStyle = '#fff8ec'; ctx.font = '600 14px ui-rounded, system-ui, sans-serif'; ctx.fillText('im Haus: ' + label, x - w / 2 + 16 + inside.length * 30, y - 18);
  ctx.fillStyle = 'rgba(43,34,51,0.86)'; ctx.beginPath(); ctx.moveTo(x - 7, y - 6); ctx.lineTo(x + 7, y - 6); ctx.lineTo(x, y + 2); ctx.fill();
  ctx.font = '500 12px ui-rounded, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,248,236,0.85)'; ctx.fillText('Klick aufs Haus: hineinschauen', x - 92, y + 20);
}
function hPill(ctx, x, y, w, h) { var r = h / 2; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// Nach dem Klick: Kamera fährt ins Haus, Wände runter, die Umgebung tritt dunkel zurück.
function hRenderInnen(canvas, cam) {
  var keepRows = H_ROWS, keepObj = H_OBJ;
  H_ROWS = H_ROWS.map(function (row, ty) { return row.split('').map(function (ch, tx) { return hInBld(tx, ty) ? ch : '.'; }).join(''); });
  H_OBJ = H_OBJ.filter(function (o) { return hInBld(o[1], o[2]); });
  var low = document.createElement('canvas'); low.width = H_LW; low.height = H_LH;
  var lg = low.getContext('2d'); lg.imageSmoothingEnabled = false;
  hSky(lg, cam); hGroundPass(lg, cam);
  var img = lg.getImageData(0, 0, H_LW, H_LH), d = img.data;
  for (var y = 0; y < H_LH; y++) for (var x = 0; x < H_LW; x++) {
    var w = hUnproj(cam, x + 0.5, y + 0.5), o = (y * H_LW + x) * 4;
    if (w && hInBld(Math.floor(w.x / H_T), Math.floor(w.y / H_T))) continue;
    d[o] = d[o] * 0.22 + 14; d[o + 1] = d[o + 1] * 0.22 + 10; d[o + 2] = d[o + 2] * 0.22 + 22;
  }
  lg.putImageData(img, 0, 0);
  window.H_NOFENCE = true;
  hItems(cam, 'offen', null).filter(function (it) { return it.y <= H_BLD.y1 * H_T + 1; }).forEach(function (it) { it.fn(lg); });
  H_ROWS = keepRows; H_OBJ = keepObj; window.H_NOFENCE = false;
  var ctx = canvas.getContext('2d'), k = canvas.width / H_LW; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, canvas.width, canvas.height);
  var names = ['Zimmer Alex', 'Zimmer Mira', 'Werkstatt', 'Küche', 'Wohnzimmer'];
  ctx.font = '600 13px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center';
  H_ROOMS.forEach(function (r, i) { var p = hProj(cam, (r[0] + r[2] / 2) * H_T, (r[1] + r[3]) * H_T - 3, 0); ctx.fillStyle = 'rgba(43,34,51,0.55)'; var tw = ctx.measureText(names[i]).width + 14; hPill(ctx, p.x * k - tw / 2, p.y * k - 18, tw, 20); ctx.fill(); ctx.fillStyle = '#fff8ec'; ctx.fillText(names[i], p.x * k, p.y * k - 4); });
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,248,236,0.95)'; hPill(ctx, 20, 18, 330, 36); ctx.fill();
  ctx.fillStyle = '#3b2c3d'; ctx.font = '700 15px ui-rounded, system-ui, sans-serif'; ctx.fillText('← Haus · Alex, Mira   (Esc: zurück ins Dorf)', 36, 41);
}
