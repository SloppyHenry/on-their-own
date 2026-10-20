// Entwurf der neuen Simulation (AP17b): alles, was der Assistent erfasst, und der Anfragekörper daraus. Reine Funktionen ohne Zustand.
import type { NewSimRequest, TemplateOut, Voice } from "../types/generated";
import { VORGABE, anfrage, type Stil } from "../welten/stellgroessen";
import { PKEYS, type Personality, type Profile } from "./begrenzung";
import { REL_DEFAULT, type Rel } from "./wuerfeln";

export type Known = "square" | "garden" | "rooms" | "lake" | "forest";
export const KNOWN: [Known, string][] = [["square", "Dorfplatz"], ["garden", "Garten"], ["rooms", "Gemeinschaftsräume (Werkstatt, Küche)"], ["lake", "See"], ["forest", "Wald"]];
export type Lake = "auto" | "east" | "south";
export type Mode = "observer" | "creator" | "intervention";
export const START_IDS = ["alex", "mira"];

export interface ResidentDraft {
  /** Vorlage, aus der die Figur stammt („“ = selbst geschrieben). */
  tpl: string;
  profile: Profile;
  personality: Personality;
  /** „Wohnt schon in Haus N“; null = sucht sich selbst eine Bleibe. */
  home: number | null;
  known: Known[];
  voice: Voice | null;
}
export interface WorldDraft { kind: "start" | "generated" | "library"; /** Welt aus der Bibliothek (Art „library“, AP18e). */ libraryId: string | null; /** Stellgrößen des Generators (AP18f). */ stil: Stil; seed: number; lake: Lake; houses: number | null; mix: Record<string, number> | null }
/** Ein bestätigtes Startereignis (Weltregeln als Text): der geprüfte Vorschlag der Ereigniseingabe. */
export interface StartEvt { text: string; source: "rule" | "llm"; ops: Record<string, unknown>[]; preview: string[] }
export type WeltEreignisse = "aus" | "selten" | "manchmal" | "oft";
export interface RulesDraft { /** Ereignisse von allein (AP18i); null = die Einstellung, wie sie ist. */ worldEvents: WeltEreignisse | null; preset: string; autonomy: number | null; scarcity: number | null; mode: Mode; creatorText: string; events: StartEvt[] }
export type PlayMode = "leben" | "gott";
export interface Draft {
  /** Spielart (AP18d): wer die Welt verändern darf. */
  playMode: PlayMode;
  world: WorldDraft;
  residents: ResidentDraft[];
  rel: Record<string, Rel>;
  stories: Record<string, string>;
  rules: RulesDraft;
  /** Modell der neuen Simulation; „“ = das bisherige. */
  model: string;
  run: "paused" | "running";
  dice: { seed: number; n: number };
}

export const CREATOR_TEXT = "Du weißt, dass diese Welt und ihre Bewohner von jemandem außerhalb geschaffen wurden, der gelegentlich zusieht und die Welt verändern kann. Du darfst darüber nachdenken oder davon erzählen, musst es aber nicht.";
export const DEFAULT_KNOWN: Known[] = ["square", "garden", "rooms"];

export const blankProfile = (name = ""): Profile => ({ name, gender: "divers", age: 30, description: "", background: "", interests: [], dislikes: [], goals: [], communication_style: "" });
export const blankPersonality = (): Personality => Object.fromEntries(PKEYS.map((k) => [k, 50])) as Personality;
export const blankResident = (name = ""): ResidentDraft => ({ tpl: "", profile: blankProfile(name), personality: blankPersonality(), home: null, known: [...DEFAULT_KNOWN], voice: null });
export const fromTemplate = (t: TemplateOut): ResidentDraft => ({ ...blankResident(), tpl: t.id, profile: structuredClone(t.profile) as unknown as Profile, personality: structuredClone(t.personality) as unknown as Personality });

export const newDraft = (seed = 1 + Math.floor(Math.random() * 99999)): Draft => ({
  playMode: "leben",
  world: { kind: "generated", libraryId: null, stil: { ...VORGABE }, seed, lake: "auto", houses: null, mix: null },
  residents: [],
  rel: {},
  stories: {},
  rules: { worldEvents: null, preset: "", autonomy: null, scarcity: null, mode: "observer", creatorText: CREATOR_TEXT, events: [] },
  model: "",
  run: "paused",
  dice: { seed: 7, n: 0 },
});

/** Gebäude für n Bewohner wie im Backend (`default_mix`): höchstens 2 Personen je Wohnhaus, dazu Werkstatt und Laden; ab 5 ein Stall, ab 7 eine Scheune. */
export function defaultMix(n: number): Record<string, number> {
  const mix: Record<string, number> = { house: Math.max(1, Math.ceil(n / 2)), workshop: 1, shop: 1 };
  if (n >= 5) mix.stable = 1;
  if (n >= 7) mix.barn = 1;
  return mix;
}
export const houseCount = (d: Draft) => d.world.houses ?? defaultMix(d.residents.length).house;
export const otherBuildings = (d: Draft) => ({ shop: 0, workshop: 0, barn: 0, stable: 0, ...(d.world.mix ?? Object.fromEntries(Object.entries(defaultMix(d.residents.length)).filter(([k]) => k !== "house"))) });

export const relOf = (d: Draft, a: number, b: number): Rel => d.rel[`${a}>${b}`] ?? REL_DEFAULT;
export const pairKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
export const relChanged = (r: Rel) => (Object.keys(REL_DEFAULT) as (keyof Rel)[]).some((k) => r[k] !== REL_DEFAULT[k]);

/** Der Anfragekörper für Vorschau und Anlegen. Nur Geändertes geht mit: Beziehungen auf Standard, leere Vorgeschichten, unberührte Regler bleiben weg. */
export function toRequest(d: Draft): NewSimRequest {
  const n = d.residents.length, start = d.world.kind === "start", lib = d.world.kind === "library";
  const w = d.world;
  const mixKeys = d.world.mix ? Object.fromEntries(Object.entries(d.world.mix).filter(([, v]) => v > 0)) : undefined;
  const relations = Object.entries(d.rel).flatMap(([k, r]) => {
    const [a, b] = k.split(">").map(Number);
    return a < n && b < n && relChanged(r) ? [{ a, b, ...r }] : [];
  });
  const stories = Object.entries(d.stories).flatMap(([k, text]) => {
    const [a, b] = k.split("-").map(Number);
    return a < n && b < n && text.trim() ? [{ a, b, text: text.trim() }] : [];
  });
  return {
    world: start ? { kind: "start" } : lib ? { kind: "library", library_id: d.world.libraryId } : { kind: "generated", seed: w.seed, lake: w.lake, ...(anfrage(w.stil) ? { style: anfrage(w.stil)! } : {}), ...(w.houses ? { houses: w.houses } : {}), ...(mixKeys ? { mix: mixKeys } : {}) },
    residents: d.residents.map((r) => ({ template: r.tpl || null, profile: r.profile, personality: r.personality, home: start || lib ? null : r.home, known: r.known, voice: r.voice })) as unknown as NewSimRequest["residents"],
    relations,
    stories,
    rules: {
      ...(d.rules.preset ? { preset: d.rules.preset } : {}),
      ...(d.rules.autonomy !== null ? { autonomy: d.rules.autonomy } : {}),
      ...(d.rules.scarcity !== null ? { scarcity: d.rules.scarcity } : {}),
      ...(d.rules.worldEvents ? { world_events: d.rules.worldEvents } : {}),
      mode: d.rules.mode,
      ...(d.rules.mode === "creator" && d.rules.creatorText.trim() ? { creator_text: d.rules.creatorText } : {}),
      ...(d.rules.events.length ? { events: d.rules.events.map((e) => ({ text: e.text, source: e.source, ops: e.ops })) } : {}),
    },
    ...(d.model ? { model: d.model } : {}),
    run: d.run,
    play_mode: d.playMode,
  };
}
