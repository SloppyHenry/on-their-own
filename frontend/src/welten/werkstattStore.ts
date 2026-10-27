// Zustand der Welt-Werkstatt (AP18e): ein Entwurf einer Weltdatei aus der Bibliothek. Die Werkstatt arbeitet nie auf der laufenden Simulation: Die Ansicht zeigt eine
// Wegwerf-Simulation im Speicher (`POST /api/worlds/preview`), gespeichert wird die Datei. Der Entwurf liegt im Browser, bis er gespeichert oder verworfen wird.
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import { applySnapshot } from "../store/reducers";
import type { World } from "../store/types";
import { useUiStore } from "../store/uiStore";
import type { WorldInfoOut } from "../types/generated";
import { useGestalten } from "../gestalten/gestaltenStore";

export type Lake = "auto" | "east" | "south";
/** Eine Weltdatei (Format wie `world_default.json`); nur die Felder, die die Werkstatt selbst liest. */
export interface Weltdatei {
  name: string;
  size: [number, number];
  tiles: string[];
  tile_types: Record<string, { char: string; walkable: boolean; label: string }>;
  startplatz?: [number, number] | null;
  [k: string]: unknown;
}

interface Werkstatt {
  offen: boolean;
  info: WorldInfoOut | null;
  welt: Weltdatei | null;
  /** Der Entwurf als Text, wie er zuletzt gespeichert wurde: Unterschied = „ungespeichert“. */
  gespeichert: string;
  vorschau: World | null;
  seed: number;
  lake: Lake;
  gewaehlt: [number, number] | null;
  busy: "laden" | "vorschau" | "speichern" | "gebiet" | null;
  error: string | null;
  hinweis: string | null;
  oeffnen: (id: string) => Promise<boolean>;
  schliessen: () => void;
  /** Legt eine gesicherte Weltdatei (ungespeicherter Entwurf) über die frisch geöffnete und baut die Vorschau neu. */
  wiederherstellen: (welt: Weltdatei) => Promise<void>;
  setSeed: (n: number) => void;
  setLake: (l: Lake) => void;
  klick: (t: { x: number; y: number }) => boolean;
  /** Schreibt den Entwurf (Aktionen des Gestaltens) in die Welt im Speicher; `false`, wenn das nicht ging. Gespeichert wird erst mit `speichern`. */
  festschreiben: () => Promise<boolean>;
  gebietErzeugen: () => Promise<void>;
  speichern: () => Promise<boolean>;
  speichernAls: (name: string) => Promise<boolean>;
  umbenennen: (name: string) => void;
}

const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");
const text = (w: Weltdatei | null) => JSON.stringify(w);
export const ungespeichert = (s: Pick<Werkstatt, "welt" | "gespeichert">) => !!s.welt && text(s.welt) !== s.gespeichert;

/** Die Kachelart an einer Stelle (Name, Bezeichnung, begehbar). */
export function kachelAn(w: Weltdatei, x: number, y: number) {
  const ch = w.tiles[y]?.[x];
  const hit = Object.entries(w.tile_types).find(([, t]) => t.char === ch);
  return hit ? { art: hit[0], label: hit[1].label, begehbar: hit[1].walkable } : null;
}

export const useWerkstatt = create<Werkstatt>((set, get) => {
  const refresh = async () => {
    const w = get().welt;
    if (!w) return;
    set({ busy: "vorschau", error: null });
    try {
      const p = await api.previewWorld(w);
      if (get().welt !== w) return;                                                   // der Entwurf hat sich währenddessen geändert
      set({ vorschau: p.snapshot ? applySnapshot(p.snapshot) : null, error: p.snapshot ? null : (p.errors[0] ?? "Keine Vorschau.") });
    } catch (e) { set({ error: detail(e) }); } finally { set({ busy: null }); }
  };
  return {
    offen: false, info: null, welt: null, gespeichert: "", vorschau: null, seed: 1 + Math.floor(Math.random() * 99999), lake: "auto", gewaehlt: null,
    busy: null, error: null, hinweis: null,
    oeffnen: async (id) => {
      set({ busy: "laden", error: null, hinweis: null });
      try {
        const doc = await api.world(id);
        if (doc.info.readonly) { set({ error: "Diese Welt ist mitgeliefert und schreibgeschützt. „Kopie bearbeiten“ legt eine eigene an." }); return false; }
        const welt = doc.world as unknown as Weltdatei;
        set({ offen: true, info: doc.info, welt, gespeichert: text(welt), gewaehlt: null, vorschau: null });
        await refresh();
        return true;
      } catch (e) { set({ error: detail(e) }); return false; } finally { set({ busy: null }); }
    },
    schliessen: () => set({ offen: false, info: null, welt: null, gespeichert: "", vorschau: null, gewaehlt: null, error: null, hinweis: null }),
    wiederherstellen: async (welt) => { set({ welt, hinweis: "Entwurf wiederhergestellt." }); await refresh(); },
    setSeed: (seed) => set({ seed: Math.max(0, Math.min(2_000_000_000, Math.round(seed) || 0)) }),
    setLake: (lake) => set({ lake }),
    klick: (t) => {
      if (!get().offen || !get().welt) return false;
      set({ gewaehlt: [t.x, t.y], hinweis: null });
      return true;
    },
    festschreiben: async () => {
      const g = useGestalten.getState(), vorschau = g.vorschau;
      const welt = await g.festschreiben();
      if (welt === undefined) return true;
      if (!welt) { set({ error: "Der Entwurf lässt sich gerade nicht berechnen." }); return false; }
      set({ welt: { ...(welt as Weltdatei), startplatz: (welt.startplatz as [number, number] | null | undefined) ?? null }, vorschau: vorschau ?? get().vorschau, error: null });
      return true;
    },
    gebietErzeugen: async () => {
      if (!(await get().festschreiben())) return;
      const { welt, gewaehlt, seed, lake } = get();
      if (!welt) return;
      if (!gewaehlt) { set({ error: "Bitte zuerst in der Welt die linke obere Ecke des Gebiets anklicken." }); return; }
      set({ busy: "gebiet", error: null, hinweis: null });
      try {
        const r = await api.addArea(welt, gewaehlt, seed, lake);
        if (!r.ok || !r.world) { set({ error: r.error ?? (r.report as { errors?: string[] } | undefined)?.errors?.[0] ?? "Hier lässt sich kein Gebiet erzeugen." }); return; }
        set({ welt: { ...(r.world as unknown as Weltdatei), startplatz: welt.startplatz ?? null }, hinweis: `Gebiet „${r.village}“ erzeugt.` });
        await refresh();
      } catch (e) { set({ error: detail(e) }); } finally { set({ busy: null }); }
    },
    speichern: async () => {
      if (!(await get().festschreiben())) return false;
      const { info, welt } = get();
      if (!info || !welt) return false;
      set({ busy: "speichern", error: null });
      try {
        const i = await api.saveWorld(info.id, welt);
        set({ info: i, gespeichert: text(welt), hinweis: "Gespeichert." });
        return true;
      } catch (e) { set({ error: detail(e) }); return false; } finally { set({ busy: null }); }
    },
    speichernAls: async (name) => {
      if (!(await get().festschreiben())) return false;
      const { welt } = get();
      if (!welt) return false;
      set({ busy: "speichern", error: null });
      try {
        const i = await api.createWorld({ ...welt, name }, name);
        const doc = await api.world(i.id);
        const neu = doc.world as unknown as Weltdatei;
        set({ info: doc.info, welt: neu, gespeichert: text(neu), hinweis: `Gespeichert als „${name}“.` });
        return true;
      } catch (e) { set({ error: detail(e) }); return false; } finally { set({ busy: null }); }
    },
    umbenennen: (name) => { const w = get().welt; if (w) set({ welt: { ...w, name } }); },
  };
});

/** Verlässt die Werkstatt: zurück an die Menüstelle, aus der man kam (Editoren › Welten), sonst ins Spiel. */
export function verlasseWerkstatt() {
  void useGestalten.getState().verlasse();
  useWerkstatt.getState().schliessen();
  const ui = useUiStore.getState(), back = ui.returnTo;
  ui.setAppMode("game");
  if (back) ui.openMenuAt(back); else ui.setReturnTo(null);
}

/** Öffnet die Werkstatt auf einer eigenen Welt; `von` ist die Menüstelle, an die Esc zurückführt. */
export async function betreteWerkstatt(id: string, von: { menu: "title" | "pause"; sel: string | null; sub: string | null }): Promise<boolean> {
  if (!(await useWerkstatt.getState().oeffnen(id))) return false;
  const ui = useUiStore.getState();
  ui.setReturnTo(von);
  ui.setMenu(null);
  ui.setAppMode("editor");
  void useGestalten.getState().betrete("werkstatt", () => useWerkstatt.getState().welt);
  return true;
}
