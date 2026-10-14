// Kamera der Dorfansicht: Zoomstufen, Grenzen, „fährt“ und „steht“.
import { describe, expect, it } from "vitest";
import { FOCUS, TH } from "./abbild";
import { Kamera, LEVELS } from "./kamera";

describe("Kamera", () => {
  it("1× ist die Startlage, die Stufen gehen von ¼× bis 3×", () => {
    const k = new Kamera([192, 288]);
    expect(k.level).toBe(1);
    expect(LEVELS).toEqual([0.25, 0.5, 1, 2, 3]);
    expect(k.next(-1)).toBe(0.5);
    expect(k.next(1)).toBe(2);
    k.setLevel(0.25); expect(k.zo).toBe(4); expect(k.zoom).toBe(1); expect(k.next(-1)).toBeNull();
    k.setLevel(3); expect(k.zo).toBe(1); expect(k.zoom).toBe(3); expect(k.next(1)).toBeNull();
  });
  it("Zurücksetzen bringt Bild A zurück", () => {
    const k = new Kamera([192, 288]);
    k.setLevel(0.5); k.set(500, 700);
    k.reset();
    expect([k.x, k.y, k.zo, k.zoom]).toEqual([192, 288, 1, 1]);
  });
  it("der Boden in Bildmitte bleibt in den Grenzen", () => {
    const k = new Kamera([192, 288]);
    k.bounds = [0, 0, 400, 300];
    k.set(5000, 5000);
    expect(k.focus[0]).toBeCloseTo(400, 9); expect(k.focus[1]).toBeCloseTo(300, 9);
    k.set(-5000, -5000);
    expect(k.focus[0]).toBeCloseTo(0, 9); expect(k.focus[1]).toBeCloseTo(0, 9);
  });
  it("Bildmitte bleibt beim Herauszoomen mit focusAt am Ort", () => {
    const k = new Kamera([192, 288]);
    k.focusAt(250, 180);
    const before = k.focus;
    k.setLevel(0.5); k.focusAt(before[0], before[1]);
    expect(k.focus[0]).toBeCloseTo(250, 9); expect(k.focus[1]).toBeCloseTo(180, 9);
    expect(k.y).toBeCloseTo(180 + TH * 2 * FOCUS, 9);            // bei ½× liegt der untere Bildrand doppelt so weit unter der Mitte
  });
  it("Fahrt blendet weich ein und im Stillstand ganz aus", () => {
    const k = new Kamera([192, 288]);
    expect(k.tick(0.016)).toEqual({ soft: 0 });
    for (let i = 0; i < 30; i++) { k.set(k.x + 3, k.y); k.tick(0.016); }
    expect(k.tick(0.016).soft).toBeGreaterThan(0.8);
    for (let i = 0; i < 90; i++) k.tick(0.016);
    expect(k.tick(0.016)).toEqual({ soft: 0 });
  });
});
