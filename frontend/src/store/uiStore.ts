// Zustand der Oberfläche: Auswahl, Kamera-Folgen, Protokollfilter. Nichts davon gehört in die Simulation.
import { create } from "zustand";
import type { EventCategory } from "../types/generated";

export type Selection = { kind: "agent" | "location" | "event"; id: string } | null;

export interface Filters {
  categories: Record<EventCategory, boolean>;
  agent: string | null;
  text: string;
  moves: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  categories: { world: true, dialogue: true, planning: true, memory: true, system: false },
  agent: null,
  text: "",
  moves: false,
};

interface UiStore {
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
  selection: null,
  lastAgent: null,
  follow: null,
  filters: DEFAULT_FILTERS,
  select: (selection) => set((s) => ({ selection, lastAgent: selection?.kind === "agent" ? selection.id : s.lastAgent })),
  setFollow: (follow) => set({ follow }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
}));
