import { afterEach, describe, expect, it, vi } from "vitest";
import { applySnapshot } from "../../store/reducers";
import { makeSnapshot } from "../../test/fixtures";
import { choicesFor } from "./actions";
import { findPath, gridOf, nearestOpen, walkMinutes, type PathGrid } from "./pathfind";
import { isTyping, PlayerController, REJECT_MS, usePlayer } from "./PlayerController";

// Kleines Dorf: Wand mit Tür, Weg, Gras, Wasser
const rows = [
  "~~~~~~~~",
  "~..#...~",
  "~,,#,,.~",
  "~..+..,~",
  "~~~~~~~~",
];
const world = (objects: object[] = []) => applySnapshot(makeSnapshot({
  map: { width: 8, height: 5, rows, legend: { "~": "water", ".": "grass", ",": "path", "#": "wall", "+": "door" } },
  tile_types: {
    water: { char: "~", walkable: false, cost: 0, color: "#3f6fa8", label: "Wasser" }, grass: { char: ".", walkable: true, cost: 2, color: "#5f8f4b", label: "Gras" },
    path: { char: ",", walkable: true, cost: 1, color: "#b59a6a", label: "Weg" }, wall: { char: "#", walkable: false, cost: 0, color: "#444", label: "Wand" },
    door: { char: "+", walkable: true, cost: 1, color: "#7a5230", label: "Tür" },
  },
  objects: objects as never,
  locations: [{ id: "paths", name: "Wege", rect: [0, 0, 8, 5], entrances: [], props: {}, discovered_by: [] }],
}));
const obj = (id: string, kind: string, x: number, y: number, state: object = {}, portable = false) =>
  ({ id, kind, name: id, x, y, location_id: "paths", holder: null, state, portable, owner: null, hidden: false, known_by: [] });

afterEach(() => { vi.restoreAllMocks(); usePlayer.setState({ path: null, minutes: null, goal: null, reject: null }); vi.useRealTimers(); });

describe("Wegsuche (wie pathfinding.py)", () => {
  it("geht um die Wand herum durch die Tür, günstigster Weg über den Pfad", () => {
    const g = gridOf(world()), p = findPath(g, [1, 2], [5, 2])!;
    expect(p[p.length - 1]).toEqual([5, 2]);
    expect(p).toContainEqual([3, 3]);                                  // durch die Tür
    expect(p.some(([x, y]) => x === 3 && y !== 3)).toBe(false);        // nie durch die Wand
    expect(walkMinutes(g, p, "clear")).toBeGreaterThanOrEqual(p.length);
    expect(walkMinutes(g, p, "storm")).toBeGreaterThan(walkMinutes(g, p, "clear"));
  });

  it("verschlossene Tür und blockierende Objekte sperren; Wasser ist unerreichbar", () => {
    expect(findPath(gridOf(world([obj("t", "door", 3, 3, { locked: true })])), [1, 2], [5, 2])).toBeNull();
    expect(findPath(gridOf(world([obj("w", "well", 3, 3)])), [1, 2], [5, 2])).toBeNull();
    expect(findPath(gridOf(world([obj("b", "bench", 3, 3)])), [1, 2], [5, 2])).not.toBeNull();   // Bank blockiert nicht
    expect(findPath(gridOf(world()), [1, 2], [0, 0])).toBeNull();
    expect(findPath(gridOf(world()), [1, 2], [1, 2])).toEqual([]);
  });

  it("nächste begehbare Kachel", () => {
    const g: PathGrid = gridOf(world());
    expect(nearestOpen(g, 3, 1)).not.toEqual([3, 1]);
    expect(g.open(...nearestOpen(g, 0, 0)!)).toBe(true);
  });
});

describe("Kontextmenü aus dem Aktionskatalog", () => {
  const w = world([obj("bett", "bed", 1, 1), obj("kamin", "fireplace", 5, 1, { lit: false }), obj("axt", "axe", 6, 1, {}, true), obj("tuer", "door", 3, 3, { locked: false })]);
  const labels = (t: Parameters<typeof choicesFor>[0]) => choicesFor(t, w).map((c) => c.label);
  it("Modi der Objektart, Nehmen nur bei tragbaren Dingen, Zustand zählt", () => {
    expect(labels({ kind: "object", id: "bett" })).toEqual(["ansehen", "schlafen"]);
    expect(labels({ kind: "object", id: "kamin" })).toEqual(["ansehen", "anzünden"]);
    expect(labels({ kind: "object", id: "axt" })).toEqual(["ansehen", "nehmen"]);
    expect(labels({ kind: "object", id: "tuer" })).toEqual(["ansehen", "abschließen"]);
    expect(labels({ kind: "agent", id: "mira" })).toEqual(["ansprechen", "ansehen"]);
  });
});

describe("PlayerController (eigene Figur)", () => {
  // Kim (id "kim") steht links auf dem Weg; die Spielart Leben mit eigener Figur kommt aus dem Schnappschuss
  const mine = () => { const w = world(); return { ...w, player: "kim", agents: { kim: { ...w.agents.kim, x: 1, y: 2 } } } as never; };
  const reply = (body: object, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("Klick auf eine Kachel schickt move_to mit der Kachel und zeigt Weg und Dauer", async () => {
    const fetchSpy = reply({ ok: true, minutes: 7 });
    vi.stubGlobal("fetch", fetchSpy);
    const w = mine(), pc = new PlayerController(() => w);
    expect(await pc.moveTo([5, 2])).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/player/act");
    expect(JSON.parse(init.body)).toEqual({ action: "move_to", params: { tile: [5, 2] } });
    expect(usePlayer.getState().path?.at(-1)).toEqual([5, 2]);
    expect(usePlayer.getState().minutes).toBe(7);
    vi.unstubAllGlobals();
  });

  it("zeigt den Ablehnungstext der Welt drei Sekunden und räumt den Weg weg", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", reply({ ok: false, code: "unreachable", text: "Dorthin führt kein Weg." }));
    const w = mine(), pc = new PlayerController(() => w);
    expect(await pc.moveTo([0, 0])).toBe(false);
    expect(usePlayer.getState().reject?.text).toBe("Dorthin führt kein Weg.");
    expect(usePlayer.getState().path).toBeNull();
    vi.advanceTimersByTime(REJECT_MS + 1);
    expect(usePlayer.getState().reject).toBeNull();
    vi.unstubAllGlobals();
  });

  it("ohne eigene Figur geht nichts hinaus; Abbrechen ruft /api/player/cancel", async () => {
    const fetchSpy = reply({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    expect(await new PlayerController(() => world()).moveTo([5, 2])).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    await new PlayerController(() => mine()).cancel();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/player/cancel");
    vi.unstubAllGlobals();
  });
});

describe("Tastaturfokus", () => {
  it("in Eingabefeldern lösen Tasten keine Kürzel aus", () => {
    const el = (tagName: string, isContentEditable = false, type?: string) => ({ tagName, isContentEditable, type }) as unknown as Element;
    expect(isTyping(el("INPUT"))).toBe(true);
    expect(isTyping(el("INPUT", false, "text"))).toBe(true);
    expect(isTyping(el("INPUT", false, "checkbox"))).toBe(false);          // Schalter behalten den Fokus, Kürzel gehen trotzdem
    expect(isTyping(el("TEXTAREA"))).toBe(true);
    expect(isTyping(el("DIV", true))).toBe(true);
    expect(isTyping(el("DIV"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
