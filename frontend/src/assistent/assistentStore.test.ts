import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "../test/fixtures";
import { useSimStore } from "../store/simStore";
import { requestKey, useAssistent } from "./assistentStore";
import { newDraft } from "./entwurf";

vi.mock("../net/api", async () => {
  const actual = await vi.importActual<typeof import("../net/api")>("../net/api");
  return { ...actual, api: { templates: vi.fn(), newSimLimits: vi.fn(), newSimPreview: vi.fn(), newSimApply: vi.fn() } };
});
const { api } = await import("../net/api");

const tpl = (id: string, name: string, builtin = true) => ({ id, builtin, profile: { name, gender: "divers", age: 30, description: "", background: "", interests: [], dislikes: [], goals: [], communication_style: "" }, personality: Object.fromEntries(["sociability", "curiosity", "helpfulness", "risk_taking", "conflict_readiness", "cooperation", "calm_need", "conversation_initiative", "suggestion_acceptance", "persistence", "spontaneity", "autonomy"].map((k) => [k, 50])) });
const TEMPLATES = [tpl("alex", "Alex"), tpl("mira", "Mira"), tpl("hanne", "Hanne"), tpl("jonas", "Jonas")];
const answer = (over: object = {}) => ({ ok: true, errors: [], warnings: [], residents: [], houses: [{ n: 1, name: "Haus Eiche", beds: 2 }], report: { ok: true, errors: [], checks: [{ name: "Raster", ok: true, detail: "" }] }, digest: "abc", village: "Lindental", seed: 5, counts: {}, snapshot: { ...makeSnapshot(), world_name: "Dorf Lindental" }, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.templates).mockResolvedValue(TEMPLATES as never);
  vi.mocked(api.newSimLimits).mockResolvedValue({ max_residents: 8, seconds_per_decision: 4.5, max_per_house: 2 } as never);
  useAssistent.setState({ draft: newDraft(5), step: 0, sel: 0, pair: null, templates: [], preview: null, busy: null, error: null, done: null });
});

describe("Assistent: Entwurf", () => {
  it("lädt Vorlagen und Grenzen und beginnt mit Alex und Mira", async () => {
    await useAssistent.getState().load();
    const s = useAssistent.getState();
    expect(s.templates).toHaveLength(4);
    expect(s.draft.residents.map((r) => r.tpl)).toEqual(["alex", "mira"]);
    expect(s.limits).toEqual({ maxResidents: 8, secondsPerDecision: 4.5, maxPerHouse: 2 });
  });

  it("die Zahl der Bewohner wächst mit den nächsten freien Vorlagen, dann leer, und endet bei 8", async () => {
    await useAssistent.getState().load();
    useAssistent.getState().setN(5);
    const names = () => useAssistent.getState().draft.residents.map((r) => r.profile.name);
    expect(names()).toEqual(["Alex", "Mira", "Hanne", "Jonas", "Neu 5"]);
    useAssistent.getState().setN(20);
    expect(names()).toHaveLength(8);
    useAssistent.getState().setN(1);
    expect(names()).toEqual(["Alex"]);
    expect(useAssistent.getState().sel).toBe(0);
  });

  it("Startwelt: höchstens 2 Bewohner und nur Alex und Mira", async () => {
    await useAssistent.getState().load();
    useAssistent.getState().setN(4);
    useAssistent.getState().patchResident(0, { tpl: "hanne" });
    useAssistent.getState().setWorld({ kind: "start" });
    const rs = useAssistent.getState().draft.residents;
    expect(rs.map((r) => r.tpl)).toEqual(["alex", "mira"]);
    useAssistent.getState().setN(8);
    expect(useAssistent.getState().draft.residents).toHaveLength(2);
  });

  it("Beziehungen: Standard, Würfeln, Zurücksetzen; Vorgeschichte gilt für das Paar", async () => {
    await useAssistent.getState().load();
    const s = useAssistent.getState();
    s.setRel(0, 1, { trust: 90 });
    s.setStory(1, 0, "Sie kennen sich vom Markt.");
    expect(useAssistent.getState().draft.rel["0>1"]).toEqual({ trust: 90, sympathy: 50, tension: 10, familiarity: 30 });
    expect(useAssistent.getState().draft.stories["0-1"]).toBe("Sie kennen sich vom Markt.");
    useAssistent.getState().rollRel(0, 1);
    expect(Object.keys(useAssistent.getState().draft.rel).sort()).toEqual(["0>1", "1>0"]);
    useAssistent.getState().resetRel(1, 0);
    expect(useAssistent.getState().draft.rel).toEqual({});
    expect(useAssistent.getState().draft.stories).toEqual({});
  });

  it("Würfeln ist reproduzierbar: gleicher Seed und gleiche Wurfnummer", async () => {
    await useAssistent.getState().load();
    useAssistent.getState().roll(0);
    const a = structuredClone(useAssistent.getState().draft.residents[0]);
    useAssistent.setState((s) => ({ draft: { ...s.draft, dice: { ...s.draft.dice, n: 0 } } }));
    useAssistent.getState().roll(0);
    expect(useAssistent.getState().draft.residents[0].profile.name).toBe(a.profile.name);
    expect(useAssistent.getState().draft.residents[0].personality).toEqual(a.personality);
  });
});

describe("Assistent: Vorschau und Anlegen", () => {
  beforeEach(async () => { await useAssistent.getState().load(); });

  it("Vorschau gilt nur für genau diesen Entwurf; eine Änderung macht sie veraltet", async () => {
    vi.mocked(api.newSimPreview).mockResolvedValue(answer() as never);
    const pv = await useAssistent.getState().runPreview();
    expect(pv).toMatchObject({ ok: true, digest: "abc", village: "Lindental" });
    expect(useAssistent.getState().preview?.key).toBe(requestKey(useAssistent.getState().draft));
    useAssistent.getState().setWorld({ seed: 6 });
    expect(useAssistent.getState().preview?.key).not.toBe(requestKey(useAssistent.getState().draft));
  });

  it("Fehler des Entwurfs kommen als Liste zurück und lassen kein Anlegen zu", async () => {
    vi.mocked(api.newSimPreview).mockResolvedValue(answer({ ok: false, digest: null, snapshot: null, errors: ["Bewohner 1: Name: fehlt."] }) as never);
    const pv = await useAssistent.getState().runPreview();
    expect(pv).toMatchObject({ ok: false, errors: ["Bewohner 1: Name: fehlt."], world: null });
    expect(await useAssistent.getState().create()).toBe(false);
    expect(api.newSimApply).not.toHaveBeenCalled();
  });

  it("eine Antwort auf einen inzwischen geänderten Entwurf wird verworfen", async () => {
    let release: (v: unknown) => void = () => {};
    vi.mocked(api.newSimPreview).mockReturnValue(new Promise((r) => { release = r; }) as never);
    const run = useAssistent.getState().runPreview();
    useAssistent.getState().setWorld({ seed: 99 });
    release(answer());
    expect(await run).toBeNull();
    expect(useAssistent.getState().preview).toBeNull();
  });

  it("Anlegen schickt den Entwurf mit der Prüfsumme der Vorschau und merkt das Ergebnis", async () => {
    vi.mocked(api.newSimPreview).mockResolvedValue(answer() as never);
    vi.mocked(api.newSimApply).mockResolvedValue({ village: "Lindental", seed: 5, residents: [], backup: "x.db", counts: {}, state: "stopped", warnings: [] } as never);
    await useAssistent.getState().runPreview();
    useSimStore.getState().setSnapshot({ ...makeSnapshot(), world_name: "Dorf Lindental" });          // die neue Welt ist im Browser angekommen
    expect(await useAssistent.getState().create()).toBe(true);
    expect(api.newSimApply).toHaveBeenCalledWith(expect.objectContaining({ world: expect.objectContaining({ kind: "generated" }) }), "abc");
    expect(useAssistent.getState().done?.backup).toBe("x.db");
  });

  it("Verwerfen setzt den Entwurf zurück", async () => {
    useAssistent.getState().setN(4);
    useAssistent.getState().discard();
    expect(useAssistent.getState().draft.residents).toHaveLength(2);
    expect(useAssistent.getState().step).toBe(0);
  });
});
