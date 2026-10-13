// Dorfansicht nach Mockup A: Abbildung wie wProject (und ihre Umkehrung für Klicks), Bodenregeln wie wTexel, Wegvorschau durch die Haustür.
import { describe, expect, it } from "vitest";
import { applySnapshot } from "../../store/reducers";
import { makeSnapshot } from "../../test/fixtures";
import { findPath, gridOf } from "../player/pathfind";
import { frameFor, project, unproject } from "./abbild";
import { texel } from "./boden";
import type { Look } from "./look";

const tex = { size: [384, 288] as [number, number], offset: [64, 96] as [number, number] };
const A = (look: Partial<Look["shapes"]> = {}): Look => ({
  style: "mockup-a", origin: [66, 104], texture: tex, decor: [], lights: [], place: {}, door: { outside: [7, 10], inside: [42, 15], at: [60, 60] }, interior: { rect: [26, 3, 24, 13] },
  shapes: { paths: [[[60, 60], [60, 80], [104, 100]]], square: { x: 128, y: 106, r: 27 }, lake: { x: 222, y: 90, rx: 40, ry: 37 }, garden: { x0: 14, y0: 120, x1: 84, y1: 176 }, beds: [[22, 127, 54, 9]], house: { x: 60, y: 60 }, dock: { x0: 180, y0: 88, x1: 202, y1: 97 }, ...look },
});

describe("Abbildung wie Mockup A", () => {
  it("setzt Punkte genau wie wProject (Puffer 320 × 200)", () => {
    const f = frameFor("tiefe", 320, 200, tex), p = project(f, 60, 60);
    const ty = 60 + 96, t = Math.pow(1 - ty / 288, 1 / 1.45), s = 0.62 + 0.9 * t, x = 160 + (124 - 192) / s, k = (x - 160) / 160;
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(200 - t * (200 - (34 + 14 * k * k)), 9);
    expect(p.sc).toBeCloseTo(1 / s, 9);
  });
  it("Klick auf den Boden trifft wieder dieselbe Stelle", () => {
    for (const mode of ["tiefe", "flach"] as const) for (const [lw, lh] of [[320, 200], [400, 230]]) {
      const f = frameFor(mode, lw, lh, tex);
      for (const [vx, vy] of [[50, 140], [128, 106], [222, 90], [10, 20]]) {
        const p = project(f, vx, vy), b = unproject(f, p.x, p.y)!;
        expect(b.x).toBeCloseTo(vx, 6); expect(b.y).toBeCloseTo(vy, 6);
      }
    }
  });
  it("breitere Fenster zeigen Bild A in der Mitte, mehr Himmel oben", () => {
    const a = frameFor("tiefe", 320, 200, tex), b = frameFor("tiefe", 380, 230, tex);
    expect(project(b, 60, 60).x - project(a, 60, 60).x).toBeCloseTo(30, 9);
    expect(project(b, 60, 60).y - project(a, 60, 60).y).toBeCloseTo(30, 9);
    expect(unproject(b, 190, 20)).toBeNull();                       // Himmel
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
