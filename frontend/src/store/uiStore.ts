// Zustand der Oberfläche: Auswahl, Kamera-Folgen, Protokollfilter. Nichts davon gehört in die Simulation.
import { create } from "zustand";
import type { EventCategory } from "../types/generated";
import type { ViewMode } from "../world/view/projection";

// Darstellungs-Einstellungen bleiben im Browser (je Gerät), nicht in der Simulation (offene Frage 21).
const load = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v == null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
};
const keep = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ohne Speicher gilt der Standard */ } };

export type Selection = { kind: "agent" | "location" | "event"; id: string } | null;

export interface Filters {
  categories: Record<EventCategory, boolean>;
  agent: string | null;
  text: string;
  moves: boolean;
  /** Nur Fehlschläge: abgelehnte oder gescheiterte Aktionen, unbrauchbare Antworten, Schutzmechanismen. */
  failures: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  categories: { world: true, dialogue: true, planning: true, memory: false, system: false },
  agent: null,
  text: "",
  moves: false,
  failures: false,
};

export type View = "world" | "memory" | "history" | "stats";
/** Anwendungsmodus: das Spiel selbst, der Welteditor (AP12c) und das Menü zum Spielbeginn. Nur im Spiel gibt es die HUD-Teile in den Ecken (AP18b). */
export type AppMode = "game" | "editor" | "menu";
/** Menü (AP17a): Titelbild beim Öffnen, Pausenmenü mit Esc. Die Simulation läuft in beiden weiter; das Menü betrifft nur diesen Browser. */
export type MenuMode = "title" | "pause" | null;
export type MenuPane = "newsim" | "load" | "editors" | "settings";
/** Eine Stelle im Menü (Bereich und Unterebene): dorthin kehrt Esc zurück, wenn man das Menü für einen Editor verlassen hat (AP18a). */
export interface MenuStelle { menu: Exclude<MenuMode, null>; sel: string | null; sub: string | null }

interface UiStore {
  view: View;
  /** Agent, dessen Gedächtnis der Inspektor zeigt. */
  memoryAgent: string | null;
  setView: (v: View) => void;
  /** Dialog für Speichern, Laden, Export und Import. */
  savesOpen: boolean;
  setSavesOpen: (open: boolean) => void;
  /** Wunsch an die Weltansicht, eine Kachel zu zeigen (z. B. nach einem neuen Objekt aus der Ereigniseingabe). */
  focusRequest: { x: number; y: number; n: number } | null;
  focusOn: (x: number, y: number) => void;
  /** Bereich in den Einstellungen (Menü › Einstellungen). `openSettings` öffnet das Menü dort (es gibt keine Schublade mehr). */
  settingsTab: string;
  openSettings: (tab?: string) => void;
  /** Gedächtnis-Seite (Einblick): Agent und Reiter („memories“, „knowledge“, „retrievals“). */
  memoryTab: string;
  openMemory: (agent: string | null, tab?: string) => void;
  /** Tagebuch (Protokoll und Verlauf in einem) als Schublade rechts. */
  drawer: "tagebuch" | null;
  setDrawer: (d: "tagebuch" | null) => void;
  /** „Wenig Text in der Welt“ (Variante B der Blasen, AP18c): nur Zeichen über den Köpfen, der Gedanke erscheint beim Zeigen. Je Gerät gemerkt. */
  wenigText: boolean;
  setWenigText: (on: boolean) => void;
  /** Offenes Popover über den Werkzeugen unten in der Mitte (Ereignis). */
  pop: "ereignis" | null;
  setPop: (p: "ereignis" | null) => void;
  /** Hilfe auf „?“ (blendet sich beim ersten Start einmal ein). */
  help: boolean;
  setHelp: (on: boolean) => void;
  selection: Selection;
  /** Zuletzt gewählter Agent: Taste F folgt ihm auch nach dem Schließen des Details. */
  lastAgent: string | null;
  follow: string | null;
  filters: Filters;
  select: (s: Selection) => void;
  setFollow: (id: string | null) => void;
  setFilters: (patch: Partial<Filters>) => void;
  /** Weltansicht „Tiefe“ (gewölbt, Mockup A) oder „Flach“. */
  worldMode: ViewMode;
  setWorldMode: (m: ViewMode) => void;
  appMode: AppMode;
  setAppMode: (m: AppMode) => void;
  menu: MenuMode;
  /** Öffnet oder schließt das Menü. Beim Öffnen steht die Auswahl wieder auf dem ersten Punkt. */
  setMenu: (m: MenuMode) => void;
  /** Gewählter Menüpunkt (null = der erste) und Unterebene darin (z. B. Assistent, Charaktereditor). */
  menuSel: string | null;
  menuSub: string | null;
  setMenuSel: (id: string | null) => void;
  setMenuSub: (sub: string | null) => void;
  /** Wohin Esc oder „Zurück“ aus einem Editor führt, den man aus dem Menü geöffnet hat; null = ins Spiel. */
  returnTo: MenuStelle | null;
  setReturnTo: (s: MenuStelle | null) => void;
  /** Öffnet das Menü genau an dieser Stelle. */
  openMenuAt: (s: MenuStelle) => void;
  /** Titelbild beim Öffnen (je Gerät gemerkt, Standard an). */
  titleOnStart: boolean;
  setTitleOnStart: (on: boolean) => void;
  /** Mitspieler-Steuerung als Vorschau (AP13): Klick geht/handelt, schickt aber nichts an die Simulation. */
  playerPreview: boolean;
  setPlayerPreview: (on: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  view: "world",
  memoryAgent: null,
  setView: (view) => set({ view }),
  savesOpen: false,
  setSavesOpen: (savesOpen) => set({ savesOpen }),
  focusRequest: null,
  focusOn: (x, y) => set((s) => ({ focusRequest: { x, y, n: (s.focusRequest?.n ?? 0) + 1 } })),
  settingsTab: "autonomy",
  openSettings: (tab) => set((s) => ({ menu: s.menu ?? "pause", menuSel: "settings", menuSub: null, settingsTab: tab ?? s.settingsTab })),
  memoryTab: "memories",
  openMemory: (memoryAgent, tab) => set((s) => ({ view: "memory", memoryAgent, memoryTab: tab ?? s.memoryTab, selection: null, drawer: null })),
  drawer: null,
  setDrawer: (drawer) => set((s) => ({ drawer, selection: drawer ? null : s.selection })),
  wenigText: load<boolean>("simulacra.wenig-text", false) === true,
  setWenigText: (wenigText) => { keep("simulacra.wenig-text", wenigText); set({ wenigText }); },
  pop: null,
  setPop: (pop) => set({ pop }),
  help: !load<boolean>("simulacra.hilfe-gesehen", false),
  setHelp: (help) => { if (!help) keep("simulacra.hilfe-gesehen", true); set({ help }); },
  selection: null,
  lastAgent: null,
  follow: null,
  filters: DEFAULT_FILTERS,
  select: (selection) => set((s) => ({ selection, lastAgent: selection?.kind === "agent" ? selection.id : s.lastAgent, drawer: selection?.kind === "agent" ? null : s.drawer })),
  setFollow: (follow) => set({ follow }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  worldMode: load<ViewMode>("simulacra.ansicht", "tiefe") === "flach" ? "flach" : "tiefe",
  setWorldMode: (worldMode) => { keep("simulacra.ansicht", worldMode); set({ worldMode }); },
  appMode: "game",
  setAppMode: (appMode) => set({ appMode }),
  menu: load<boolean>("simulacra.titelbild", true) === false ? null : "title",
  setMenu: (menu) => set({ menu, menuSel: null, menuSub: null }),
  menuSel: null,
  menuSub: null,
  setMenuSel: (menuSel) => set({ menuSel }),
  setMenuSub: (menuSub) => set({ menuSub }),
  returnTo: null,
  setReturnTo: (returnTo) => set({ returnTo }),
  openMenuAt: (s) => set({ menu: s.menu, menuSel: s.sel, menuSub: s.sub, returnTo: null }),
  titleOnStart: load<boolean>("simulacra.titelbild", true) !== false,
  setTitleOnStart: (titleOnStart) => { keep("simulacra.titelbild", titleOnStart); set({ titleOnStart }); },
  playerPreview: load<boolean>("simulacra.mitspieler", false) === true,
  setPlayerPreview: (playerPreview) => { keep("simulacra.mitspieler", playerPreview); set({ playerPreview }); },
}));
