// Pixel-Sprites und Icons des Mockups. Alles wird aus Zeichenketten erzeugt: keine Bilddateien, eine Palette.
function gridCanvas(rows, pal, scale = 1) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale; c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x * scale, y * scale, scale, scale); } }));
  return c;
}

// Figur 12 x 17 Pixel, frontal. k Kontur, h Haar, H Haarglanz, s Haut, e Auge, b/B Oberteil hell/dunkel, p Hose, o Schuh
const BODY = [
  '...kkkkkk...', '..khhhhhhk..', '..khHHhhhk..', '..khsssshk..', '..ksessesk..', '..kssssssk..',
  '...kssssk...', '..kbbbbbbk..', '.kbbbbbbbbk.', '.ksbbbbbbsk.', '.ksbBBBBbsk.', '..kbbbbbbk..',
  '..kppppppk..', '..kppkkppk..', '..kpp..ppk..', '..koo..ook..', '..kkk..kkk..',
];
const LEGS_B = ['..kppkkppk..', '..kppk.ppk..', '..kook.ook..', '...kk..kkk..'];

const CHARS = {
  alex: {
    pal: { k: '#2a1d18', h: '#5b3a24', H: '#7d5334', s: '#e8b98f', e: '#2a1d18', b: '#e0a458', B: '#b57d34', p: '#4a5568', o: '#3a2a20' },
    mods: { 5: '..kshhhhsk..', 6: '...khhhhk...' },              // Bart
  },
  mira: {
    pal: { k: '#25212e', h: '#3a3350', H: '#5a5078', s: '#f0c8a0', e: '#25212e', b: '#8fb996', B: '#5f8a6a', p: '#6b4f3a', o: '#3a2a20' },
    mods: { 0: '...khhhhk...', 3: '.hkhsssshkh.', 4: '.hksessesk' + 'h.', 5: '.hkssssssk' + 'h.', 6: '.h.kssssk.h.' }, // langes Haar
  },
};

function charSprite(who, frame = 0) {
  const c = CHARS[who], rows = BODY.slice();
  Object.entries(c.mods).forEach(([i, r]) => { rows[i] = r; });
  if (frame === 1) LEGS_B.forEach((r, i) => { rows[13 + i] = r; });
  return gridCanvas(rows, c.pal, 1);
}

function portrait(who, size = 44) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = who === 'alex' ? '#2a2318' : '#1c2a22'; g.fillRect(0, 0, size, size);
  const rows = BODY.slice(0, 11), pal = CHARS[who].pal;
  Object.entries(CHARS[who].mods).forEach(([i, r]) => { if (i < 11) rows[i] = r; });
  const s = Math.floor(size / 13);
  g.drawImage(gridCanvas(rows, pal, s), Math.floor((size - 12 * s) / 2), 2);
  return c;
}

// Icons 8 x 8, einfarbig; werden als Maske eingesetzt und nehmen die Textfarbe an
const ICONS = {
  hammer: ['..####..', '..#####.', '..####..', '...##...', '...##...', '...##...', '...##...', '...##...'],
  go:     ['..#.....', '..##....', '..###...', '..####..', '..###...', '..##....', '..#.....', '........'],
  chat:   ['.######.', '########', '########', '########', '.######.', '..##....', '.#......', '........'],
  plan:   ['...##...', '..####..', '.######.', '########', '.######.', '..####..', '...##...', '........'],
  leaf:   ['....####', '..######', '.#######', '.#####.#', '..###.#.', '..#..#..', '.#......', '#.......'],
  moon:   ['..####..', '.##.....', '##......', '##......', '##......', '.##....#', '..#####.', '........'],
  sun:    ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
  rain:   ['..###...', '.#####.#', '########', '########', '.#.#.#..', '#.#.#.#.', '.#.#.#..', '........'],
  ok:     ['......#.', '.....##.', '#...##..', '##.##...', '.###....', '..#.....', '........', '........'],
  no:     ['#......#', '.#....#.', '..#..#..', '...##...', '...##...', '..#..#..', '.#....#.', '#......#'],
  link:   ['.##..##.', '#..##..#', '#......#', '.##..##.', '........', '........', '........', '........'],
};
function iconURL(name) { return gridCanvas(ICONS[name], { '#': '#fff' }, 1).toDataURL(); }

function initPixelUI() {
  document.querySelectorAll('[data-ic]').forEach(el => {
    el.classList.add('ic'); el.style.setProperty('--m', `url(${iconURL(el.dataset.ic)})`);
  });
  document.querySelectorAll('canvas[data-who]').forEach(cv => {
    cv.replaceWith(Object.assign(portrait(cv.dataset.who, +cv.dataset.size || 44), { className: cv.className }));
  });
}
