// Klang (AP17d): Einstellungen „Ton“ – an/aus, Lautstärke gesamt und je Kanal, Quelle je Kanal (Code oder CC0). Wie die Darstellung je Gerät
// gemerkt (localStorage). Die Stimmen der Bewohner gehören dagegen zur Welt und wandern mit dem Spielstand (`World.voices`, PUT /api/agents/{id}/voice).
import { create } from "zustand";
import type { Stimme } from "./stimmen";

export type Quelle = "code" | "cc0";
export type Regler = "music" | "amb" | "fig" | "voice";
export interface TonStand {
  an: boolean;
  gesamt: number;
  vol: Record<Regler, number>;
  quelle: Record<"music" | "amb" | "fig", Quelle>;
}
const KEY = "simulacra.ton";
export const TON_STANDARD: TonStand = {
  an: true, gesamt: 0.8,
  vol: { music: 0.45, amb: 0.55, fig: 0.6, voice: 0.75 },
  quelle: { music: "cc0", amb: "code", fig: "code" },
};
function load(): TonStand {
  try {
    const raw = localStorage.getItem(KEY);
    // automatisierte Browser (Tests) bleiben stumm, solange nichts gespeichert ist
    if (raw == null) return { ...TON_STANDARD, an: !(typeof navigator !== "undefined" && navigator.webdriver) };
    const v = JSON.parse(raw) as Partial<TonStand>;
    return { an: v.an ?? TON_STANDARD.an, gesamt: v.gesamt ?? TON_STANDARD.gesamt, vol: { ...TON_STANDARD.vol, ...v.vol }, quelle: { ...TON_STANDARD.quelle, ...v.quelle } };
  } catch { return TON_STANDARD; }
}
const keep = (s: TonStand) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ohne Speicher gilt der Standard */ } };

export interface TonStore extends TonStand {
  set(patch: Partial<TonStand>): void;
  setVol(k: Regler, v: number): void;
  setQuelle(k: "music" | "amb" | "fig", q: Quelle): void;
}
const pick = (s: TonStore): TonStand => ({ an: s.an, gesamt: s.gesamt, vol: s.vol, quelle: s.quelle });
export const useTon = create<TonStore>((set, get) => ({
  ...load(),
  set: (patch) => { set(patch); keep(pick(get())); },
  setVol: (k, v) => { set((s) => ({ vol: { ...s.vol, [k]: v } })); keep(pick(get())); },
  setQuelle: (k, q) => { set((s) => ({ quelle: { ...s.quelle, [k]: q } })); keep(pick(get())); },
}));

/** Stimmen, die eine frühere Fassung im Browser gespeichert hat (vor dem 19.10.2026); beim Start gelesen und einmal in die Welt übernommen. */
const ALT = ((): Record<string, Partial<Stimme>> | null => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { stimmen?: Record<string, Partial<Stimme>> } | null; return v?.stimmen && Object.keys(v.stimmen).length ? v.stimmen : null; } catch { return null; }
})();
export const alteStimmen = () => ALT;
export const alteStimmenVergessen = () => keep(pick(useTon.getState()));
