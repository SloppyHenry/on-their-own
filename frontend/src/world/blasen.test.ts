import { describe, expect, it } from "vitest";
import { ausweichen, type Teil } from "./blasen";

const t = (id: string, x: number, y: number, rang = 1, w = 100, h = 30): Teil => ({ id, x, y, w, h, rang });
const rects = (ps: ReturnType<typeof ausweichen>, ts: Teil[]) => ps.map((p, i) => ({ id: p.id, l: p.left, t: p.top, r: p.left + ts[i].w, b: p.top + ts[i].h }));
const ueberdeckt = (a: { l: number; t: number; r: number; b: number }, b: { l: number; t: number; r: number; b: number }) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

describe("ausweichen", () => {
  it("lässt ein einzelnes Teil am Anker", () => {
    const [p] = ausweichen([t("a", 300, 200)], 800, 600);
    expect(p.left).toBe(250); expect(p.top).toBe(170); expect(p.hoch).toBe(0);
  });

  it("zwei Teile am selben Punkt überdecken sich nicht: das spätere steht darüber", () => {
    const ts = [t("a", 300, 200, 1), t("b", 300, 200, 2)];
    const ps = ausweichen(ts, 800, 600);
    expect(ps[0].top).toBe(170);
    expect(ps[1].top).toBeLessThan(170 - 30);
    expect(ps[1].hoch).toBeGreaterThan(0);
    const r = rects(ps, ts);
    expect(ueberdeckt(r[0], r[1])).toBe(false);
  });

  it("der kleinere Rang bleibt stehen, egal in welcher Reihenfolge die Teile kommen", () => {
    const ps = ausweichen([t("spaet", 300, 200, 5), t("frueh", 300, 200, 1)], 800, 600);
    expect(ps.find((p) => p.id === "frueh")!.hoch).toBe(0);
    expect(ps.find((p) => p.id === "spaet")!.hoch).toBeGreaterThan(0);
  });

  it("bleibt am Bildrand und der Zeiger zeigt weiter auf den Anker", () => {
    const [p] = ausweichen([t("a", 10, 200)], 800, 600);
    expect(p.left).toBe(4);
    expect(p.zeiger).toBe(10);
    const [q] = ausweichen([t("b", 795, 200)], 800, 600);
    expect(q.left).toBe(800 - 100 - 4);
    expect(q.zeiger).toBe(90);
  });

  it("viele Teile auf engem Raum: keines überdeckt ein anderes und alle liegen im Bild", () => {
    const ts = Array.from({ length: 9 }, (_, i) => t(`n${i}`, 400 + (i % 3) * 20, 300, i, 90, 28));
    const ps = ausweichen(ts, 800, 600);
    const r = rects(ps, ts);
    for (let i = 0; i < r.length; i++) {
      expect(r[i].t).toBeGreaterThanOrEqual(0); expect(r[i].b).toBeLessThanOrEqual(600);
      for (let j = i + 1; j < r.length; j++) expect(ueberdeckt(r[i], r[j])).toBe(false);
    }
  });

  it("Schilder am Fuß weichen nach unten aus und überdecken sich nicht", () => {
    const ts: Teil[] = [{ id: "a", x: 300, y: 200, w: 60, h: 18, rang: 0, runter: true }, { id: "b", x: 305, y: 200, w: 60, h: 18, rang: 1, runter: true }];
    const [a, b] = ausweichen(ts, 800, 600);
    expect(a.top).toBe(200); expect(b.top).toBeGreaterThan(200 + 18);
  });

  it("ist deterministisch", () => {
    const ts = [t("a", 300, 200, 1), t("b", 310, 205, 2), t("c", 290, 198, 3)];
    expect(ausweichen(ts, 800, 600)).toEqual(ausweichen(ts, 800, 600));
  });
});
