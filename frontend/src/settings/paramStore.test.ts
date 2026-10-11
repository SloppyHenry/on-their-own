import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeEvent } from "../timeline/describeEvent";
import { ev } from "../test/fixtures";
import { registerSpecs, shown, type Spec } from "./labels";
import { idOf, useParamStore } from "./paramStore";

const spec = (o: Partial<Spec>): Spec => ({ key: "k", group: "g", scope: "global", type: "int", label: "L", help: "h", default: 0, min: 0, max: 100, step: 1, unit: "", options: [], effect: "immediate", effect_text: "sofort", locked: null, warn: null, max_len: null, ...o });
const values = (v: Record<string, unknown>) => ({ agents: ["alex", "mira"], values: v, defaults: {}, changed: [] });
const names = { agent: (id: string) => id, location: (id: string) => id };

let calls: { method: string; body: unknown }[];
const answer = (status: string, reason: string | null = null) => async (_url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body));
  calls.push({ method: init.method ?? "GET", body });
  return { ok: true, json: async () => ({ results: body.changes.map((c: { key: string; agent?: string; value: unknown }) => ({ key: c.key, agent: c.agent ?? null, status, reason, old: 0, new: c.value })), values: values({ k: body.changes.at(-1).value }) }) };
};

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  useParamStore.setState({ specs: [spec({})], values: values({ k: 0, p: { alex: 50, mira: 50 } }), status: {}, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Parameter-Store", () => {
  it("drosselt Schieberbewegungen: viele Werte, eine Anfrage mit dem letzten", async () => {
    vi.stubGlobal("fetch", answer("applied"));
    const { set } = useParamStore.getState();
    [10, 20, 30, 40, 55].forEach((v) => set("k", v));
    expect(useParamStore.getState().values!.values.k).toBe(55);                       // sofort sichtbar
    expect(useParamStore.getState().status.k.status).toBe("sending");
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({ changes: [{ key: "k", value: 55, agent: null }] });
    expect(useParamStore.getState().status.k).toEqual({ status: "applied", reason: null });
  });

  it("trennt Agenten und Regler: jede Kombination hat ihren eigenen Status", async () => {
    vi.stubGlobal("fetch", answer("pending_next_decision"));
    const { set } = useParamStore.getState();
    set("p", 70, "alex");
    set("p", 20, "mira");
    expect((useParamStore.getState().values!.values.p as Record<string, number>)).toEqual({ alex: 70, mira: 20 });
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(1);
    expect((calls[0].body as { changes: unknown[] }).changes).toHaveLength(2);
    expect(useParamStore.getState().status[idOf("p", "alex")].status).toBe("pending_next_decision");
    expect(useParamStore.getState().status[idOf("p", "mira")].status).toBe("pending_next_decision");
  });

  it("zeigt eine Ablehnung mit Grund und überschreibt den Wert nicht stillschweigend", async () => {
    vi.stubGlobal("fetch", answer("rejected", "Der Wert muss zwischen 0 und 100 liegen."));
    useParamStore.getState().set("k", 500);
    await vi.advanceTimersByTimeAsync(300);
    expect(useParamStore.getState().status.k).toEqual({ status: "rejected", reason: "Der Wert muss zwischen 0 und 100 liegen." });
  });

  it("meldet Netzwerkfehler am Regler", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500, statusText: "kaputt", json: async () => ({ detail: "Datenbank gesperrt" }) }));
    useParamStore.getState().set("k", 5);
    await vi.advanceTimersByTimeAsync(300);
    expect(useParamStore.getState().status.k).toEqual({ status: "rejected", reason: "Datenbank gesperrt" });
  });
});

describe("Beschriftungen", () => {
  it("zeigt Werte lesbar", () => {
    expect(shown(true)).toBe("an");
    expect(shown(0.35, spec({ unit: "" }))).toBe("0.35");
    expect(shown(36, spec({ unit: "Sim-Std." }))).toBe("36 Sim-Std.");
    expect(shown("max", spec({ type: "enum", options: [["max", "max."]] }))).toBe("max.");
    expect(shown("")).toBe("–");
    expect(shown("x".repeat(60)).length).toBeLessThan(45);
  });

  it("Protokollsatz für eine Parameteränderung nennt Namen, alten und neuen Wert", () => {
    registerSpecs([spec({ key: "world.scarcity", label: "Knappheit", unit: "%" })]);
    const d = describeEvent(ev("simulation.parameter_changed", { group: "world", key: "world.scarcity", old: 0, new: 40, agent: null, status: "applied" }), names);
    expect(d.text).toBe("Einstellung „Knappheit“: 0 → 40.");
    expect(describeEvent(ev("simulation.parameter_changed", { group: "world_rules", rules: {} }), names).text).toBe("Parameter geändert: world_rules.");
  });
});
