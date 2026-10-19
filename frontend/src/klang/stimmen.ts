// Klang (AP17d): Stimmen der Figuren (Plappern aus Code, Mockup docs/mockups/klang/stimmen.js). Eine Stimme ist EIN Oszillator mit
// drei Formantfiltern (Vokalfarbe) und einem Rauschzweig (s, sch, f, t, k …). Alles wird vorab auf der Zeitachse geplant; der Text
// in der Blase läuft silbengenau mit (sprechStand). Die Lautheit gleicht loudness() an, egal welche Klangfarbe, Tonhöhe und Größe.
import { chain, duckFor, filt, gain, k, noise, now, osc, place, seeded } from "./kern";
import { consonants, DIPH, plan, VOWEL_F } from "./sprache";

export type Klangfarbe = "weich" | "klar" | "rau" | "hohl" | "piepsig";
export type Sprechart = "plappern" | "summen" | "piepsen";
export interface Stimme { base: number; timbre: Klangfarbe; speed: number; size: number; lively: number; breath: number; vib: number; style: Sprechart }
const TIMBRES: Record<Klangfarbe, (n: number) => number> = { weich: (n) => Math.pow(n, -1.9), klar: (n) => 1 / n, rau: (n) => Math.pow(n, -0.75) * (1 + 0.35 * Math.sin(n * 1.7)), hohl: (n) => (n % 2 ? 1 / n : 0), piepsig: (n) => [0, 1, 0.25, 0.07][n] || 0 };
export const KLANGFARBEN: Record<Klangfarbe, string> = { weich: "weich", klar: "klar", rau: "rau", hohl: "hohl", piepsig: "piepsig" };
export const SPRECHARTEN: Record<Sprechart, string> = { plappern: "Plappern (Silben)", summen: "Summen", piepsen: "Piepsen (je Buchstabe)" };
const FQ = [7, 12, 14], FG = [1.1, 0.75, 0.35], VOICE_LEVEL = 0.21;

/** Vorschlag für eine Figur: Tonhöhe nach Geschlecht und Alter, Klangfarbe und Eigenheiten fest aus der Kennung (gleiche Figur, gleiche Stimme). */
export function standardStimme(id: string, profile?: { gender?: string; age?: number } | null): Stimme {
  const r = seeded("stimme|" + id), g = (profile?.gender ?? "").toLowerCase(), age = profile?.age ?? 35;
  const female = /^(w|f)|weib|frau|female/.test(g), male = /^m|männ|mann|male/.test(g) && !female;
  let base = female ? 205 + r() * 40 : male ? 110 + r() * 30 : 150 + r() * 40;
  if (age < 14) base *= 1.35; else if (age > 65) base *= 0.92;
  const timbres: Klangfarbe[] = ["klar", "weich", "rau", "klar", "weich"];
  return { base: Math.round(base), timbre: timbres[Math.floor(r() * timbres.length)], speed: +(0.88 + r() * 0.24).toFixed(2), size: +((female || age < 14 ? 1.12 : 1) + r() * 0.08).toFixed(2), lively: +(0.55 + r() * 0.55).toFixed(2), breath: +(0.05 + r() * 0.1).toFixed(2), vib: 4 + r() * 1.5, style: "plappern" };
}

const waves = new Map<string, PeriodicWave>(); let waveCtx: AudioContext | null = null;
function timbreWave(name: Klangfarbe) {
  if (waveCtx !== k().ctx) { waves.clear(); waveCtx = k().ctx; }
  if (!waves.has(name)) { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) im[i] = TIMBRES[name](i); waves.set(name, k().ctx.createPeriodicWave(re, im)); }
  return waves.get(name)!;
}
const loudCache = new Map<string, number>();
/** Erwarteter Pegel: Obertöne der Klangfarbe durch die Filter (Mittel über fünf Vokale), aus dem Frequenzgang berechnet. */
function loudness(v: Stimme): number {
  const key = [v.timbre, Math.round(v.base), v.size.toFixed(2), v.style].join("|"); const c = loudCache.get(key); if (c) return c;
  const amp = TIMBRES[v.timbre], K: number[] = [];
  for (let q = 1; q < 48 && q * v.base < 9000; q++) K.push(q);
  let peak = 0; for (let i = 0; i < 512; i++) { const x = (2 * Math.PI * i) / 512; let y = 0; for (const q of K) y += amp(q) * Math.sin(q * x); peak = Math.max(peak, Math.abs(y)); }
  const fr = new Float32Array(K.map((q) => q * v.base)), mag = new Float32Array(K.length), ph = new Float32Array(K.length);
  type Path = [BiquadFilterType, number | null, number, number, number | null];
  const paths: Path[] = v.style === "piepsen" ? [["lowpass", 2600, 0.7, 0.55, null]] : [...[0, 1, 2].map((i): Path => ["bandpass", null, FQ[i], FG[i] * (v.style === "summen" ? [1, 0.35, 0.1][i] : 1), i]), ["lowpass", v.style === "summen" ? 700 : 1000, 0.7, v.style === "summen" ? 0.5 : 0.28, null]];
  let E = 0; const vowels = ["a", "e", "i", "o", "u"];
  for (const vw of vowels) {
    const re = new Float32Array(K.length), im = new Float32Array(K.length);
    for (const [type, f, q, g, fi] of paths) {
      filt(type, fi === null ? f! : VOWEL_F[vw][fi] * v.size * (v.style === "summen" ? 0.85 : 1), q).getFrequencyResponse(fr, mag, ph);
      K.forEach((_, j) => { re[j] += g * mag[j] * Math.cos(ph[j]); im[j] += g * mag[j] * Math.sin(ph[j]); });
    }
    K.forEach((q, j) => { E += (Math.pow(amp(q) / peak, 2) * (re[j] * re[j] + im[j] * im[j])) / 2; });
  }
  const l = Math.sqrt(E / vowels.length) || 1; loudCache.set(key, l); return l;
}

export interface Rede { key: string; text: string; t0: number; end: number; timeline: [number, number][]; truncated: boolean; done: boolean; stop(): void }
const speaking = new Map<string, Rede>();
/** Spricht `text` mit Stimme `v`; je Sprecher (`key`) nur eine Stimme zugleich. x, d: Ort im Bild (place). */
export function speak(key: string, text: string, v: Stimme, { x = 0.5, d = 0, dest, onDone }: { x?: number; d?: number; dest?: AudioNode; onDone?: () => void } = {}): Rede | null {
  speaking.get(key)?.stop();
  const syl = plan(text, v); if (!syl.length) return null;
  const ctx = k().ctx, t0 = now() + 0.04, size = v.size, style = v.style, timeline: [number, number][] = [];
  const src = ctx.createOscillator(); src.setPeriodicWave(timbreWave(v.timbre)); src.frequency.value = v.base;
  const vib = osc("sine", v.vib), vibG = gain(18); chain(vib, vibG); vibG.connect(src.detune);
  const drift = osc("sine", 0.7 + Math.random() * 0.4), driftG = gain(9); chain(drift, driftG); driftG.connect(src.detune);
  const vg = gain(0), ng = gain(0), ag = gain(0), formIn = gain(1), sum = gain(1), outG = gain(Math.min(8, (VOICE_LEVEL * (style === "piepsen" ? 1.35 : 1)) / loudness(v)));
  const noiseSrc = noise("white", { loop: true, at: t0 }), nf = filt("bandpass", 5000, 1.5), af = gain(1);
  src.connect(vg); noiseSrc.connect(nf); nf.connect(ng); ng.connect(sum); noiseSrc.connect(af); af.connect(ag); ag.connect(formIn);
  const F = [0, 1, 2].map((i) => filt("bandpass", VOWEL_F.a[i] * size, FQ[i]));
  if (style === "piepsen") chain(vg, filt("lowpass", 2600, 0.7), gain(0.55), sum);
  else {
    vg.connect(formIn);
    F.forEach((f, i) => chain(formIn, f, gain(FG[i] * (style === "summen" ? [1, 0.35, 0.1][i] : 1)), sum));
    chain(formIn, filt("lowpass", style === "summen" ? 700 : 1000, 0.7), gain(style === "summen" ? 0.5 : 0.28), sum);
  }
  chain(sum, outG, place(dest ?? k().bus.voice, x, d));
  const P = src.frequency, VG = vg.gain, NG = ng.gain, AG = ag.gain;
  const toF = (vowel: string, t: number, tc: number) => { const fs = VOWEL_F[vowel] || VOWEL_F["@"]; F.forEach((f, i) => f.frequency.setTargetAtTime(fs[i] * size * (style === "summen" ? 0.85 : 1), t, tc)); };
  let t = t0; VG.setValueAtTime(0, t0); P.setValueAtTime(v.base, t0);
  const cons = (segs: ReturnType<typeof consonants>, amp: number) => {
    for (const c of segs) {
      if (style === "summen") { VG.setTargetAtTime(amp * 0.45, t, 0.015); t += 0.035 / v.speed; continue; }
      if (style === "piepsen") continue;
      const dd = c.d / v.speed;
      if (c.k === "son") { VG.setTargetAtTime(amp * c.a, t, 0.012); F.forEach((f, i) => f.frequency.setTargetAtTime(c.F![i] * size, t, 0.012)); if (c.roll) VG.setValueCurveAtTime(new Float32Array([amp * 0.5, amp * 0.2, amp * 0.5, amp * 0.2, amp * 0.5]), t + 0.002, dd * 0.9); t += dd; }
      else if (c.k === "fric") { VG.setTargetAtTime(0, t, 0.01); nf.frequency.setValueAtTime(c.f!, t); nf.Q.setValueAtTime(c.q!, t); NG.setTargetAtTime(c.a, t, 0.008); NG.setTargetAtTime(0, t + dd, 0.01); t += dd + 0.008; }
      else if (c.k === "plos") { VG.setTargetAtTime(c.voiced ? amp * 0.12 : 0, t, 0.006); t += c.clo! / v.speed; nf.frequency.setValueAtTime(c.f!, t); nf.Q.setValueAtTime(0.9, t); NG.setValueAtTime(c.a, t); NG.setTargetAtTime(0, t + 0.003, dd / 3); t += dd; }
      else { VG.setTargetAtTime(0, t, 0.01); AG.setTargetAtTime(c.a, t, 0.01); AG.setTargetAtTime(0, t + dd, 0.01); t += dd; }
    }
  };
  syl.forEach((sy, i) => {
    const f = v.base * Math.pow(2, sy.st / 12), amp = 0.8 * sy.amp;
    if (style === "piepsen") {
      const letters = text.slice(sy.s, sy.e).replace(/[^\p{L}\p{N}]/gu, ""), step = Math.max(0.045, sy.dur / Math.max(1, letters.length)) * 0.9;
      [...letters].forEach((ch, li) => {
        const isV = /[aeiouyäöü]/i.test(ch), lf = f * Math.pow(2, ((ch.charCodeAt(0) % 5) * (isV ? 2 : 1) - 2) / 12) * (isV ? 1 : 0.84);
        P.setValueAtTime(lf, t); VG.setValueAtTime(0, t); VG.linearRampToValueAtTime(amp * (isV ? 1 : 0.55), t + 0.006); VG.setTargetAtTime(0, t + step * 0.65, 0.01);
        timeline.push([t, sy.s + Math.min(li + 1, sy.e - sy.s)]); t += step;
      });
    } else {
      if (sy.wordStart && !sy.on && i) { VG.setTargetAtTime(amp * 0.08, t, 0.006); t += 0.025 / v.speed; }      // Stimmeinsatz vor Vokal am Wortanfang
      P.setTargetAtTime(f, t, 0.03);
      timeline.push([t, sy.e]);
      cons(consonants(sy.on), amp);
      const vt = t, [v1, v2] = DIPH[sy.v] || [sy.v];
      VG.setTargetAtTime(amp, t, 0.014); toF(v1, t, 0.016); AG.setTargetAtTime(v.breath, t, 0.015);
      if (v2) toF(v2, t + sy.dur * 0.45, 0.04);
      if (sy.end === "?" && i === syl.length - 1) P.setTargetAtTime(f * 1.12, vt + sy.dur * 0.3, sy.dur * 0.4);
      else if (sy.end && sy.end !== "," && i === syl.length - 1) P.setTargetAtTime(f * 0.9, vt + sy.dur * 0.3, sy.dur * 0.5);
      t += sy.dur;
      cons(consonants(sy.coda), amp * 0.8);
      AG.setTargetAtTime(0.3 * v.breath, t, 0.015);
    }
    if (sy.end) {
      timeline.push([t, sy.pe]);
      VG.setTargetAtTime(0, t, sy.end === "…" ? 0.08 : 0.03); NG.setTargetAtTime(0, t, 0.01); AG.setTargetAtTime(0, t, 0.02);
      t += { ",": 0.14, ".": 0.26, "!": 0.26, "?": 0.28, "…": 0.42 }[sy.end] / Math.sqrt(v.speed);
    }
  });
  VG.setTargetAtTime(0, t, 0.02); NG.setTargetAtTime(0, t, 0.01);
  const end = t + 0.1;
  [src, vib, drift].forEach((o) => { o.start(t0); o.stop(end + 0.1); }); noiseSrc.stop(end + 0.1);
  duckFor(end - now());
  let timer = 0;
  const h: Rede = {
    key, text, t0, end, timeline, truncated: !!syl.truncated, done: false,
    stop() { if (h.done) return; h.done = true; clearTimeout(timer); outG.gain.setTargetAtTime(0, now(), 0.015); [src, vib, drift, noiseSrc].forEach((o) => { try { o.stop(now() + 0.1); } catch { /* schon aus */ } }); if (speaking.get(key) === h) speaking.delete(key); },
  };
  timer = window.setTimeout(() => { h.done = true; zuletzt.set(key, { text, until: Date.now() + 2500 }); if (speaking.get(key) === h) speaking.delete(key); onDone?.(); }, (end - now()) * 1000);
  speaking.set(key, h);
  return h;
}
export function stopAllVoices() { [...speaking.values()].forEach((h) => h.stop()); }
export const isSpeaking = () => speaking.size > 0;
/** Zeilen, die schon in der Blase stehen, aber noch auf ihre Stimme warten (ein Gespräch läuft): die Blase zeigt bis dahin nichts. */
export const wartend = new Map<string, string>();
const zuletzt = new Map<string, { text: string; until: number }>();
/** Die Blase bleibt, solange ihre Zeile wartet oder gesprochen wird, und 2,5 s danach (auch wenn ihre übliche Zeit um ist). */
export function haeltBlase(key: string, text: string): boolean {
  const z = zuletzt.get(key);
  return wartend.get(key) === text || speaking.get(key)?.text === text || (!!z && z.text === text && z.until > Date.now());
}
/** Wie weit der Text gerade gesprochen ist (Zeichen), oder null, wenn diese Figur nicht spricht. */
export function sprechStand(key: string, text: string): number | null {
  if (wartend.get(key) === text) return 0;
  const h = speaking.get(key); if (!h || h.done || h.text !== text) return null;
  let upto = 0; const t = now(); for (const [ts, e] of h.timeline) { if (ts <= t) upto = e; else break; }
  return upto;
}
