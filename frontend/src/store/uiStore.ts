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
/** Anwendungsmodus: das Spiel selbst, der Welteditor (AP12c) und das Menü zum Spielbeginn. Nur im Spiel gibt es die Infoleiste rechts (Bewohner, Protokoll, Details). */
export type SideTab = "bewohner" | "protokoll" | "ansicht";
export type AppMode = "game" | "editor" | "menu";
/** Menü (AP17a): Titelbild beim Öffnen, Pausenmenü mit Esc. Die Simulation läuft in beiden weiter; das Menü betrifft nur diesen Browser. */
export type MenuMode = "title" | "pause" | null;
export type MenuPane = "newsim" | "load" | "editors" | "settings";

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
  /** Einstellungen (Parameter, Presets, Status) als Schublade über der Welt. */
  settingsOpen: boolean;
  settingsTab: string;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  openMemory: (agent: string | null) => void;
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
  setMenu: (m: MenuMode) => void;
  /** Titelbild beim Öffnen (je Gerät gemerkt, Standard an). */
  titleOnStart: boolean;
  setTitleOnStart: (on: boolean) => void;
  /** Infoleiste rechts eingeklappt (je Gerät gemerkt). Im Editor und im Startmenü ist sie ohnehin aus. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Reiter der Infoleiste: Bewohner, Protokoll, Ansicht (je Gerät gemerkt). */
  sideTab: SideTab;
  setSideTab: (t: SideTab) => void;
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
  settingsOpen: false,
  settingsTab: "autonomy",
  openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
  closeSettings: () => set({ settingsOpen: false }),
  openMemory: (memoryAgent) => set({ view: "memory", memoryAgent, selection: null }),
  selection: null,
  lastAgent: null,
  follow: null,
  filters: DEFAULT_FILTERS,
  select: (selection) => set((s) => ({ selection, lastAgent: selection?.kind === "agent" ? selection.id : s.lastAgent })),
  setFollow: (follow) => set({ follow }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  worldMode: load<ViewMode>("simulacra.ansicht", "tiefe") === "flach" ? "flach" : "tiefe",
  setWorldMode: (worldMode) => { keep("simulacra.ansicht", worldMode); set({ worldMode }); },
  appMode: "game",
  setAppMode: (appMode) => set({ appMode }),
  menu: load<boolean>("simulacra.titelbild", true) === false ? null : "title",
  setMenu: (menu) => set({ menu }),
  titleOnStart: load<boolean>("simulacra.titelbild", true) !== false,
  setTitleOnStart: (titleOnStart) => { keep("simulacra.titelbild", titleOnStart); set({ titleOnStart }); },
  sidebarCollapsed: load<boolean>("simulacra.infoleiste-zu", false) === true,
  toggleSidebar: () => set((s) => { keep("simulacra.infoleiste-zu", !s.sidebarCollapsed); return { sidebarCollapsed: !s.sidebarCollapsed }; }),
  sideTab: ((t) => (t === "protokoll" || t === "ansicht" ? t : "bewohner"))(load<string>("simulacra.reiter", "bewohner")),
  setSideTab: (sideTab) => { keep("simulacra.reiter", sideTab); set({ sideTab }); },
  playerPreview: load<boolean>("simulacra.mitspieler", false) === true,
  setPlayerPreview: (playerPreview) => { keep("simulacra.mitspieler", playerPreview); set({ playerPreview }); },
}));
