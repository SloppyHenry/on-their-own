// Zustand des Welteditors (AP12c): der Wunsch an den Generator, die Vorschau (eine ganze Welt, nur zur Ansicht) und was gerade läuft.
// Die Vorschau ist nie die Simulation: Sie ersetzt in der Weltansicht nur, was die Brücke als „Welt“ liefert (siehe worldBridge.ts).
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import { applySnapshot } from "../store/reducers";
import { useSimStore } from "../store/simStore";
import type { World } from "../store/types";
import { useUiStore } from "../store/uiStore";
import type { CheckOut, GenerateApplied, GenerateRequest } from "../types/generated";

export type Kind = "extend" | "new";
export type Lake = "auto" | "east" | "south";
export const ROLES = [["house", "Wohnhäuser"], ["shop", "Läden"], ["workshop", "Werkstätten"], ["barn", "Scheunen"], ["stable", "Ställe"]] as const;
export const MAX_EACH = 6, MAX_TOTAL = 10;

export interface Wish {
  kind: Kind;
  seed: number;
  lake: Lake;
  /** Gebäude je Art; null = Standard (drei Wohnhäuser und zwei Sondergebäude nach Zufall). */
  mix: Record<string, number> | null;
  keepProfiles: boolean;
}

export interface Preview {
  kind: Kind;
  world: World;
  /** Dorfplatz des neuen Dorfs (Kachel) und sein Gebiet in `world.look`; bei einer neuen Simulation keins von beiden. */
  focus: [number, number] | null;
  region: string | null;
  village: string;
  seed: number;
  digest: string;
  counts: Record<string, number>;
  checks: CheckOut[];
  /** Für welchen Wunsch die Vorschau gilt; ändert sich der Wunsch, ist sie veraltet. */
  key: string;
  /** Übernommen: die Vorschau bleibt noch stehen (ohne Schleier), bis die laufende Welt dasselbe zeigt – so springt die Kamera nicht. */
  applied?: boolean;
}

export const wishKey = (w: Wish) => JSON.stringify([w.kind, w.seed, w.lake, w.mix]);
export const request = (w: Wish): GenerateRequest => ({ kind: w.kind, seed: w.seed, lake: w.lake, mix: w.mix });
export const mixTotal = (m: Record<string, number> | null) => (m ? Object.values(m).reduce((a, b) => a + b, 0) : 0);

interface EditorStore {
  tab: Kind;
  wish: Wish;
  preview: Preview | null;
  busy: "preview" | "apply" | null;
  /** Fehlermeldung zur letzten Vorschau oder zum Übernehmen. */
  error: string | null;
  /** Prüfbericht der letzten Vorschau, auch wenn sie scheiterte. */
  checks: CheckOut[];
  done: GenerateApplied | null;
  /** Wunsch an die Weltansicht: dorthin fahren (Kachel). `n` zählt hoch, damit derselbe Ort erneut gewünscht werden kann. */
  fly: { x: number; y: number; n: number } | null;
  set: (patch: Partial<Wish>) => void;
  setTab: (t: Kind) => void;
  flyTo: (x: number, y: number) => void;
  clearFly: () => void;
  discard: () => void;
  runPreview: () => Promise<void>;
  runApply: () => Promise<boolean>;
}

const dice = () => 1 + Math.floor(Math.random() * 99999);
const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");

export const useEditorStore = create<EditorStore>((set, get) => ({
  tab: "extend",
  wish: { kind: "extend", seed: dice(), lake: "auto", mix: null, keepProfiles: false },
  preview: null,
  busy: null,
  error: null,
  checks: [],
  done: null,
  fly: null,
  set: (patch) => set((s) => ({ wish: { ...s.wish, ...patch }, done: null })),
  setTab: (tab) => {
    set((s) => ({ tab, wish: { ...s.wish, kind: tab }, preview: null, error: null, checks: [], done: null }));
    useUiStore.getState().setAppMode(tab === "new" ? "menu" : "editor");
  },
  flyTo: (x, y) => set((s) => ({ fly: { x, y, n: (s.fly?.n ?? 0) + 1 } })),
  clearFly: () => set({ fly: null }),
  discard: () => set({ preview: null, error: null, checks: [] }),
  runPreview: async () => {
    const wish = get().wish;
    set({ busy: "preview", error: null, done: null });
    try {
      const p = await api.generate(request(wish));
      if (wishKey(get().wish) !== wishKey(wish)) return;                         // der Wunsch hat sich währenddessen geändert: Antwort verwerfen
      if (!p.ok || !p.snapshot || !p.digest) {
        set({ preview: null, error: p.error ?? p.report.errors[0] ?? "Kein gültiges Dorf.", checks: p.report.checks });
        return;
      }
      const focus: [number, number] | null = p.focus ? [p.focus[0], p.focus[1]] : null;
      set({ preview: { kind: wish.kind, world: applySnapshot(p.snapshot), focus, region: p.region, village: p.village ?? "", seed: p.seed ?? wish.seed, digest: p.digest, counts: p.counts, checks: p.report.checks, key: wishKey(wish) }, checks: p.report.checks });
      if (focus) get().flyTo(focus[0], focus[1]);
    } catch (e) {
      set({ preview: null, error: detail(e) });
    } finally {
      set({ busy: null });
    }
  },
  runApply: async () => {
    const { preview, wish } = get();
    if (!preview || preview.key !== wishKey(wish)) return false;
    set({ busy: "apply", error: null });
    try {
      const done = await api.applyGenerated({ ...request(wish), digest: preview.digest, keep_profiles: wish.keepProfiles });
      set({ preview: { ...preview, applied: true }, checks: [], done, wish: { ...wish, seed: dice() } });
      await liveCaughtUp(preview);
      set({ preview: null });
      return true;
    } catch (e) {
      set({ error: detail(e) });
      return false;
    } finally {
      set({ busy: null });
    }
  },
}));

/** Wartet (höchstens 5 s), bis die laufende Welt im Browser angekommen ist: das neue Gebiet beziehungsweise die neue Simulation. */
function liveCaughtUp(p: Preview): Promise<void> {
  const regions = (w: World | null) => ((w?.look as { regions?: unknown[] } | null | undefined)?.regions ?? []).length;
  const ready = () => { const w = useSimStore.getState().world; return !!w && (p.kind === "new" ? w.worldName === p.world.worldName : regions(w) >= regions(p.world)); };
  return new Promise((resolve) => {
    if (ready()) return resolve();
    const stop = () => { off(); clearTimeout(t); resolve(); };
    const off = useSimStore.subscribe(() => ready() && stop()), t = setTimeout(stop, 5000);
  });
}

/** Beim Verlassen des Editors: Vorschau und Meldungen weg. */
export function leaveEditor() {
  useEditorStore.setState({ preview: null, error: null, checks: [], done: null });
  useUiStore.getState().setAppMode("game");
}

export function enterEditor(tab: Kind = "extend") {
  useEditorStore.getState().setTab(tab);
}
