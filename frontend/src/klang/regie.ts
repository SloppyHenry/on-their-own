// Klang (AP17d): Regie – Umgebung und Musik nach Tageszeit, Wetter und Ort (draußen oder in einem Haus), Lautstärken, Freigabe beim ersten Klick.
// Läuft für die ganze Anwendung (AppShell); die Weltansicht meldet sich mit ihrer Bühne an (buehne.ts), damit Klänge wissen, was zu sehen ist.
import { useSimStore } from "../store/simStore";
import type { World } from "../store/types";
import { housesOf, inRect, lookOf } from "../world/dorf/look";
import { aufnahmeMusik, aufnahmeSchleife, vorladen } from "./aufnahmen";
import { api } from "../net/api";
import type { Voice } from "../types/generated";
import { alteStimmen, alteStimmenVergessen, useTon, type TonStand } from "./einstellungen";
import { k, kern, setVolumes, setWand, startKern, type Loop } from "./kern";
import { startCodeMusic, type Stueck } from "./musik";
import { standardStimme, stopAllVoices } from "./stimmen";
import { AMB, together } from "./umgebung";

export type Tageszeit = "morgen" | "mittag" | "abend" | "nacht";
/** Tageszeit aus der Uhr der Welt (Stunde), nachts immer „nacht“. */
export function tageszeit(w: World | null): Tageszeit {
  if (!w) return "mittag";
  const h = Number(w.clock.time.slice(0, 2));
  if (w.clock.phase === "night" || h < 5 || h >= 21) return "nacht";
  return h < 10 ? "morgen" : h < 17 ? "mittag" : "abend";
}

/** Was die Ansicht gerade zeigt: Innenansicht eines Hauses (Index) oder -1. Setzt buehne.ts. */
export const ansicht = { interior: -1, aktiv: false };

/** Kern starten und fortsetzen (nur nach einer Geste des Nutzers erlaubt). */
export function freigeben(): boolean {
  const t = useTon.getState();
  if (!t.an) return false;
  const K = startKern(); if (!K) return false;
  if (K.ctx.state === "suspended") void K.ctx.resume();
  anwenden(t);
  return true;
}
const bereit = () => { const K = kern(); return !!K && K.ctx.state === "running" && useTon.getState().an; };
export const klangBereit = bereit;

function anwenden(t: TonStand) {
  const K = kern(); if (!K) return;
  setVolumes(t.an ? t.gesamt : 0, t.vol);
  if (!t.an && K.ctx.state === "running") { stopAllVoices(); void K.ctx.suspend(); }
  if (t.an && K.ctx.state === "suspended") void K.ctx.resume();
  if (t.quelle.fig === "cc0") vorladen();
}

/* ---------- Umgebung und Musik ---------- */
let ambKey = "", amb: Loop | null = null, innenKey = "", innen: Loop | null = null, musKey = "", mus: { stop(): void } | null = null;
export const laeuft = { musik: "", umgebung: "" };

function lit(w: World, kinds: string[], rect?: number[]) {
  return Object.values(w.objects).some((o) => kinds.includes(o.kind) && o.state.lit === true && o.x != null && o.y != null && (!rect || inRect(rect, o.x, o.y)));
}
function draussen(w: World | null, tod: Tageszeit, wx: string, src: "code" | "cc0"): Loop {
  const B = k().bus.amb, rainy = wx === "rain" || wx === "storm", storm = wx === "storm", L: Loop[] = [];
  if (src === "cc0") {
    L.push(rainy ? aufnahmeSchleife("regen", B, { level: storm ? 1.3 : 1 }) : aufnahmeSchleife("voegel", B, { level: tod === "nacht" ? 0.45 : wx === "snow" ? 0.4 : 1, rate: tod === "nacht" ? 0.8 : 1 }));
    L.push(aufnahmeSchleife("bach", B, { level: rainy ? 0.7 : 1 }));
  } else if (rainy) L.push(AMB.rain(B, storm ? 1.3 : 1), AMB.wind(B, storm ? 1.8 : 1.2), AMB.water(B, 0.6));
  else if (wx === "snow") L.push(AMB.wind(B, 0.7), AMB.water(B, 0.5));
  else {
    const few = wx === "cloudy" ? 0.6 : wx === "fog" ? 0.4 : 1;
    if (tod === "morgen") L.push(AMB.birds(B, 1.6 * few, { dove: true }), AMB.wind(B, 0.5), AMB.water(B));
    else if (tod === "mittag") L.push(AMB.birds(B, 0.9 * few), AMB.bees(B), AMB.wind(B, 0.6), AMB.water(B));
    else if (tod === "abend") L.push(AMB.birds(B, 0.35 * few), AMB.crickets(B, 0.6), AMB.wind(B, 0.5), AMB.water(B));
    else L.push(AMB.crickets(B), AMB.owl(B), AMB.wind(B, 0.4), AMB.water(B, 0.8));
  }
  if (storm) L.push(AMB.thunder(B));
  if (w && lit(w, ["firepit"])) L.push(AMB.fire(B, 0.35));
  return together(...L);
}

/** Einmal je halbe Sekunde: passt Umgebung und Musik an, wenn sich Tageszeit, Wetter, Ort oder Quelle geändert haben. */
function stimmung() {
  if (!bereit()) return;
  const w = useSimStore.getState().world, t = useTon.getState(), tod = tageszeit(w), wx = w?.weather.kind ?? "clear";
  const house = ansicht.aktiv ? ansicht.interior : -1, rainy = wx === "rain" || wx === "storm";
  setWand(house >= 0);
  const aKey = `${tod}|${wx}|${t.quelle.amb}|${w && lit(w, ["firepit"]) ? "f" : ""}`;
  if (aKey !== ambKey) { amb?.stop(); amb = draussen(w, tod, wx, t.quelle.amb); ambKey = aKey; laeuft.umgebung = aKey; }
  // drinnen: Regen trommelt aufs Dach, ein brennender Kamin knistert nah
  const look = w && house >= 0 ? lookOf(w) : null, H = look ? housesOf(look)[house]?.house ?? null : null, fire = !!H && !!w && lit(w, ["fireplace", "candle"], H.interior.rect);
  const iKey = H ? `${house}|${rainy}|${fire}` : "";
  if (iKey !== innenKey) {
    innen?.stop(); innen = null; innenKey = iKey;
    if (H) { const L: Loop[] = []; if (rainy) L.push(AMB.roofRain(k().bus.innen, wx === "storm" ? 1.3 : 1)); if (fire) L.push(AMB.fire(k().bus.innen, 0.8)); innen = together(...L); }
  }
  // Musik: draußen nach Tageszeit (bei Regen gedämpft), im Haus das eigene Lied; in den Einstellungen kann man jedes Stück anhören
  const stueck: Stueck = musikProbe ?? (H ? "drinnen" : tod), mKey = `${stueck}|${!H && rainy}|${t.quelle.music}|${tod === "nacht"}`;
  if (mKey !== musKey) {
    mus?.stop(); musKey = mKey;
    if (t.quelle.music === "cc0") { const m = aufnahmeMusik(stueck); k().musicTone.frequency.setTargetAtTime(!H && rainy ? 1900 : 18000, k().ctx.currentTime, 0.5); mus = m; laeuft.musik = m.label; }
    else { const m = startCodeMusic(stueck, { rain: !H && rainy, night: tod === "nacht" }); mus = m; laeuft.musik = m.label + " (Code)"; }
  }
}
let musikProbe: Stueck | null = null;
/** Ein Stück anhören (Einstellungen) statt der Musik zur Lage; null kehrt zurück. */
export function setMusikProbe(s: Stueck | null) { musikProbe = s; stimmung(); }
export const getMusikProbe = () => musikProbe;
/** Musik und Umgebung neu beginnen (nach dem Ausschalten oder Quellenwechsel). */
export function neuStimmen() { ambKey = innenKey = musKey = ""; }

/** Einmal: Stimmen aus dem Browser (frühere Fassung) in die Welt übernehmen, für Figuren, die dort noch keine haben. */
function uebernimmAlteStimmen(): () => void {
  const alt = alteStimmen(); if (!alt) return () => {};
  let done = false;
  const go = (w: World | null) => {
    if (done || !w) return; done = true;
    const jobs = Object.entries(alt).filter(([id]) => w.agents[id] && !w.voices?.[id])
      .map(([id, v]) => api.setVoice(id, { ...standardStimme(id, w.agents[id].profile), ...v } as Voice));
    void Promise.allSettled(jobs).then((r) => { if (r.every((x) => x.status === "fulfilled")) alteStimmenVergessen(); });
  };
  go(useSimStore.getState().world);
  return useSimStore.subscribe((s) => go(s.world));
}

/** Startet die Regie für die Anwendung; liefert das Aufräumen. */
export function startKlang(): () => void {
  const offAlt = uebernimmAlteStimmen();
  const gesture = () => { freigeben(); };
  window.addEventListener("pointerdown", gesture, true); window.addEventListener("keydown", gesture, true);
  const off = useTon.subscribe((t, prev) => {
    if (t.an && !prev.an) freigeben();
    anwenden(t);
    if (t.quelle !== prev.quelle) stimmung();
  });
  const timer = window.setInterval(stimmung, 500);
  return () => {
    window.removeEventListener("pointerdown", gesture, true); window.removeEventListener("keydown", gesture, true);
    off(); offAlt(); clearInterval(timer); amb?.stop(); innen?.stop(); mus?.stop(); amb = innen = mus = null; neuStimmen();
  };
}
