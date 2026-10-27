import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ pause: vi.fn(async () => ({})), resume: vi.fn(async () => ({})), gestaltenKatalog: vi.fn(async () => ({})), entwurfDatei: vi.fn(async () => ({ ok: true, stati: [], world: null, snapshot: null })), previewWorld: vi.fn(async () => ({ snapshot: null, errors: ["x"] })), world: vi.fn() }));
vi.mock("../net/api", () => ({ api, ApiError: class extends Error { constructor(readonly status: number, readonly detail: string) { super(detail); } } }));

import { useGestalten } from "../gestalten/gestaltenStore";
import { SCHLUESSEL, entwurfOffen, ladeSicherung, sichere, stelleEntwurfWiederHer } from "./entwurfSicherung";
import { useWerkstatt } from "./werkstattStore";

const welt = (name: string) => ({ name, size: [2, 2], tiles: ["..", ".."], tile_types: {} });
const aktion = { art: "deko", sorte: "baum", tile: [1, 1] };

const speicher = new Map<string, string>();
vi.stubGlobal("sessionStorage", { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v), removeItem: (k: string) => void speicher.delete(k), clear: () => speicher.clear() });

beforeEach(() => { sessionStorage.clear(); useWerkstatt.getState().schliessen(); api.world.mockResolvedValue({ info: { id: "w1", readonly: false }, world: welt("Alt") }); });

describe("Entwurf-Sicherung", () => {
  it("sichert und lädt; Kaputtes wird ignoriert", () => {
    sichere({ id: "w1", welt: welt("A") as never, aktionen: [aktion as never] });
    expect(ladeSicherung()?.aktionen).toHaveLength(1);
    sessionStorage.setItem(SCHLUESSEL, "{kaputt");
    expect(ladeSicherung()).toBeNull();
    sessionStorage.setItem(SCHLUESSEL, JSON.stringify({ id: 3 }));
    expect(ladeSicherung()).toBeNull();
  });
  it("ohne Sicherung bleibt die Werkstatt zu", async () => {
    expect(await stelleEntwurfWiederHer()).toBe(false);
    expect(useWerkstatt.getState().offen).toBe(false);
  });
  it("stellt Datei und Aktionen nach dem Neuladen wieder her und gilt dann als ungespeichert", async () => {
    sichere({ id: "w1", welt: welt("Neu") as never, aktionen: [aktion as never] });
    expect(await stelleEntwurfWiederHer()).toBe(true);
    expect(useWerkstatt.getState().welt?.name).toBe("Neu");
    expect(useGestalten.getState().aktionen).toEqual([aktion]);
    expect(entwurfOffen()).toBe(true);
    await useGestalten.getState().verlasse();
  });
  it("eine Welt, die es nicht mehr gibt, räumt die Sicherung weg", async () => {
    api.world.mockRejectedValue(new Error("weg"));
    sichere({ id: "w1", welt: welt("Neu") as never, aktionen: [] });
    expect(await stelleEntwurfWiederHer()).toBe(false);
    expect(ladeSicherung()).toBeNull();
  });
});
