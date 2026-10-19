// Zustand der Modellverwaltung (AP17c-4): Gesamtzustand vom Backend (REST und WebSocket-Nachricht „models“), Hardware und Katalog.
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import type { CatalogOut, HardwareOut, LlmStatusOut } from "../types/generated";

export interface CatalogQuery { q: string; onlyFit: boolean; allPublishers: boolean }
export const DEFAULT_QUERY: CatalogQuery = { q: "", onlyFit: true, allPublishers: false };

interface ModelStore {
  status: LlmStatusOut | null;
  hardware: HardwareOut | null;
  catalog: CatalogOut | null;
  catalogBusy: boolean;
  catalogError: string | null;
  error: string | null;
  setStatus: (s: LlmStatusOut) => void;
  loadStatus: () => Promise<void>;
  loadHardware: () => Promise<void>;
  loadCatalog: (q: CatalogQuery, refresh?: boolean) => Promise<void>;
  /** Führt einen verändernden Aufruf aus; die Antwort ist der neue Gesamtzustand. Gibt zurück, ob es geklappt hat. */
  run: (call: () => Promise<LlmStatusOut>) => Promise<boolean>;
  clearError: () => void;
}

const ACTIVE = ["preparing", "downloading", "verifying", "unpacking"];

/** Frage 42: nach dem Laden misst das Tool automatisch (überspringbar). Nur, wenn dieser Browser das Ende der Übertragung miterlebt hat
 *  (nicht beim Öffnen der Seite nach dem Laden), im eingebauten Betrieb mit Laufzeit und bei angehaltener Simulation. */
export function shouldAutoProbe(prev: LlmStatusOut | null, next: LlmStatusOut): string | null {
  const t = next.transfer, was = prev?.transfer;
  if (!t || t.kind !== "model" || t.phase !== "done" || !t.model_id || !was || was.id !== t.id || !ACTIVE.includes(was.phase)) return null;
  if (next.mode !== "builtin" || !next.runtime.installed || next.sim_running || (next.probe && (next.probe.phase === "starting" || next.probe.phase === "running"))) return null;
  return next.installed.some((m) => m.id === t.model_id) ? t.model_id : null;
}

const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");
let catalogCall = 0;                                                         // nur die neueste Antwort zählt (Tippen in der Suche)

export const useModelStore = create<ModelStore>((set) => ({
  status: null,
  hardware: null,
  catalog: null,
  catalogBusy: false,
  catalogError: null,
  error: null,
  setStatus: (status) => {
    const id = shouldAutoProbe(useModelStore.getState().status, status);
    set({ status });
    if (id) void useModelStore.getState().run(() => api.probeModel(id));
  },
  loadStatus: async () => {
    try { set({ status: await api.llm() }); } catch (e) { set({ error: detail(e) }); }
  },
  loadHardware: async () => {
    try { set({ hardware: await api.hardware() }); } catch { /* der Kopf zeigt dann nichts */ }
  },
  loadCatalog: async (q, refresh = false) => {
    const mine = ++catalogCall;
    set({ catalogBusy: true, catalogError: null });
    try {
      const catalog = await api.catalog({ q: q.q.trim(), only_fit: q.onlyFit, publishers: q.allPublishers ? "all" : "trusted", refresh: refresh || undefined, limit: 50 });
      if (mine === catalogCall) set({ catalog, hardware: catalog.hardware, catalogBusy: false });
    } catch (e) {
      if (mine === catalogCall) set({ catalogBusy: false, catalogError: detail(e) });
    }
  },
  run: async (call) => {
    try {
      const status = await call();
      set({ error: null });
      useModelStore.getState().setStatus(status);
      return true;
    } catch (e) {
      set({ error: detail(e) });
      return false;
    }
  },
  clearError: () => set({ error: null }),
}));
