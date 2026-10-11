// Zustand der Eingabeleiste: Eingabe, Auswahl, Phase der Verarbeitung (lesen → Rückfrage → Vorschau → ausgeführt), Verlauf. Alles Wirkliche passiert im Backend.
import { create } from "zustand";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import type { InjectProposal } from "../types/generated";
import { remember } from "./suggestions";

export type Phase = "idle" | "reading" | "clarify" | "preview" | "executing" | "done" | "rejected" | "error";
export type When = { kind: "now" } | { kind: "in"; minutes: number } | { kind: "clock"; day: number; hour: number; minute: number };

interface Composer {
  text: string;
  agents: string[];
  when: When;
  phase: Phase;
  proposal: InjectProposal | null;
  message: string;
  history: InjectProposal[];
  historyOpen: boolean;
  setText: (t: string) => void;
  toggleAgent: (id: string) => void;
  setWhen: (w: When) => void;
  submit: () => Promise<void>;
  answer: (value: string | number) => Promise<void>;
  confirm: () => Promise<void>;
  cancel: () => void;
  loadHistory: () => Promise<void>;
  toggleHistory: () => void;
}

export const atMinute = (w: When, now: number): number | null => (w.kind === "now" ? null : w.kind === "in" ? now + w.minutes : (w.day - 1) * 1440 + w.hour * 60 + w.minute);

const errText = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");

export const useComposer = create<Composer>((set, get) => {
  const apply = async (p: InjectProposal) => {
    if (p.status === "needs_clarification") return set({ phase: "clarify", proposal: p, message: "" });
    if (p.status === "needs_confirmation") return set({ phase: "preview", proposal: p, message: "" });
    if (p.status === "rejected") return set({ phase: "rejected", proposal: p, message: p.reason });
    if (p.status === "executed") return finished(p);
    set({ phase: "executing", proposal: p });                                    // „ready“: einfache Ereignisse laufen ohne weitere Bestätigung
    try {
      await apply(await api.injectConfirm(p.id));
    } catch (e) {
      set({ phase: "error", message: errText(e) });
    }
  };
  const finished = (p: InjectProposal) => {
    remember(p.text);
    set({ phase: "done", proposal: p, text: "", when: { kind: "now" }, message: p.preview[0] ?? "ausgeführt" });          // ein Zeitpunkt gilt nur für die eine Eingabe
    void get().loadHistory();
    const events = useSimStore.getState().events;
    const made = events.find((e) => p.event_seqs.includes(e.seq) && e.type === "world.object_created") as { data: { object: { x: number | null; y: number | null } } } | undefined;
    if (made?.data.object.x != null) useUiStore.getState().focusOn(made.data.object.x, made.data.object.y ?? 0);
  };
  return {
    text: "", agents: [], when: { kind: "now" }, phase: "idle", proposal: null, message: "", history: [], historyOpen: false,
    setText: (text) => set({ text, ...(get().phase === "done" || get().phase === "rejected" || get().phase === "error" ? { phase: "idle", message: "" } : {}) }),
    toggleAgent: (id) => set((s) => ({ agents: s.agents.includes(id) ? s.agents.filter((a) => a !== id) : [...s.agents, id] })),
    setWhen: (when) => set({ when }),
    submit: async () => {
      const { text, agents, when } = get();
      if (!text.trim() || get().phase === "reading" || get().phase === "executing") return;
      set({ phase: "reading", message: "", proposal: null });
      const now = useSimStore.getState().world?.clock.minute ?? 0;
      try {
        await apply(await api.injectParse({ text: text.trim(), agents: agents.length ? agents : null, at: atMinute(when, now) }));
      } catch (e) {
        set({ phase: "error", message: errText(e) });
      }
    },
    answer: async (value) => {
      const p = get().proposal;
      if (!p) return;
      set({ phase: "reading", message: "" });
      try {
        await apply(await api.injectParse({ answer_to: p.id, answer: value }));
      } catch (e) {
        set({ phase: "error", message: errText(e) });
      }
    },
    confirm: async () => {
      const p = get().proposal;
      if (!p) return;
      set({ phase: "executing" });
      try {
        await apply(await api.injectConfirm(p.id));
      } catch (e) {
        set({ phase: "error", message: errText(e) });
      }
    },
    cancel: () => set({ phase: "idle", proposal: null, message: "" }),
    loadHistory: async () => {
      try {
        set({ history: await api.injectHistory(30) });
      } catch {
        /* Verlauf ist nur eine Hilfe */
      }
    },
    toggleHistory: () => {
      set((s) => ({ historyOpen: !s.historyOpen }));
      if (get().historyOpen) void get().loadHistory();
    },
  };
});
