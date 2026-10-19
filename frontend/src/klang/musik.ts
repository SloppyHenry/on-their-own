// Klang (AP17d): Musik aus Code (Mockup docs/mockups/klang/musik.js). Kleine Stücke mit Form statt Zufallstönen: Akkordfolge je Stück,
// Motive A A′ B A″, Schluss auf dem Grundton; jeder Durchlauf bringt ein neues B. Bei Regen in Moll, langsamer und dumpfer.
// Neu: „drinnen“, das Lied im Haus (Stube): langsam, gezupft, warm, ohne Schlagzeug; nachts noch ruhiger mit Spieluhr.
import { burst, chain, env, filt, gain, k, midi, modes, now, osc, seeded, send } from "./kern";

export type Stueck = "morgen" | "mittag" | "abend" | "nacht" | "drinnen";
const SCALES = { dur: [0, 2, 4, 5, 7, 9, 11], moll: [0, 2, 3, 5, 7, 8, 10], dorisch: [0, 2, 3, 5, 7, 9, 10] };
interface Def { name: string; bpm: number; root: number; scale: keyof typeof SCALES; prog: number[]; lead: "puls25" | "puls50" | "dreieck" | "spieluhr" | "zupf"; drums: "leicht" | "voll" | "besen" | null; pad?: boolean; arp?: boolean; counter?: boolean; walk?: boolean; swing?: number; sparse?: boolean; warm?: boolean }
export const MUS: Record<Stueck, Def> = {
  morgen: { name: "Morgen · C-Dur, 96 bpm", bpm: 96, root: 60, scale: "dur", prog: [0, 4, 5, 3], lead: "puls25", drums: "leicht", pad: true, arp: true },
  mittag: { name: "Mittag · F-Dur, 108 bpm", bpm: 108, root: 65, scale: "dur", prog: [0, 3, 1, 4], lead: "puls50", drums: "voll", counter: true, walk: true },
  abend: { name: "Abend · a-Moll, 80 bpm", bpm: 80, root: 57, scale: "moll", prog: [0, 5, 2, 6], lead: "dreieck", drums: "besen", pad: true, swing: 0.58 },
  nacht: { name: "Nacht · d-dorisch, 62 bpm", bpm: 62, root: 62, scale: "dorisch", prog: [0, 3, 0, 6], lead: "spieluhr", drums: null, pad: true, sparse: true },
  drinnen: { name: "Stube · G-Dur, 72 bpm", bpm: 72, root: 55, scale: "dur", prog: [0, 5, 3, 4], lead: "zupf", drums: null, pad: true, warm: true },
};
const RHYTHMS = [ // Positionen in Achteln (0–7) und Längen eines Taktes
  [[0, 2], [2, 1], [3, 1], [4, 3]], [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2]], [[0, 3], [3, 1], [4, 2], [6, 1], [7, 1]],
  [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2]], [[1, 1], [2, 2], [4, 4]], [[0, 1], [1, 1], [2, 1], [3, 1], [4, 4]],
];
const CADENCE = [[0, 2], [2, 2], [4, 4]];
const pulseWaves: Record<number, PeriodicWave> = {};
let waveCtx: AudioContext | null = null;
function pulseWave(duty: number) {
  if (waveCtx !== k().ctx) { for (const d in pulseWaves) delete pulseWaves[d]; waveCtx = k().ctx; }
  if (pulseWaves[duty]) return pulseWaves[duty];
  const n = 40, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return (pulseWaves[duty] = k().ctx.createPeriodicWave(re, im));
}
interface Motif { rh: number[][]; contour: number[] }
/** Motiv: Rhythmus und Kontur (Schritte auf der Tonleiter), Startton ist ein Akkordton. */
function makeMotif(rnd: () => number, sparse?: boolean): Motif {
  const rh = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)].filter(() => !sparse || rnd() < 0.75);
  let p = 0; const contour = rh.map((_, i) => (i === 0 ? 0 : (p += [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd() * 7)])));
  return { rh: rh.length ? rh : [[0, 4]], contour };
}
const vary = (m: Motif, rnd: () => number): Motif => ({ rh: m.rh, contour: m.contour.map((c, i) => (i && rnd() < 0.3 ? c + (rnd() < 0.5 ? -1 : 1) : c)) });

export interface Musik { label: string; bar: number; stop(): void }
/** Startet ein Stück; `nacht` macht das Stück drinnen langsamer und mit Spieluhr. */
export function startCodeMusic(key: Stueck, { rain = false, night = false } = {}): Musik {
  const M = MUS[key], scale = SCALES[rain && M.scale === "dur" ? "moll" : M.scale], bpm = M.bpm * (rain ? 0.92 : 1) * (night && key === "drinnen" ? 0.86 : 1), eighth = 60 / bpm / 2;
  const rnd = seeded(key + Date.now()), g = gain(0), deg = (d: number) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  g.connect(k().bus.music); g.gain.setTargetAtTime(M.warm ? 1.1 : 0.55, now(), 0.6); send(g, M.sparse ? 0.7 : M.warm ? 0.35 : 0.22);
  const echo = gain(M.lead === "spieluhr" ? 0.5 : M.lead === "zupf" ? 0.18 : 0.3); echo.connect(k().echoIn);
  k().musicTone.frequency.setTargetAtTime(rain ? 1900 : M.warm ? 5200 : 18000, now(), 0.5);
  const A = makeMotif(rnd, M.sparse); let B = makeMotif(rnd, M.sparse), A1 = vary(A, rnd), A2 = vary(A, rnd);
  let bar = 0, next = now() + 0.15, live = true, timer = 0;
  const voice = (wave: number | "tri" | "sine", f: number, t: number, len: number, a: number, { att = 0.008, rel = 0.08, vib = 0, echoSend = 0 } = {}) => {
    const o = k().ctx.createOscillator(), og = gain(0);
    if (wave === "tri") o.type = "triangle"; else if (wave === "sine") o.type = "sine"; else o.setPeriodicWave(pulseWave(wave));
    o.frequency.value = f; chain(o, og, g); if (echoSend) og.connect(echo);
    if (vib) { const l = osc("sine", 5.2), lg = gain(0); chain(l, lg); lg.connect(o.detune); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + Math.min(len, 0.5)); l.start(t); l.stop(t + len + rel + 0.05); }
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + att); og.gain.setTargetAtTime(a * 0.7, t + att, 0.12); og.gain.setTargetAtTime(0, t + len, rel / 3);
    o.start(t); o.stop(t + len + rel + 0.1);
  };
  const bell = (f: number, t: number, a: number) => modes(g, t, f, [1, 2.76, 5.4, 8.93], [1.8, 0.9, 0.45, 0.2], [a, a * 0.35, a * 0.12, a * 0.05], { a: 0.003 });
  /** Gezupft (Laute, Zither): heller Anschlag, der Klang wird beim Ausklingen dunkler. */
  const pluck = (f: number, t: number, a: number, len = 1.2) => {
    const o = k().ctx.createOscillator(), o2 = osc("triangle", f * 2.001), lp = filt("lowpass", 3200, 1.2), og = gain(0), g2 = gain(0.25);
    o.setPeriodicWave(pulseWave(0.3)); o.frequency.value = f; chain(o, lp, og, g); chain(o2, g2, lp); og.connect(echo);
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    env(og, t, 0.003, a, len); o.start(t); o2.start(t); o.stop(t + len + 0.1); o2.stop(t + len + 0.1);
  };
  const lead = (f: number, t: number, len: number) => {
    if (rain) len *= 1.1;
    if (M.lead === "puls25") voice(0.25, f, t, len, 0.1, { vib: 12, echoSend: 1 });
    else if (M.lead === "puls50") voice(0.5, f, t, len, 0.075, { vib: 10, echoSend: 1 });
    else if (M.lead === "dreieck") voice("tri", f, t, len, 0.22, { vib: 18, att: 0.02, rel: 0.15, echoSend: 1 });
    else if (M.lead === "zupf") { pluck(f, t, 0.13, Math.max(0.6, len * 1.6)); if (night) bell(f * 2, t, 0.03); }
    else bell(f, t, 0.12);
  };
  const drum = (kind: string, t: number) => {
    if (kind === "kick") { const o = osc("sine", 120), og = gain(0); chain(o, og, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(og, t, 0.002, 0.45, 0.16); o.start(t); o.stop(t + 0.2); }
    else if (kind === "snare") { burst(g, t, { f: 1900, q: 0.7, peak: 0.12, d: 0.11 }); burst(g, t, { ft: "highpass", f: 5000, peak: 0.05, d: 0.06 }); }
    else if (kind === "hat") burst(g, t, { ft: "highpass", f: 8000, peak: 0.035, d: 0.025 });
    else if (kind === "shaker") burst(g, t, { f: 6500, q: 1.5, a: 0.02, peak: 0.03, d: 0.04 });
    else if (kind === "besen") burst(g, t, { type: "pink", f: 3500, q: 0.6, a: 0.04, peak: 0.05, d: 0.12 });
  };
  const playBar = (t0: number) => {
    const pos = bar % 8, chordDeg = M.prog[bar % M.prog.length], root = M.root - 12 + deg(chordDeg);
    const sw = (i: number) => t0 + i * eighth + (M.swing && i % 2 ? (M.swing - 0.5) * 2 * eighth : 0);
    const chord = [0, 2, 4].map((q) => M.root + deg(chordDeg + q));
    // Bass
    if (M.walk) [0, 2, 4, 6].forEach((i, q) => voice("tri", midi(root - 12 + (q === 3 ? deg(chordDeg + 1) - deg(chordDeg) : q === 2 ? 7 : 0)), sw(i), eighth * 1.7, 0.3));
    else if (M.warm) [0, 4].forEach((i, q) => pluck(midi(root - 12 + (q ? 7 : 0)), sw(i), 0.16, 1.6));
    else [0, 4].forEach((i) => voice("tri", midi(root - 12), sw(i), eighth * (M.sparse ? 7.5 : 3.6), M.sparse ? 0.22 : 0.3, { att: 0.02 }));
    // Fläche
    if (M.pad) chord.forEach((n) => { for (const det of [-6, 6]) { const o = osc("triangle", midi(n - 12)), lp = filt("lowpass", rain ? 900 : M.warm ? 1100 : 1500), og = gain(0); o.detune.value = det; chain(o, lp, og, g); og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(0.025, t0 + eighth * 2); og.gain.setValueAtTime(0.025, t0 + eighth * 7); og.gain.linearRampToValueAtTime(0, t0 + eighth * 8.6); o.start(t0); o.stop(t0 + eighth * 8.8); } });
    // Begleitung: gebrochene Akkorde (morgens als Pulswelle, drinnen leise gezupft auf den Zählzeiten 2 und 4)
    if (M.arp && !rain) [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => voice(0.125, midi(chord[[0, 1, 2, 1][i % 4]] + 12), sw(i), eighth * 0.5, 0.035));
    if (M.warm) [2, 3, 6, 7].forEach((i, q) => pluck(midi(chord[[1, 2, 1, 2][q]]), sw(i), 0.045, 0.7));
    if (M.lead === "spieluhr") [0, 3, 5].forEach((i, q) => { if (rnd() < 0.6) bell(midi(chord[q] + 12), sw(i), 0.05); });
    if (M.counter) voice("tri", midi(chord[1]), sw(0), eighth * 7, 0.08, { att: 0.05, rel: 0.2 });
    // Melodie: Form A A' B A'', in Takt 4 und 8 die Schlusswendung
    const motif = [A, A1, B, A2][Math.floor(pos / 2)], cad = pos === 3 || pos === 7;
    const rh = cad ? CADENCE : motif.rh, startDeg = chordDeg + (pos % 2 ? 2 : 0) + 7;
    rh.forEach(([i, len], q) => {
      if ((M.sparse || (night && M.warm)) && rnd() < 0.3) return;
      let d = startDeg + (cad ? [2, 1, 0][q] ?? 0 : motif.contour[q] ?? 0);
      if (cad && pos === 7 && q === rh.length - 1) d = 7;     // Schluss auf dem Grundton
      lead(midi(M.root + deg(d)), sw(i), eighth * len * 0.92);
    });
    // Schlagwerk
    if (M.drums && !rain) for (let i = 0; i < 8; i++) {
      const s = sw(i);
      if (M.drums === "voll") { if (i === 0 || i === 4) drum("kick", s); if (i === 2 || i === 6) drum("snare", s); drum("hat", s); }
      else if (M.drums === "leicht") { if (i === 0) drum("kick", s); drum("shaker", s); }
      else if (M.drums === "besen") { if (i === 2 || i === 6) drum("besen", s); if (i === 0) drum("kick", s); }
    }
    if (pos === 7) { B = makeMotif(rnd, M.sparse); A1 = vary(A, rnd); A2 = vary(A, rnd); }
    music.bar = pos + 1;
  };
  const music: Musik = {
    label: M.name + (rain ? " · bei Regen gedämpft" : "") + (night && key === "drinnen" ? " · nachts" : ""), bar: 0,
    stop() { live = false; clearTimeout(timer); g.gain.setTargetAtTime(0, now(), 0.6); setTimeout(() => g.disconnect(), 3000); },
  };
  const sched = () => {
    if (!live) return;
    while (next < now() + 0.3) { playBar(next); bar++; next += eighth * 8; }
    timer = window.setTimeout(sched, 100);
  };
  sched();
  return music;
}
