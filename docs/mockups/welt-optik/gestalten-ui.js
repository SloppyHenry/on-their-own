// SIMULACRA Mockup AP16: Bedienung (Werkzeugleiste, Zeiger, Entwurf, Prüfung, Übernehmen). Kein Produktionscode.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('c'), g = cv.getContext('2d'), tip = $('tip');
  var S = { view: 'out', tool: 'zeiger', grid: true, abend: false, room: 'schlaf', hover: null, path: [], drag: null, sel: null,
    opt: { ww: 66, roof: 'blau', wall: 'rosa', hk: 'bh', deko: 'tree', furn: 'bett', flip: false } };
  var E, ground, chk, QS = new URLSearchParams(location.search);
  var SC = G.SC, X0 = G.X0, Y0 = G.Y0, T = G.T;
  var TOOLS_OUT = [['zeiger', '⇱', 'Zeiger'], ['weg', '〰', 'Weg'], ['see', '◔', 'See'], ['garten', '▦', 'Garten'], ['haus', '⌂', 'Haus'], ['deko', '✿', 'Deko'], ['loeschen', '✕', 'Löschen']];
  var TOOLS_IN = [['moebel', '▣', 'Möbel'], ['wand', '▭', 'Wand'], ['farben', '◐', 'Farben'], ['loeschen', '✕', 'Löschen']];
  var HINT = {
    zeiger: 'Zeiger: etwas anklicken wählt es aus. Bei einem Haus erscheint „Von innen einrichten“.',
    weg: 'Weg: Klick setzt Punkte, Doppelklick oder Enter beendet, Esc bricht ab. Die Kacheln werden aus der Form abgeleitet.',
    see: 'See: vom Mittelpunkt nach außen ziehen. Bild und Karte (Wasser, nicht begehbar) kommen aus derselben Form.',
    garten: 'Garten: Rechteck aufziehen; Zaun, Pfähle und drei Beete entstehen von selbst.',
    haus: 'Haus: Art und Farben wählen, dann klicken. Tür, Innenbereich, Räume und Einrichtung legt der Generator-Baustein an.',
    deko: 'Deko: Bäume, Büsche, Laternen, Bänke … Klick setzt, Umschalt+Klick setzt mehrere.',
    loeschen: 'Löschen: Klick löscht, was unter dem Zeiger liegt (als Aktion im Entwurf, rückgängig zu machen).',
    moebel: 'Möbel: Klick setzt, R oder Rechtsklick dreht. Vor der Tür und vor jedem Möbel bleibt Platz frei.',
    wand: 'Wandschmuck: Fenster und Bilder hängen an der Rückwand (nicht vor der Tür).',
    farben: 'Farben: Tapete, Boden und Vorhänge dieses Raums; jede Wahl ist eine Aktion im Entwurf.'
  };
  var DEKO = ['tree', 'treeF', 'pine', 'bush', 'bushP', 'bushY', 'bushW', 'lamp', 'bench', 'mailbox', 'barrel', 'rock', 'reed', 'sign', 'bm:0', 'bhay', 'blog', 'bcr'];
  var HOUSES = [['bh', 58, 'Wohnhaus klein'], ['bh', 66, 'Wohnhaus'], ['bh', 90, 'Wohnhaus groß'], ['bs', 0, 'Laden'], ['bw', 0, 'Werkstatt'], ['bb', 0, 'Scheune'], ['bt', 0, 'Stall']];
  var hkind = function (hk, ww) { return hk === 'bh' ? 'bh:' + ww + ':' + S.opt.roof + ':' + S.opt.wall : hk; };

  // ---- Zustand und Neuberechnung -------------------------------------------------------------------------------------
  function acts() { return G.committed.map(function (a) { return { a: a, d: false }; }).concat(G.draft.map(function (a) { return { a: a, d: true }; })); }
  function refresh(rebuild) {
    if (rebuild !== false) { E = G.build(true); ground = G.ground(E); chk = G.check(E, ground); }
    renderPanel(); draw();
  }
  function act(a) { a.id = 'a' + G.nid++; G.draft.push(a); G.redo = []; refresh(true); }
  function undo() { if (!G.draft.length) return; G.redo.push(G.draft.pop()); refresh(true); }
  function redo() { if (!G.redo.length) return; G.draft.push(G.redo.pop()); refresh(true); }
  function describe(a) {
    var n = { path: function () { return 'Weg, ' + a.pts.length + ' Punkte'; }, lake: function () { return 'See ' + Math.round(a.rx * 2) + ' × ' + Math.round(a.ry * 2); },
      garden: function () { return 'Garten ' + (a.x1 - a.x0) + ' × ' + (a.y1 - a.y0); }, house: function () { return 'Haus: ' + G.nameOf(a); }, deko: function () { return 'Deko: ' + G.nameOf(a); },
      del: function () { return 'Löschen: ' + a.name; },
      'in': function () { var R = I.ROOMS[a.room].name.split(' (')[0]; return a.op === 'add' ? R + ': ' + I.cat[a.k].name + ' setzen' : a.op === 'del' ? R + ': ' + a.name + ' entfernen' : R + ': ' + { paper: 'Tapete', floor: 'Boden', curtain: 'Vorhang' }[a.key] + ' ändern'; } };
    return n[a.t]();
  }

  // ---- Panel ---------------------------------------------------------------------------------------------------------------
  function thumb(sprite, size) { var c = document.createElement('canvas'); c.width = sprite.width; c.height = sprite.height; c.getContext('2d').drawImage(sprite, 0, 0); c.style.imageRendering = 'pixelated'; c.style.maxHeight = (size || 30) + 'px'; c.style.maxWidth = '44px'; return c; }
  function btn(label, on, fn, cls) { var b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.setAttribute('aria-pressed', !!on); b.onclick = fn; return b; }
  function lbl(t) { var d = document.createElement('div'); d.className = 'lbl'; d.textContent = t; return d; }
  function swatches(el, title, list, cur, fn) {
    el.appendChild(lbl(title));
    list.forEach(function (it, i) { var b = btn('', cur === i, function () { fn(i); }, 'sw'); b.title = it[0]; b.style.background = Array.isArray(it[1]) ? it[1][0] : it[1]; b.style.outline = cur === i ? '2px solid #ffd36e' : 'none'; el.appendChild(b); });
  }
  function cat(el, sprite, label, on, fn) { var b = document.createElement('button'); b.className = 'cat'; b.setAttribute('aria-pressed', !!on); b.title = label; b.onclick = fn; b.appendChild(thumb(sprite)); var s = document.createElement('span'); s.textContent = label; b.appendChild(s); el.appendChild(b); }
  function renderTools() {
    var nav = $('tools'), list = S.view === 'out' ? TOOLS_OUT : TOOLS_IN; nav.innerHTML = '';
    list.forEach(function (t, i) { var b = document.createElement('button'); b.setAttribute('aria-pressed', S.tool === t[0]); b.innerHTML = '<i>' + t[1] + '</i>' + t[2] + '<kbd>' + (i + 1) + '</kbd>'; b.onclick = function () { setTool(t[0]); }; nav.appendChild(b); });
  }
  function renderOpts() {
    var el = $('opts'), t = S.tool; el.innerHTML = '';
    $('optT').textContent = (S.view === 'out' ? TOOLS_OUT : TOOLS_IN).filter(function (x) { return x[0] === t; })[0][2];
    $('hint').textContent = HINT[t];
    if (S.view === 'in') {
      el.appendChild(lbl('Raum'));
      I.KEYS.forEach(function (k) { el.appendChild(btn(I.ROOMS[k].name.split(' (')[0], S.room === k, function () { S.room = k; refresh(false); })); });
      var ef = I.effective(S.room, acts());
      if (t === 'moebel') { el.appendChild(lbl('Möbel und Teppiche')); I.CAT.filter(function (c) { return !c.wall; }).forEach(function (c) { cat(el, c.sprite, c.name, S.opt.furn === c.k, function () { S.opt.furn = c.k; renderOpts(); }); }); }
      if (t === 'wand') { el.appendChild(lbl('Wandschmuck')); I.CAT.filter(function (c) { return c.wall; }).forEach(function (c) { cat(el, c.sprite, c.name, S.opt.furn === c.k, function () { S.opt.furn = c.k; renderOpts(); }); }); }
      if (t === 'farben') {
        var st = function (key, val) { act({ t: 'in', room: S.room, op: 'style', key: key, val: val }); };
        swatches(el, 'Tapete', I.PAPERS, ef.paper, function (i) { st('paper', i); }); swatches(el, 'Boden', I.FLOORS, ef.floor, function (i) { st('floor', i); }); swatches(el, 'Vorhänge', I.CURTAINS, ef.curtain, function (i) { st('curtain', i); });
      }
      return;
    }
    if (t === 'haus') {
      el.appendChild(lbl('Gebäudeart (aus den Bauplänen)'));
      HOUSES.forEach(function (h) { var k = hkind(h[0], h[1]); cat(el, G.sprite(k), h[2], S.opt.hk === h[0] && (h[0] !== 'bh' || S.opt.ww === h[1]), function () { S.opt.hk = h[0]; S.opt.ww = h[1] || S.opt.ww; renderOpts(); }); });
      if (S.opt.hk === 'bh') {
        var rk = Object.keys(B_ROOF), wk = Object.keys(B_WALL);
        el.appendChild(lbl('Dach')); rk.forEach(function (k) { var b = btn('', S.opt.roof === k, function () { S.opt.roof = k; renderOpts(); }, 'sw'); b.title = k; b.style.background = B_ROOF[k][0]; b.style.outline = S.opt.roof === k ? '2px solid #ffd36e' : 'none'; el.appendChild(b); });
        el.appendChild(lbl('Wände')); wk.forEach(function (k) { var b = btn('', S.opt.wall === k, function () { S.opt.wall = k; renderOpts(); }, 'sw'); b.title = k; b.style.background = B_WALL[k][0]; b.style.outline = S.opt.wall === k ? '2px solid #ffd36e' : 'none'; el.appendChild(b); });
      }
    }
    if (t === 'deko') { el.appendChild(lbl('Bäume und Deko')); DEKO.forEach(function (k) { cat(el, G.sprite(k, 1), G.nameOf({ kind: k }), S.opt.deko === k, function () { S.opt.deko = k; renderOpts(); }); }); }
    if (t === 'zeiger' && S.sel && S.sel.type === 'obj' && G.isHouse(S.sel.o.kind)) {
      var b = btn('Von innen einrichten', false, function () { setView('in'); }, 'on'); b.style.width = '100%'; el.appendChild(b);
      el.appendChild(lbl(S.sel.name + (S.sel.o.draft ? ': Innenräume entstehen mit dem Haus (Bauplan)' : ': Innenräume bearbeiten')));
    }
  }
  function renderDraft() {
    var ol = $('draft'); ol.innerHTML = '';
    G.draft.forEach(function (a, i) {
      var li = document.createElement('li'), s = document.createElement('span'), x = document.createElement('button');
      s.textContent = describe(a); x.textContent = '×'; x.title = 'Aus dem Entwurf nehmen'; x.onclick = function () { G.draft.splice(i, 1); G.redo = []; refresh(true); };
      li.appendChild(s); li.appendChild(x); ol.appendChild(li);
    });
    if (!G.draft.length) { var e = document.createElement('li'); e.style.cssText = 'background:none;border-color:transparent;color:#bfae9a'; e.textContent = 'Leer – wähle ein Werkzeug und setze etwas.'; ol.appendChild(e); }
    $('cnt').textContent = G.draft.length ? '(' + G.draft.length + ')' : '';
    $('undo').disabled = !G.draft.length; $('redo').disabled = !G.redo.length; $('drop').disabled = !G.draft.length; $('apply').disabled = !G.draft.length || !checksAll().ok;
    $('undo').title = G.draft.length ? '' : 'Was übernommen ist, bleibt; bis zum Beginn der Runde lässt sich weiter gestalten';
    $('banner').hidden = !G.draft.length;
  }
  function checksAll() {
    var list = chk.list.slice(), ok = chk.ok;
    var rooms = {}; G.draft.forEach(function (a) { if (a.t === 'in') rooms[a.room] = 1; });
    Object.keys(rooms).forEach(function (r) { var c = I.check(I.effective(r, acts())); ok = ok && c.ok; list = list.concat(c.list.map(function (x) { return { ok: x.ok, text: I.ROOMS[r].name.split(' (')[0] + ': ' + x.text }; })); });
    if (S.view === 'in' && !rooms[S.room]) { var c = I.check(I.effective(S.room, acts())); list = list.concat(c.list.map(function (x) { return { ok: x.ok, text: I.ROOMS[S.room].name.split(' (')[0] + ': ' + x.text }; })); ok = ok && c.ok; }
    return { list: list, ok: ok };
  }
  function renderChecks() {
    var ul = $('checks'); ul.innerHTML = '';
    checksAll().list.forEach(function (c) { var li = document.createElement('li'); li.className = c.ok ? 'ok' : 'bad'; li.textContent = (c.ok ? '✓ ' : '✗ ') + c.text; ul.appendChild(li); });
  }
  function renderPanel() { renderTools(); renderOpts(); renderDraft(); renderChecks(); $('vOut').setAttribute('aria-pressed', S.view === 'out'); $('vIn').setAttribute('aria-pressed', S.view === 'in'); }
  function setTool(t) { S.tool = t; S.path = []; S.drag = null; renderPanel(); draw(); }
  function setView(v) {
    S.view = v; S.tool = v === 'out' ? 'zeiger' : 'moebel'; S.path = []; S.drag = null; S.hover = null;
    if (v === 'in') { cv.width = I.W; cv.height = I.H; } else { cv.width = G.VW * SC; cv.height = G.VH * SC; }
    refresh(false);
  }

  // ---- Zeichnen --------------------------------------------------------------------------------------------------------------
  var GHOST = 'rgba(183,156,255,', SZ = function (v) { return v * SC; };
  function sx(vx) { return (vx - X0) * SC; } function sy(vy) { return (vy - Y0) * SC; }
  function dashedPath(pts, w, col) { g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(function (p, i) { i ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1])); }); g.stroke(); g.restore(); }
  function bbox(o, col, dash) { var s = G.size(o); g.save(); if (dash) g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = col; g.strokeRect(sx(o.vx - s.w / 2) - 3, sy(o.vy - s.h) - 3, SZ(s.w) + 6, SZ(s.h) + 6); g.restore(); }
  function drawOut() {
    g.imageSmoothingEnabled = false; g.drawImage(ground.canvas, 0, 0, G.VW * SC, G.VH * SC);
    var showGrid = S.grid && S.tool !== 'zeiger';
    if (showGrid) { g.strokeStyle = 'rgba(255,248,236,0.18)'; g.lineWidth = 1; for (var x = 0; x <= G.VW; x += T) { g.beginPath(); g.moveTo(x * SC, 0); g.lineTo(x * SC, G.VH * SC); g.stroke(); } for (var y = 0; y <= G.VH; y += T) { g.beginPath(); g.moveTo(0, y * SC); g.lineTo(G.VW * SC, y * SC); g.stroke(); } }
    E.items.forEach(function (it) {                                                  // Schleier unter den neuen Formen
      if (!it.draft) return;
      if (it.kind === 'path') { dashedPath(it.a.pts, 11 * SC, GHOST + '0.30)'); g.save(); g.setLineDash([10, 8]); dashedPath(it.a.pts, 3, '#d9c8ff'); g.restore(); }
      if (it.kind === 'lake') { g.save(); g.fillStyle = GHOST + '0.28)'; g.setLineDash([10, 8]); g.strokeStyle = '#d9c8ff'; g.lineWidth = 3; g.beginPath(); g.ellipse(sx(it.a.x), sy(it.a.y), SZ(it.a.rx * 1.13), SZ(it.a.ry * 1.13), 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
      if (it.kind === 'garden') { g.save(); g.fillStyle = GHOST + '0.22)'; g.setLineDash([10, 8]); g.strokeStyle = '#d9c8ff'; g.lineWidth = 3; g.fillRect(sx(it.a.x0), sy(it.a.y0), SZ(it.a.x1 - it.a.x0), SZ(it.a.y1 - it.a.y0)); g.strokeRect(sx(it.a.x0), sy(it.a.y0), SZ(it.a.x1 - it.a.x0), SZ(it.a.y1 - it.a.y0)); g.restore(); }
    });
    E.objs.forEach(function (o) {
      var s = G.sprite(o.kind, o.extra, S.abend && o.kind === 'lamp'), w = s.width * SC, h = s.height * SC;
      g.save(); if (o.draft) g.globalAlpha = 0.86; g.drawImage(s, Math.round(sx(o.vx) - w / 2), Math.round(sy(o.vy) - h), w, h); g.restore();
      if (o.draft && !(o.src && /^(fence|post)$/.test(o.kind))) bbox(o, '#b79cff', true);
    });
    if (S.abend) { g.fillStyle = 'rgba(120,60,150,0.28)'; g.fillRect(0, 0, cv.width, cv.height); E.objs.forEach(function (o) { if (o.kind === 'lamp') { var gr = g.createRadialGradient(sx(o.vx), sy(o.vy - 24), 4, sx(o.vx), sy(o.vy - 24), 60 * SC / 2); gr.addColorStop(0, 'rgba(255,214,120,0.55)'); gr.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gr; g.fillRect(sx(o.vx) - 90, sy(o.vy) - 130, 180, 180); } }); }
    drawTool();
  }
  function pointReason(x, y) {                                                       // Weg: Punkt auf Wasser oder in Gebäuden?
    var r = G.overlap(E, [x - 3, y - 3, x + 3, y + 3], { path: true, water: false, inGarden: true });
    return r && r !== 'Das ist der Dorfplatz' ? (r === 'Dort ist Wasser' ? 'Wasser: dort braucht der Weg einen Steg oder eine Brücke' : r) : null;
  }
  function snap(v, k, o) { return Math.round((v - o) / k) * k + o; }
  function reasonFor(h) {
    if (!h) return null;
    var t = S.tool;
    if (t === 'weg') return pointReason(h[0], h[1]);
    if (t === 'see' && S.drag) { var L = lakeOf(S.drag, h); if (L.rx < 14 || L.ry < 10) return 'Zu klein (mindestens 28 × 20)'; return G.overlap(E, [L.x - L.rx * 1.13, L.y - L.ry * 1.13, L.x + L.rx * 1.13, L.y + L.ry * 1.13], { water: true }) ; }
    if (t === 'garten' && S.drag) {
      var q = gardenOf(S.drag, h); if (q.x1 - q.x0 < 48 || q.y1 - q.y0 < 32) return 'Zu klein (mindestens 48 × 32)';
      var why = G.overlap(E, [q.x0, q.y0, q.x1, q.y1 + 6], {}); if (why) return why;
      for (var k = 0; k <= 8; k++) for (var m = 0; m <= 6; m++) { var px = q.x0 + (q.x1 - q.x0) * k / 8, py = q.y0 + (q.y1 - q.y0) * m / 6; if (E.V.paths.some(function (p) { return G.pathDist(p, px, py) < 6; })) return 'Ein Weg führt hindurch'; }
      return null;
    }
    if (t === 'haus' || t === 'deko') {
      var o = ghostObj(h), f = G.foot(o);
      if (f) { var rr = G.overlap(E, [f[0], f[1], f[2], f[3] + (t === 'haus' ? 2 : 0)], { path: t === 'haus', inGarden: false }); if (rr) return rr; }
      else if (G.overlap(E, [o.vx - 4, o.vy - 4, o.vx + 4, o.vy], { water: false, path: true, inGarden: true }) === 'Dort ist Wasser' && o.kind !== 'reed') return 'Dort ist Wasser';
      if (t === 'haus') { var d = G.door(o), tl = G.tileOf(d[0], d[1]); if (chk.blocked[tl[1] * (G.VW / T) + tl[0]]) return 'Vor der Tür ist kein freier Platz'; }
      return null;
    }
    if (t === 'loeschen' && S.hit) return deleteReason(S.hit);
    return null;
  }
  function deleteReason(h) {
    if (h.type === 'obj' && h.o.vx === 126 && h.o.vy === 57) return 'Alex und Mira wohnen hier – ein bewohntes Haus lässt sich nicht löschen';
    if (h.type === 'obj' && (h.o.kind === 'well' || h.o.kind === 'board')) return null;
    return null;
  }
  function ghostObj(h) { var kind = S.tool === 'haus' ? hkind(S.opt.hk, S.opt.ww) : S.opt.deko; return { kind: kind, extra: 1, vx: snap(h[0], 8, 0), vy: S.tool === 'haus' ? snap(h[1], T, Y0) : Math.round(h[1]) }; }
  function lakeOf(a, h) { return { x: a[0], y: a[1], rx: Math.round(Math.abs(h[0] - a[0]) / 4) * 4, ry: Math.round(Math.abs(h[1] - a[1]) / 4) * 4 }; }
  function gardenOf(a, h) { var x0 = snap(Math.min(a[0], h[0]), T, X0), x1 = snap(Math.max(a[0], h[0]), T, X0), y0 = snap(Math.min(a[1], h[1]), T, Y0), y1 = snap(Math.max(a[1], h[1]), T, Y0); return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
  function drawTool() {
    var h = S.hover, t = S.tool; if (!h) return;
    var why = reasonFor(h), col = why ? '#ff8a7a' : '#8fd99a';
    if (t === 'zeiger' || t === 'loeschen') {
      var ht = S.hit; if (ht) { g.save(); g.setLineDash([6, 5]); g.lineWidth = 3; g.strokeStyle = t === 'loeschen' ? (deleteReason(ht) ? '#ff8a7a' : '#ffd36e') : '#fff8ec'; if (ht.type === 'obj') bbox(ht.o, g.strokeStyle, true); else if (ht.type === 'lake') { var L = ht.a || E.V.lake; g.beginPath(); g.ellipse(sx(L.x), sy(L.y), SZ(L.rx * 1.1), SZ(L.ry * 1.1), 0, 0, 7); g.stroke(); } else if (ht.type === 'garden') { var q = ht.a || E.V.garden; g.strokeRect(sx(q.x0), sy(q.y0), SZ(q.x1 - q.x0), SZ(q.y1 - q.y0)); } else if (ht.type === 'path') dashedPath(ht.pts, 3, g.strokeStyle); g.restore(); } return;
    }
    if (t === 'weg') {
      var pts = S.path.concat([[snap(h[0], 4, 0), snap(h[1], 4, 0)]]);
      dashedPath(pts, 11 * SC, why ? 'rgba(255,138,122,0.28)' : GHOST + '0.30)'); g.save(); g.setLineDash([10, 8]); dashedPath(pts, 3, col); g.restore();
      pts.forEach(function (p) { g.fillStyle = col; g.fillRect(sx(p[0]) - 5, sy(p[1]) - 5, 10, 10); });
    }
    if (t === 'see' && S.drag) { var L2 = lakeOf(S.drag, h); g.save(); g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeStyle = col; g.fillStyle = why ? 'rgba(255,138,122,0.22)' : GHOST + '0.28)'; g.beginPath(); g.ellipse(sx(L2.x), sy(L2.y), SZ(L2.rx * 1.13), SZ(L2.ry * 1.13), 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
    if (t === 'garten' && S.drag) { var q2 = gardenOf(S.drag, h); g.save(); g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeStyle = col; g.fillStyle = why ? 'rgba(255,138,122,0.22)' : GHOST + '0.22)'; g.fillRect(sx(q2.x0), sy(q2.y0), SZ(q2.x1 - q2.x0), SZ(q2.y1 - q2.y0)); g.strokeRect(sx(q2.x0), sy(q2.y0), SZ(q2.x1 - q2.x0), SZ(q2.y1 - q2.y0)); g.restore(); }
    if (t === 'haus' || t === 'deko') {
      var o = ghostObj(h), s = G.sprite(o.kind, o.extra), w = s.width * SC, hh = s.height * SC;
      g.save(); g.globalAlpha = 0.6; g.drawImage(s, Math.round(sx(o.vx) - w / 2), Math.round(sy(o.vy) - hh), w, hh); g.restore(); bbox(o, col, true);
      if (t === 'haus') { var d = G.door(o); g.fillStyle = col; g.fillRect(sx(d[0]) - 18, sy(d[1]) - 6, 36, 12); g.fillStyle = '#2b2233'; g.font = '600 12px system-ui'; g.fillText('Tür', sx(d[0]) - 10, sy(d[1]) + 4); }
    }
    if (t === 'weg' || t === 'see' || t === 'garten' || t === 'haus' || t === 'deko') { var tl = G.tileOf(h[0], h[1]), r = G.tileRect(tl[0], tl[1]); g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(sx(r[0]), sy(r[1]), T * SC, T * SC); }
  }
  function drawIn() {
    var ef = I.effective(S.room, acts()); I.draw(g, ef, { grid: S.grid, abend: S.abend });
    var h = S.hover; if (!h) return;
    var cell = I.cellAt(h.px, h.py), c = I.cat[S.opt.furn], t = S.tool;
    if (t === 'moebel' && c && !c.wall && cell.inFloor) {
      var tx = Math.min(cell.col, I.COLS - c.w), ty = Math.min(cell.row, I.ROWS - c.h), why = I.canPlace(ef, c.k, tx, ty), pp = I.px(tx, ty + c.h), x = pp[0] + c.w * I.TW * I.SC / 2;
      S.why = why; I.put(g, c.sprite, x, pp[1], S.opt.flip, 0.65);
      var q = I.px(tx, ty); g.save(); g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = why ? '#ff8a7a' : '#8fd99a'; g.strokeRect(q[0], q[1], c.w * I.TW * I.SC, c.h * I.TH * I.SC); g.restore();
      S.ghostIn = { k: c.k, tx: tx, ty: ty };
    } else if (t === 'wand' && c && c.wall && cell.inWall) {
      var why2 = I.canPlace(ef, c.k, cell.col, 0); S.why = why2; var x2 = I.px(cell.col, 0)[0] + I.TW * I.SC / 2;
      I.put(g, c.sprite, x2, I.WY + (c.k === 'fenster' ? 36 : 28) * I.SC, false, 0.65); g.save(); g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = why2 ? '#ff8a7a' : '#8fd99a'; g.strokeRect(I.px(cell.col, 0)[0], I.WY, I.TW * I.SC, I.WALLH * I.SC); g.restore();
      S.ghostIn = { k: c.k, col: cell.col };
    } else if (t === 'loeschen') {
      var it = cell.inFloor && I.itemAt(ef, cell.col, cell.row), wl = !it && cell.inWall && ef.wall.filter(function (w) { return w.col === cell.col; })[0];
      S.ghostIn = it ? { del: it } : wl ? { del: wl } : null;
      var tgt = it || wl; if (tgt) { var f = it ? I.footprint(it) : [wl.col, 0, wl.col + 1, 0]; var a = it ? I.px(f[0], f[1]) : [I.px(wl.col, 0)[0], I.WY]; g.save(); g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = '#ffd36e'; g.strokeRect(a[0], a[1], (f[2] - f[0]) * I.TW * I.SC, it ? (f[3] - f[1]) * I.TH * I.SC : I.WALLH * I.SC); g.restore(); }
    } else S.ghostIn = null;
  }
  function draw() { if (!E) return; S.view === 'out' ? drawOut() : drawIn(); }

  // ---- Zeiger ------------------------------------------------------------------------------------------------------------------
  function pos(e) { var r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * cv.width / r.width, py = (e.clientY - r.top) * cv.height / r.height; return { px: px, py: py, v: [px / SC + X0, py / SC + Y0] }; }
  function showTip(e, text, bad) { if (!text) { tip.hidden = true; return; } var r = $('stage').getBoundingClientRect(); tip.hidden = false; tip.textContent = text; tip.className = bad ? 'bad' : ''; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; }
  cv.addEventListener('pointermove', function (e) {
    var p = pos(e); if (!E) return;
    if (S.view === 'out') {
      S.hover = p.v; S.hit = (S.tool === 'zeiger' || S.tool === 'loeschen') ? G.hit(E, p.v[0], p.v[1]) : null;
      var why = reasonFor(S.hover); S.why = why;
      showTip(e, why || (S.hit ? S.hit.name : S.tool === 'weg' && S.path.length ? 'Doppelklick beendet den Weg' : ''), !!why);
    } else {
      S.hover = { px: p.px, py: p.py }; draw();
      var cell = I.cellAt(p.px, p.py), ef = I.effective(S.room, acts()), it = S.tool === 'loeschen' && cell.inFloor ? I.itemAt(ef, cell.col, cell.row) : null;
      showTip(e, S.why || (it ? I.cat[it.k].name : ''), !!S.why); return;
    }
    draw();
  });
  cv.addEventListener('pointerleave', function () { S.hover = null; tip.hidden = true; draw(); });
  cv.addEventListener('pointerdown', function (e) {
    var p = pos(e); if (!E || e.button === 2) return;
    if (S.view === 'in') {
      var ef = I.effective(S.room, acts()), g2 = S.ghostIn;
      if (S.tool === 'moebel' && g2 && g2.k && g2.tx != null && !S.why) act({ t: 'in', room: S.room, op: 'add', k: g2.k, tx: g2.tx, ty: g2.ty, flip: S.opt.flip });
      else if (S.tool === 'wand' && g2 && g2.col != null && !S.why) act({ t: 'in', room: S.room, op: 'add', k: g2.k, col: g2.col });
      else if (S.tool === 'loeschen' && g2 && g2.del) act({ t: 'in', room: S.room, op: 'del', target: g2.del.id, name: I.cat[g2.del.k].name });
      return;
    }
    var v = p.v, t = S.tool;
    if (t === 'zeiger') { S.sel = G.hit(E, v[0], v[1]); renderOpts(); draw(); }
    else if (t === 'weg') { if (!pointReason(v[0], v[1])) { var pt = [snap(v[0], 4, 0), snap(v[1], 4, 0)], last = S.path[S.path.length - 1]; if (e.detail === 2 || (last && last[0] === pt[0] && last[1] === pt[1])) finishPath(); else S.path.push(pt); } draw(); }
    else if (t === 'see' || t === 'garten') S.drag = v.slice();
    else if (t === 'haus' || t === 'deko') { if (!S.why) { var o = ghostObj(v); act({ t: t === 'haus' ? 'house' : 'deko', kind: o.kind, vx: o.vx, vy: o.vy, extra: t === 'deko' ? Math.floor(Math.random() * 7) : 0 }); } }
    else if (t === 'loeschen') { var h = G.hit(E, v[0], v[1]); if (h && !deleteReason(h)) act({ t: 'del', target: h.id, name: h.name.replace(' (neu)', ''), type: h.type }); }
  });
  cv.addEventListener('pointerup', function (e) {
    if (S.view !== 'out' || !S.drag) return;
    var h = pos(e).v, a = S.drag; S.drag = null;
    if (S.tool === 'see' && !reasonFor(h) && !S.why) { var L = lakeOf(a, h); act({ t: 'lake', x: L.x, y: L.y, rx: L.rx, ry: L.ry }); }
    else if (S.tool === 'garten') { S.drag = a; var why = reasonFor(h); S.drag = null; if (!why) act(Object.assign({ t: 'garden' }, gardenOf(a, h))); }
    draw();
  });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); if (S.view === 'in') { S.opt.flip = !S.opt.flip; draw(); } else if (S.path.length) { finishPath(); } });
  function finishPath() { if (S.path.length >= 2) act({ t: 'path', pts: S.path.slice() }); S.path = []; }
  window.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'SELECT') return;
    var list = S.view === 'out' ? TOOLS_OUT : TOOLS_IN, n = +e.key;
    if (n >= 1 && n <= list.length && !e.ctrlKey && !e.metaKey) setTool(list[n - 1][0]);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (e.key === 'Enter') finishPath();
    else if (e.key === 'Escape') { S.path = []; S.drag = null; draw(); }
    else if (e.key.toLowerCase() === 'r' && S.view === 'in') { S.opt.flip = !S.opt.flip; draw(); }
  });
  $('undo').onclick = undo; $('redo').onclick = redo; $('drop').onclick = function () { G.draft = []; G.redo = []; refresh(true); };
  $('vOut').onclick = function () { setView('out'); }; $('vIn').onclick = function () { setView('in'); };
  $('zeit').onchange = function () { S.abend = $('zeit').value === 'Abend'; draw(); };
  $('grid').onchange = function () { S.grid = $('grid').checked; draw(); };
  $('apply').onclick = function () {
    var n = {}; G.draft.forEach(function (a) { n[a.t] = (n[a.t] || 0) + 1; });
    $('mSum').textContent = G.draft.length + ' Aktionen: ' + G.draft.map(describe).slice(0, 6).join(', ') + (G.draft.length > 6 ? ' …' : '') + '. Die Prüfung ist bestanden.';
    $('modal').classList.add('open');
  };
  $('mNo').onclick = function () { $('modal').classList.remove('open'); };
  $('mYes').onclick = function () {
    $('modal').classList.remove('open'); var k = G.draft.length; G.committed = G.committed.concat(G.draft); G.draft = []; G.redo = []; refresh(true);
    var t = $('toast'); t.textContent = 'Übernommen (Mockup): ' + k + ' Aktionen sind Teil der Welt.'; t.style.display = 'block'; setTimeout(function () { t.style.display = 'none'; }, 3500);
  };

  // ---- Start (mit ?demo=1 ein gefüllter Entwurf für die Bilder) ---------------------------------------------------------------------------
  function demo() {
    var A = function (a) { a.id = 'a' + G.nid++; G.draft.push(a); };
    A({ t: 'house', kind: 'bh:66:blau:rosa', vx: 120, vy: 208, extra: 0 });
    A({ t: 'path', pts: [[120, 214], [120, 224], [150, 236], [190, 236]] });
    A({ t: 'garden', x0: 160, y0: 176, x1: 224, y1: 224 });
    A({ t: 'deko', kind: 'treeF', vx: 232, vy: 232, extra: 2 });
    A({ t: 'deko', kind: 'lamp', vx: 140, vy: 236, extra: 0 });
    A({ t: 'del', target: 'o20', name: 'Busch' });
    var ef = I.effective('kueche', []);
    A({ t: 'in', room: 'kueche', op: 'add', k: 'sessel', tx: 7, ty: 4, flip: false });
    A({ t: 'in', room: 'kueche', op: 'style', key: 'paper', val: 2 });
  }
  if (QS.get('demo')) demo();
  S.abend = QS.get('zeit') === 'Abend'; $('zeit').value = S.abend ? 'Abend' : 'Mittag';
  if (QS.get('tool')) S.tool = QS.get('tool');
  cv.width = G.VW * SC; cv.height = G.VH * SC;
  E = G.build(true); ground = G.ground(E); chk = G.check(E, ground);
  if (QS.get('view') === 'in') { S.room = QS.get('room') || 'schlaf'; setView('in'); if (QS.get('tool')) setTool(QS.get('tool')); } else { renderPanel(); draw(); }
  if (QS.get('hx')) { S.hover = [+QS.get('hx'), +QS.get('hy')]; S.hit = G.hit(E, S.hover[0], S.hover[1]); draw(); }
  window.MOCK = { S: S, G: G, I: I, refresh: refresh, setView: setView, setTool: setTool };
  document.body.dataset.ready = '1';
})();
