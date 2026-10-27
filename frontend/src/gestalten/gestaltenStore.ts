// Zustand des Gestaltens (AP16b), gemeinsam für die Welt-Werkstatt (Weltdatei) und das Spiel in der Spielart Gott (laufende Welt):
// Werkzeug, angefangene Form, Entwurf (Aktionen mit Rückgängig), die Rechnung des Backends und die Prüfung am Cursor. Die Rechnung läuft nach jeder Änderung neu
// (die Aktionen sind klein, siehe Messung in AP16a); ihre Welt zeigt die Weltansicht statt der laufenden (Brücke).
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import { applySnapshot } from "../store/reducers";
import { useSimStore } from "../store/simStore";
import type { World } from "../store/types";
import { LEER, entfernen, hinzu, rueckgaengig, wiederholen } from "./entwurf";
import { rechne } from "./rechnen";
import { START_OPTIONEN, type Aktion, type Katalog, type Optionen, type Ort, type Punkt, type Rechnung, type Werkzeug } from "./typen";
import { kandidat, klickSchritt, wegFertig } from "./werkzeug";

export interface Probe { schluessel: string; ok: boolean; grund?: string | null; ort?: number[] | null }
export interface Uebernommen { backup: string | null; aktionen: number }

interface Gestalten {
  offen: boolean;
  ort: Ort;
  werkzeug: Werkzeug;
  opt: Optionen;
  pending: Punkt[];
  hover: Punkt | null;
  aktionen: Aktion[];
  wieder: Aktion[];
  rechnung: Rechnung | null;
  vorschau: World | null;
  busy: "rechnen" | "uebernehmen" | null;
  fehler: string | null;
  probe: Probe | null;
  katalog: Katalog | null;
  /** Im Spiel: die Zeit lief, als das Werkzeug geöffnet wurde (dann läuft sie beim Verlassen weiter). */
  lief: boolean;
  fertig: Uebernommen | null;
  /** Raster um den Zeiger anzeigen. */
  innen: boolean;
  /** Von der Weltansicht gesetzt: zurück vor das Haus. */
  verlasseInnen: (() => void) | null;
  setInnen: (an: boolean, verlasse?: (() => void) | null) => void;
  raster: boolean;
  setRaster: (an: boolean) => void;
  betrete: (ort: Ort, basis?: () => Record<string, unknown> | null) => Promise<void>;
  verlasse: () => Promise<void>;
  setWerkzeug: (w: Werkzeug) => void;
  setOpt: (o: Partial<Optionen>) => void;
  klick: (t: Punkt) => boolean;
  hoverAn: (t: Punkt | null) => void;
  wegBeenden: () => void;
  abbrechen: () => boolean;
  setze: (a: Aktion) => void;
  entferne: (i: number) => void;
  zurueck: () => void;
  wiederhole: () => void;
  verwerfen: () => void;
  /** Setzt einen gesicherten Entwurf (Aktionen) ein, z. B. nach einem Neuladen. */
  setzeEntwurf: (aktionen: Aktion[]) => void;
  /** Wartet auf die laufende Rechnung und liefert die Welt (Datei) mit allen Aktionen; leert den Entwurf. Nur Werkstatt. */
  festschreiben: () => Promise<Record<string, unknown> | null | undefined>;
  uebernehmen: () => Promise<boolean>;
}

const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");
const schluessel = (a: Aktion | null) => (a ? JSON.stringify(a) : "");
let katalogLaden: Promise<Katalog> | null = null;
let basisWelt: () => Record<string, unknown> | null = () => null;
let zaehler = 0, probeZaehler = 0, probeTimer: ReturnType<typeof setTimeout> | undefined, laufend: Promise<void> = Promise.resolve();
const cache = new Map<string, Probe>();

export const useGestalten = create<Gestalten>((set, get) => {
  /** Rechnet den Entwurf neu und setzt Prüfbericht und Vorschau; veraltete Antworten werden verworfen. */
  const neuRechnen = () => {
    const n = ++zaehler, { aktionen, ort } = get();
    cache.clear();
    if (aktionen.length === 0) { set({ rechnung: null, vorschau: null, busy: null, fehler: null }); laufend = Promise.resolve(); schiebeProbe(); return; }
    set({ busy: "rechnen" });
    laufend = rechne(ort, aktionen, basisWelt, true).then((r) => {
      if (n !== zaehler) return;
      set({ rechnung: r, vorschau: r.snapshot ? applySnapshot(r.snapshot) : null, busy: null, fehler: r.error ?? null });
      schiebeProbe();
    }, (e) => { if (n === zaehler) set({ busy: null, fehler: detail(e) }); });
  };

  /** Prüft nach kurzer Ruhe, ob der nächste Klick gehen würde („Fehler am Cursor“). */
  const schiebeProbe = () => {
    clearTimeout(probeTimer);
    const s = get(), a = s.offen ? kandidat(s.werkzeug, s.pending, s.hover, s.opt) : null, k = schluessel(a);
    if (!a) { if (s.probe) set({ probe: null }); return; }
    const hit = cache.get(k);
    if (hit) { set({ probe: hit }); return; }
    if (s.probe && s.probe.schluessel !== k) set({ probe: null });
    const p = ++probeZaehler;
    probeTimer = setTimeout(() => {
      void rechne(s.ort, [...get().aktionen, a], basisWelt, false).then((r) => {
        if (p !== probeZaehler) return;
        const st = r.stati[r.stati.length - 1], probe: Probe = { schluessel: k, ok: !!st?.ok, grund: st?.grund, ort: st?.ort };
        cache.set(k, probe);
        set({ probe });
      }, () => undefined);
    }, 140);
  };

  const aendern = (st: { aktionen: Aktion[]; wieder: Aktion[] }) => { set({ ...st, pending: [] }); neuRechnen(); };

  return {
    offen: false, ort: "werkstatt", werkzeug: "zeiger", opt: START_OPTIONEN, pending: [], hover: null, aktionen: [], wieder: [], rechnung: null, vorschau: null, busy: null,
    fehler: null, probe: null, katalog: null, lief: false, fertig: null, raster: true, innen: false, verlasseInnen: null,
    setInnen: (an, verlasseInnen = null) => { if (an !== get().innen) { set({ innen: an, werkzeug: "zeiger", pending: [], probe: null, verlasseInnen }); schiebeProbe(); } else set({ verlasseInnen }); },
    setRaster: (raster) => set({ raster }),
    betrete: async (ort, basis) => {
      zaehler++; cache.clear();
      basisWelt = basis ?? (() => null);
      set({ offen: true, ort, werkzeug: "zeiger", opt: START_OPTIONEN, pending: [], hover: null, aktionen: [], wieder: [], rechnung: null, vorschau: null, busy: null, fehler: null, probe: null, fertig: null,
        lief: ort === "spiel" && useSimStore.getState().world?.simulation.state === "running" });
      if (ort === "spiel" && get().lief) await api.pause().catch(() => undefined);                     // die Zeit steht still, solange das Werkzeug offen ist
      katalogLaden ??= api.gestaltenKatalog();
      katalogLaden.then((katalog) => set({ katalog }), () => { katalogLaden = null; });
    },
    verlasse: async () => {
      zaehler++; clearTimeout(probeTimer);
      const lief = get().offen && get().ort === "spiel" && get().lief;
      set({ offen: false, werkzeug: "zeiger", pending: [], hover: null, aktionen: [], wieder: [], rechnung: null, vorschau: null, busy: null, fehler: null, probe: null, lief: false });
      if (lief) await api.resume().catch(() => undefined);                                              // fortsetzen nur, wenn die Zeit vorher lief
    },
    setWerkzeug: (werkzeug) => { set({ werkzeug, pending: [], fehler: null, probe: null }); schiebeProbe(); },
    setOpt: (o) => { set({ opt: { ...get().opt, ...o } }); schiebeProbe(); },
    hoverAn: (hover) => { set({ hover }); schiebeProbe(); },
    klick: (t) => {
      const s = get();
      if (!s.offen) return false;
      if (t[0] < 0 || t[1] < 0) return true;
      if (s.werkzeug === "zeiger" || s.werkzeug === "gebiet" || s.werkzeug === "karte") return false;
      const { pending, aktion } = klickSchritt(s.werkzeug, s.pending, t, s.opt);
      if (aktion && s.probe && !s.probe.ok && s.probe.schluessel === schluessel(aktion)) return true;   // Verbotenes Setzen tut nichts; der Grund steht am Cursor, die angefangene Form bleibt
      set({ pending, fehler: null });
      if (aktion) get().setze(aktion); else schiebeProbe();
      return true;
    },
    wegBeenden: () => { const a = wegFertig(get().pending); if (a) get().setze(a); },
    abbrechen: () => {
      const s = get();
      if (s.pending.length) { set({ pending: [] }); schiebeProbe(); return true; }
      if (s.werkzeug !== "zeiger") { s.setWerkzeug("zeiger"); return true; }
      return false;
    },
    setze: (a) => aendern(hinzu({ aktionen: get().aktionen, wieder: get().wieder }, a)),
    entferne: (i) => aendern(entfernen({ aktionen: get().aktionen, wieder: get().wieder }, i)),
    zurueck: () => aendern(rueckgaengig({ aktionen: get().aktionen, wieder: get().wieder })),
    wiederhole: () => aendern(wiederholen({ aktionen: get().aktionen, wieder: get().wieder })),
    verwerfen: () => aendern(LEER),
    setzeEntwurf: (aktionen) => aendern({ aktionen, wieder: [] }),
    festschreiben: async () => {
      if (get().aktionen.length === 0) return undefined;
      await laufend;
      const r = get().rechnung;
      if (!r?.welt) return null;
      set({ aktionen: [], wieder: [], pending: [], rechnung: null, vorschau: null });
      zaehler++;
      return r.welt;
    },
    uebernehmen: async () => {
      const { aktionen, rechnung, ort } = get();
      if (ort !== "spiel" || !rechnung?.digest || !rechnung.ok || get().busy) return false;
      set({ busy: "uebernehmen", fehler: null });
      const seq = useSimStore.getState().world?.seq ?? 0;
      try {
        const r = await api.entwurfUebernehmen(aktionen, rechnung.digest);
        await liveCaughtUp(seq);
        set({ aktionen: [], wieder: [], pending: [], rechnung: null, vorschau: null, fertig: { backup: r.backup ?? null, aktionen: r.actions } });
        zaehler++;
        return true;
      } catch (e) { set({ fehler: detail(e) }); return false; } finally { set({ busy: null }); }
    },
  };
});

/** Wartet (höchstens 5 s), bis die laufende Welt im Browser angekommen ist, damit die Ansicht nicht zurückspringt. */
function liveCaughtUp(seq: number): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => (useSimStore.getState().world?.seq ?? 0) > seq;
    if (ready()) return resolve();
    const stop = () => { off(); clearTimeout(t); resolve(); };
    const off = useSimStore.subscribe(() => ready() && stop()), t = setTimeout(stop, 5000);
  });
}

export const anzahl = () => useGestalten.getState().aktionen.length;
