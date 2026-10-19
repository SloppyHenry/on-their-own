// Klang (AP17d): Audiokontext, Kanäle, Raum, Rauschen und Bausteine für Klänge. Aus dem Mockup docs/mockups/klang/kern.js übertragen.
// Alles entsteht im Browser (Web Audio), das Backend trägt keine Last. Der Kontext entsteht erst beim ersten Klick (Regel der Browser).
export type Kanal = "music" | "amb" | "innen" | "fig" | "voice";
export const KANAELE: Kanal[] = ["music", "amb", "innen", "fig", "voice"];

export const R = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Gleiches Ergebnis für gleichen Text: kleiner Zufallsgenerator mit Startwert. */
export function seeded(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface Kern {
  ctx: AudioContext;
  master: GainNode;
  bus: Record<Kanal, GainNode>;
  duck: Record<"music" | "amb", GainNode>;
  /** Dämpfung der Umgebung draußen, wenn man ins Haus schaut (Wand: tiefer und leiser). */
  wand: { lp: BiquadFilterNode; g: GainNode };
  musicTone: BiquadFilterNode;
  revIn: GainNode;
  echoIn: GainNode;
  meter: AnalyserNode;
  noise: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer };
}
let K: Kern | null = null;
export const kern = () => K;
/** Kern für die Klangfunktionen; sie werden nur aufgerufen, wenn er schon läuft. */
export const k = () => K!;
export const now = () => K!.ctx.currentTime;

export function startKern(): Kern | null {
  if (K) return K;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: "interactive" });
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const f = (type: BiquadFilterType, fr: number, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fr; b.Q.value = q; return b; };
  const master = g(0.9);
  // sanfter Kompressor, dahinter ein harter Begrenzer gegen Übersteuern
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
  const meter = ctx.createAnalyser(); meter.fftSize = 1024; lim.connect(meter);
  // Kanäle: Musik mit Klangregler, Umgebung draußen hinter der „Wand“, Umgebung drinnen ohne; Musik und Umgebung treten beim Sprechen zurück
  const bus = Object.fromEntries(KANAELE.map((c) => [c, g()])) as Record<Kanal, GainNode>;
  const duck = { music: g(), amb: g() };
  const musicTone = f("lowpass", 18000, 0.5), wand = { lp: f("lowpass", 18000, 0.5), g: g() };
  bus.music.connect(musicTone); musicTone.connect(duck.music); duck.music.connect(master);
  bus.amb.connect(wand.lp); wand.lp.connect(wand.g); wand.g.connect(duck.amb); bus.innen.connect(duck.amb); duck.amb.connect(master);
  bus.fig.connect(master); bus.voice.connect(master);
  // Raum: erzeugte Impulsantwort, stereo, mit kurzem Vorlauf und dunklerem Ausklang
  const sr = ctx.sampleRate, len = Math.floor(sr * 2.4), ir = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) { const q = i / len, w = Math.random() * 2 - 1, a = 0.5 + 0.45 * q; lp = lp * a + w * (1 - a); d[i] = lp * Math.pow(1 - q, 3) * (i < sr * 0.012 ? 0 : 1) * 2.2; }
  }
  const rev = ctx.createConvolver(); rev.buffer = ir; const revIn = g(0.5);
  const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.018; revIn.connect(pre); pre.connect(rev); rev.connect(master);
  // Echo für Melodien (gedämpft, Rückkopplung)
  const echoIn = g(1), dl = ctx.createDelay(1.5), fb = g(0.32), elp = f("lowpass", 2400, 0.5), eg = g(0.45);
  dl.delayTime.value = 0.36; echoIn.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(eg); eg.connect(master);
  // Rauschen: weiß, rosa, braun
  const mk = (sec: number, fn: (d: Float32Array) => void) => { const b = ctx.createBuffer(1, Math.floor(sr * sec), sr); fn(b.getChannelData(0)); return b; };
  const white = mk(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  const pink = mk(4, (d) => { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; } });
  const brown = mk(4, (d) => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
  K = { ctx, master, bus, duck, wand, musicTone, revIn, echoIn, meter, noise: { white, pink, brown } };
  return K;
}

/** Lautstärken setzen (0–1 je Kanal, dazu gesamt); „innen“ folgt der Umgebung. */
export function setVolumes(gesamt: number, vol: Record<"music" | "amb" | "fig" | "voice", number>) {
  if (!K) return;
  const t = now();
  K.master.gain.setTargetAtTime(0.9 * gesamt, t, 0.05);
  for (const c of KANAELE) K.bus[c].gain.setTargetAtTime(c === "innen" ? vol.amb : vol[c], t, 0.05);
}
/** Drinnen: die Umgebung von draußen klingt durch die Wand tiefer und leiser. */
export function setWand(drinnen: boolean) {
  if (!K) return;
  const t = now();
  K.wand.lp.frequency.setTargetAtTime(drinnen ? 650 : 18000, t, 0.25);
  K.wand.g.gain.setTargetAtTime(drinnen ? 0.4 : 1, t, 0.25);
}
/** Ducking: während jemand spricht, treten Musik und Umgebung etwas zurück. */
let duckN = 0;
export function duckFor(sec: number) {
  if (!K) return;
  const t = now(); duckN++;
  K.duck.music.gain.setTargetAtTime(0.5, t, 0.08); K.duck.amb.gain.setTargetAtTime(0.72, t, 0.08);
  setTimeout(() => { if (--duckN <= 0 && K) { duckN = 0; const t2 = now(); K.duck.music.gain.setTargetAtTime(1, t2, 0.35); K.duck.amb.gain.setTargetAtTime(1, t2, 0.35); } }, sec * 1000);
}

/* ---------- Bausteine ---------- */
export function filt(type: BiquadFilterType, f: number, q = 1) { const b = k().ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
export function osc(type: OscillatorType, f: number) { const o = k().ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
export function gain(v = 1) { const g = k().ctx.createGain(); g.gain.value = v; return g; }
export function panner(v = 0) { const p = k().ctx.createStereoPanner(); p.pan.value = v; return p; }
export function chain<T extends AudioNode>(...n: [...AudioNode[], T]): T { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1] as T; }
export function noise(type: "white" | "pink" | "brown" = "white", { loop = false, at = now(), dur = 1 } = {}) {
  const s = k().ctx.createBufferSource(); s.buffer = k().noise[type]; s.loop = loop;
  s.start(at, Math.random() * (s.buffer.duration - 0.5)); if (!loop) s.stop(at + dur + 0.02); return s;
}
/** Hüllkurve auf einem Gain: schnell an, exponentiell aus. */
export function env(g: GainNode | AudioParam, t: number, a: number, peak: number, d: number) {
  const p = g instanceof GainNode ? g.gain : g; p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d); p.setValueAtTime(0, t + a + d + 0.001);
}
/** Ort im Bild: x von 0 (links) bis 1 (rechts), d = Entfernung von 0 (nah) bis 1 (fern): links/rechts, leiser und dumpfer mit Entfernung. */
export function place(dest: AudioNode, x = 0.5, d = 0): GainNode {
  const p = panner(clamp((x - 0.5) * 1.5, -0.9, 0.9)), g = gain(1 - 0.55 * d), lp = filt("lowpass", 16000 - 12500 * d, 0.5);
  chain(g, lp, p, dest); return g;
}
export function send(node: AudioNode, amount: number) { const s = gain(amount); node.connect(s); s.connect(k().revIn); return s; }
export interface BurstOpts { type?: "white" | "pink" | "brown"; ft?: BiquadFilterType; f?: number; q?: number; a?: number; peak?: number; d?: number; f2?: number | null }
/** Rauschstoß durch einen Filter. */
export function burst(dest: AudioNode, t: number, { type = "white", ft = "bandpass", f = 1000, q = 1, a = 0.002, peak = 0.5, d = 0.05, f2 = null }: BurstOpts = {}) {
  const n = noise(type, { at: t, dur: a + d + 0.02 }), fl = filt(ft, f, q), g = gain(0);
  if (f2) { fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(f2, t + a + d); }
  chain(n, fl, g, dest); env(g, t, a, peak, d); return g;
}
/** Moden: gedämpfte Sinusschwingungen eines Körpers (Holz, Metall) nach Frequenzverhältnissen. */
export function modes(dest: AudioNode, t: number, f0: number, ratios: number[], decays: number[], amps: number[], { a = 0.001, spread = 0.01, glide = 0 } = {}) {
  ratios.forEach((r, i) => {
    const f = f0 * r * (1 + R(-spread, spread)), o = osc("sine", f), g = gain(0);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t + decays[i]);
    chain(o, g, dest); env(g, t, a, amps[i], decays[i]); o.start(t); o.stop(t + a + decays[i] + 0.05);
  });
}
/** Viele kleine Körner zufällig verteilt (Knistern, Tropfen, Kies). */
export function grains(n: number, t: number, span: number, fn: (t: number, i: number) => void) { for (let i = 0; i < n; i++) fn(t + Math.pow(Math.random(), 1.3) * span, i); }
/** Hüllkurve als Kurve aus zufälligen Werten (Rascheln, Strahl). */
export function roughCurve(n: number, shape: (q: number) => number, lo = 0.35, hi = 1) {
  const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = shape(i / (n - 1)) * R(lo, hi); c[n - 1] = 0; return c;
}

/** Schleife mit Vorausplanung: fn(t) wird in zufälligen Abständen aufgerufen, bis zum Stopp. */
export function every(minGap: number, maxGap: number, fn: (t: number) => void, { first = 0 } = {}): () => void {
  let live = true, next = now() + first, timer = 0;
  const tick = () => {
    if (!live || !K) return;
    while (next < now() + 0.25) { fn(Math.max(next, now() + 0.01)); next += R(minGap, maxGap); }
    timer = window.setTimeout(tick, 60);
  };
  tick();
  return () => { live = false; clearTimeout(timer); };
}
export interface Loop { g: GainNode; stop(): void }
export interface Shell extends Loop {
  add<T extends AudioScheduledSourceNode>(s: T): T;
  every(minGap: number, maxGap: number, fn: (t: number) => void, o?: { first?: number }): void;
  lfo(param: AudioParam, rate: number, depth: number, base: number): void;
}
/** Dauerklang-Hülle: blendet ein und aus, räumt Quellen und Schleifen auf. */
export function loopShell(dest: AudioNode, level: number, fadeIn = 1.2): Shell {
  const g = gain(0); g.connect(dest); g.gain.setTargetAtTime(level, now(), fadeIn / 3);
  const srcs: AudioScheduledSourceNode[] = [], stops: (() => void)[] = [];
  return {
    g,
    add(s) { srcs.push(s); return s; },
    every(a, b, fn, o) { stops.push(every(a, b, fn, o)); },
    lfo(param, rate, depth, base) {                 // langsames, unregelmäßiges Schwanken (geglätteter Zufall)
      let live = true;
      const step = () => { if (!live || !K) return; param.setTargetAtTime(base + R(-depth, depth), now(), rate / 2); setTimeout(step, rate * 1000 * R(0.6, 1.4)); };
      step(); stops.push(() => { live = false; });
    },
    stop() { stops.forEach((f) => f()); g.gain.setTargetAtTime(0, now(), 0.4); setTimeout(() => { srcs.forEach((s) => { try { s.stop(); } catch { /* schon aus */ } }); g.disconnect(); }, 2000); },
  };
}
/** Pegel am Ausgang (Spitze 0–1), für die Anzeige und für Tests. */
export function peakLevel(): number {
  if (!K) return 0;
  const buf = new Float32Array(K.meter.fftSize); K.meter.getFloatTimeDomainData(buf);
  let p = 0; for (const x of buf) p = Math.max(p, Math.abs(x)); return p;
}
