import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "../test/fixtures";
import { useSimStore } from "../store/simStore";
import { mixTotal, request, useEditorStore, wishKey, type Wish } from "./editorStore";

vi.mock("../net/api", async () => {
  const actual = await vi.importActual<typeof import("../net/api")>("../net/api");
  return { ...actual, api: { generate: vi.fn(), applyGenerated: vi.fn() } };
});
const { api } = await import("../net/api");

const wish: Wish = { kind: "extend", seed: 5, lake: "auto", mix: null, keepProfiles: false };
const look = (n: number) => ({ version: 2, regions: Array.from({ length: n }, (_, i) => ({ id: `r${i}` })), roads: [] });
const snap = (name = "Welt", regions = 1) => ({ ...makeSnapshot(), world_name: name, look: look(regions) });
const answer = (over: object = {}) => ({ kind: "extend", ok: true, error: null, report: { ok: true, errors: [], checks: [{ name: "Raster", ok: true, detail: "" }] }, digest: "abc", village: "Birkenau", seed: 5, focus: [3, 4], region: "v2", counts: { locations: 4 }, snapshot: snap("Vorschau", 2), ...over });

describe("Welteditor: Wunsch und Vorschau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSimStore.getState().setSnapshot(snap());
    useEditorStore.setState({ tab: "extend", wish, preview: null, busy: null, error: null, checks: [], done: null, fly: null });
  });

  it("Der Schlüssel des Wunsches erkennt jede Änderung, die das Dorf ändert", () => {
    expect(wishKey(wish)).toBe(wishKey({ ...wish, keepProfiles: true }));            // Profile betreffen nur das Anlegen, nicht das Dorf
    for (const w of [{ ...wish, seed: 6 }, { ...wish, lake: "south" as const }, { ...wish, mix: { house: 2 } }, { ...wish, kind: "new" as const }]) expect(wishKey(w)).not.toBe(wishKey(wish));
    expect(request({ ...wish, mix: { house: 2, shop: 1 } })).toEqual({ kind: "extend", seed: 5, lake: "auto", mix: { house: 2, shop: 1 } });
    expect(mixTotal({ house: 2, shop: 1 })).toBe(3);
  });

  it("Vorschau: ersetzt nur die angezeigte Welt, merkt Dorf und Ziel der Kamera, fordert die Kamerafahrt an", async () => {
    vi.mocked(api.generate).mockResolvedValue(answer() as never);
    await useEditorStore.getState().runPreview();
    const s = useEditorStore.getState();
    expect(s.preview).toMatchObject({ village: "Birkenau", focus: [3, 4], region: "v2", digest: "abc", key: wishKey(wish) });
    expect(s.preview?.world.worldName).toBe("Vorschau");
    expect(useSimStore.getState().world?.worldName).toBe("Welt");                      // die laufende Welt bleibt unberührt
    expect(s.fly).toMatchObject({ x: 3, y: 4 });
    expect(s.busy).toBeNull();
  });

  it("Ein abgelehntes Dorf zeigt Fehler und Prüfbericht statt einer Vorschau", async () => {
    vi.mocked(api.generate).mockResolvedValue(answer({ ok: false, error: "Kein gültiges Dorf nach 8 Versuchen", snapshot: null, digest: null, report: { ok: false, errors: ["x"], checks: [{ name: "Quellen", ok: false, detail: "unerreichbar" }] } }) as never);
    await useEditorStore.getState().runPreview();
    const s = useEditorStore.getState();
    expect(s.preview).toBeNull();
    expect(s.error).toContain("Kein gültiges Dorf");
    expect(s.checks[0]).toMatchObject({ name: "Quellen", ok: false });
  });

  it("Eine Antwort auf einen überholten Wunsch wird verworfen", async () => {
    vi.mocked(api.generate).mockImplementation(async () => { useEditorStore.getState().set({ seed: 99 }); return answer() as never; });
    await useEditorStore.getState().runPreview();
    expect(useEditorStore.getState().preview).toBeNull();
  });

  it("Übernehmen geht nur mit passender Vorschau und sendet deren Prüfsumme; die Vorschau bleibt, bis die laufende Welt dasselbe zeigt", async () => {
    expect(await useEditorStore.getState().runApply()).toBe(false);                    // ohne Vorschau
    vi.mocked(api.generate).mockResolvedValue(answer() as never);
    await useEditorStore.getState().runPreview();
    useEditorStore.getState().set({ seed: 6 });
    expect(await useEditorStore.getState().runApply()).toBe(false);                    // veraltete Vorschau
    expect(api.applyGenerated).not.toHaveBeenCalled();
    useEditorStore.getState().set({ seed: 5 });
    vi.mocked(api.applyGenerated).mockResolvedValue({ kind: "extend", village: "Birkenau", seed: 5, patch: "p", backup: "Vor dem Erweitern", counts: {}, focus: [3, 4] });
    const pending = useEditorStore.getState().runApply();
    await vi.waitFor(() => expect(useEditorStore.getState().preview?.applied).toBe(true));
    expect(api.applyGenerated).toHaveBeenCalledWith(expect.objectContaining({ digest: "abc", seed: 5, kind: "extend" }));
    useSimStore.getState().setSnapshot(snap("Vorschau", 2));   // die laufende Welt zieht nach
    await expect(pending).resolves.toBe(true);
    expect(useEditorStore.getState().preview).toBeNull();
    expect(useEditorStore.getState().done?.backup).toBe("Vor dem Erweitern");
  });

  it("Scheitert das Übernehmen, bleibt die Vorschau und der Fehler steht da", async () => {
    vi.mocked(api.generate).mockResolvedValue(answer() as never);
    await useEditorStore.getState().runPreview();
    const { ApiError } = await vi.importActual<typeof import("../net/api")>("../net/api");
    vi.mocked(api.applyGenerated).mockRejectedValue(new ApiError(409, "Die Welt hat sich seit der Vorschau geändert."));
    expect(await useEditorStore.getState().runApply()).toBe(false);
    expect(useEditorStore.getState().error).toContain("geändert");
    expect(useEditorStore.getState().preview).not.toBeNull();
  });
});
