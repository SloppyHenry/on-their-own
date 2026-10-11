import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "../test/fixtures";
import { useSimStore } from "../store/simStore";
import { atMinute, useComposer } from "./composerStore";
import { EXAMPLES, suggest } from "./suggestions";

const proposal = (o: Record<string, unknown>) => ({ id: "inj_1", text: "Heute regnet es.", status: "ready", source: "rule", ops: [], preview: ["Das Wetter wechselt zu Regen."], clarification: null, reason: "", mode: "observer", needs_confirmation: false, directive: false, at_minute: null, created: 420, executed: null, event_seqs: [], ...o });
let calls: { url: string; body: Record<string, unknown> | null }[];
const answer = (...responses: Record<string, unknown>[]) => {
  const queue = [...responses];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const next = url.includes("history") ? [] : queue.shift();
    return { ok: true, json: async () => next };
  });
};

beforeEach(() => {
  calls = [];
  useSimStore.getState().setSnapshot(makeSnapshot());
  useComposer.setState({ text: "", agents: [], when: { kind: "now" }, phase: "idle", proposal: null, message: "", history: [], historyOpen: false });
});
afterEach(() => vi.unstubAllGlobals());

describe("Eingabeleiste", () => {
  it("ein einfaches Ereignis wird gelesen und ohne weitere Bestätigung ausgeführt", async () => {
    answer(proposal({}), proposal({ status: "executed", event_seqs: [5] }));
    useComposer.getState().setText("Heute regnet es.");
    await useComposer.getState().submit();
    const s = useComposer.getState();
    expect(s.phase).toBe("done");
    expect(s.text).toBe("");
    expect(calls.filter((c) => !c.url.includes("history")).map((c) => c.url)).toEqual(["/api/inject/parse", "/api/inject/confirm"]);
    expect(calls[0].body).toMatchObject({ text: "Heute regnet es.", agents: null, at: null });
  });

  it("komplexe Ereignisse zeigen zuerst die Vorschau und laufen erst nach Bestätigung", async () => {
    answer(proposal({ status: "needs_confirmation", needs_confirmation: true }), proposal({ status: "executed" }));
    useComposer.getState().setText("Ein Fremder zieht in das Dorf.");
    await useComposer.getState().submit();
    expect(useComposer.getState().phase).toBe("preview");
    expect(calls.some((c) => c.url.includes("confirm"))).toBe(false);
    await useComposer.getState().confirm();
    expect(useComposer.getState().phase).toBe("done");
  });

  it("eine Rückfrage wird gestellt und die Antwort geht mit der Kennung der Eingabe zurück", async () => {
    const q = { question: "Wann?", options: [{ label: "Morgen", value: 2520 }], op: 0, field: "when", free_text: true };
    answer(proposal({ status: "needs_clarification", clarification: q }), proposal({ status: "ready" }), proposal({ status: "executed" }));
    useComposer.getState().setText("Mira erhält eine Einladung.");
    await useComposer.getState().submit();
    expect(useComposer.getState().phase).toBe("clarify");
    await useComposer.getState().answer(2520);
    expect(calls[1].body).toEqual({ answer_to: "inj_1", answer: 2520 });
    expect(useComposer.getState().phase).toBe("done");
  });

  it("eine Ablehnung zeigt den Grund und lässt den Text zum Ändern stehen", async () => {
    answer(proposal({ status: "rejected", reason: "Den Ort „Mars“ gibt es nicht." }));
    useComposer.getState().setText("Auf dem Mars landet etwas");
    await useComposer.getState().submit();
    const s = useComposer.getState();
    expect(s.phase).toBe("rejected");
    expect(s.message).toBe("Den Ort „Mars“ gibt es nicht.");
    expect(s.text).toBe("Auf dem Mars landet etwas");
  });

  it("Zeitpunkt und gewählte Figuren gehen mit, danach gilt wieder „sofort“", async () => {
    answer(proposal({ status: "needs_confirmation" }), proposal({ status: "executed" }));
    const c = useComposer.getState();
    c.toggleAgent("mira");
    c.setWhen({ kind: "in", minutes: 30 });
    c.setText("Heute regnet es.");
    await useComposer.getState().submit();
    expect(calls[0].body).toMatchObject({ agents: ["mira"], at: atMinute({ kind: "in", minutes: 30 }, useSimStore.getState().world!.clock.minute) });
    await useComposer.getState().confirm();
    expect(useComposer.getState().when).toEqual({ kind: "now" });
  });

  it("Netzwerkfehler und leere Eingabe", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    await useComposer.getState().submit();
    expect(useComposer.getState().phase).toBe("idle");
    useComposer.getState().setText("Heute regnet es.");
    await useComposer.getState().submit();
    expect(useComposer.getState().phase).toBe("error");
  });
});

describe("Zeitpunkt und Vorschläge", () => {
  it("rechnet Zeitangaben in Simulationsminuten um", () => {
    expect(atMinute({ kind: "now" }, 420)).toBeNull();
    expect(atMinute({ kind: "in", minutes: 120 }, 420)).toBe(540);
    expect(atMinute({ kind: "clock", day: 2, hour: 18, minute: 30 }, 420)).toBe(1440 + 1110);
  });

  it("zeigt Beispiele und filtert beim Tippen", () => {
    expect(suggest("", null)).toEqual(expect.arrayContaining(EXAMPLES.slice(0, 5)));
    expect(suggest("markt", null)).toEqual(["Am zentralen Platz findet morgen ein Markt statt."]);
    expect(suggest("zzzz", null)).toEqual([]);
  });
});
