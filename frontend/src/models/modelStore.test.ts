import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeInstalled, makeLlmStatus, makeTransfer } from "../test/llm";

vi.mock("../net/api", async () => {
  const actual = await vi.importActual<typeof import("../net/api")>("../net/api");
  return { ...actual, api: { llm: vi.fn(), hardware: vi.fn(), catalog: vi.fn(), probeModel: vi.fn(), downloadModel: vi.fn() } };
});
const { ApiError, api } = await import("../net/api");
const { shouldAutoProbe, useModelStore } = await import("./modelStore");

const during = makeLlmStatus({ transfer: makeTransfer({ phase: "verifying" }), installed: [] });
const after = (over = {}) => makeLlmStatus({ transfer: makeTransfer({ phase: "done" }), installed: [makeInstalled()], ...over });

beforeEach(() => {
  vi.clearAllMocks();
  useModelStore.setState({ status: null, error: null, catalog: null, hardware: null, catalogError: null, catalogBusy: false });
});

describe("automatischer Probelauf nach dem Laden (Frage 42)", () => {
  it("startet, wenn das Ende der Übertragung miterlebt wurde", () => {
    expect(shouldAutoProbe(during, after())).toBe("Qwen3-8B-Q4_K_M");
  });
  it("nicht beim bloßen Öffnen der Seite nach dem Laden", () => {
    expect(shouldAutoProbe(null, after())).toBeNull();
    expect(shouldAutoProbe(after(), after())).toBeNull();
  });
  it("nicht für eine andere Übertragung, für die Laufzeit oder bei Fehlschlag", () => {
    expect(shouldAutoProbe(makeLlmStatus({ transfer: makeTransfer({ id: "t0", phase: "downloading" }) }), after())).toBeNull();
    const rt = makeLlmStatus({ transfer: makeTransfer({ kind: "runtime", model_id: null, phase: "unpacking" }) });
    expect(shouldAutoProbe(rt, makeLlmStatus({ transfer: makeTransfer({ kind: "runtime", model_id: null, phase: "done" }) }))).toBeNull();
    expect(shouldAutoProbe(during, after({ transfer: makeTransfer({ phase: "failed", error: "x" }) }))).toBeNull();
  });
  it("nicht ohne eingebauten Betrieb, ohne Laufzeit, bei laufender Simulation oder laufendem Probelauf", () => {
    expect(shouldAutoProbe(during, after({ mode: "external" }))).toBeNull();
    expect(shouldAutoProbe(during, after({ runtime: { ...makeLlmStatus().runtime, installed: false } }))).toBeNull();
    expect(shouldAutoProbe(during, after({ sim_running: true }))).toBeNull();
    expect(shouldAutoProbe(during, after({ probe: { model_id: "x", phase: "running", step: 1, n: 10, error: null, result: null } }))).toBeNull();
  });
  it("nicht, wenn das Modell nicht im Bestand steht", () => {
    expect(shouldAutoProbe(during, after({ installed: [] }))).toBeNull();
  });
});

describe("Store", () => {
  it("setStatus übernimmt den Zustand und startet den Probelauf einmal", async () => {
    vi.mocked(api.probeModel).mockResolvedValue(makeLlmStatus({ probe: { model_id: "Qwen3-8B-Q4_K_M", phase: "starting", step: 0, n: 10, error: null, result: null } }));
    useModelStore.getState().setStatus(during);
    expect(api.probeModel).not.toHaveBeenCalled();
    useModelStore.getState().setStatus(after());
    await vi.waitFor(() => expect(useModelStore.getState().status?.probe?.phase).toBe("starting"));
    expect(api.probeModel).toHaveBeenCalledTimes(1);
    expect(api.probeModel).toHaveBeenCalledWith("Qwen3-8B-Q4_K_M");
    useModelStore.getState().setStatus(after());
    expect(api.probeModel).toHaveBeenCalledTimes(1);
  });

  it("run übernimmt die Antwort; ein Fehler steht im Store und lässt den Zustand unverändert", async () => {
    const ok = makeLlmStatus({ default_model: "a" });
    expect(await useModelStore.getState().run(async () => ok)).toBe(true);
    expect(useModelStore.getState().status).toBe(ok);
    expect(await useModelStore.getState().run(async () => { throw new ApiError(409, "Die Simulation läuft."); })).toBe(false);
    expect(useModelStore.getState().error).toBe("Die Simulation läuft.");
    expect(useModelStore.getState().status).toBe(ok);
    useModelStore.getState().clearError();
    expect(useModelStore.getState().error).toBeNull();
    expect(await useModelStore.getState().run(async () => { throw new Error("netz"); })).toBe(false);
    expect(useModelStore.getState().error).toBe("Backend nicht erreichbar");
  });

  it("loadCatalog: nur die neueste Antwort zählt", async () => {
    let first!: (v: unknown) => void;
    vi.mocked(api.catalog).mockImplementationOnce(() => new Promise((r) => { first = r; }) as never);
    vi.mocked(api.catalog).mockResolvedValueOnce({ hardware: { name: "neu" }, items: [], recommended: [], hidden: {}, total: 0, source: "live", fetched_at: null, note: null } as never);
    const slow = useModelStore.getState().loadCatalog({ q: "a", onlyFit: true, allPublishers: false });
    await useModelStore.getState().loadCatalog({ q: "ab", onlyFit: true, allPublishers: false });
    first({ hardware: { name: "alt" }, items: [], recommended: [], hidden: {}, total: 0, source: "live", fetched_at: null, note: null });
    await slow;
    expect(useModelStore.getState().hardware?.name).toBe("neu");
    expect(vi.mocked(api.catalog).mock.calls[1][0]).toMatchObject({ q: "ab", only_fit: true, publishers: "trusted" });
  });

  it("loadCatalog: Fehler stehen im Store, der alte Katalog bleibt", async () => {
    vi.mocked(api.catalog).mockRejectedValueOnce(new ApiError(502, "kaputt"));
    await useModelStore.getState().loadCatalog({ q: "", onlyFit: false, allPublishers: true }, true);
    expect(useModelStore.getState().catalogError).toBe("kaputt");
    expect(vi.mocked(api.catalog).mock.calls[0][0]).toMatchObject({ publishers: "all", refresh: true, only_fit: false });
  });
});
