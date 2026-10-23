import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  pause: vi.fn(async () => ({})), resume: vi.fn(async () => ({})), gestaltenKatalog: vi.fn(async () => ({ deko: [], haeuser: [], daecher: [], waende: [], karte: { richtungen: [], kacheln: [], max: 256 } })),
  entwurfVorschau: vi.fn(), entwurfUebernehmen: vi.fn(), entwurfDatei: vi.fn(),
}));
vi.mock("../net/api", () => ({ api, ApiError: class extends Error { constructor(readonly status: number, readonly detail: string) { super(detail); } } }));

import { useSimStore } from "../store/simStore";
import { useGestalten } from "./gestaltenStore";

const antwort = (n: number, extra = {}) => ({ ok: true, spielbar: true, digest: `d${n}`, stati: Array.from({ length: n }, () => ({ ok: true })), meldungen: [{ stufe: "ok", text: "ok" }], fehler: 0, hinweise: 0, world: { name: "W", n }, snapshot: null, ...extra });
const warte = () => new Promise((r) => setTimeout(r, 0));
const g = () => useGestalten.getState();

beforeEach(async () => {
  vi.clearAllMocks();
  api.entwurfDatei.mockImplementation(async (_w: unknown, a: unknown[]) => antwort(a.length));
  await g().verlasse();
  await g().betrete("werkstatt", () => ({ name: "W" }));
});

describe("Gestalten-Zustand", () => {
  it("ein Klick mit dem Setzen-Werkzeug legt eine Aktion in den Entwurf und rechnet neu", async () => {
    g().setWerkzeug("natur");
    expect(g().klick([4, 5])).toBe(true);
    expect(g().aktionen).toEqual([{ art: "deko", sorte: "baum", tile: [4, 5] }]);
    await warte();
    expect(api.entwurfDatei).toHaveBeenCalledWith({ name: "W" }, g().aktionen, true);
    expect(g().rechnung?.digest).toBe("d1");
  });
  it("Zeiger, Gebiet und Karte verbrauchen den Klick nicht", () => {
    for (const w of ["zeiger", "gebiet", "karte"] as const) { g().setWerkzeug(w); expect(g().klick([1, 1])).toBe(false); }
  });
  it("Weg: der Zug bleibt angefangen, bis er beendet wird; Esc nimmt erst den Zug, dann das Werkzeug zurück", () => {
    g().setWerkzeug("weg");
    g().klick([1, 1]); g().klick([5, 1]);
    expect(g().pending).toHaveLength(2);
    expect(g().aktionen).toHaveLength(0);
    expect(g().abbrechen()).toBe(true);
    expect(g().pending).toHaveLength(0);
    expect(g().werkzeug).toBe("weg");
    expect(g().abbrechen()).toBe(true);
    expect(g().werkzeug).toBe("zeiger");
    expect(g().abbrechen()).toBe(false);                                                      // nichts mehr zu tun: Esc gehört dem Ort
  });
  it("Rückgängig, Wiederholen und Entfernen", () => {
    g().setWerkzeug("natur");
    g().klick([1, 1]); g().klick([2, 2]); g().klick([3, 3]);
    g().zurueck();
    expect(g().aktionen).toHaveLength(2);
    g().wiederhole();
    expect(g().aktionen).toHaveLength(3);
    g().entferne(0);
    expect(g().aktionen.map((a) => a.tile)).toEqual([[2, 2], [3, 3]]);
    g().verwerfen();
    expect(g().aktionen).toHaveLength(0);
    expect(g().rechnung).toBeNull();
  });
  it("ein verbotenes Setzen (Prüfung am Cursor sagt nein) tut nichts und lässt die angefangene Form stehen", () => {
    g().setWerkzeug("natur");
    useGestalten.setState({ probe: { schluessel: JSON.stringify({ art: "deko", sorte: "baum", tile: [4, 5] }), ok: false, grund: "Dort ist Wasser." } });
    expect(g().klick([4, 5])).toBe(true);
    expect(g().aktionen).toHaveLength(0);
  });
  it("Festschreiben liefert die Welt mit allen Aktionen und leert den Entwurf; ohne Aktionen undefined", async () => {
    expect(await g().festschreiben()).toBeUndefined();
    g().setWerkzeug("natur");
    g().klick([1, 1]);
    expect(await g().festschreiben()).toEqual({ name: "W", n: 1 });
    expect(g().aktionen).toHaveLength(0);
  });
  it("kleine Klicks außerhalb der Karte werden verschluckt", () => {
    g().setWerkzeug("natur");
    expect(g().klick([-1, 3])).toBe(true);
    expect(g().aktionen).toHaveLength(0);
  });
});

describe("Gestalten im Spiel", () => {
  const laufen = (state: string) => useSimStore.setState({ world: { simulation: { state }, seq: 1 } as never });
  it("hält die Zeit an, wenn sie lief, und setzt sie beim Verlassen fort", async () => {
    laufen("running");
    await g().betrete("spiel");
    expect(api.pause).toHaveBeenCalledTimes(1);
    await g().verlasse();
    expect(api.resume).toHaveBeenCalledTimes(1);
  });
  it("lief sie nicht, wird sie weder angehalten noch fortgesetzt", async () => {
    laufen("paused");
    await g().betrete("spiel");
    await g().verlasse();
    expect(api.pause).not.toHaveBeenCalled();
    expect(api.resume).not.toHaveBeenCalled();
  });
  it("Übernehmen geht nur mit Prüfsumme und ohne Fehler", async () => {
    laufen("paused");
    await g().betrete("spiel");
    api.entwurfVorschau.mockResolvedValue({ ok: false, digest: "x", stati: [{ ok: true }], meldungen: [{ stufe: "fehler", text: "✗" }], fehler: 1, hinweise: 0, counts: {}, snapshot: null });
    g().setWerkzeug("natur");
    g().klick([1, 1]);
    await warte();
    expect(await g().uebernehmen()).toBe(false);
    expect(api.entwurfUebernehmen).not.toHaveBeenCalled();
    api.entwurfVorschau.mockResolvedValue({ ok: true, digest: "y", stati: [{ ok: true }], meldungen: [], fehler: 0, hinweise: 0, counts: {}, snapshot: null });
    g().klick([2, 2]);
    await warte();
    api.entwurfUebernehmen.mockResolvedValue({ patch: "p", backup: "Vor dem Gestalten", counts: {}, actions: 2 });
    useSimStore.setState({ world: { simulation: { state: "paused" }, seq: 5 } as never });
    const fertig = g().uebernehmen();
    useSimStore.setState({ world: { simulation: { state: "paused" }, seq: 6 } as never });
    expect(await fertig).toBe(true);
    expect(api.entwurfUebernehmen).toHaveBeenCalledWith(expect.any(Array), "y");
    expect(g().fertig).toEqual({ backup: "Vor dem Gestalten", aktionen: 2 });
    expect(g().aktionen).toHaveLength(0);
  });
});
