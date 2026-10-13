import { describe, expect, it } from "vitest";
import { clampToMap, dragBy, fit, zoomAt } from "./camera";
import { horizon, project, unproject, visibleWorld, type Camera, type Viewport } from "./projection";

const vp: Viewport = { w: 320, h: 200 };
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("Projektion", () => {
  for (const [name, extra] of [["tiefe", {}], ["tiefe innen", { curve: 0 }], ["flach", {}]] as const) {
    const mode = name.startsWith("tiefe") ? "tiefe" : "flach";
    it(`${name}: Hin- und Rückweg treffen denselben Punkt, bei jeder Kamerastellung`, () => {
      const r = rnd(7);
      for (let i = 0; i < 400; i++) {
        const cam: Camera = { fx: r() * 4000, fy: r() * 4000, zoom: 0.3 + r() * 2.5, mode, ...extra };
        const sx = r() * vp.w, sy = mode === "tiefe" ? Math.max(0, horizon(cam, vp, sx)) + 2 + r() * (vp.h * 0.9) : r() * vp.h;
        const w = unproject(cam, vp, sx, sy);
        if (!w) continue;
        const p = project(cam, vp, w.x, w.y);
        expect(p.x).toBeCloseTo(sx, 5);
        expect(p.y).toBeCloseTo(sy, 5);
        const back = unproject(cam, vp, p.x, p.y)!;
        expect(back.x).toBeCloseTo(w.x, 3);
        expect(back.y).toBeCloseTo(w.y, 3);
      }
    });
  }

  it("Tiefe wölbt sich nach außen wie eine Weltkugel: Horizont oben sichtbar, an den Rändern tiefer, aber sanft", () => {
    const cam: Camera = { fx: 0, fy: 0, zoom: 1, mode: "tiefe" };
    const mid = horizon(cam, vp, vp.w / 2), edge = horizon(cam, vp, 0);
    expect(mid / vp.h).toBeGreaterThan(0.08);
    expect(mid / vp.h).toBeLessThan(0.3);
    expect(edge).toBeGreaterThan(mid);                                     // Ränder fallen ab (außen, nicht Innenseite eines Balls)
    expect((edge - mid) / vp.h).toBeLessThan(0.045);                       // sanft: weniger als die 7 % des Mockups
    expect(unproject(cam, vp, vp.w / 2, mid - 3)).toBeNull();               // darüber Himmel
  });

  it("Boden: vorn kaum gestaucht, zum Horizont immer stärker (kein Schüssel-Effekt am unteren Rand)", () => {
    const cam: Camera = { fx: 0, fy: 0, zoom: 1, mode: "tiefe" }, hz = horizon(cam, vp, vp.w / 2);
    const step = (y: number) => unproject(cam, vp, vp.w / 2, y + 1)!.y - unproject(cam, vp, vp.w / 2, y)!.y;   // Weltpixel je Bildzeile (unten = näher = größeres y)
    const near = step(vp.h - 2), midd = step((vp.h + hz) / 2), far = step(hz + 4);
    expect(near).toBeGreaterThan(0.5);
    expect(midd).toBeGreaterThan(near);
    expect(far).toBeGreaterThan(midd * 2);
  });

  it("Innenansicht ohne Krümmung: gleicher Abstand zum Fokus gibt gleiche Bildzeile links wie Mitte", () => {
    const cam: Camera = { fx: 500, fy: 300, zoom: 1, mode: "tiefe", curve: 0 };
    const a = project(cam, vp, 500, 280), b = project(cam, vp, 380, 280);
    expect(b.y).toBeCloseTo(a.y, 6);
    const curved = { ...cam, curve: 1 }, c = project(curved, vp, 500, 200), d = project(curved, vp, 300, 200);
    expect(d.y).toBeGreaterThan(c.y);                                      // gewölbt fällt der Rand ab
  });

  it("am Fokus ist der Maßstab der Zoom; Höhe hebt senkrecht an", () => {
    const cam: Camera = { fx: 500, fy: 300, zoom: 1.3, mode: "tiefe" };
    const f = project(cam, vp, 500, 300), g = project(cam, vp, 520, 310), h = project(cam, vp, 520, 310, 20);
    expect(f.sc).toBeCloseTo(1.3, 6);
    expect(f.x).toBeCloseTo(vp.w / 2, 6);
    expect(Math.abs(h.x - g.x)).toBeLessThan(2);                          // Senkrechte neigen sich in der Perspektive leicht
    expect(g.y - h.y).toBeGreaterThan(20 * g.sc * 0.7);
  });

  it("Weiter hinten ist alles kleiner und höher im Bild; hinter dem Horizont verdeckt", () => {
    const cam: Camera = { fx: 500, fy: 300, zoom: 1, mode: "tiefe" };
    const near = project(cam, vp, 500, 330), far = project(cam, vp, 500, 100);
    expect(far.sc).toBeLessThan(near.sc);
    expect(far.y).toBeLessThan(near.y);
    expect(project(cam, vp, 500, -8000).t).toBeGreaterThan(1);
  });

  it("sichtbares Weltrechteck enthält alle Bodenpunkte des Bildes", () => {
    const cam: Camera = { fx: 900, fy: 700, zoom: 0.8, mode: "tiefe" }, r = visibleWorld(cam, vp);
    for (let x = 0; x <= vp.w; x += 16) for (let y = 0; y <= vp.h; y += 10) {
      const w = unproject(cam, vp, x, y);
      if (!w) continue;
      expect(w.x).toBeGreaterThanOrEqual(r.x0 - 2); expect(w.x).toBeLessThanOrEqual(r.x1 + 2);
      expect(w.y).toBeGreaterThanOrEqual(r.y0 - 2); expect(w.y).toBeLessThanOrEqual(r.y1 + 2);
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
      expect(north.y).toBeGreaterThanOrEqual(mode === "tiefe" ? horizon(cam, vp, 160) : 0);
    });
  }

  it("Fokus bleibt in der Nähe der Karte", () => {
    const c = clampToMap({ fx: -5000, fy: 9000, zoom: 1, mode: "tiefe" }, 1024, 640);
    expect(c.fx).toBe(-160);
    expect(c.fy).toBe(800);
  });
});
