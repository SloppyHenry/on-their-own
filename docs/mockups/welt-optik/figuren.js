// SIMULACRA Mockup AP13: Figuren 16 × 24 in vier Richtungen mit Stand- und vier Laufbildern, Sitzen, Schlafen, Arbeiten; dazu Möbel als aufrechte Sprites.
// Kein Produktionscode. Rechts ist die gespiegelte linke Ansicht.
var F_LOOK = {
  alex: { hair: '#7a4a2b', hairHi: '#9b6a44', top: '#efa24b', topHi: '#ffc07a', topLo: '#c9802f', legs: '#4f6c9c', legsLo: '#3d5580', shoes: '#5a3a2a', dress: false },
  mira: { hair: '#3d2a3c', hairHi: '#5a4058', top: '#7fc48f', topHi: '#a2dcae', topLo: '#5ea873', legs: WP.skin, legsLo: '#e0a983', shoes: '#c95c6c', dress: true, clip: '#ff9fc2' }
};

// frame: 'stand' | 0..3 (Laufbilder: Kontakt, Durchgang, Kontakt gespiegelt, Durchgang)
function fFigure(who, dir, frame, pose) {
  if (dir === 'right') { var l = fFigure(who, 'left', frame, pose), c = document.createElement('canvas'); c.width = l.width; c.height = l.height; var g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(l, 0, 0); return c; }
  var L = F_LOOK[who], walk = frame !== 'stand', b = walk && (frame === 1 || frame === 3) ? 1 : 0, sit = pose === 'sit';
  return wSprite(16, 24, function (s) {
    var top = 12 - b + (sit ? 3 : 0), side = dir === 'left';
    // Beine
    if (sit) { s.r(4, 20, 3, 2, L.legs); s.r(9, 20, 3, 2, L.legs); s.r(4, 22, 3, 1, L.shoes); s.r(9, 22, 3, 1, L.shoes); }
    else if (!side) {
      var liftL = frame === 2 ? 1 : 0, liftR = frame === 0 ? 1 : 0;
      s.r(5, 19, 2, 3 - liftL, L.legs); s.r(9, 19, 2, 3 - liftR, L.legs);
      s.r(4, 22 - liftL, 3, 1, L.shoes); s.r(9, 22 - liftR, 3, 1, L.shoes);
    } else if (!walk || frame === 1 || frame === 3) { s.r(6, 19, 3, 3, L.legs); s.r(7, 19, 1, 3, L.legsLo); s.r(5, 22, 4, 1, L.shoes); }
    else {
      var fwd = frame === 0 ? L.legs : L.legsLo, back = frame === 0 ? L.legsLo : L.legs;
      s.r(9, 19, 2, 3, back); s.r(10, 22, 2, 1, L.shoes); s.p(9, 21, back);
      s.r(4, 19, 2, 3, fwd); s.r(3, 22, 3, 1, L.shoes); s.p(6, 19, fwd);
    }
    // Körper
    if (L.dress) for (var y = 0; y < 8 - (sit ? 1 : 0); y++) { var hw = (side ? 2.5 : 3) + Math.floor(y / 3); s.r(7.5 - hw + (side ? 0.5 : 0), top + y, hw * 2, 1, y < 2 ? L.top : (y % 3 === 2 ? L.topLo : L.top)); }
    else { s.r(side ? 5 : 4, top, side ? 6 : 8, 7, L.top); s.r(side ? 5 : 4, top, side ? 6 : 8, 1, L.topHi); s.r(side ? 10 : 11, top + 1, 1, 6, L.topLo); }
    // Arme mit Schwung
    var sw = !walk ? 0 : frame === 0 ? 1 : frame === 2 ? -1 : 0;
    if (side) { s.r(7 - sw, top + 1, 2, 4, L.topLo); s.p(7 - sw * 2, top + 5, WP.skin); }
    else { s.r(3, top + 1 + sw, 1, 4, L.topLo); s.p(3, top + 5 + sw, WP.skin); s.r(12, top + 1 - sw, 1, 4, L.topLo); s.p(12, top + 5 - sw, WP.skin); }
    // Kopf
    var hy = 7 - b + (sit ? 3 : 0);
    s.disc(7.5, hy, 5.4, WP.skin);
    if (dir === 'up') { s.disc(7.5, hy, 5.5, L.hair); s.p(6, hy - 4, L.hairHi); if (L.dress) s.r(2, hy - 1, 11, 8, L.hair); }
    else if (side) {
      s.disc(8.5, hy - 1.6, 5.2, L.hair); s.r(9, hy - 2, 4, 6, L.hair); if (L.dress) s.r(9, hy, 4, 7, L.hair);
      s.ell(5.2, hy + 1.6, 3.2, 3.2, WP.skin); s.p(2, hy + 1, WP.skin);
      s.r(4, hy + 1, 1, 2, '#2a1f2b'); s.p(5, hy + 3, '#ffb0a8');
      if (L.clip) s.p(10, hy - 4, L.clip);
    } else {
      s.disc(7.5, hy - 2.4, 5.2, L.hair); s.r(2, hy - 3, 12, 2, L.hair);
      s.ell(7.5, hy + 1.8, 4.3, 3.2, WP.skin);
      if (L.dress) { s.r(2, hy - 3, 2, 9, L.hair); s.r(12, hy - 3, 2, 9, L.hair); } else { s.p(3, hy, L.hair); s.p(12, hy, L.hair); }
      s.p(6, hy - 5, L.hairHi);
      s.r(5, hy + 1, 1, 2, '#2a1f2b'); s.r(10, hy + 1, 1, 2, '#2a1f2b'); s.p(4, hy + 3, '#ffb0a8'); s.p(11, hy + 3, '#ffb0a8');
      if (L.clip) { s.p(11, hy - 5, L.clip); s.p(12, hy - 4, L.clip); }
    }
    s.outline(WP.outline);
  });
}

function fWork(who, frame) {
  var base = fFigure(who, 'left', frame ? 1 : 'stand');
  return wSprite(24, 26, function (s) {
    s.g.drawImage(base, 6, 2);
    var up = frame === 0;
    if (up) { s.r(13, 4, 1, 10, WP.wood2); s.r(10, 2, 5, 3, WP.stone2); s.r(10, 2, 2, 3, WP.stone1); }
    else { s.r(4, 15, 9, 1, WP.wood2); s.r(2, 13, 3, 5, WP.stone2); s.r(2, 13, 1, 5, WP.stone1); }
    s.outline(WP.outline);
  });
}

function fSleeper(who) {
  var L = F_LOOK[who];
  return wSprite(18, 22, function (s) {
    s.r(1, 0, 16, 6, WP.wood2); s.r(2, 1, 14, 4, WP.wood1);
    s.r(1, 5, 16, 14, WP.wood3); s.r(2, 6, 14, 4, '#fffaf0');
    s.disc(8.5, 6, 3.8, L.hair); s.ell(8.5, 8.4, 3, 2.2, WP.skin); s.r(6, 8, 2, 1, '#2a1f2b'); s.r(10, 8, 2, 1, '#2a1f2b');
    s.r(2, 10, 14, 9, who === 'alex' ? '#e9a35f' : '#8fd0a0'); s.r(2, 10, 14, 1, '#fff2d8');
    for (var x = 3; x < 16; x += 4) s.r(x, 12, 1, 6, who === 'alex' ? '#cf8a49' : '#6fb382');
    s.r(1, 19, 2, 3, WP.wood3); s.r(15, 19, 2, 3, WP.wood3);
    s.outline(WP.outline);
  });
}

function hFurniture(kind, owner) {
  var spr = {
    bed: function (s) { s.r(1, 0, 14, 5, WP.wood2); s.r(2, 1, 12, 3, WP.wood1); s.r(1, 5, 14, 12, WP.wood3); s.r(2, 6, 12, 4, '#fffaf0'); s.r(2, 10, 12, 7, owner === 'alex' ? '#e9a35f' : '#8fd0a0'); s.r(2, 10, 12, 1, '#fff2d8'); s.r(1, 17, 2, 2, WP.wood3); s.r(13, 17, 2, 2, WP.wood3); },
    chest: function (s) { s.r(1, 2, 13, 9, WP.wood2); s.r(1, 2, 13, 3, WP.wood1); s.r(1, 5, 13, 1, WP.wood3); s.r(6, 5, 3, 3, WP.fY); },
    desk: function (s) { s.r(0, 3, 16, 4, WP.wood1); s.r(0, 7, 16, 2, WP.wood3); s.r(1, 9, 2, 5, WP.wood3); s.r(13, 9, 2, 5, WP.wood3); s.r(4, 2, 5, 3, '#fffaf0'); s.r(11, 0, 1, 4, '#5c8de0'); },
    workbench: function (s) { s.r(0, 4, 18, 4, '#b98a5a'); s.r(0, 8, 18, 2, WP.wood3); s.r(1, 10, 2, 5, WP.wood3); s.r(15, 10, 2, 5, WP.wood3); s.r(3, 1, 4, 3, WP.stone2); s.r(11, 2, 6, 1, WP.wood2); s.r(14, 0, 2, 3, WP.stone3); },
    stove: function (s) { s.r(1, 2, 13, 13, '#4b4559'); s.r(1, 2, 13, 3, '#6b6478'); s.ell(4.5, 3.5, 2, 1, '#2b2233'); s.ell(10.5, 3.5, 2, 1, '#2b2233'); s.r(3, 7, 9, 6, '#2b2233'); s.r(4, 8, 7, 1, '#ff9a4a'); },
    tap: function (s) { s.r(1, 5, 12, 9, WP.stone1); s.r(1, 5, 12, 2, '#efeae2'); s.r(3, 6, 8, 2, '#86dbf0'); s.r(6, 0, 2, 6, WP.stone3); s.r(6, 0, 4, 1, WP.stone3); },
    sofa: function (s) { s.r(0, 2, 22, 6, '#5d8fb0'); s.r(0, 8, 22, 5, '#4a7896'); s.r(0, 3, 3, 10, '#3e6580'); s.r(19, 3, 3, 10, '#3e6580'); s.r(4, 8, 7, 2, '#79acc9'); s.r(11, 8, 7, 2, '#79acc9'); },
    table: function (s) { s.r(0, 2, 18, 5, WP.wood1); s.r(0, 7, 18, 2, WP.wood3); s.r(1, 9, 2, 5, WP.wood3); s.r(15, 9, 2, 5, WP.wood3); s.ell(9, 3, 2.5, 1.2, WP.fR); },
    bookshelf: function (s) { s.r(0, 0, 16, 24, WP.wood3); s.r(1, 1, 14, 22, WP.wood2); for (var r = 0; r < 3; r++) { s.r(1, 7 + r * 7, 14, 1, WP.wood3); for (var b = 0; b < 6; b++) s.r(2 + b * 2, 2 + r * 7, 2, 5, ['#e05a5a', '#5c8de0', WP.fY, '#7fc48f', '#c27ad8', '#f0e2c4'][(b + r * 2) % 6]); } },
    fireplace: function (s) { s.r(0, 2, 18, 20, WP.stone2); s.r(0, 2, 18, 3, WP.stone3); s.r(4, 9, 10, 13, '#2b2233'); s.r(0, 0, 18, 2, WP.wood2); for (var y = 6; y < 22; y += 4) s.r(0, y, 3, 1, WP.stone3); }
  };
  if (kind === 'well') return wWell();
  if (kind === 'bench') return wBench();
  if (kind === 'board') return wBoard();
  var w = { bed: 16, chest: 15, desk: 16, workbench: 18, stove: 15, tap: 14, sofa: 22, table: 18, bookshelf: 16, fireplace: 18 }[kind] || 12;
  var h = { bed: 19, chest: 12, desk: 14, workbench: 15, stove: 15, tap: 14, sofa: 13, table: 14, bookshelf: 24, fireplace: 22 }[kind] || 12;
  return wSprite(w, h, function (s) { (spr[kind] || function (q) { q.r(1, 1, 10, 10, WP.wood2); })(s); s.outline(WP.outline); });
}

// Figurenbogen: je Figur vier Richtungen × (Stehen + vier Laufbilder), daneben Sitzen, Schlafen, Arbeiten
function fSheet(canvas) {
  var g = canvas.getContext('2d'), S = 4, dirs = [['down', 'vorn'], ['up', 'hinten'], ['left', 'links'], ['right', 'rechts']], frames = ['stand', 0, 1, 2, 3];
  g.fillStyle = '#fff8ec'; g.fillRect(0, 0, canvas.width, canvas.height); g.imageSmoothingEnabled = false;
  g.fillStyle = '#3b2c3d'; g.font = '600 15px ui-rounded, system-ui, sans-serif';
  ['alex', 'mira'].forEach(function (who, k) {
    var ox = 24 + k * 640, oy = 44;
    g.font = '700 18px ui-rounded, system-ui, sans-serif'; g.fillText(who === 'alex' ? 'Alex' : 'Mira', ox, 26); g.font = '600 13px ui-rounded, system-ui, sans-serif';
    ['Stehen', 'Lauf 1', 'Lauf 2', 'Lauf 3', 'Lauf 4'].forEach(function (t, i) { g.fillText(t, ox + 60 + i * 72, oy + 8); });
    dirs.forEach(function (d, r) {
      g.fillText(d[1], ox, oy + 30 + r * 104 + 50);
      frames.forEach(function (f, i) { g.drawImage(fFigure(who, d[0], f), ox + 56 + i * 72, oy + 18 + r * 104, 16 * S, 24 * S); });
    });
    var ex = ox + 56 + 5 * 72 + 12;
    g.fillText('Sitzen', ex, oy + 8); g.drawImage(fFigure(who, 'down', 'stand', 'sit'), ex, oy + 18, 16 * S, 24 * S);
    g.fillText('Schlafen (im Bett)', ex, oy + 130); g.drawImage(fSleeper(who), ex, oy + 140, 18 * S, 22 * S);
    g.fillText('Arbeiten (2 Bilder)', ex, oy + 250 + 6);
    g.drawImage(fWork(who, 0), ex - 20, oy + 262, 24 * S * 0.75, 26 * S * 0.75); g.drawImage(fWork(who, 1), ex + 64, oy + 262, 24 * S * 0.75, 26 * S * 0.75);
  });
}
