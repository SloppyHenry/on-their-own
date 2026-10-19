// Klang (AP17d): Anhören in den Einstellungen – Einzelklänge und Dauerklänge in beiden Quellen, Stimmen der Bewohner.
import { useSimStore } from "../store/simStore";
import { aufnahmeSchleife, hatAufnahme, ladeKlang, laden, spieleAufnahme } from "./aufnahmen";
import { stimmeVon, zaehler } from "./buehne";
import type { Quelle } from "./einstellungen";
import { SFX, type Boden, type Sfx } from "./geraeusche";
import { k, kern, peakLevel, type Kanal, type Loop } from "./kern";
import { freigeben, laeuft } from "./regie";
import { speak, type Rede, type Stimme } from "./stimmen";
import { AMB, together } from "./umgebung";

export interface ProbeKlang { label: string; sfx: Sfx; boden?: Boden; times?: number; gap?: number; cc0: boolean }
const steps = (b: Boden, label: string): ProbeKlang => ({ label, sfx: "step", boden: b, times: 4, gap: 0.43, cc0: true });
export const PROBE_KLAENGE: ProbeKlang[] = [
  steps("gras", "4 Schritte auf Gras"), steps("weg", "4 Schritte auf dem Weg"), steps("holz", "4 Schritte auf Holz"), steps("stein", "4 Schritte auf Stein"),
  ...([["doorOpen", "Tür öffnen"], ["doorClose", "Tür schließen"], ["pot", "Kochen"], ["coins", "Münzen"], ["chop", "Holz hacken"], ["book", "Buch blättern"], ["cloth", "Tuch, Bettdecke"], ["latch", "Schloss"],
    ["pour", "Gießkanne"], ["snore", "Schlafen"], ["hammer", "Hämmern (Bauen)"], ["dig", "Graben (Pflanzen)"], ["light", "Anzünden"], ["blow", "Ausblasen"], ["clink", "Essen und Trinken"], ["splash", "Paddel, Angel"], ["write", "Schreiben"], ["purr", "Katze schnurrt"]] as [Sfx, string][])
    .map(([sfx, label]) => ({ label, sfx, cc0: hatAufnahme(sfx) })),
];
/** Spielt einen Klang aus der gewählten Quelle (CC0 lädt beim ersten Mal kurz). */
export async function probeKlang(p: ProbeKlang, q: Quelle): Promise<boolean> {
  if (!freigeben()) return false;
  if (q === "cc0") await ladeKlang(p.sfx, p.boden);
  for (let i = 0; i < (p.times ?? 1); i++) setTimeout(() => (q === "cc0" ? spieleAufnahme(p.sfx, k().bus.fig, p.boden) : p.sfx === "step" ? SFX.step(k().bus.fig, p.boden) : (SFX[p.sfx] as (d: AudioNode) => void)(k().bus.fig)), i * (p.gap ?? 0) * 1000);
  return true;
}
export const PROBE_SCHLEIFEN: { id: string; label: string; code: () => Loop; cc0?: () => Loop }[] = [
  { id: "bach", label: "Bach", code: () => AMB.water(k().bus.innen), cc0: () => aufnahmeSchleife("bach", k().bus.innen) },
  { id: "regen", label: "Regen", code: () => AMB.rain(k().bus.innen), cc0: () => aufnahmeSchleife("regen", k().bus.innen) },
  { id: "voegel", label: "Vögel am Morgen", code: () => AMB.birds(k().bus.innen, 1.6, { dove: true }), cc0: () => aufnahmeSchleife("voegel", k().bus.innen) },
  { id: "wind", label: "Wind", code: () => AMB.wind(k().bus.innen) },
  { id: "feuer", label: "Feuer im Kamin", code: () => AMB.fire(k().bus.innen) },
  { id: "dach", label: "Regen aufs Dach (drinnen)", code: () => AMB.roofRain(k().bus.innen) },
  { id: "nacht", label: "Nacht: Grillen und Eule", code: () => together(AMB.crickets(k().bus.innen), AMB.owl(k().bus.innen)) },
  { id: "bienen", label: "Mittag: Bienen", code: () => AMB.bees(k().bus.innen) },
  { id: "gewitter", label: "Gewitter (erstes Grollen nach ~6 s)", code: () => AMB.thunder(k().bus.innen) },
];
/** Dauerklang anhören: läuft 12 s oder bis stop(). */
export function probeSchleife(id: string, q: Quelle): Loop | null {
  const s = PROBE_SCHLEIFEN.find((x) => x.id === id); if (!s || !freigeben()) return null;
  const l = q === "cc0" && s.cc0 ? s.cc0() : s.code();
  return l;
}
let rede: Rede | null = null;
/** Eine Stimme anhören (mit den Werten aus den Reglern, auch ungespeichert). */
export function probeStimme(id: string, text: string, v?: Stimme): Rede | null {
  if (!freigeben()) return null;
  rede?.stop();
  rede = speak(id, text, v ?? stimmeVon(useSimStore.getState().world, id));
  return rede;
}
/** Mittlerer Pegel eines Kanals in dB über `ms` Millisekunden (Messung, Tests). */
async function kanalPegel(c: Kanal | "master", ms = 1000): Promise<number> {
  const K = kern(); if (!K) return -Infinity;
  const an = K.ctx.createAnalyser(); an.fftSize = 2048; (c === "master" ? K.master : K.bus[c]).connect(an);
  const buf = new Float32Array(an.fftSize); let sum = 0, n = 0;
  const end = performance.now() + ms;
  while (performance.now() < end) { an.getFloatTimeDomainData(buf); for (const x of buf) sum += x * x; n += buf.length; await new Promise((r) => setTimeout(r, 40)); }
  an.disconnect();
  return 10 * Math.log10(sum / Math.max(1, n) + 1e-12);
}
/** Für Tests und Messungen: Pegel am Ausgang und je Kanal, was läuft, Aufnahme laden, Zustand des Kontexts. */
export const messen = { zaehler, pegel: peakLevel, kanalPegel, laeuft, laden, zustand: () => kern()?.ctx.state ?? "aus", probeKlang, probeSchleife, probeStimme };
if (import.meta.env.DEV || location.search.includes("messen")) Object.assign(window, { __klang: messen });
