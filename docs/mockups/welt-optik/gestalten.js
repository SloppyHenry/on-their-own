// SIMULACRA Mockup AP16: Welt gestalten (Außenwelt). Modell = Dorf aus dorf.js (Seed 7) + übernommene Aktionen + Entwurf.
// Jede Werkzeugaktion ist eine Aktion {id, t, …}; die Welt wird daraus neu berechnet (so wie im Spiel jede Aktion ein Patch ist). Kein Produktionscode.
var G = {};
(function () {
  var SC = 3, X0 = -112, Y0 = -32, VW = 464, VH = 320, T = 16;
  G.SC = SC; G.X0 = X0; G.Y0 = Y0; G.VW = VW; G.VH = VH; G.T = T;
  var world = dorfWelt(7), V0 = world.data.V;
  var baseObjs = world.data.objects.map(function (o, i) { return { id: 'o' + i, kind: o.kind, vx: o.vx, vy: o.vy, extra: o.extra || 0 }; });
  G.V0 = V0; G.sq = V0.sq; G.committed = []; G.draft = []; G.redo = []; G.nid = 1;
  var cache = {};
  G.sprite = function (kind, extra, lit) { return bSpriteFor({ kind: kind, extra: extra || 0 }, !!lit, 0, cache); };

  var NAMES = { house: 'Haus', bh: 'Wohnhaus', bw: 'Werkstatt', bb: 'Scheune', bs: 'Laden', bt: 'Stall', bm: 'Marktstand', bhay: 'Heuballen', blog: 'Holzstapel', bcr: 'Kiste',
    tree: 'Baum', treeF: 'Obstbaum', treeB: 'Baum', pine: 'Kiefer', bush: 'Busch', bushP: 'Busch (rosa)', bushY: 'Busch (gelb)', bushW: 'Busch (weiß)', lamp: 'Laterne',
    well: 'Brunnen', bench: 'Bank', board: 'Brett', fence: 'Zaun', post: 'Pfahl', sun: 'Sonnenblume', tomato: 'Tomaten', scare: 'Vogelscheuche', sign: 'Wegweiser',
    mailbox: 'Briefkasten', rock: 'Stein', reed: 'Schilf', barrel: 'Fass', boat: 'Boot', alex: 'Alex', mira: 'Mira' };
  G.nameOf = function (o) { return NAMES[o.kind.split(':')[0]] || o.kind; };
  var BUILD = /^(house|bh|bw|bb|bs|bt|bm)/, SOLID = /^(tree|treeF|treeB|pine|rock|fence|post|well|barrel|bcr|blog|boat)$/;
  var BK = { house: 1, bh: 1, bw: 1, bb: 1, bs: 1, bt: 1, bm: 1 };
  G.isBuilding = function (k) { return !!BK[k.split(':')[0]]; };
  G.isHouse = function (k) { var b = k.split(':')[0]; return b !== 'bm' && !!BK[b]; };
  G.size = function (o) { var s = G.sprite(o.kind, o.extra); return { w: s.width, h: s.height }; };
  /** Grundfläche in Dorfkoordinaten [x0, y0, x1, y1] (nur was den Weg versperrt). */
  G.foot = function (o) {
    var k = o.kind.split(':')[0];
    if (G.isBuilding(o.kind)) { var w = G.size(o).w; return [o.vx - w / 2 + 2, o.vy - (k === 'bm' ? 8 : 26), o.vx + w / 2 - 2, o.vy - 2]; }
    if (SOLID.test(k)) return [o.vx - 1, o.vy - 4, o.vx + 1, o.vy - 1];
    return null;
  };
  G.door = function (o) { return [o.vx, o.vy + 7]; };

  // ---- Aktionen → Welt ------------------------------------------------------------------------------------------
  function bedsFor(a) { var out = [], y; for (y = a.y0 + 7; y + 9 < a.y1 - 5; y += 14) out.push([a.x0 + 8, y, a.x1 - a.x0 - 16, 9]); return out; }
  G.bedsFor = bedsFor;
  /** Welt aus Basis + Aktionen. `draftFrom`: Aktionen ab diesem Index der Liste gelten als Entwurf (Schleier). */
  G.build = function (withDraft) {
    var acts = G.committed.map(function (a) { return { a: a, d: false }; }).concat(withDraft ? G.draft.map(function (a) { return { a: a, d: true }; }) : []);
    var dead = {}; acts.forEach(function (x) { if (x.a.t === 'del') dead[x.a.target] = x.a; });
    var E = { V: Object.assign({}, V0, { paths: [], pads: V0.pads.slice(), beds: V0.beds.slice() }), lakes: [], gardens: [], objs: [], items: [], pathDraft: [] };
    V0.paths.forEach(function (p, i) { if (!dead['p' + i]) E.V.paths.push(p); });
    if (dead.l0) { E.V.lake = null; E.V.dock = null; }
    if (dead.g0) { E.V.garden = null; E.V.beds = []; }
    var inL = function (o) { var L = V0.lake; return L && Math.pow((o.vx - L.x) / (L.rx + 10), 2) + Math.pow((o.vy - L.y) / (L.ry + 14), 2) < 1; };
    var inG = function (o) { var q = V0.garden; return o.vx >= q.x0 - 2 && o.vx <= q.x1 + 2 && o.vy >= q.y0 - 2 && o.vy <= q.y1 + 12; };
    baseObjs.forEach(function (o) {
      if (dead[o.id]) return;
      if (dead.l0 && /^(boat|reed)$/.test(o.kind) && inL(o)) return;
      if (dead.g0 && /^(fence|post|sun|tomato|scare)$/.test(o.kind) && inG(o)) return;
      E.objs.push(o);
    });
    acts.forEach(function (x) {
      var a = x.a, d = x.d;
      if (a.t === 'del' || dead[a.id]) return;
      var tag = { src: a.id, draft: d };
      if (a.t === 'path') { E.V.paths.push(a.pts); E.items.push(Object.assign({ kind: 'path', a: a }, tag)); }
      else if (a.t === 'lake') { E.lakes.push(Object.assign({}, a, { draft: d })); E.items.push(Object.assign({ kind: 'lake', a: a }, tag)); }
      else if (a.t === 'garden') {
        E.gardens.push(Object.assign({}, a, { draft: d })); E.items.push(Object.assign({ kind: 'garden', a: a }, tag));
        for (var x2 = a.x0; x2 < a.x1 - 4; x2 += 12) { E.objs.push(Object.assign({ id: a.id + 'f' + x2, kind: 'fence', vx: x2 + 7, vy: a.y1, extra: 0 }, tag)); E.objs.push(Object.assign({ id: a.id + 'g' + x2, kind: 'fence', vx: x2 + 7, vy: a.y0, extra: 0 }, tag)); }
        for (var y2 = a.y0 + 8; y2 < a.y1; y2 += 8) { E.objs.push(Object.assign({ id: a.id + 'l' + y2, kind: 'post', vx: a.x0, vy: y2, extra: 0 }, tag)); E.objs.push(Object.assign({ id: a.id + 'r' + y2, kind: 'post', vx: a.x1, vy: y2, extra: 0 }, tag)); }
      }
      else if (a.t === 'house' || a.t === 'deko') {
        var o = Object.assign({ id: a.id, kind: a.kind, vx: a.vx, vy: a.vy, extra: a.extra || 0 }, tag);
        E.objs.push(o); E.items.push(Object.assign({ kind: a.t, a: a, o: o }, tag));
        if (a.t === 'house') { var w = G.size(o).w; E.V.pads.push([a.vx - w / 2 + 3, a.vy - 26, a.vx + w / 2 - 3, a.vy]); E.V.paths.push([[a.vx, a.vy + 3], [a.vx, a.vy + 10]]); }
      }
    });
    E.objs.sort(function (p, q) { return p.vy - q.vy; });
    return E;
  };

  // ---- Boden ----------------------------------------------------------------------------------------------------------
  function gTexel(E, tx, ty) {
    var r = dTexel(E.V, tx, ty), vx = tx - W_OX, vy = ty - W_OY, h = wHash(tx, ty, 2), i, a, b, lv;
    for (i = 0; i < E.lakes.length; i++) {
      var L = E.lakes[i]; a = (vx - L.x) / L.rx; b = (vy - L.y) / L.ry; lv = a * a + b * b + (wNoise(vx * 0.09, vy * 0.09, 7) - 0.5) * 0.45;
      if (lv < 1) { r[1] = 2; r[0] = lv < 0.35 ? WPA.waterDeep : lv < 0.62 ? WPA.water3 : lv < 0.86 ? WPA.water2 : WPA.water1; if (lv > 0.95) r[0] = WPA.foam; }
      else if (lv < 1.13 && r[1] !== 2) { r[1] = 6; r[0] = h < 0.5 ? WPA.path1 : WPA.path2; }
    }
    for (i = 0; i < E.gardens.length; i++) {
      var q = E.gardens[i];
      if ((r[1] === 0 || r[1] === 7 || r[1] === 1) && vx >= q.x0 && vx < q.x1 && vy >= q.y0 && vy < q.y1) {
        r[1] = 0; r[0] = h < 0.5 ? WPA.grass1 : WPA.grassLight;
        bedsFor(q).forEach(function (bd) {
          if (vx >= bd[0] && vx < bd[0] + bd[2] && vy >= bd[1] && vy < bd[1] + bd[3]) { r[1] = 4; r[0] = (vy - bd[1]) % 3 === 0 ? WPA.soil2 : WPA.soil1; if (vx === bd[0] || vx === bd[0] + bd[2] - 1 || vy === bd[1] + bd[3] - 1) r[0] = WPA.wood3; }
        });
      }
    }
    return r;
  }
  var gc = document.createElement('canvas'); gc.width = VW; gc.height = VH;
  /** Boden neu berechnen (Texel für Texel wie im Spiel). Liefert Zeichenfläche und Typen je Texel. */
  G.ground = function (E) {
    var g = gc.getContext('2d'), img = g.createImageData(VW, VH), types = new Uint8Array(VW * VH), x, y;
    for (y = 0; y < VH; y++) for (x = 0; x < VW; x++) {
      var r = gTexel(E, x + X0 + W_OX, y + Y0 + W_OY), o = (y * VW + x) * 4, c = r[0];
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; types[y * VW + x] = r[1];
    }
    g.putImageData(img, 0, 0);
    var out = document.createElement('canvas'); out.width = VW; out.height = VH; out.getContext('2d').drawImage(gc, 0, 0);
    return { canvas: out, types: types };
  };

  // ---- Kacheln, Erreichbarkeit, Prüfung ---------------------------------------------------------------------------------
  var NX = VW / T, NY = VH / T;
  G.tileOf = function (vx, vy) { return [Math.floor((vx - X0) / T), Math.floor((vy - Y0) / T)]; };
  G.tileRect = function (tx, ty) { return [X0 + tx * T, Y0 + ty * T, X0 + (tx + 1) * T, Y0 + (ty + 1) * T]; };
  function blockedGrid(E, ground) {
    var bl = new Uint8Array(NX * NY), tx, ty;
    for (ty = 0; ty < NY; ty++) for (tx = 0; tx < NX; tx++) { var cx = tx * T + 8, cy = ty * T + 8; if (ground.types[cy * VW + cx] === 2) bl[ty * NX + tx] = 1; }
    E.objs.forEach(function (o) {
      var f = G.foot(o); if (!f) return;
      var a = G.tileOf(f[0] + 1, f[1] + 1), b = G.tileOf(f[2] - 1, f[3] - 1);
      for (var y = a[1]; y <= b[1]; y++) for (var x = a[0]; x <= b[0]; x++) if (x >= 0 && y >= 0 && x < NX && y < NY) bl[y * NX + x] = 1;
    });
    return bl;
  }
  G.blocked = blockedGrid;
  function reach(bl, sx, sy) {
    var seen = new Uint8Array(NX * NY), q = [[sx, sy]]; seen[sy * NX + sx] = 1;
    while (q.length) {
      var p = q.pop(), d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) { var x = p[0] + d[i][0], y = p[1] + d[i][1]; if (x < 0 || y < 0 || x >= NX || y >= NY || seen[y * NX + x] || bl[y * NX + x]) continue; seen[y * NX + x] = 1; q.push([x, y]); }
    }
    return seen;
  }
  /** Prüfung wie der Generator: Türen erreichbar, Figuren auf begehbarem Boden; dazu, was für neue Häuser angelegt würde. */
  G.check = function (E, ground) {
    var bl = blockedGrid(E, ground), s = G.tileOf(G.sq.x, G.sq.y + 14), seen = reach(bl, s[0], s[1]), out = [], bad = [];
    E.objs.forEach(function (o) {
      if (!G.isHouse(o.kind)) return;
      var d = G.door(o), t = G.tileOf(d[0], d[1]), ok = [[0, 0], [1, 0], [-1, 0], [0, 1]].some(function (k) { var x = t[0] + k[0], y = t[1] + k[1]; return x >= 0 && y >= 0 && x < NX && y < NY && seen[y * NX + x]; });
      if (!ok) bad.push(G.nameOf(o) + (o.draft ? ' (neu)' : ''));
    });
    out.push({ ok: !bad.length, text: bad.length ? 'Tür nicht erreichbar vom Dorfplatz: ' + bad.join(', ') : 'Alle Haustüren sind vom Dorfplatz aus erreichbar' });
    var stuck = ['alex', 'mira'].filter(function (k) {                          // nur was der Entwurf selbst über eine Figur baut
      var o = E.objs.filter(function (q) { return q.kind === k; })[0]; if (!o) return false;
      var onDraft = E.objs.some(function (q) { var f = q.draft && G.foot(q); return f && o.vx >= f[0] && o.vx <= f[2] && o.vy >= f[1] && o.vy <= f[3]; });
      return onDraft || E.lakes.some(function (L) { return L.draft && Math.pow((o.vx - L.x) / L.rx, 2) + Math.pow((o.vy - L.y) / L.ry, 2) < 1.2; });
    });
    out.push({ ok: !stuck.length, text: stuck.length ? 'Figur steht auf unbegehbarem Boden: ' + stuck.join(', ') : 'Alex und Mira stehen auf begehbarem Boden' });
    var out2 = E.items.filter(function (i) { return i.draft && i.kind === 'house'; });
    out2.forEach(function (i) { out.push({ ok: true, text: G.nameOf(i.o) + ' (neu): Tür, Innenbereich, Räume und Einrichtung werden angelegt' }); });
    E.items.filter(function (i) { return i.draft && i.kind === 'path'; }).forEach(function () { out.push({ ok: true, text: 'Weg (neu): Kacheln werden aus der Form abgeleitet, Bild und Karte stimmen überein' }); });
    return { list: out, ok: out.every(function (c) { return c.ok; }), blocked: bl, seen: seen };
  };

  // ---- Treffer ----------------------------------------------------------------------------------------------------------
  function segD(px, py, a, b) { return wSeg(px, py, a[0], a[1], b[0], b[1]); }
  G.pathDist = function (pts, x, y) { var d = 1e9; for (var i = 0; i < pts.length - 1; i++) d = Math.min(d, segD(x, y, pts[i], pts[i + 1])); return d; };
  /** Was liegt unter dem Zeiger (Dorfkoordinaten)? Objekt, Weg, See oder Garten. */
  G.hit = function (E, x, y) {
    var i, best = null;
    for (i = E.objs.length - 1; i >= 0; i--) {
      var o = E.objs[i];
      if (o.kind === 'alex' || o.kind === 'mira') continue;
      var s = G.size(o);
      if (x >= o.vx - s.w / 2 && x <= o.vx + s.w / 2 && y >= o.vy - s.h && y <= o.vy) {
        var part = o.src && /^(fence|post)$/.test(o.kind);                      // Zaun und Pfähle eines neuen Gartens gehören zum Garten
        return { type: 'obj', o: o, id: part ? o.src : (o.src || o.id), name: part ? 'Garten (neu)' : G.nameOf(o) + (o.draft ? ' (neu)' : '') };
      }
    }
    for (i = E.lakes.length - 1; i >= 0; i--) { var L = E.lakes[i]; if (Math.pow((x - L.x) / L.rx, 2) + Math.pow((y - L.y) / L.ry, 2) < 1) return { type: 'lake', id: L.id, name: 'See (neu)', a: L }; }
    for (i = E.gardens.length - 1; i >= 0; i--) { var q = E.gardens[i]; if (x >= q.x0 && x < q.x1 && y >= q.y0 && y < q.y1) return { type: 'garden', id: q.id, name: 'Garten (neu)', a: q }; }
    var L0 = E.V.lake; if (L0 && Math.pow((x - L0.x) / L0.rx, 2) + Math.pow((y - L0.y) / L0.ry, 2) < 1) return { type: 'lake', id: 'l0', name: 'See' };
    var g0 = E.V.garden; if (g0 && x >= g0.x0 && x < g0.x1 && y >= g0.y0 && y < g0.y1) return { type: 'garden', id: 'g0', name: 'Garten' };
    var bestP = null, bd = 6;
    E.V.paths.forEach(function (p) { var dd = G.pathDist(p, x, y); if (dd < bd) { bd = dd; bestP = p; } });
    if (bestP) {
      var idx = V0.paths.indexOf(bestP), act = E.items.filter(function (it) { return it.kind === 'path' && it.a.pts === bestP; })[0];
      return { type: 'path', id: act ? act.a.id : 'p' + idx, name: act ? 'Weg (neu)' : 'Weg', pts: bestP };
    }
    return null;
  };
  /** Liegt Fläche [x0,y0,x1,y1] auf etwas, das nicht überbaut werden darf? Liefert den Grund oder null. */
  G.overlap = function (E, r, opt) {
    opt = opt || {};
    var i, L;
    for (i = 0; i < E.objs.length; i++) {
      var o = E.objs[i], f = G.foot(o); if (!f || o === opt.self) continue;
      if (r[0] < f[2] && r[2] > f[0] && r[1] < f[3] && r[3] > f[1]) return G.nameOf(o) + (o.draft ? ' (neu)' : '') + ' steht dort';
    }
    var ls = E.lakes.concat(E.V.lake ? [E.V.lake] : []);
    for (i = 0; i < ls.length; i++) { L = ls[i]; var cx = Math.max(r[0], Math.min(L.x, r[2])), cy = Math.max(r[1], Math.min(L.y, r[3])); if (Math.pow((cx - L.x) / L.rx, 2) + Math.pow((cy - L.y) / L.ry, 2) < 1) return opt.water ? null : 'Dort ist Wasser'; }
    var sq = G.sq; if (!opt.path && Math.hypot((Math.max(r[0], Math.min(sq.x, r[2])) - sq.x), (Math.max(r[1], Math.min(sq.y, r[3])) - sq.y) * 1.08) < sq.r - 2) return 'Das ist der Dorfplatz';
    var all = E.gardens.concat(E.V.garden ? [E.V.garden] : []);
    for (i = 0; i < all.length; i++) { var q = all[i]; if (!opt.inGarden && r[0] < q.x1 && r[2] > q.x0 && r[1] < q.y1 && r[3] > q.y0) return 'Dort ist ein Garten'; }
    if (r[0] < X0 + 4 || r[2] > X0 + VW - 4 || r[1] < Y0 + 4 || r[3] > Y0 + VH - 4) return 'Außerhalb des Gebiets';
    return null;
  };
})();
