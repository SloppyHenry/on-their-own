/* Klang-Mockup AP17d: Grundlagen – Audiokontext, Kanäle, Raum, Rauschen, Bausteine für Klänge */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const R = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const midi = m => 440 * Math.pow(2, (m - 69) / 12);

let ctx, master, bus = {}, duck = {}, musicTone, revIn, echoIn, meter, noiseBuf, pinkBuf, brownBuf;
const vol = { music: .45, amb: .55, fig: .6, voice: .75 }, src = { music: 'code', amb: 'code', fig: 'code' };

/* Gleiches Ergebnis für gleichen Text: kleiner Zufallsgenerator mit Startwert */
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function initAudio() {
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = .9;
  // sanfter Kompressor, dahinter ein harter Begrenzer gegen Übersteuern
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .006; comp.release.value = .25;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .1;
  master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
  meter = ctx.createAnalyser(); meter.fftSize = 1024; lim.connect(meter);

  // Kanäle: jeder mit eigenem Regler und einer Ducking-Stufe (Stimmen machen Musik und Umgebung leiser)
  musicTone = filt('lowpass', 18000, .5);
  for (const k of ['music', 'amb', 'fig', 'voice']) {
    bus[k] = ctx.createGain(); duck[k] = ctx.createGain();
    if (k === 'music') { bus[k].connect(musicTone); musicTone.connect(duck[k]); } else bus[k].connect(duck[k]);
    duck[k].connect(master);
  }
  // Raum: erzeugte Impulsantwort, stereo, mit kurzem Vorlauf und dunklerem Ausklang
  const sr = ctx.sampleRate, len = Math.floor(sr * 2.4), ir = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) { const k = i / len, w = Math.random() * 2 - 1, a = .5 + .45 * k; lp = lp * a + w * (1 - a); d[i] = lp * Math.pow(1 - k, 3) * (i < sr * .012 ? 0 : 1) * 2.2; }
  }
  const rev = ctx.createConvolver(); rev.buffer = ir; revIn = ctx.createGain(); revIn.gain.value = .5;
  const pre = ctx.createDelay(.1); pre.delayTime.value = .018; revIn.connect(pre); pre.connect(rev); rev.connect(master);
  // Echo für Melodien (gedämpft, Rückkopplung)
  echoIn = ctx.createGain(); echoIn.gain.value = 1;
  const dl = ctx.createDelay(1.5), fb = ctx.createGain(), elp = filt('lowpass', 2400, .5), eg = ctx.createGain();
  dl.delayTime.value = .36; fb.gain.value = .32; eg.gain.value = .45;
  echoIn.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(eg); eg.connect(master);
  // Rauschen: weiß, rosa, braun
  const mk = (sec, fn) => { const b = ctx.createBuffer(1, Math.floor(sr * sec), sr), d = b.getChannelData(0); fn(d); return b; };
  noiseBuf = mk(2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  pinkBuf = mk(4, d => { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .25; } });
  brownBuf = mk(4, d => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
  updateVol();
}
function updateVol() {
  if (!ctx) return;
  for (const k of ['music', 'amb', 'fig', 'voice']) bus[k].gain.setTargetAtTime(vol[k], ctx.currentTime, .05);
}
/* Ducking: während jemand spricht, treten Musik und Umgebung etwas zurück */
let duckN = 0;
function duckFor(sec) {
  const t = now(); duckN++;
  duck.music.gain.setTargetAtTime(.5, t, .08); duck.amb.gain.setTargetAtTime(.72, t, .08);
  setTimeout(() => { if (--duckN <= 0) { duckN = 0; const t2 = now(); duck.music.gain.setTargetAtTime(1, t2, .35); duck.amb.gain.setTargetAtTime(1, t2, .35); } }, sec * 1000);
}

const now = () => ctx.currentTime;
function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function gain(v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
function noise(type = 'white', { loop = false, at = now(), dur = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = type === 'pink' ? pinkBuf : type === 'brown' ? brownBuf : noiseBuf; s.loop = loop;
  s.start(at, Math.random() * (s.buffer.duration - .5)); if (!loop) s.stop(at + dur + .02); return s;
}
/* Hüllkurve auf einem Gain: schnell an, exponentiell aus */
function env(g, t, a, peak, d) {
  const p = g.gain || g; p.cancelScheduledValues(t); p.setValueAtTime(.0001, t);
  p.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); p.exponentialRampToValueAtTime(.0001, t + a + d); p.setValueAtTime(0, t + a + d + .001);
}

/* Ort im Bild: x von 0 (links) bis 1 (rechts), d = Entfernung von 0 (nah) bis 1 (fern).
   Links/rechts im Stereobild, leiser und dumpfer mit Entfernung (Plan: leiser zur Bildmitte hin entfernt). */
function place(dest, x = .5, d = 0) {
  const p = ctx.createStereoPanner(); p.pan.value = clamp((x - .5) * 1.5, -.9, .9);
  const g = gain(1 - .55 * d), lp = filt('lowpass', 16000 - 12500 * d, .5);
  chain(g, lp, p, dest); return g;
}
function send(node, amount) { const s = gain(amount); node.connect(s); s.connect(revIn); return s; }

/* Bausteine für Geräusche */
// Rauschstoß durch einen Filter
function burst(dest, t, { type = 'white', ft = 'bandpass', f = 1000, q = 1, a = .002, peak = .5, d = .05, f2 = null } = {}) {
  const n = noise(type, { at: t, dur: a + d + .02 }), fl = filt(ft, f, q), g = gain(0);
  if (f2) { fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(f2, t + a + d); }
  chain(n, fl, g, dest); env(g, t, a, peak, d); return g;
}
// Moden: gedämpfte Sinusschwingungen eines Körpers (Holz, Metall) nach Frequenzverhältnissen
function modes(dest, t, f0, ratios, decays, amps, { a = .001, spread = .01, glide = 0 } = {}) {
  ratios.forEach((r, i) => {
    const f = f0 * r * (1 + R(-spread, spread)), o = osc('sine', f), g = gain(0);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t + decays[i]);
    chain(o, g, dest); env(g, t, a, amps[i], decays[i]); o.start(t); o.stop(t + a + decays[i] + .05);
  });
}
// Viele kleine Körner zufällig verteilt (Knistern, Tropfen, Kies)
function grains(n, t, span, fn) { for (let i = 0; i < n; i++) fn(t + Math.pow(Math.random(), 1.3) * span, i); }

/* Schleifen mit Vorausplanung: fn(t) wird in zufälligen Abständen aufgerufen, bis stop() */
function every(minGap, maxGap, fn, { first = 0 } = {}) {
  let live = true, next = now() + first, timer;
  (function tick() {
    if (!live) return;
    while (next < now() + .25) { fn(Math.max(next, now() + .01)); next += R(minGap, maxGap); }
    timer = setTimeout(tick, 60);
  })();
  return () => { live = false; clearTimeout(timer); };
}
/* Dauerklang-Hülle: blendet ein und aus, räumt Quellen und Schleifen auf */
function loopShell(dest, level, fadeIn = 1.2) {
  const g = gain(0); g.connect(dest); g.gain.setTargetAtTime(level, now(), fadeIn / 3);
  const srcs = [], stops = [];
  return {
    g, add(s) { srcs.push(s); return s; }, every(...a) { stops.push(every(...a)); },
    lfo(param, rate, depth, base) { // langsames, unregelmäßiges Schwanken (geglätteter Zufall)
      let live = true; const step = () => { if (!live) return; param.setTargetAtTime(base + R(-depth, depth), now(), rate / 2); setTimeout(step, rate * 1000 * R(.6, 1.4)); }; step();
      stops.push(() => { live = false; });
    },
    stop() { stops.forEach(f => f()); g.gain.setTargetAtTime(0, now(), .2); setTimeout(() => { srcs.forEach(s => { try { s.stop(); } catch (e) {} }); g.disconnect(); }, 1200); },
  };
}

/* Pegelanzeige im Kopf (Spitze am Ausgang) */
function runMeter(el) {
  const buf = new Float32Array(meter.fftSize); let hold = 0;
  (function draw() {
    meter.getFloatTimeDomainData(buf); let p = 0; for (const x of buf) p = Math.max(p, Math.abs(x));
    hold = Math.max(p, hold * .92); el.style.width = Math.min(100, hold * 100) + '%'; el.style.background = hold > .95 ? 'var(--bad)' : 'var(--acc)';
    requestAnimationFrame(draw);
  })();
}
