// Klang (AP17d): CC0-Aufnahmen (frontend/public/klang, Quellen und Lizenz in docs/assets.md). Sie laden erst, wenn eine Quelle auf CC0 steht;
// bis eine Datei da ist, spielt das Gegenstück aus Code. Pegel auf die Code-Klänge abgeglichen (wie im Mockup).
import { chain, gain, k, now, pick, R, type Loop } from "./kern";
import type { Boden, Sfx } from "./geraeusche";
import type { Stueck } from "./musik";

const cache = new Map<string, AudioBuffer | Promise<AudioBuffer | null> | null>();
let cacheCtx: AudioContext | null = null;
/** Lädt eine Aufnahme (einmal je Kontext); liefert sie, sobald sie dekodiert ist. */
export function laden(name: string): Promise<AudioBuffer | null> {
  if (cacheCtx !== k().ctx) { cache.clear(); cacheCtx = k().ctx; }
  const c = cache.get(name);
  if (c instanceof AudioBuffer || c === null) return Promise.resolve(c);
  if (c) return c;
  const p = fetch(`/klang/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText)))).then((b) => k().ctx.decodeAudioData(b))
    .then((b) => { cache.set(name, b); return b; }, () => { cache.set(name, null); return null; });
  cache.set(name, p); return p;
}
const bereit = (name: string): AudioBuffer | null => { const c = cache.get(name); if (c instanceof AudioBuffer) return c; if (c === undefined) void laden(name); return null; };

function play(b: AudioBuffer, out: AudioNode, { loop = false, rate = 1, level = 1, fade = 0 } = {}): Loop {
  const s = k().ctx.createBufferSource(), g = gain(fade ? 0 : level); s.buffer = b; s.loop = loop; s.playbackRate.value = rate; chain(s, g, out); s.start(now());
  if (fade) g.gain.setTargetAtTime(level, now(), fade / 3);
  return { g, stop() { g.gain.setTargetAtTime(0, now(), fade ? 0.5 : 0.1); setTimeout(() => { try { s.stop(); } catch { /* schon aus */ } g.disconnect(); }, fade ? 2500 : 500); } };
}

const STEPS: Record<Boden, [string[], number]> = { gras: [["schritt_gras_1", "schritt_gras_2", "schritt_gras_3", "schritt_gras_4"], 0.7], weg: [["schritt_weg_1", "schritt_weg_2", "schritt_weg_3"], 0.45], holz: [["schritt_holz_1", "schritt_holz_2"], 0.75], stein: [["schritt_stein_1", "schritt_stein_2"], 1.1] };
const ONE: Partial<Record<Sfx, [string, number]>> = { doorOpen: ["tuer_auf", 0.45], doorClose: ["tuer_zu", 0.8], pot: ["topf", 0.6], coins: ["muenzen", 0.9], chop: ["hacken", 0.45], book: ["buch", 1.4], cloth: ["tuch", 0.8], latch: ["schloss", 0.7] };
/** Gibt es diesen Klang als Aufnahme? */
export const hatAufnahme = (name: Sfx) => name === "step" || !!ONE[name];
/** Spielt den Klang als Aufnahme; false, wenn es keine gibt oder sie noch lädt (dann spielt der Aufrufer Code). */
export function spieleAufnahme(name: Sfx, dest: AudioNode, boden?: Boden): boolean {
  if (name === "step") {
    const [files, level] = STEPS[boden ?? "gras"]; files.forEach((f) => bereit(f));
    const b = bereit(pick(files)); if (!b) return false;
    play(b, dest, { rate: R(0.92, 1.08), level }); return true;
  }
  const o = ONE[name]; if (!o) return false;
  const b = bereit(o[0]); if (!b) return false;
  play(b, dest, { rate: name.startsWith("door") ? R(0.97, 1.03) : 1, level: o[1] }); return true;
}
/** Lädt die Aufnahmen eines Klangs (Probe in den Einstellungen). */
export const ladeKlang = async (name: Sfx, boden?: Boden) => { await Promise.all(name === "step" ? STEPS[boden ?? "gras"][0].map(laden) : ONE[name] ? [laden(ONE[name]![0])] : []); };
/** Lädt die Einzelklänge vorab (beim Umschalten auf CC0). */
export const vorladen = () => { for (const [f] of Object.values(STEPS)) f.forEach((n) => void laden(n)); for (const o of Object.values(ONE)) void laden(o![0]); };

const AMB_FILES = { regen: ["regen", 1.8], voegel: ["voegel", 3.5], bach: ["bach", 0.45] } as const;
/** Umgebung als Schleife (Regen, Vögel mit Wind, Bach); wartet aufs Laden und blendet dann ein. */
export function aufnahmeSchleife(key: keyof typeof AMB_FILES, dest: AudioNode, { level = 1, rate = 1 } = {}): Loop {
  let inner: Loop | null = null, live = true;
  const [file, base] = AMB_FILES[key], g = gain(1); g.connect(dest);
  void laden(file).then((b) => { if (b && live) inner = play(b, g, { loop: true, level: base * level, rate, fade: 1.5 }); });
  return { g, stop() { live = false; inner?.stop(); setTimeout(() => g.disconnect(), 3000); } };
}

export const CC0_MUSIK: Record<Stueck, [string, string]> = {
  morgen: ["musik_morgen", "A Place I Call Home"], mittag: ["musik_mittag", "Peaceful Days"], abend: ["musik_abend", "Summer Memories"],
  nacht: ["musik_nacht", "Innocence"], drinnen: ["musik_drinnen", "Sand Castles"],
};
/** Musik als Aufnahme (Juhani Junkala, „JRPG Pack 4 Calm“), in Schleife, weich eingeblendet. */
export function aufnahmeMusik(key: Stueck): Loop & { label: string } {
  const [file, title] = CC0_MUSIK[key], g = gain(1); g.connect(k().bus.music);
  let inner: Loop | null = null, live = true;
  void laden(file).then((b) => { if (b && live) inner = play(b, g, { loop: true, level: 0.9, fade: 2 }); });
  return { g, label: `${title} (Juhani Junkala, CC0)`, stop() { live = false; inner?.stop(); setTimeout(() => g.disconnect(), 3000); } };
}
