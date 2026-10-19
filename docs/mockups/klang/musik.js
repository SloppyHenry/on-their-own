/* Klang-Mockup AP17d: Musik aus Code.
   Statt Zufallstönen ein kleines Stück mit Form: Akkordfolge je Tageszeit, zwei Motive (A und B) in der Form A A' B A'',
   Schlusswendung auf dem Grundton. Bei jedem Durchlauf ändern sich B und Kleinigkeiten in A, das Stück bleibt erkennbar.
   Instrumente: Pulswelle (Melodie, mit Echo), Dreieck (Bass, Gegenstimme), weiche Fläche, Spieluhr, leises Schlagwerk.
   Regen: dieselbe Tageszeit in Moll, etwas langsamer, dumpfer, ohne Schlagzeug. */
const SCALES = { dur: [0, 2, 4, 5, 7, 9, 11], moll: [0, 2, 3, 5, 7, 8, 10], dorisch: [0, 2, 3, 5, 7, 9, 10] };
const MUS = {
  morgen: { name: 'Morgen · C-Dur, 96 bpm', bpm: 96, root: 60, scale: 'dur', prog: [0, 4, 5, 3], lead: 'puls25', drums: 'leicht', pad: true, arp: true },
  mittag: { name: 'Mittag · F-Dur, 108 bpm', bpm: 108, root: 65, scale: 'dur', prog: [0, 3, 1, 4], lead: 'puls50', drums: 'voll', counter: true, walk: true },
  abend: { name: 'Abend · a-Moll, 80 bpm', bpm: 80, root: 57, scale: 'moll', prog: [0, 5, 2, 6], lead: 'dreieck', drums: 'besen', pad: true, swing: .58 },
  nacht: { name: 'Nacht · d-dorisch, 62 bpm', bpm: 62, root: 62, scale: 'dorisch', prog: [0, 3, 0, 6], lead: 'spieluhr', drums: null, pad: true, sparse: true },
};
const RHYTHMS = [ // Positionen in Achteln (0–7) und Längen eines Taktes
  [[0, 2], [2, 1], [3, 1], [4, 3]], [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2]], [[0, 3], [3, 1], [4, 2], [6, 1], [7, 1]],
  [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2]], [[1, 1], [2, 2], [4, 4]], [[0, 1], [1, 1], [2, 1], [3, 1], [4, 4]],
];
const CADENCE = [[0, 2], [2, 2], [4, 4]];
let pulseWaves = {}, music = null;
function pulseWave(duty) {
  if (pulseWaves[duty]) return pulseWaves[duty];
  const n = 40, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return (pulseWaves[duty] = ctx.createPeriodicWave(re, im));
}
/* Motiv: Rhythmus und Kontur (Schritte auf der Tonleiter), Startton ist ein Akkordton */
function makeMotif(rnd, sparse) {
  const rh = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)].filter(() => !sparse || rnd() < .75);
  let p = 0; const contour = rh.map((_, i) => (i === 0 ? 0 : (p += [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd() * 7)])));
  return { rh: rh.length ? rh : [[0, 4]], contour };
}
function vary(m, rnd) { return { rh: m.rh, contour: m.contour.map((c, i) => (i && rnd() < .3 ? c + (rnd() < .5 ? -1 : 1) : c)) }; }

function startCodeMusic(key, rain = false) {
  stopCodeMusic();
  const M = MUS[key], scale = SCALES[rain && M.scale === 'dur' ? 'moll' : M.scale], bpm = M.bpm * (rain ? .92 : 1), eighth = 60 / bpm / 2;
  const rnd = seeded(key + Date.now()), g = gain(0), deg = d => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  g.connect(bus.music); g.gain.setTargetAtTime(.55, now(), .4); send(g, M.sparse ? .7 : .22);
  const echo = gain(M.lead === 'spieluhr' ? .5 : .3); echo.connect(echoIn);
  musicTone.frequency.setTargetAtTime(rain ? 1900 : 18000, now(), .5);
  const A = makeMotif(rnd, M.sparse); let B = makeMotif(rnd, M.sparse), A1 = vary(A, rnd), A2 = vary(A, rnd);
  let bar = 0, next = now() + .15, live = true, timer;
  const voice = (wave, f, t, len, a, { dest = g, att = .008, rel = .08, vib = 0, echoSend = 0 } = {}) => {
    const o = ctx.createOscillator(), og = gain(0);
    if (wave === 'tri') o.type = 'triangle'; else if (wave === 'sine') o.type = 'sine'; else o.setPeriodicWave(pulseWave(wave));
    o.frequency.value = f; chain(o, og, dest); if (echoSend) og.connect(echo);
    if (vib) { const l = osc('sine', 5.2), lg = gain(0); chain(l, lg, o.detune); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + Math.min(len, .5)); l.start(t); l.stop(t + len + rel + .05); }
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + att); og.gain.setTargetAtTime(a * .7, t + att, .12); og.gain.setTargetAtTime(0, t + len, rel / 3);
    o.start(t); o.stop(t + len + rel + .1);
  };
  const bell = (f, t, a) => modes(g, t, f, [1, 2.76, 5.4, 8.93], [1.8, .9, .45, .2], [a, a * .35, a * .12, a * .05], { a: .003 });
  const lead = (f, t, len) => {
    if (rain) len *= 1.1;
    if (M.lead === 'puls25') voice(.25, f, t, len, .1, { vib: 12, echoSend: 1 });
    else if (M.lead === 'puls50') voice(.5, f, t, len, .075, { vib: 10, echoSend: 1 });
    else if (M.lead === 'dreieck') voice('tri', f, t, len, .22, { vib: 18, att: .02, rel: .15, echoSend: 1 });
    else bell(f, t, .12);
  };
  const drum = (kind, t) => {
    if (kind === 'kick') { const o = osc('sine', 120), og = gain(0); chain(o, og, g); o.frequency.exponentialRampToValueAtTime(42, t + .12); env(og, t, .002, .45, .16); o.start(t); o.stop(t + .2); }
    else if (kind === 'snare') { burst(g, t, { f: 1900, q: .7, peak: .12, d: .11 }); burst(g, t, { ft: 'highpass', f: 5000, peak: .05, d: .06 }); }
    else if (kind === 'hat') burst(g, t, { ft: 'highpass', f: 8000, peak: .035, d: .025 });
    else if (kind === 'shaker') burst(g, t, { f: 6500, q: 1.5, a: .02, peak: .03, d: .04 });
    else if (kind === 'besen') burst(g, t, { type: 'pink', f: 3500, q: .6, a: .04, peak: .05, d: .12 });
  };
  const playBar = t0 => {
    const pos = bar % 8, chordDeg = M.prog[bar % M.prog.length], root = M.root - 12 + deg(chordDeg);
    const sw = i => t0 + i * eighth + (M.swing && i % 2 ? (M.swing - .5) * 2 * eighth : 0);
    const chord = [0, 2, 4].map(k => M.root + deg(chordDeg + k));
    // Bass
    if (M.walk) [0, 2, 4, 6].forEach((i, k) => voice('tri', midi(root - 12 + (k === 3 ? deg(chordDeg + 1) - deg(chordDeg) : k === 2 ? 7 : 0)), sw(i), eighth * 1.7, .3));
    else [0, 4].forEach(i => voice('tri', midi(root - 12), sw(i), eighth * (M.sparse ? 7.5 : 3.6), M.sparse ? .22 : .3, { att: .02 }));
    // Fläche
    if (M.pad) chord.forEach(n => { for (const det of [-6, 6]) { const o = osc('triangle', midi(n - 12)), lp = filt('lowpass', rain ? 900 : 1500), og = gain(0); o.detune.value = det; chain(o, lp, og, g); og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(.025, t0 + eighth * 2); og.gain.setValueAtTime(.025, t0 + eighth * 7); og.gain.linearRampToValueAtTime(0, t0 + eighth * 8.6); o.start(t0); o.stop(t0 + eighth * 8.8); } });
    // Begleitung: gebrochene Akkorde
    if (M.arp && !rain) [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => voice(.125, midi(chord[[0, 1, 2, 1][i % 4]] + 12), sw(i), eighth * .5, .035));
    if (M.lead === 'spieluhr') [0, 3, 5].forEach((i, k) => { if (rnd() < .6) bell(midi(chord[k] + 12), sw(i), .05); });
    // Gegenstimme (Mittag): lange Töne der Terz
    if (M.counter) voice('tri', midi(chord[1]), sw(0), eighth * 7, .08, { att: .05, rel: .2 });
    // Melodie: Form A A' B A'', in Takt 4 und 8 die Schlusswendung
    const motif = [A, A1, B, A2][Math.floor(pos / 2)], cad = pos === 3 || pos === 7;
    const rh = cad ? CADENCE : motif.rh;
    const startDeg = chordDeg + (pos % 2 ? 2 : 0) + 7;
    rh.forEach(([i, len], k) => {
      if (M.sparse && rnd() < .3) return;
      let d = startDeg + (cad ? [2, 1, 0][k] ?? 0 : motif.contour[k] ?? 0);
      if (cad && pos === 7 && k === rh.length - 1) d = 7; // Schluss auf dem Grundton
      lead(midi(M.root + deg(d)), sw(i), eighth * len * .92);
    });
    // Schlagwerk
    if (M.drums && !rain) for (let i = 0; i < 8; i++) {
      const s = sw(i);
      if (M.drums === 'voll') { if (i === 0 || i === 4) drum('kick', s); if (i === 2 || i === 6) drum('snare', s); drum('hat', s); }
      else if (M.drums === 'leicht') { if (i === 0) drum('kick', s); drum('shaker', s); }
      else if (M.drums === 'besen') { if (i === 2 || i === 6) drum('besen', s); if (i === 0) drum('kick', s); }
    }
    if (pos === 7) { B = makeMotif(rnd, M.sparse); A1 = vary(A, rnd); A2 = vary(A, rnd); } // nächster Durchlauf: neues B, kleine Änderungen in A
    music.bar = pos + 1; music.chord = chordDeg;
  };
  music = { label: M.name + (rain ? (M.scale === 'dur' ? ' · bei Regen in Moll, gedämpft' : ' · bei Regen langsamer, gedämpft') : ''), bar: 0, stop() { live = false; clearTimeout(timer); g.gain.setTargetAtTime(0, now(), .25); setTimeout(() => g.disconnect(), 1500); } };
  (function sched() {
    if (!live) return;
    while (next < now() + .3) { playBar(next); bar++; next += eighth * 8; }
    timer = setTimeout(sched, 100);
  })();
  return music;
}
function stopCodeMusic() { if (music) { music.stop(); music = null; } }
