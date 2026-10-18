/* Klang-Mockup AP17d: CC0-Aufnahmen, lebendes Dorf, Reiter */
const buffers = {};
async function loadAll() { for (const [k, uri] of Object.entries(ASSETS)) buffers[k] = await ctx.decodeAudioData(await (await fetch(uri)).arrayBuffer()); }
function playBuf(key, { out = bus.fig, loop = false, rate = 1, gain: gv = 1 } = {}) {
  const b = buffers[key]; if (!b) return null; const s = ctx.createBufferSource(), g = gain(gv); s.buffer = b; s.loop = loop; s.playbackRate.value = rate; chain(s, g, out); s.start(now());
  return { stop() { g.gain.setTargetAtTime(0, now(), .1); setTimeout(() => { try { s.stop(); } catch (e) {} g.disconnect(); }, 500); } };
}
const STEP_KEY = { gras: 'grass', holz: 'wood', stein: 'concrete' };
const CC0 = {
  step: (d, s) => playBuf(`step_${STEP_KEY[s]}_00${pick([0, 3])}`, { out: d, rate: R(.92, 1.08), gain: { gras: 1.1, holz: .75, stein: 1.1 }[s] }),
  door: (d, open) => playBuf(open ? 'rpg_doorOpen_1' : 'rpg_doorClose_2', { out: d, rate: R(.97, 1.03), gain: open ? .45 : .8 }),
  pot: d => playBuf('rpg_metalPot1', { out: d, gain: .6 }), coins: d => playBuf('rpg_handleCoins', { out: d, gain: .9 }),
  chop: d => playBuf('rpg_chop', { out: d, gain: .45 }), book: d => playBuf('rpg_bookFlip2', { out: d, gain: 1.4 }),
  cloth: d => playBuf('rpg_cloth2', { out: d, gain: .8 }), latch: d => playBuf('rpg_metalLatch', { out: d, gain: .7 }),
};
const CC0_AMB = { regen: ['amb_regen', 1.8], voegel: ['amb_voegel_wind', 3.5], wasser: ['amb_wasser', 5] };
const cc0Loop = (k, rate = 1, g = 1) => playBuf(CC0_AMB[k][0], { out: bus.amb, loop: true, gain: CC0_AMB[k][1] * g, rate });

/* ---------- Lebendes Dorf ---------- */
const FIG = { Alex: { x: .34, d: .15 }, Mira: { x: .62, d: .3 }, Jo: { x: .78, d: .5 } };
const state = { tod: 'mittag', wx: 'klar', ambient: [], cc0Music: null, live: true, liveT: 0, tab: 'dorf' };
function log(text, kind) { const c = document.createElement('span'); c.className = 'chip ' + kind; c.textContent = text; const l = $('#log'); l.prepend(c); while (l.children.length > 9) l.lastChild.remove(); }
/* Geräusch an einem Ort; ohne CC0-Gegenstück immer aus Code */
function fx(name, at, arg) {
  const dest = place(bus.fig, at.x, at.d), useCC0 = src.fig === 'cc0' && CC0[name];
  (useCC0 ? CC0 : SFX)[name](dest, arg); return useCC0 ? 'cc0' : 'code';
}
const DIALOGS = [
  [['Alex', 'Guten Morgen, Mira! Hast du gut geschlafen?'], ['Mira', 'Ja, danke. Ich mache gleich Frühstück.']],
  [['Jo', 'Die Beete brauchen heute Wasser.'], ['Alex', 'Soll ich dir helfen?'], ['Jo', 'Gern, nimm die zweite Kanne.']],
  [['Mira', 'Wer hat das Buch auf der Bank liegen lassen?'], ['Jo', 'Das war ich… tut mir leid.']],
  [['Alex', 'Hast du die Münzen gezählt?'], ['Mira', 'Zwölf! Das reicht für Mehl und Eier.']],
];
function bubbleFor(who, host) {
  const sign = $('#s' + who), b = document.createElement('div'); b.className = 'bubble'; b.style.left = sign.offsetLeft + 'px'; b.style.top = (sign.offsetTop - 6) + 'px'; host.append(b); return b;
}
function dialog(lines, { host, bubble, gap = .35, onEnd } = {}) {
  const token = {}; dialog.cur = token; let i = 0;
  (function nextLine() {
    if (dialog.cur !== token || i >= lines.length) { if (dialog.cur === token) dialog.cur = null; onEnd && onEnd(); return; }
    const [who, text] = lines[i++], b = bubble(who);
    const h = speak(who, text, { x: (FIG[who] || {}).x, onDone: () => { setTimeout(() => { if (host) b.remove(); nextLine(); }, gap * 1000 + (host ? 500 : 0)); } });
    typeAlong(b, h);
  })();
  return token;
}
function event(kind) {
  const n = state.tod === 'nacht';
  if (kind === 'steps') { const who = pick(['Alex', 'Mira', 'Jo']), surf = pick(['gras', 'holz', 'stein']), at = { ...FIG[who] }; let k = 0, s;
    const iv = setInterval(() => { at.x += .015; s = fx('step', at, surf); if (k === 0) log(`${who} geht über ${surf}`, s); if (++k >= 7) clearInterval(iv); }, n ? 520 : 420); }
  else if (kind === 'door') { log('Tür geht auf und zu', fx('door', { x: .5, d: .3 }, true)); setTimeout(() => fx('door', { x: .5, d: .3 }, false), 1300); }
  else if (kind === 'cook') log('Mira kocht', fx('pot', FIG.Mira));
  else if (kind === 'coins') log('Alex zählt Münzen', fx('coins', FIG.Alex));
  else if (kind === 'chop') log('Jo hackt Holz', fx('chop', FIG.Jo));
  else if (kind === 'pour') log('Jo gießt die Beete', fx('pour', FIG.Jo));
  else if (kind === 'book') log('Mira blättert im Buch', fx('book', FIG.Mira));
  else if (kind === 'sleep') log('jemand schläft', fx('snore', { x: .5, d: .55 }));
  else if (kind === 'talk') { stopAllVoices(); $$('#world .bubble').forEach(b => b.remove()); const lines = pick(DIALOGS); log(`${[...new Set(lines.map(l => l[0]))].join(' und ')} reden (Stimme aus Code)`, 'code'); dialog(lines, { host: $('#world'), bubble: w => bubbleFor(w, $('#world')) }); }
}
function applyAmbient() {
  state.ambient.forEach(a => a && a.stop()); state.ambient = []; if (!ctx || state.tab !== 'dorf') return;
  const rainy = state.wx === 'regen', tod = state.tod, A = state.ambient;
  if (src.amb === 'code') {
    if (rainy) A.push(AMB.rain(), AMB.wind(bus.amb, 1.2), AMB.thunder(), AMB.water(bus.amb, .7));
    else if (tod === 'morgen') A.push(AMB.birds(bus.amb, 1.6, { dove: true }), AMB.wind(bus.amb, .5), AMB.water());
    else if (tod === 'mittag') A.push(AMB.birds(bus.amb, .9), AMB.bees(), AMB.wind(bus.amb, .6), AMB.water());
    else if (tod === 'abend') A.push(AMB.birds(bus.amb, .35), AMB.crickets(bus.amb, .6), AMB.wind(bus.amb, .5), AMB.water());
    else A.push(AMB.crickets(), AMB.owl(), AMB.wind(bus.amb, .4), AMB.water(bus.amb, .8));
    if (tod === 'abend' || tod === 'nacht') A.push(AMB.fire(bus.amb, rainy ? .5 : .7));
  } else {
    if (rainy) A.push(cc0Loop('regen')); else A.push(cc0Loop('voegel', tod === 'nacht' ? .8 : 1, tod === 'nacht' ? .45 : 1));
    A.push(cc0Loop('wasser'));
  }
}
function stopMusic() { stopCodeMusic(); if (state.cc0Music) { state.cc0Music.stop(); state.cc0Music = null; } $('#mnow').textContent = ''; }
const CC0_MUSIC = { morgen: ['music_morgen', 'A Place I Call Home'], mittag: ['music_mittag', 'Peaceful Days'], abend: ['music_abend', 'Summer Memories'] };
function playMusic(key, from, rain) {
  stopMusic(); musicTone.frequency.setTargetAtTime(rain ? 1900 : 18000, now(), .5);
  if (from === 'code') { const m = startCodeMusic(key, rain); return m.label + ' (Code)'; }
  if (!CC0_MUSIC[key]) return 'Für die Nacht gibt es in diesem CC0-Paket kein Stück (still).';
  state.cc0Music = playBuf(CC0_MUSIC[key][0], { out: bus.music, loop: true, gain: .9 }); return CC0_MUSIC[key][1] + ' (CC0)' + (rain ? ' · bei Regen gedämpft' : '');
}
function applyScene() {
  const w = $('#world'); w.style.backgroundImage = IMGS[{ morgen: 'mittag', mittag: 'mittag', abend: 'abend', nacht: 'nacht' }[state.tod]]; w.classList.toggle('rainy', state.wx === 'regen');
  $('#shade').style.background = state.tod === 'morgen' ? 'rgba(255,200,140,.12)' : state.wx === 'regen' ? 'rgba(40,50,80,.35)' : 'transparent';
  if (!ctx || state.tab !== 'dorf') return;
  applyAmbient(); $('#dnow').textContent = playMusic(state.tod, src.music, state.wx === 'regen');
}
function liveLoop() {
  clearTimeout(state.liveT); if (!state.live || state.tab !== 'dorf') return;
  const kinds = state.tod === 'nacht' ? ['steps', 'door', 'sleep', 'sleep', 'talk', 'book'] : ['steps', 'steps', 'door', 'cook', 'coins', 'talk', 'talk', 'chop', 'pour', 'book'];
  event(pick(dialog.cur ? kinds.filter(k => k !== 'talk') : kinds)); state.liveT = setTimeout(liveLoop, R(3000, 6000));
}
/* Reiterwechsel: Das Dorf schweigt, solange ein anderer Reiter offen ist (sonst hört man die Tests nicht sauber) */
function setTab(tab) {
  const was = state.tab; state.tab = tab;
  $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.v === tab)); $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
  if (!ctx || was === tab) return;
  stopAllVoices(); dialog.cur = null; einzelStop(); stopMusic(); $('#mnow').textContent = '';
  if (tab === 'dorf') { applyScene(); liveLoop(); } else { clearTimeout(state.liveT); applyAmbient(); $$('#world .bubble').forEach(b => b.remove()); }
}

/* ---------- Oberfläche ---------- */
$('#go').onclick = async () => {
  initAudio(); $('#go').textContent = 'lade …'; await loadAll(); $('#gate').classList.add('off');
  runMeter($('#meter i')); buildGrid(); buildVoices(); buildMusic(); applyScene(); liveLoop();
};
$$('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.v));
$$('#tod button').forEach(b => b.onclick = () => { $$('#tod button').forEach(x => x.classList.toggle('on', x === b)); state.tod = b.dataset.t; applyScene(); });
$$('#wx button').forEach(b => b.onclick = () => { $$('#wx button').forEach(x => x.classList.toggle('on', x === b)); state.wx = b.dataset.w; applyScene(); });
$$('[data-ev]').forEach(b => b.onclick = () => event(b.dataset.ev));
$('#live').onclick = () => { state.live = !state.live; $('#live').classList.toggle('on', state.live); $('#live').textContent = state.live ? '▶ Das Dorf lebt' : '■ Das Dorf ruht'; liveLoop(); };
[['vMusic', 'music'], ['vAmb', 'amb'], ['vFig', 'fig'], ['vVoice', 'voice']].forEach(([id, k]) => $('#' + id).oninput = e => { vol[k] = e.target.value / 100; updateVol(); });
$$('.seg[data-ch]').forEach(sg => $$('button', sg).forEach(b => b.onclick = () => {
  $$('button', sg).forEach(x => x.classList.toggle('on', x === b)); src[sg.dataset.ch] = b.dataset.s;
  if (sg.dataset.ch === 'amb') applyAmbient(); if (sg.dataset.ch === 'music' && state.tab === 'dorf') $('#dnow').textContent = playMusic(state.tod, src.music, state.wx === 'regen');
}));
