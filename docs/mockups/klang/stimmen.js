/* Klang-Mockup AP17d: Stimmen der Figuren (Plappern aus Code).
   Ablauf: Text → Sätze und Teilsätze → Wörter → Silben (Anlaut, Vokal, Auslaut) → Satzmelodie → ein durchgehender Klang.
   Eine Stimme ist EIN Oszillator mit drei Formantfiltern (Vokalfarbe) und einem Rauschzweig (s, sch, f, t, k …).
   Alles wird vorab auf der Zeitachse des Audiokontexts geplant; der Text in der Blase läuft synchron mit (Zeitleiste). */
const VOWEL_F = { a: [730, 1100, 2450], e: [470, 1950, 2550], i: [300, 2250, 2950], o: [460, 830, 2700], u: [330, 780, 2250], ä: [620, 1750, 2500], ö: [430, 1450, 2300], ü: [310, 1650, 2200], y: [310, 1650, 2200], '@': [500, 1500, 2450] };
const DIPH = { ei: ['a', 'i'], ai: ['a', 'i'], au: ['a', 'u'], eu: ['o', 'ü'], äu: ['o', 'ü'], ie: ['i'], aa: ['a'], ee: ['e'], oo: ['o'] };
const FUNC = new Set('der die das den dem des ein eine einen einem einer und oder aber ich du er sie es wir ihr mir mich dir dich uns ist bin bist sind war hat hab habe zu zum zur im in an am auf aus mit von vom für bei so wie als dass the a'.split(' '));
const WQ = /^(wer|wen|wem|wie|was|wo|wann|warum|wieso|weshalb|welche[rsnm]?|woher|wohin|wozu)$/;
const NUC = /ei|ai|au|eu|äu|ie|aa|ee|oo|[aeiouyäöü]/g;
/* Klangfarben als Obertonreihen; die Lautheit gleicht loudness() an, egal welche Farbe, Tonhöhe und Größe */
const TIMBRES = { weich: n => Math.pow(n, -1.9), klar: n => 1 / n, rau: n => Math.pow(n, -.75) * (1 + .35 * Math.sin(n * 1.7)), hohl: n => (n % 2 ? 1 / n : 0), piepsig: n => [0, 1, .25, .07][n] || 0 };
const TIMBRE_NAMES = { weich: 'weich', klar: 'klar', rau: 'rau', hohl: 'hohl', piepsig: 'piepsig' };
const STYLE_NAMES = { plappern: 'Plappern (Silben)', summen: 'Summen', piepsen: 'Piepsen (je Buchstabe)' };
const VOICES = {
  Alex: { base: 120, timbre: 'klar', speed: 1, size: 1, lively: .8, breath: .06, vib: 5, style: 'plappern', c: 'var(--alex)', x: .34 },
  Mira: { base: 220, timbre: 'weich', speed: 1.12, size: 1.18, lively: 1.1, breath: .14, vib: 5.5, style: 'plappern', c: 'var(--mira)', x: .62 },
  Jo: { base: 150, timbre: 'rau', speed: .88, size: 1.06, lively: .55, breath: .1, vib: 4, style: 'plappern', c: 'var(--jo)', x: .78 },
};
const waves = {}, loudCache = {}, FQ = [7, 12, 14], FG = [1.1, .75, .35];
/* Erwarteter Pegel einer Stimme: Obertöne der Klangfarbe durch die Filter (Mittel über fünf Vokale), aus dem Frequenzgang berechnet.
   Damit klingen alle Stimmen gleich laut, auch wenn Regler verstellt werden. */
function loudness(v) {
  const key = [v.timbre, Math.round(v.base), v.size.toFixed(2), v.style].join('|'); if (loudCache[key]) return loudCache[key];
  const amp = k => TIMBRES[v.timbre](k), K = [];
  for (let k = 1; k < 48 && k * v.base < 9000; k++) K.push(k);
  let peak = 0; for (let i = 0; i < 512; i++) { const x = 2 * Math.PI * i / 512; let y = 0; for (const k of K) y += amp(k) * Math.sin(k * x); peak = Math.max(peak, Math.abs(y)); }
  const fr = new Float32Array(K.map(k => k * v.base)), mag = new Float32Array(K.length), ph = new Float32Array(K.length);
  const paths = v.style === 'piepsen' ? [['lowpass', 2600, .7, .55, null]] : [...[0, 1, 2].map(i => ['bandpass', null, FQ[i], FG[i] * (v.style === 'summen' ? [1, .35, .1][i] : 1), i]), ['lowpass', v.style === 'summen' ? 700 : 1000, .7, v.style === 'summen' ? .5 : .28, null]];
  let E = 0; const vowels = ['a', 'e', 'i', 'o', 'u'];
  for (const vw of vowels) {
    const re = new Float32Array(K.length), im = new Float32Array(K.length);
    for (const [type, f, q, g, fi] of paths) {
      filt(type, fi === null ? f : VOWEL_F[vw][fi] * v.size * (v.style === 'summen' ? .85 : 1), q).getFrequencyResponse(fr, mag, ph);
      K.forEach((_, j) => { re[j] += g * mag[j] * Math.cos(ph[j]); im[j] += g * mag[j] * Math.sin(ph[j]); });
    }
    K.forEach((k, j) => { E += Math.pow(amp(k) / peak, 2) * (re[j] * re[j] + im[j] * im[j]) / 2; });
  }
  return (loudCache[key] = Math.sqrt(E / vowels.length));
}
const VOICE_LEVEL = .21;
function timbreWave(name) {
  if (!waves[name]) { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = TIMBRES[name](k); waves[name] = ctx.createPeriodicWave(re, im); }
  return waves[name];
}

/* ---------- Text zerlegen ---------- */
function parseText(text) {
  const phrases = []; let cur = { words: [] };
  for (const m of text.matchAll(/[\p{L}\p{N}]+|\.{3}|[.!?…,;:—–]+/gu)) {
    const tok = m[0];
    if (/[\p{L}\p{N}]/u.test(tok)) { cur.words.push({ w: tok.toLowerCase(), s: m.index, e: m.index + tok.length }); continue; }
    if (!cur.words.length) continue;
    cur.end = tok.includes('?') ? '?' : tok.includes('!') ? '!' : /…|\.\.\./.test(tok) ? '…' : tok.includes('.') ? '.' : ',';
    cur.pe = m.index + tok.length; phrases.push(cur); cur = { words: [] };
  }
  if (cur.words.length) { cur.end = '.'; cur.pe = cur.words[cur.words.length - 1].e; phrases.push(cur); }
  return phrases;
}
function syllables(word, off) {
  if (/^\d+$/.test(word)) return [...word].map((_, i) => ({ on: '', v: 'ei', coda: '', s: off + i, e: off + i + 1 }));
  const nucs = [...word.matchAll(NUC)];
  if (!nucs.length) return [{ on: word, v: '@', coda: '', s: off, e: off + word.length, weak: true }];
  const out = [];
  nucs.forEach((n, i) => {
    let on = word.slice(i ? nucs[i - 1].index + nucs[i - 1][0].length : 0, n.index);
    if (i) { const keep = (on.match(/(sch|ch|ck|qu|[^aeiouyäöü])$/) || [''])[0]; out[i - 1].coda = on.slice(0, on.length - keep.length); on = keep; }
    out.push({ on, v: n[0], coda: '', vs: n.index });
  });
  const last = nucs[nucs.length - 1]; out[out.length - 1].coda = word.slice(last.index + last[0].length);
  out.forEach((sy, i) => { sy.s = off + (i ? sy.vs - sy.on.length : 0); sy.e = off + (i < out.length - 1 ? out[i + 1].vs - out[i + 1].on.length : word.length); });
  // Betonung: erste Silbe, nach unbetonter Vorsilbe die zweite; Füllwörter unbetont
  const stressAt = out.length > 1 && /^(be|ge|ver|er|zer|ent|emp)/.test(word) ? 1 : 0;
  out.forEach((sy, i) => { sy.stress = i === stressAt && !FUNC.has(word); sy.func = FUNC.has(word); sy.long = /^(ie|aa|ee|oo)$/.test(sy.v) || sy.coda.startsWith('h') || DIPH[sy.v]; });
  return out;
}
/* Konsonanten in Laute zerlegen: Art (Reibe-, Verschluss-, Nasal-, Fließlaut, Hauch), Filter, Dauer */
function consonants(cl) {
  const segs = [];
  for (const c of cl.match(/sch|ch|ck|ph|qu|ng|ß|./g) || []) {
    if (/^(s|ß|c)$/.test(c)) segs.push({ k: 'fric', f: 6300, q: 1.6, a: .3, d: .065 });
    else if (c === 'z' || c === 'x') segs.push({ k: 'plos', f: 3800, a: .25, d: .012, clo: .025 }, { k: 'fric', f: 6300, q: 1.6, a: .3, d: .05 });
    else if (c === 'sch') segs.push({ k: 'fric', f: 2700, q: 1.3, a: .4, d: .08 });
    else if (c === 'ch') segs.push({ k: 'fric', f: 3900, q: 1, a: .22, d: .06 });
    else if (/^(f|v|ph)$/.test(c)) segs.push({ k: 'fric', f: 7500, q: .7, a: .12, d: .055 });
    else if (c === 'h') segs.push({ k: 'asp', a: .5, d: .04 });
    else if (/^(p|t|k|ck|qu)$/.test(c)) segs.push({ k: 'plos', f: { p: 900, t: 4200, k: 2100, ck: 2100, qu: 2100 }[c], a: .45, d: .018, clo: .035 });
    else if (/^(b|d|g)$/.test(c)) segs.push({ k: 'plos', f: { b: 700, d: 3200, g: 1700 }[c], a: .2, d: .01, clo: .022, voiced: true });
    else if (/^(m|n|ng)$/.test(c)) segs.push({ k: 'son', F: [260, 1050, 2300], a: .5, d: .05 });
    else if (/^(l|r|w|j)$/.test(c)) segs.push({ k: 'son', F: c === 'j' ? [300, 2100, 2900] : c === 'l' ? [360, 1300, 2600] : [420, 1200, 2400], a: .55, d: .04, roll: c === 'r' });
  }
  return segs;
}

/* ---------- Satzmelodie und Zeitplan ---------- */
function plan(text, v) {
  const rnd = seeded(text + '|' + v.base), out = [], L = v.lively, MAX = 36;
  for (const ph of parseText(text)) {
    const syl = []; ph.words.forEach((w, wi) => syllables(w.w, w.s).forEach(sy => syl.push(Object.assign(sy, { wi, first: wi === 0 }))));
    const n = syl.length, wq = WQ.test(ph.words[0].w), lastStress = syl.reduce((a, s, i) => (s.stress ? i : a), n - 1);
    const lift = ph.end === '!' ? 2 : 0, wide = ph.end === '!' ? 1.4 : 1;
    syl.forEach((sy, i) => {
      if (out.length >= MAX) { out.truncated = true; return; }
      let st = lift + L * (1.6 - 3.2 * i / Math.max(1, n - 1)) + (rnd() - .5) * .6;
      if (sy.stress) st += L * wide * (2 + rnd() * 1.5);
      if (sy.func) st -= .8 * L;
      if (wq && sy.first && sy.stress) st += 2.5 * L;
      const tail = i - (n - 3);
      if (ph.end === '?' && !wq && tail >= 0) st += L * (2.5 + 2.5 * tail);
      else if (ph.end === ',' && i === n - 1) st += 1.6 * L;
      else if ((ph.end === '.' || ph.end === '!' || wq) && i > lastStress) st -= L * (2 + 1.5 * (i - lastStress));
      else if (ph.end === '…' && i === n - 1) st -= 1.5 * L;
      let dur = .1 * (sy.stress ? 1.3 : sy.func ? .75 : 1) * (sy.long ? 1.2 : 1) * (i === n - 1 ? 1.45 : 1) * (ph.end === '…' && i === n - 1 ? 1.4 : 1);
      out.push({ ...sy, st, dur: dur / v.speed, amp: (sy.stress ? 1 : .72) * (ph.end === '!' ? 1.12 : 1), wordStart: sy.s === ph.words[sy.wi].s, end: i === n - 1 ? ph.end : null, pe: ph.pe });
    });
    // sehr lange Texte: nach MAX Silben verklingt die Stimme, die Blase zeigt trotzdem alles
    if (out.truncated) { const l = out[out.length - 1]; l.end = '…'; l.pe = text.length; break; }
  }
  return out;
}

/* ---------- Sprechen ---------- */
const speaking = {};
function speak(name, text, { x, onDone } = {}) {
  const v = VOICES[name]; if (!v || !ctx) return null;
  if (speaking[name]) speaking[name].stop();
  const syl = plan(text, v); if (!syl.length) return null;
  const t0 = now() + .04, size = v.size, style = v.style, timeline = [];
  // Klangweg aufbauen
  const src = ctx.createOscillator(); src.setPeriodicWave(timbreWave(v.timbre)); src.frequency.value = v.base;
  const vib = osc('sine', v.vib), vibG = gain(18); chain(vib, vibG, src.detune);
  const drift = osc('sine', .7 + Math.random() * .4), driftG = gain(9); chain(drift, driftG, src.detune);
  const vg = gain(0), ng = gain(0), ag = gain(0), formIn = gain(1), sum = gain(1), outG = gain(Math.min(8, VOICE_LEVEL * (style === 'piepsen' ? 1.35 : 1) / loudness(v)));
  const noiseSrc = noise('white', { loop: true, at: t0 }), nf = filt('bandpass', 5000, 1.5), af = gain(1);
  src.connect(vg); noiseSrc.connect(nf); nf.connect(ng); ng.connect(sum); noiseSrc.connect(af); af.connect(ag); ag.connect(formIn);
  const F = [0, 1, 2].map(i => filt('bandpass', VOWEL_F.a[i] * size, FQ[i]));
  if (style === 'piepsen') { chain(vg, filt('lowpass', 2600, .7), gain(.55), sum); }
  else {
    vg.connect(formIn);
    F.forEach((f, i) => chain(formIn, f, gain(FG[i] * (style === 'summen' ? [1, .35, .1][i] : 1)), sum));
    chain(formIn, filt('lowpass', style === 'summen' ? 700 : 1000, .7), gain(style === 'summen' ? .5 : .28), sum);
  }
  chain(sum, outG, place(bus.voice, x ?? v.x ?? .5, 0));
  const P = src.frequency, VG = vg.gain, NG = ng.gain, AG = ag.gain;
  const toF = (vowel, t, tc) => { const fs = VOWEL_F[vowel] || VOWEL_F['@']; F.forEach((f, i) => f.frequency.setTargetAtTime(fs[i] * size * (style === 'summen' ? .85 : 1), t, tc)); };
  const breath = (t, amp) => AG.setTargetAtTime(amp * v.breath, t, .015);
  let t = t0; VG.setValueAtTime(0, t0); P.setValueAtTime(v.base, t0);
  const cons = (segs, base, amp) => {
    for (const c of segs) {
      if (style === 'summen') { VG.setTargetAtTime(amp * .45, t, .015); t += .035 / v.speed; continue; }
      if (style === 'piepsen') continue;
      const d = c.d / v.speed;
      if (c.k === 'son') { VG.setTargetAtTime(amp * c.a, t, .012); F.forEach((f, i) => f.frequency.setTargetAtTime(c.F[i] * size, t, .012)); if (c.roll) { VG.setValueCurveAtTime(new Float32Array([amp * .5, amp * .2, amp * .5, amp * .2, amp * .5]), t + .002, d * .9); } t += d; }
      else if (c.k === 'fric') { VG.setTargetAtTime(0, t, .01); nf.frequency.setValueAtTime(c.f, t); nf.Q.setValueAtTime(c.q, t); NG.setTargetAtTime(c.a, t, .008); NG.setTargetAtTime(0, t + d, .01); t += d + .008; }
      else if (c.k === 'plos') { VG.setTargetAtTime(c.voiced ? amp * .12 : 0, t, .006); t += c.clo / v.speed; nf.frequency.setValueAtTime(c.f, t); nf.Q.setValueAtTime(.9, t); NG.setValueAtTime(c.a, t); NG.setTargetAtTime(0, t + .003, d / 3); t += d; }
      else if (c.k === 'asp') { VG.setTargetAtTime(0, t, .01); AG.setTargetAtTime(c.a, t, .01); AG.setTargetAtTime(0, t + d, .01); t += d; }
    }
  };
  syl.forEach((sy, i) => {
    const f = v.base * Math.pow(2, sy.st / 12), amp = .8 * sy.amp;
    if (style === 'piepsen') {
      const letters = text.slice(sy.s, sy.e).replace(/[^\p{L}\p{N}]/gu, ''), step = Math.max(.045, sy.dur / Math.max(1, letters.length)) * .9;
      [...letters].forEach((ch, li) => {
        const isV = /[aeiouyäöüAEIOUYÄÖÜ]/.test(ch), lf = f * Math.pow(2, ((ch.charCodeAt(0) % 5) * (isV ? 2 : 1) - 2) / 12) * (isV ? 1 : .84);
        P.setValueAtTime(lf, t); VG.setValueAtTime(0, t); VG.linearRampToValueAtTime(amp * (isV ? 1 : .55), t + .006); VG.setTargetAtTime(0, t + step * .65, .01);
        timeline.push([t, sy.s + Math.min(li + 1, sy.e - sy.s)]); t += step;
      });
    } else {
      if (sy.wordStart && !sy.on && i) { VG.setTargetAtTime(amp * .08, t, .006); t += .025 / v.speed; } // Stimmeinsatz vor Vokal am Wortanfang
      P.setTargetAtTime(f, t, .03);
      timeline.push([t, sy.e]);
      cons(consonants(sy.on), f, amp);
      const vt = t, [v1, v2] = DIPH[sy.v] || [sy.v];
      VG.setTargetAtTime(amp, t, .014); toF(v1, t, .016); breath(t, 1);
      if (v2) toF(v2, t + sy.dur * .45, .04);
      if (sy.end === '?' && i === syl.length - 1) P.setTargetAtTime(f * 1.12, vt + sy.dur * .3, sy.dur * .4);
      else if (sy.end && sy.end !== ',' && i === syl.length - 1) P.setTargetAtTime(f * .9, vt + sy.dur * .3, sy.dur * .5);
      t += sy.dur;
      cons(consonants(sy.coda), f, amp * .8);
      breath(t, .3);
    }
    if (sy.end) {
      timeline.push([t, sy.pe]);
      VG.setTargetAtTime(0, t, sy.end === '…' ? .08 : .03); NG.setTargetAtTime(0, t, .01); AG.setTargetAtTime(0, t, .02);
      t += ({ ',': .14, '.': .26, '!': .26, '?': .28, '…': .42 })[sy.end] / Math.sqrt(v.speed);
    }
  });
  VG.setTargetAtTime(0, t, .02); NG.setTargetAtTime(0, t, .01);
  const end = t + .1;
  [src, vib, drift].forEach(o => { o.start(t0); o.stop(end + .1); }); noiseSrc.stop(end + .1);
  duckFor(end - now());
  const h = {
    name, text, t0, end, timeline, truncated: !!syl.truncated,
    stop() { if (h.done) return; h.done = true; clearTimeout(h.timer); const s = now(); outG.gain.setTargetAtTime(0, s, .015); [src, vib, drift, noiseSrc].forEach(o => { try { o.stop(s + .1); } catch (e) {} }); if (speaking[name] === h) delete speaking[name]; },
  };
  h.timer = setTimeout(() => { h.done = true; if (speaking[name] === h) delete speaking[name]; onDone && onDone(); }, (end - now()) * 1000);
  speaking[name] = h;
  return h;
}
function stopAllVoices() { Object.values(speaking).forEach(h => h.stop()); }

/* Text in der Blase läuft mit der Stimme mit: zeigt jeweils bis zum Ende der Silbe, die gerade klingt */
function typeAlong(el, h) {
  if (!h) return; const full = h.text; el.textContent = ''; el.classList.add('talking'); el._h = h;
  (function frame() {
    if (el._h !== h) return; // eine neuere Äußerung hat die Blase übernommen
    if (h.done) { el.textContent = full; el.classList.remove('talking'); return; }
    let upto = 0; for (const [t, e] of h.timeline) if (t <= now()) upto = e; else break;
    el.textContent = full.slice(0, upto); requestAnimationFrame(frame);
  })();
}
