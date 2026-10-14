// Dorfansicht nach Mockup A: Abbildung wie wProject (und ihre Umkehrung für Klicks), Bodenregeln wie wTexel, Wegvorschau durch die Haustür.
import { describe, expect, it } from "vitest";
import { applySnapshot } from "../../store/reducers";
import { makeSnapshot } from "../../test/fixtures";
import { findPath, gridOf } from "../player/pathfind";
import { frameFor, project, unproject } from "./abbild";
import { texel } from "./boden";
import startwelt from "../../../../backend/simulacra/data/world_default.json" with { type: "json" };
import v1Startwelt from "./look-v1-startwelt.json" with { type: "json" };
import { housesOf, isInside, lookOf, normalizeLook, regionAt, type Look } from "./look";
import { boatSpot, glowing } from "./dinge";

/** Look in der alten Form (Version 1) wie in alten Weltdateien; `normalizeLook` macht daraus die neue. */
const v1 = (shapes: Record<string, unknown> = {}, more: Record<string, unknown> = {}) => ({
  style: "mockup-a", origin: [66, 104], texture: { size: [384, 288], offset: [64, 96] }, decor: [["house", 60, 60, 0]], lights: [], place: {}, door: { outside: [7, 10], inside: [42, 15], at: [60, 60] }, interior: { rect: [26, 3, 24, 13] },
  shapes: { paths: [[[60, 60], [60, 80], [104, 100]]], square: { x: 128, y: 106, r: 27 }, lake: { x: 222, y: 90, rx: 40, ry: 37 }, garden: { x0: 14, y0: 120, x1: 84, y1: 176 }, beds: [[22, 127, 54, 9]], house: { x: 60, y: 60 }, dock: { x0: 180, y0: 88, x1: 202, y1: 97 }, ...shapes },
  ...more,
});
const A = (shapes: Record<string, unknown> = {}, more: Record<string, unknown> = {}): Look => normalizeLook(v1(shapes, more));
const SHIFT = A().texShift;                                  // Weltpixel − Texel = (2, 8)
const world = (vx: number, vy: number): [number, number] => [vx + 66, vy + 104];

describe("look Version 2", () => {
  it("macht aus der alten Form ein Gebiet mit einem Haus", () => {
    const L = A();
    expect(L.version).toBe(2);
    expect(L.regions).toHaveLength(1);
    expect(L.regions[0].frame).toEqual([66, 104]);
    expect(L.regions[0].decor).toEqual([]);                         // das Haus steht jetzt unter `houses`
    expect(housesOf(L)).toHaveLength(1);
    expect(housesOf(L)[0].house).toMatchObject({ at: [60, 60], sprite: "house", door: { outside: [7, 10], inside: [42, 15] }, smoke: 19 });
    expect(L.home).toEqual([194, 296]);                              // Bild A: Boden (192, 288) in Texeln
  });
  it("kennt Innenbereich und Gebiet an Weltpixeln", () => {
    const L = A();
    expect(isInside(L, 30, 8)).toBe(true);
    expect(isInside(L, 10, 10)).toBe(false);
    expect(regionAt(L, ...world(100, 100))?.id).toBe("dorf");
    expect(regionAt(L, 5000, 5000)).toBeNull();
  });
  it("die alte Form der Startwelt wird zu genau dem, was die Weltdatei heute enthält", () => {
    expect(normalizeLook(JSON.parse(JSON.stringify(v1Startwelt)))).toEqual(startwelt.look);
  });
  it("nimmt eine Welt in Version 2 unverändert", () => {
    const L = A();
    expect(normalizeLook(L)).toBe(L);
  });
  it("gibt für Welten ohne Gestaltung nichts zurück", () => {
    expect(lookOf(null)).toBeNull();
    expect(lookOf({ look: null } as never)).toBeNull();
  });
});

describe("Abbildung wie Mockup A", () => {
  const home = (L: Look) => [L.home[0] - L.texShift[0], L.home[1] - L.texShift[1]] as [number, number];
  it("setzt Punkte genau wie wProject (Puffer 320 × 200)", () => {
    const L = A(), f = frameFor("tiefe", 320, 200, SHIFT, home(L)), p = project(f, ...world(60, 60));
    const ty = 60 + 96, t = Math.pow(1 - ty / 288, 1 / 1.45), s = 0.62 + 0.9 * t, x = 160 + (124 - 192) / s, k = (x - 160) / 160;
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(200 - t * (200 - (34 + 14 * k * k)), 9);
    expect(p.sc).toBeCloseTo(1 / s, 9);
  });
  it("Klick auf den Boden trifft wieder dieselbe Stelle, auch bei Kamerafahrt und Herauszoomen", () => {
    for (const mode of ["tiefe", "flach"] as const) for (const [lw, lh] of [[320, 200], [400, 230]]) for (const zo of [1, 2, 4]) for (const cam of [[192, 288], [300, 330], [-40, 260]] as [number, number][]) {
      const f = frameFor(mode, lw, lh, SHIFT, cam, zo, mode === "tiefe" && zo === 2 ? 0.5 : 1);
      for (const [vx, vy] of [[50, 140], [128, 106], [222, 90], [10, 20]]) {
        const [wx, wy] = world(vx, vy), p = project(f, wx, wy);
        if (p.sc <= 0 || p.t > 1.5) continue;
        const b = unproject(f, p.x, p.y);
        if (!b) continue;
        expect(b.x).toBeCloseTo(wx, 4); expect(b.y).toBeCloseTo(wy, 4);
      }
    }
  });
  it("breitere Fenster zeigen Bild A in der Mitte, mehr Himmel oben", () => {
    const L = A(), a = frameFor("tiefe", 320, 200, SHIFT, home(L)), b = frameFor("tiefe", 380, 230, SHIFT, home(L));
    expect(project(b, ...world(60, 60)).x - project(a, ...world(60, 60)).x).toBeCloseTo(30, 9);
    expect(project(b, ...world(60, 60)).y - project(a, ...world(60, 60)).y).toBeCloseTo(30, 9);
    expect(unproject(b, 190, 20)).toBeNull();                       // Himmel
  });
  it("hinter der Kamera geht es unter den unteren Rand, hinter dem Horizont unter die Horizontlinie (Kugel)", () => {
    const f = frameFor("tiefe", 320, 200, SHIFT, [192, 288]);
    const near = project(f, 192 + SHIFT[0], 280 + SHIFT[1]), behind = project(f, 192 + SHIFT[0], 300 + SHIFT[1]), further = project(f, 192 + SHIFT[0], 340 + SHIFT[1]);
    expect(near.y).toBeLessThan(200); expect(behind.y).toBeGreaterThan(200); expect(further.y).toBeGreaterThan(behind.y);
    expect(behind.sc).toBeCloseTo(1 / 0.62, 9);                      // Größe wie am unteren Rand
    const edge = project(f, 192 + SHIFT[0], 0 + SHIFT[1]), past = project(f, 192 + SHIFT[0], -30 + SHIFT[1]), gone = project(f, 192 + SHIFT[0], -80 + SHIFT[1]);
    expect(edge.y).toBeCloseTo(34, 9);                               // Fußpunkt genau auf dem Horizont
    expect(past.t).toBeGreaterThan(1); expect(past.y).toBeGreaterThan(34); expect(gone.y).toBeGreaterThan(past.y);   // versinkt immer tiefer
  });
  it("die Kamera lässt sich auf einen Weltpunkt und eine Bildstelle ausrichten", async () => {
    const { camFor } = await import("./abbild");
    const L = A(), f = frameFor("tiefe", 320, 200, SHIFT, home(L), 2, 0.6), [wx, wy] = world(120, 100);
    const c = camFor(f, wx, wy, 140, 120), g = frameFor("tiefe", 320, 200, SHIFT, c, 2, 0.6), p = project(g, wx, wy);
    expect(p.x).toBeCloseTo(140, 6); expect(p.y).toBeCloseTo(120, 6);
  });
});

describe("Boden wie wTexel", () => {
  const L = A();
  it("See, Platz, Steg, Beet, Weg und Wildnis an den Stellen aus A", () => {
    const at = (vx: number, vy: number) => texel(L, vx + 64, vy + 96)[1];
    expect(at(222, 90)).toBe(2);
    expect(at(128, 106)).toBe(3);
    expect(at(190, 92)).toBe(5);
    expect(at(40, 131)).toBe(4);
    expect(at(60, 70)).toBe(1);
    expect(at(-60, 20)).toBe(7);
  });
  it("gleiche Eingabe, gleiche Farbe", () => expect(texel(L, 100, 150)).toEqual(texel(L, 100, 150)));
  it("Listen: zweiter See, Bach und Landstraße außerhalb des Dorfs", () => {
    const V = A();
    V.regions[0].shapes.lakes.push({ x: 60, y: 30, rx: 12, ry: 10 });
    V.regions[0].shapes.streams.push([[150, 0], [150, 90]]);
    V.roads.push([[-400, 600], [900, 600]]);
    expect(texel(V, 60 + 64, 30 + 96)[1]).toBe(2);
    expect(texel(V, 150 + 64, 40 + 96)[1]).toBe(2);
    expect(texel(V, 700 + 2, 600 - 8)[1]).toBe(1);               // Weg in der Wildnis (Welt y = 600)
    expect(texel(V, 700 + 2, 400)[1]).toBe(7);
  });
});

describe("Wegvorschau durch die Haustür", () => {
  it("geht über den Übergang wie das Backend", () => {
    const w = applySnapshot(makeSnapshot({
      map: { width: 7, height: 3, rows: ["...T...", "...T...", "...T..."], legend: { T: "tree", ".": "grass" } },
      links: [[[2, 0], [4, 2]]],
    }));
    const p = findPath(gridOf(w), [0, 1], [6, 1])!;
    expect(p).not.toBeNull();
    expect(p[p.findIndex(([x, y]) => x === 2 && y === 0) + 1]).toEqual([4, 2]);
  });
});

describe("Dinge im Dorf (AP15)", () => {
  const obj = (id: string, kind: string, state: Record<string, unknown> = {}) => ({ id, kind, name: kind, location_id: "lake", x: 18, y: 13, holder: null, state, portable: false, owner: null, hidden: false }) as never;
  it("Lichtschein nur an brennenden Laternen, Fenster wie in A", () => {
    const L = A({}, { lights: [[43, 60, 32, 1], [103, 86, 24, 1], [154, 128, 24, 1]], place: { l1: { at: [103, 86] }, l2: { at: [154, 128] } } });
    const w = { objects: { l1: obj("l1", "lantern", { lit: false }), l2: obj("l2", "lantern", { lit: true }) } } as never;
    expect(glowing(w, L)).toEqual([[43 + 66, 60 + 104, 32, 1], [154 + 66, 128 + 104, 24, 1]]);       // in Weltpixeln
  });
  it("wer rudert, sitzt im Boot; sonst steht die Figur an ihrer Kachel", () => {
    const L = A({}, { place: { boat: { at: [230, 106], sprite: "boat" } } });
    const w = { objects: { boat: obj("boat", "boat") } } as never;
    const rowing = { action: { type: "use", params: { object_id: "boat", mode: "row" } } } as never;
    expect(boatSpot(w, L, rowing)).toEqual([230 + 66, 103 + 104]);
    expect(boatSpot(w, L, { action: { type: "wait", params: {} } } as never)).toBeNull();
  });
});
