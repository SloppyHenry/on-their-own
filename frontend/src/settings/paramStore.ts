// Zustand der Einstellungen: Schema, aktuelle Werte (vom Verbraucher gemeldet), Status je Regler. Änderungen gehen gedrosselt an die API.
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import type { ParamResult, ParamValues } from "../types/generated";
import { TEXTE } from "./aufbau";
import { registerSpecs, type Spec } from "./labels";

/** Name, Erklärung und Auswahl so, wie die Oberfläche sie zeigt (aufbau.ts); ohne Eintrag bleibt der Text des Backends. */
const mitTexten = (s: Spec): Spec => {
  const t = TEXTE[s.key];
  if (!t) return s;
  return { ...s, label: t.l ?? s.label, help: t.h ?? s.help, options: t.o ? s.options.map(([v, l]) => [v, t.o![v] ?? l]) : s.options };
};

export type Status = { status: string; reason: string | null };
export const idOf = (key: string, agent?: string | null) => (agent ? `${key}|${agent}` : key);
const THROTTLE_MS = 250;

interface ParamStore {
  specs: Spec[];
  groups: { id: string; label: string }[];
  values: ParamValues | null;
  /** Status der letzten Änderung je Regler. */
  status: Record<string, Status>;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  set: (key: string, value: unknown, agent?: string | null) => void;
  reset: (body: { keys?: string[]; group?: string; agent?: string }) => Promise<void>;
  applyResults: (results: ParamResult[], values: ParamValues) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queued = new Map<string, { key: string; value: unknown; agent: string | null }>();

export const useParamStore = create<ParamStore>((set, get) => {
  const send = async () => {
    const changes = [...queued.values()];
    queued.clear();
    timers.clear();
    if (!changes.length) return;
    try {
      const r = await api.patchParams(changes);
      get().applyResults(r.results, r.values);
    } catch (e) {
      const text = e instanceof ApiError ? e.detail : "Backend nicht erreichbar";
      set((s) => ({ error: text, status: { ...s.status, ...Object.fromEntries(changes.map((c) => [idOf(c.key, c.agent), { status: "rejected", reason: text }])) } }));
    }
  };
  return {
    specs: [],
    groups: [],
    values: null,
    status: {},
    error: null,
    load: async () => {
      if (get().specs.length) return;
      try {
        const [schema, values] = await Promise.all([api.paramSchema(), api.params()]);
        const specs = (schema.specs as Spec[]).map(mitTexten);
        registerSpecs(specs);
        set({ specs, groups: schema.groups, values, error: null });
      } catch (e) {
        set({ error: e instanceof ApiError ? e.detail : "Backend nicht erreichbar" });
      }
    },
    refresh: async () => {
      if (queued.size) return;                                      // eigene Änderung unterwegs: nicht mit dem alten Stand überschreiben
      try {
        set({ values: await api.params() });
      } catch {
        /* nächster Versuch beim nächsten Ereignis */
      }
    },
    set: (key, value, agent = null) => {
      const id = idOf(key, agent);
      set((s) => {
        if (!s.values) return s;
        const cur = s.values.values[key];
        const next = agent ? { ...(cur as Record<string, unknown>), [agent]: value } : value;
        return { values: { ...s.values, values: { ...s.values.values, [key]: next } }, status: { ...s.status, [id]: { status: "sending", reason: null } } };
      });
      queued.set(id, { key, value, agent });
      if (!timers.has(id)) timers.set(id, setTimeout(() => void send(), THROTTLE_MS));     // höchstens eine Anfrage je Regler und 250 ms; der letzte Wert gewinnt
    },
    reset: async (body) => {
      try {
        const r = await api.resetParams(body);
        get().applyResults(r.results, r.values);
      } catch (e) {
        set({ error: e instanceof ApiError ? e.detail : "Backend nicht erreichbar" });
      }
    },
    applyResults: (results, values) =>
      set((s) => ({
        values: queued.size ? s.values : values,
        error: null,
        status: { ...s.status, ...Object.fromEntries(results.map((r) => [idOf(r.key, r.agent), { status: r.status, reason: r.reason }])) },
      })),
  };
});
