/* Klang-Mockup AP17d: Reiter Einzelklänge, Stimmen, Musik */

/* ---------- Einzelklänge ---------- */
const running = {};
function einzelStop() { for (const k in running) { running[k].stop(); delete running[k]; } $$('#grid button.on').forEach(b => b.classList.remove('on')); }
const steps4 = (fn, surf) => () => { let k = 0; const iv = setInterval(() => { fn(bus.fig, surf); if (++k >= 4) clearInterval(iv); }, 430); };
const ONE = [ // Name, Code, CC0, Herkunft
  ['4 Schritte auf Gras', steps4(SFX.step, 'gras'), steps4(CC0.step, 'gras'), 'Kenney Impact Sounds'],
  ['4 Schritte auf Holz', steps4(SFX.step, 'holz'), steps4(CC0.step, 'holz'), 'Kenney Impact Sounds'],
  ['4 Schritte auf Stein', steps4(SFX.step, 'stein'), steps4(CC0.step, 'stein'), 'Kenney Impact Sounds'],
  ['Tür öffnen', () => SFX.door(bus.fig, true), () => CC0.door(bus.fig, true), 'Kenney RPG Audio'],
  ['Tür schließen', () => SFX.door(bus.fig, false), () => CC0.door(bus.fig, false), 'Kenney RPG Audio'],
  ['Topf und Braten', () => SFX.pot(), () => CC0.pot(bus.fig), 'Kenney RPG Audio'],
  ['Münzen', () => SFX.coins(), () => CC0.coins(bus.fig), 'Kenney RPG Audio'],
  ['Holz hacken', () => SFX.chop(), () => CC0.chop(bus.fig), 'Kenney RPG Audio'],
  ['Buch blättern', () => SFX.book(), () => CC0.book(bus.fig), 'Kenney RPG Audio'],
  ['Tuch, Bettdecke', () => SFX.cloth(), () => CC0.cloth(bus.fig), 'Kenney RPG Audio'],
  ['Schloss', () => SFX.latch(), () => CC0.latch(bus.fig), 'Kenney RPG Audio'],
  ['Gießkanne', () => SFX.pour(), null, 'nur aus Code'],
  ['Schlafen', () => SFX.snore(), null, 'nur aus Code'],
];
const LOOPS = [
  ['Regen', () => AMB.rain(), () => cc0Loop('regen'), 'Ylmir, Rain (loopable)'],
  ['Vögel am Morgen', () => AMB.birds(bus.amb, 1.6, { dove: true }), () => cc0Loop('voegel'), 'Spring Spring, Birds and Wind (mit Wind)'],
  ['Wind', () => AMB.wind(), null, 'CC0 nur zusammen mit Vögeln'],
  ['Bach', () => AMB.water(), () => cc0Loop('wasser'), 'rubberduck, 30 CC0 SFX loops'],
  ['Feuer im Kamin', () => AMB.fire(), null, 'in CC0 nicht vorhanden'],
  ['Nacht: Grillen und Eule', () => { const a = AMB.crickets(), b = AMB.owl(); return { stop() { a.stop(); b.stop(); } }; }, null, 'nur aus Code'],
  ['Mittag: Bienen', () => AMB.bees(), null, 'nur aus Code'],
  ['Gewitter in der Ferne', () => AMB.thunder(), null, 'nur aus Code; erstes Grollen nach ~6 s'],
];
function buildGrid() {
  const card = (it, i, kind) => `<div class="snd"><b>${it[0]}</b><div class="btns"><button data-k="${kind}" data-i="${i}" data-s="code">▶ Code</button><button data-k="${kind}" data-i="${i}" data-s="cc0" ${it[2] ? '' : 'disabled'}>▶ CC0</button></div><div class="src">${it[3]}</div></div>`;
  $('#grid').innerHTML = ONE.map((it, i) => card(it, i, 'one')).join('');
  $('#grid2').innerHTML = LOOPS.map((it, i) => card(it, i, 'loop')).join('');
  $$('#grid button, #grid2 button').forEach(b => b.onclick = () => {
    const list = b.dataset.k === 'one' ? ONE : LOOPS, it = list[+b.dataset.i], fn = b.dataset.s === 'code' ? it[1] : it[2];
    if (b.dataset.k === 'one') { fn(); return; }
    const key = b.dataset.i + b.dataset.s; if (running[key]) { running[key].stop(); delete running[key]; b.classList.remove('on'); return; }
    const h = fn(); running[key] = h; b.classList.add('on');
    setTimeout(() => { if (running[key] === h) { h.stop(); delete running[key]; b.classList.remove('on'); } }, 15000);
  });
}

/* ---------- Stimmen ---------- */
const SAMPLES = [
  ['Aussage', 'Ich gehe jetzt zum Brunnen und hole Wasser.'],
  ['Ja/Nein-Frage', 'Kommst du heute Abend zum Essen?'],
  ['W-Frage', 'Wo hast du die Schaufel hingelegt?'],
  ['Ausruf', 'Das ist ja großartig!'],
  ['Aufzählung', 'Wir brauchen Mehl, Eier, Milch und ein bisschen Zucker.'],
  ['Zögern', 'Hm… ich weiß nicht so recht…'],
  ['Langer KI-Text', 'Ich habe heute Morgen lange über unser Gespräch von gestern nachgedacht. Vielleicht sollten wir den Garten gemeinsam neu anlegen, mit mehr Tomaten und weniger Kartoffeln. Was meinst du dazu? Wir könnten gleich nach dem Mittagessen anfangen, wenn das Wetter hält. Ich bringe die Samen mit.'],
];
const TALK = [['Alex', 'Guten Morgen! Hat jemand den Hahn gehört?'], ['Mira', 'Ja, um fünf Uhr schon… viel zu früh.'], ['Jo', 'Ich war längst wach. Die Beete brauchen Wasser.'], ['Alex', 'Soll ich dir helfen, Jo?'], ['Jo', 'Gern! Nimm die zweite Kanne.']];
const SLIDERS = [['base', 'Tonhöhe', 80, 330, 1, v => v + ' Hz'], ['speed', 'Tempo', 60, 160, 100, v => v + ' %'], ['size', 'Größe', 80, 135, 100, v => (v < 100 ? 'kleiner ' : v > 100 ? 'größer ' : '') + v + ' %'], ['lively', 'Lebhaft', 0, 200, 100, v => v + ' %'], ['breath', 'Hauch', 0, 40, 100, v => v + ' %']];
function info(h) { $('#vinfo').textContent = h ? `${h.name}: ${(h.end - h.t0).toFixed(1)} s, ${h.timeline.length} Schritte${h.truncated ? ' · gekürzt: die Stimme verklingt nach 36 Silben, die Blase zeigt den ganzen Text' : ''}` : ''; }
function sayOne(name, text = $('#said').value) {
  dialog.cur = null; const h = speak(name, text);
  if (h) { typeAlong($('#say-' + name), h); info(h); }
}
function buildVoices() {
  $('#stage').innerHTML = Object.entries(VOICES).map(([n, v]) => `<div class="fig" style="--c:${v.c}"><div class="say" id="say-${n}">…</div><div class="who"><b>${n}</b><button data-say="${n}">▶ sprechen</button></div></div>`).join('');
  $$('[data-say]').forEach(b => b.onclick = () => sayOne(b.dataset.say));
  $('#samples').innerHTML = SAMPLES.map(([l], i) => `<button data-sample="${i}">${l}</button>`).join('');
  $$('[data-sample]').forEach(b => b.onclick = () => { $('#said').value = SAMPLES[+b.dataset.sample][1]; sayOne(pick(Object.keys(VOICES))); });
  $('#said').onkeydown = e => { if (e.key === 'Enter') sayOne('Alex'); };
  $('#talk').onclick = () => { stopAllVoices(); Object.keys(VOICES).forEach(n => { $('#say-' + n).textContent = '…'; }); dialog(TALK, { bubble: w => $('#say-' + w) }); };
  $('#vstop').onclick = () => { dialog.cur = null; stopAllVoices(); };
  $('#vset').innerHTML = Object.entries(VOICES).map(([n, v]) => `<div class="vrow" style="--c:${v.c}"><b>${n}</b>` +
    SLIDERS.map(([p, l, a, b, k, fmt]) => `<label>${l}<input type="range" min="${a}" max="${b}" value="${Math.round(v[p] * k)}" data-n="${n}" data-p="${p}" data-k="${k}"><small>${fmt(Math.round(v[p] * k))}</small></label>`).join('') +
    `<label>Klang<select data-n="${n}" data-p="timbre">${Object.entries(TIMBRE_NAMES).map(([k, l]) => `<option value="${k}" ${k === v.timbre ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` +
    `<label>Art<select data-n="${n}" data-p="style">${Object.entries(STYLE_NAMES).map(([k, l]) => `<option value="${k}" ${k === v.style ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`).join('');
  $$('#vset [data-p]').forEach(el => {
    const fmt = (SLIDERS.find(s => s[0] === el.dataset.p) || [])[5];
    el.oninput = () => { const v = VOICES[el.dataset.n]; v[el.dataset.p] = el.tagName === 'SELECT' ? el.value : el.value / +el.dataset.k; if (fmt) el.nextElementSibling.textContent = fmt(+el.value); };
    el.onchange = () => sayOne(el.dataset.n); // nach dem Loslassen sofort anhören
  });
}

/* ---------- Musik ---------- */
function buildMusic() {
  $('#mcode').innerHTML = Object.keys(MUS).map(k => `<button data-k="${k}">▶ ${k[0].toUpperCase() + k.slice(1)}</button>`).join('');
  $('#mcc0').innerHTML = Object.keys(CC0_MUSIC).map(k => `<button data-k="${k}">▶ ${k[0].toUpperCase() + k.slice(1)}</button>`).join('') + '<button disabled>Nacht –</button>';
  const play = (k, s, b) => { $$('#mcode button, #mcc0 button').forEach(x => x.classList.toggle('on', x === b)); $('#mnow').textContent = 'Läuft: ' + playMusic(k, s, $('#mrain').checked); };
  $$('#mcode button').forEach(b => b.onclick = () => play(b.dataset.k, 'code', b));
  $$('#mcc0 [data-k]').forEach(b => b.onclick = () => play(b.dataset.k, 'cc0', b));
  $('#mrain').onchange = () => { const b = $('#mcode button.on, #mcc0 button.on'); if (b) b.click(); };
  $('#mstop').onclick = () => { stopMusic(); $$('#mcode button, #mcc0 button').forEach(x => x.classList.remove('on')); };
  setInterval(() => { const el = $('#mbar'); el.textContent = music && state.tab === 'musik' ? `Takt ${music.bar} von 8 · Form A A′ B A″` : ''; }, 250);
}
