import { describe, expect, it } from "vitest";
import { clampToMap, dragBy, fit, zoomAt } from "./camera";
import { horizon, project, unproject, visibleWorld, type Camera, type Viewport } from "./projection";

const vp: Viewport = { w: 320, h: 200 };
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("Projektion", () => {
  for (const mode of ["tiefe", "flach"] as const) {
    it(`${mode}: Hin- und Rückweg treffen denselben Punkt, bei jeder Kamerastellung`, () => {
      const r = rnd(7);
      for (let i = 0; i < 400; i++) {
        const cam: Camera = { fx: r() * 4000, fy: r() * 4000, zoom: 0.3 + r() * 2.5, mode };
        const sx = r() * vp.w, sy = mode === "tiefe" ? horizon(vp, sx) + 2 + r() * (vp.h * 1.3) : r() * vp.h;
        const w = unproject(cam, vp, sx, sy)!;
        const p = project(cam, vp, w.x, w.y);
        expect(p.x).toBeCloseTo(sx, 6);
        expect(p.y).toBeCloseTo(sy, 6);
        const back = unproject(cam, vp, p.x, p.y)!;
        expect(back.x).toBeCloseTo(w.x, 5);
        expect(back.y).toBeCloseTo(w.y, 5);
      }
    });
  }

  it("Tiefe entspricht Mockup A bei Zoom 1 (wProject: unten 0,62, Horizont 34 + 14·k²)", () => {
    const cam: Camera = { fx: 0, fy: 0, zoom: 1, mode: "tiefe" };
    const bottom = unproject(cam, vp, 160, 200)!, far = unproject(cam, vp, 160, 34.001)!;
    expect(bottom.y - far.y).toBeCloseTo(288, 1);                          // sichtbare Tiefe 288 Weltpixel
    const a = unproject(cam, vp, 100, 199.999)!, b = unproject(cam, vp, 200, 199.999)!;
    expect((b.x - a.x) / 100).toBeCloseTo(0.62, 3);
    expect(horizon(vp, 0)).toBeCloseTo(48, 6);
    expect(unproject(cam, vp, 160, 30)).toBeNull();                         // Himmel
  });

  it("Höhe hebt einen Punkt senkrecht an, proportional zum Maßstab", () => {
    const cam: Camera = { fx: 500, fy: 300, zoom: 1.3, mode: "tiefe" };
    const g = project(cam, vp, 520, 310), h = project(cam, vp, 520, 310, 20);
    expect(h.x).toBeCloseTo(g.x, 9);
    expect(g.y - h.y).toBeCloseTo(20 * g.sc, 9);
  });

  it("Weiter hinten ist alles kleiner und höher im Bild", () => {
    const cam: Camera = { fx: 500, fy: 300, zoom: 1, mode: "tiefe" };
    const near = project(cam, vp, 500, 330), far = project(cam, vp, 500, 200);
    expect(far.sc).toBeLessThan(near.sc);
    expect(far.y).toBeLessThan(near.y);
  });

  it("sichtbares Weltrechteck enthält alle Bodenpunkte des Bildes", () => {
    const cam: Camera = { fx: 900, fy: 700, zoom: 0.8, mode: "tiefe" }, r = visibleWorld(cam, vp);
    for (let x = 0; x <= vp.w; x += 16) for (let y = 0; y <= vp.h; y += 10) {
      const w = unproject(cam, vp, x, y);
      if (!w) continue;
      expect(w.x).toBeGreaterThanOrEqual(r.x0 - 1e-6); expect(w.x).toBeLessThanOrEqual(r.x1 + 1e-6);
      expect(w.y).toBeGreaterThanOrEqual(r.y0 - 1e-6); expect(w.y).toBeLessThanOrEqual(r.y1 + 1e-6);
    }
  });
});

describe("Kamera", () => {
  for (const mode of ["tiefe", "flach"] as const) {
    it(`${mode}: Zoom hält den Bodenpunkt unter dem Zeiger fest`, () => {
      const cam: Camera = { fx: 512, fy: 320, zoom: 1, mode };
      const before = unproject(cam, vp, 250, 150)!, next = zoomAt(cam, vp, 250, 150, 1.7), after = unproject(next, vp, 250, 150)!;
      expect(next.zoom).toBeCloseTo(1.7, 9);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    });

    it(`${mode}: Ziehen führt den gegriffenen Punkt mit dem Zeiger`, () => {
      const cam: Camera = { fx: 512, fy: 320, zoom: 0.9, mode };
      const grab = unproject(cam, vp, 120, 140)!, next = dragBy(cam, vp, { x: 120, y: 140 }, { x: 180, y: 170 });
      const p = project(next, vp, grab.x, grab.y);
      expect(p.x).toBeCloseTo(180, 6);
      expect(p.y).toBeCloseTo(170, 6);
    });

    it(`${mode}: Gesamtansicht zeigt die Karte`, () => {
      const cam = fit({ fx: 0, fy: 0, zoom: 1, mode }, vp, 1024, 640);
      const south = project(cam, vp, 512, 640), north = project(cam, vp, 512, 0);
      expect(south.y).toBeLessThanOrEqual(vp.h);
      expect(north.y).toBeGreaterThanOrEqual(mode === "tiefe" ? horizon(vp, 160) : 0);
    });
  }

  it("Fokus bleibt in der Nähe der Karte", () => {
    const c = clampToMap({ fx: -5000, fy: 9000, zoom: 1, mode: "tiefe" }, 1024, 640);
    expect(c.fx).toBe(-160);
    expect(c.fy).toBe(800);
  });
});
