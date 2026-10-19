// Zustand des Assistenten „Neue Simulation“ (AP17b): der Entwurf (bleibt je Gerät im Browser, bis er angelegt oder verworfen wird), die Vorschau und was gerade läuft.
// Die Vorschau ist nie die Simulation: sie gilt nur für genau diesen Entwurf (`key`); ändert er sich, ist sie veraltet.
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import { applySnapshot } from "../store/reducers";
import { useSimStore } from "../store/simStore";
import type { World } from "../store/types";
import type { CheckOut, HouseOut, NewSimApplied, NewSimLimits, ResidentOut, TemplateOut } from "../types/generated";
import { FALLBACK_LIMITS } from "./begrenzung";
import { blankResident, fromTemplate, newDraft, pairKey, START_IDS, toRequest, type Draft, type ResidentDraft, type WorldDraft } from "./entwurf";
import { wuerfelBeziehung, wuerfelFigur, type Rel } from "./wuerfeln";

const STORAGE = "simulacra.entwurf";

export interface PreviewState {
  /** Für welchen Entwurf die Vorschau gilt (Anfragekörper als Text). */
  key: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  residents: ResidentOut[];
  houses: HouseOut[];
  world: World | null;
  digest: string | null;
  village: string;
  counts: Record<string, number>;
  checks: CheckOut[];
}

export interface Limits { maxResidents: number; secondsPerDecision: number; maxPerHouse: number }

interface Store {
  draft: Draft;
  step: number;
  sel: number;
  pair: [number, number] | null;
  templates: TemplateOut[];
  limits: Limits;
  preview: PreviewState | null;
  busy: "preview" | "apply" | null;
  error: string | null;
  done: NewSimApplied | null;
  load: () => Promise<void>;
  setStep: (n: number) => void;
  setWorld: (patch: Partial<WorldDraft>) => void;
  setN: (n: number) => void;
  select: (i: number) => void;
  setPair: (p: [number, number] | null) => void;
  patchResident: (i: number, patch: Partial<ResidentDraft>) => void;
  takeTemplate: (i: number, id: string) => void;
  roll: (i: number) => void;
  setRel: (a: number, b: number, patch: Partial<Rel>) => void;
  rollRel: (a: number, b: number) => void;
  resetRel: (a: number, b: number) => void;
  setStory: (a: number, b: number, text: string) => void;
  patchDraft: (patch: Partial<Draft>) => void;
  setRules: (patch: Partial<Draft["rules"]>) => void;
  setDiceSeed: (seed: number) => void;
  discard: () => void;
  runPreview: () => Promise<PreviewState | null>;
  create: () => Promise<boolean>;
}

const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");
export const requestKey = (d: Draft) => JSON.stringify(toRequest(d));

function stored(): { draft: Draft; step: number; sel: number } | null {
  try {
    const j = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
    if (!j || !j.draft || !Array.isArray(j.draft.residents)) return null;
    j.draft.rules = { ...newDraft().rules, ...j.draft.rules };                          // Entwürfe aus älteren Fassungen bekommen die neuen Felder
    return j;
  } catch { return null; }
}
const keep = (s: Pick<Store, "draft" | "step" | "sel">) => { try { localStorage.setItem(STORAGE, JSON.stringify({ draft: s.draft, step: s.step, sel: s.sel })); } catch { /* ohne Speicher bleibt der Entwurf nur in diesem Fenster */ } };

const s0 = stored();

export const useAssistent = create<Store>((set, get) => {
  /** Ändert den Entwurf, merkt ihn und macht eine Vorschau, die nicht mehr passt, unsichtbar (sie bleibt für `runPreview` ungültig, weil der Schlüssel abweicht). */
  const edit = (fn: (d: Draft) => Draft, extra: Partial<Store> = {}) => {
    set((s) => ({ draft: fn(s.draft), done: null, ...extra }));
    keep(get());
  };
  const limitN = (kind: WorldDraft["kind"], n: number) => Math.max(1, Math.min(kind === "start" ? 2 : get().limits.maxResidents, n));
  const fill = (d: Draft, n: number, templates: TemplateOut[]): Draft => {
    const rs = d.residents.slice(0, n);
    while (rs.length < n) {
      const used = new Set(rs.map((r) => r.tpl));
      const next = templates.find((t) => !used.has(t.id) && (d.world.kind !== "start" || START_IDS.includes(t.id)) && t.builtin);
      rs.push(next ? fromTemplate(next) : blankResident(`Neu ${rs.length + 1}`));
    }
    return { ...d, residents: rs };
  };
  return {
    draft: s0?.draft ?? newDraft(),
    step: s0?.step ?? 0,
    sel: s0?.sel ?? 0,
    pair: null,
    templates: [],
    limits: { maxResidents: FALLBACK_LIMITS.maxResidents, secondsPerDecision: FALLBACK_LIMITS.secondsPerDecision, maxPerHouse: FALLBACK_LIMITS.maxPerHouse },
    preview: null,
    busy: null,
    error: null,
    done: null,
    load: async () => {
      try {
        const [templates, l] = await Promise.all([api.templates(), api.newSimLimits().catch((): NewSimLimits | null => null)]);
        set((s) => ({ templates, limits: l ? { maxResidents: l.max_residents, secondsPerDecision: l.seconds_per_decision, maxPerHouse: l.max_per_house } : s.limits }));
        if (get().draft.residents.length === 0) edit((d) => fill(d, 2, templates));            // Standard: Alex und Mira
      } catch (e) { set({ error: detail(e) }); }
    },
    setStep: (step) => { set({ step }); keep(get()); },
    setWorld: (patch) => edit((d) => {
      const next = { ...d, world: { ...d.world, ...patch } };
      if (patch.kind !== "start") return next;
      const t = get().templates, own = (i: number) => t.find((x) => x.id === START_IDS[i]);                          // die Startwelt hat Zimmer nur für Alex und Mira
      return { ...next, residents: next.residents.slice(0, 2).map((r, i) => (START_IDS.includes(r.tpl) || !own(i) ? r : { ...fromTemplate(own(i)!), home: null })) };
    }),
    setN: (n) => edit((d) => fill(d, limitN(d.world.kind, n), get().templates), { pair: null, sel: Math.min(get().sel, limitN(get().draft.world.kind, n) - 1) }),
    select: (sel) => { set({ sel, pair: null }); keep(get()); },
    setPair: (pair) => set({ pair }),
    patchResident: (i, patch) => edit((d) => ({ ...d, residents: d.residents.map((r, j) => (j === i ? { ...r, ...patch } : r)) })),
    takeTemplate: (i, id) => {
      const t = get().templates.find((x) => x.id === id);
      edit((d) => ({ ...d, residents: d.residents.map((r, j) => (j === i ? (t ? { ...fromTemplate(t), home: r.home } : { ...blankResident(`Neu ${i + 1}`), home: r.home }) : r)) }));
    },
    roll: (i) => edit((d) => {
      const dice = { ...d.dice, n: d.dice.n + 1 }, w = wuerfelFigur(dice.seed, dice.n, d.residents.filter((_, j) => j !== i).map((r) => r.profile.name));
      return { ...d, dice, residents: d.residents.map((r, j) => (j === i ? { ...r, profile: { ...r.profile, name: w.name, age: w.age }, personality: w.personality } : r)) };
    }),
    setRel: (a, b, patch) => edit((d) => ({ ...d, rel: { ...d.rel, [`${a}>${b}`]: { ...(d.rel[`${a}>${b}`] ?? { trust: 50, sympathy: 50, tension: 10, familiarity: 30 }), ...patch } } })),
    rollRel: (a, b) => edit((d) => {
      const dice = { ...d.dice, n: d.dice.n + 1 };
      return { ...d, dice, rel: { ...d.rel, [`${a}>${b}`]: wuerfelBeziehung(dice.seed, dice.n * 2), [`${b}>${a}`]: wuerfelBeziehung(dice.seed, dice.n * 2 + 1) } };
    }),
    resetRel: (a, b) => edit((d) => {
      const rel = { ...d.rel }, stories = { ...d.stories };
      delete rel[`${a}>${b}`]; delete rel[`${b}>${a}`]; delete stories[pairKey(a, b)];
      return { ...d, rel, stories };
    }),
    setStory: (a, b, text) => edit((d) => ({ ...d, stories: { ...d.stories, [pairKey(a, b)]: text } })),
    patchDraft: (patch) => edit((d) => ({ ...d, ...patch })),
    setRules: (patch) => edit((d) => ({ ...d, rules: { ...d.rules, ...patch } })),
    setDiceSeed: (seed) => edit((d) => ({ ...d, dice: { ...d.dice, seed } })),
    discard: () => {
      const draft = fill(newDraft(), 2, get().templates);
      set({ draft, step: 0, sel: 0, pair: null, preview: null, error: null, done: null });
      keep(get());
    },
    runPreview: async () => {
      const draft = get().draft, key = requestKey(draft);
      set({ busy: "preview", error: null });
      try {
        const p = await api.newSimPreview(toRequest(draft));
        if (requestKey(get().draft) !== key) return null;                                  // der Entwurf hat sich währenddessen geändert: Antwort verwerfen
        const pv: PreviewState = { key, ok: p.ok && !!p.digest && !!p.snapshot, errors: p.errors.length ? p.errors : p.report && !p.report.ok ? p.report.errors : [], warnings: p.warnings, residents: p.residents, houses: p.houses,
          world: p.snapshot ? applySnapshot(p.snapshot) : null, digest: p.digest, village: p.village ?? "", counts: p.counts, checks: p.report?.checks ?? [] };
        set({ preview: pv });
        return pv;
      } catch (e) {
        set({ error: detail(e), preview: null });
        return null;
      } finally { set({ busy: null }); }
    },
    create: async () => {
      const { draft, preview } = get();
      if (!preview || !preview.ok || !preview.digest || preview.key !== requestKey(draft)) return false;
      set({ busy: "apply", error: null });
      try {
        const done = await api.newSimApply(toRequest(draft), preview.digest);
        set({ done });
        await worldArrived(preview.world?.worldName ?? done.village);
        return true;
      } catch (e) {
        set({ error: detail(e) });
        return false;
      } finally { set({ busy: null }); }
    },
  };
});

/** Nach dem Anlegen: der Entwurf ist verbraucht (neuer, leerer Entwurf), die Vorschau weg. */
export function clearDraftAfterCreate() {
  const s = useAssistent.getState();
  s.discard();
}

/** Wartet (höchstens 5 s), bis die neue Welt im Browser angekommen ist. */
function worldArrived(name: string): Promise<void> {
  const ready = () => useSimStore.getState().world?.worldName === name;
  return new Promise((resolve) => {
    if (ready()) return resolve();
    const done = () => { off(); clearTimeout(t); resolve(); };
    const off = useSimStore.subscribe(() => ready() && done()), t = setTimeout(done, 5000);
  });
}
