// Zustand der Oberfläche: Auswahl, Kamera-Folgen, Protokollfilter. Nichts davon gehört in die Simulation.
import { create } from "zustand";
import type { EventCategory } from "../types/generated";

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

export type View = "world" | "memory";

interface UiStore {
  view: View;
  /** Agent, dessen Gedächtnis der Inspektor zeigt. */
  memoryAgent: string | null;
  setView: (v: View) => void;
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
}

export const useUiStore = create<UiStore>((set) => ({
  view: "world",
  memoryAgent: null,
  setView: (view) => set({ view }),
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
}));
