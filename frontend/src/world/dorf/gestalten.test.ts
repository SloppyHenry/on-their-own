// Gestalten (AP16a): Operationen an der Gestaltung wie im Backend (`world/look_ops.py`), Maske im Block `legacy`, Bild A bleibt Pixel für Pixel gleich, wo nichts gelöscht wurde.
import { describe, expect, it } from "vitest";
import { applyEvent } from "../../store/reducers";
import { ev, makeSnapshot } from "../../test/fixtures";
import { applySnapshot } from "../../store/reducers";
import v2Startwelt from "./look-v2-startwelt.json" with { type: "json" };
import { Ground, CH } from "./grund";
import { applyLookOps, normalizeLook, rawLook, type Look, type LookOp } from "./look";

const start = (): Look => JSON.parse(JSON.stringify(v2Startwelt)) as Look;

describe("Operationen an der Gestaltung", () => {
  it("trägt Formen ein, entfernt sie, setzt Bildstellen und vergrößert Gebiete (außerhalb von legacy)", () => {
    const L = start();
    L.legacy = null;
    const lake = { x: 50, y: 60, rx: 20, ry: 15 };
    const ops: LookOp[] = [
      { op: "add", region: "dorf", liste: "lakes", item: lake },
      { op: "add", region: "dorf", liste: "decor", item: ["tree", 10, 12, 3] },
      { op: "place", region: "dorf", id: "e1_bench", value: { at: [5, 6], sprite: "bench", e: 0 } },
      { op: "bounds", region: "dorf", right: 999 },
      { op: "bounds", region: "dorf", right: 10 },
    ];
    const a = applyLookOps(L, ops);
    expect(a.regions[0].shapes.lakes.at(-1)).toEqual(lake);
    expect(a.regions[0].shapes.lakes).toHaveLength(L.regions[0].shapes.lakes.length + 1);
    expect(a.regions[0].place.e1_bench.sprite).toBe("bench");
    expect(a.regions[0].bounds.right).toBe(999);                                        // nur größer
    expect(L.regions[0].shapes.lakes).toHaveLength(1);                                  // die Eingabe bleibt unverändert
    const b = applyLookOps(a, [{ op: "remove", region: "dorf", liste: "lakes", item: lake }, { op: "unplace", region: "dorf", id: "e1_bench" }]);
    expect(b.regions[0].shapes.lakes).toEqual(L.regions[0].shapes.lakes);
    expect(b.regions[0].place.e1_bench).toBeUndefined();
  });

  it("im Block legacy bleibt der Eintrag in der Liste und wird ausgeblendet", () => {
    const L = start();
    const lake = L.regions[0].shapes.lakes[0];
    const a = applyLookOps(L, [{ op: "remove", region: "dorf", liste: "lakes", item: lake }]);
    expect(a.regions[0].shapes.lakes).toEqual(L.regions[0].shapes.lakes);
    expect(a.mask).toEqual([{ region: "dorf", liste: "lakes", item: lake }]);
    expect(normalizeLook(a).regions[0].shapes.lakes).toEqual([]);
    expect(rawLook(a).regions[0].shapes.lakes).toHaveLength(1);
  });

  it("die Ereignisse ändern die Welt im Browser wie im Backend", () => {
    let w = applySnapshot({ ...makeSnapshot(), look: start() as never, links: [[[7, 10], [42, 15]]] } as never);
    w = applyEvent(w, ev("world.look_edited", { ops: [{ op: "add", region: "dorf", liste: "paths", item: [[0, 0], [30, 0]] }], upgraded: false }));
    expect((rawLook(w.look as never).regions[0].shapes.paths).at(-1)).toEqual([[0, 0], [30, 0]]);
    w = applyEvent(w, ev("world.links_removed", { links: [[[42, 15], [7, 10]]] }));
    expect(w.links).toEqual([]);
  });
});

describe("Bild A bleibt Pixel für Pixel gleich", () => {
  /** Alle Blöcke des Bodens von Bild A als ein Puffer (384 × 288 Texel, rgba). */
  function bake(L: Look): Uint8ClampedArray {
    const g = new Ground(L), out = new Uint8ClampedArray(384 * 288 * 4);
    for (let cj = 0; cj < 5; cj++) for (let ci = 0; ci < 6; ci++) {
      const c = g.chunk(ci, cj, 1);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
        const tx = ci * CH + x, ty = cj * CH + y;
        if (tx < 384 && ty < 288) out.set(c.subarray((y * CH + x) * 4, (y * CH + x) * 4 + 4), (ty * 384 + tx) * 4);
      }
    }
    return out;
  }

  it("ohne Änderung und mit einer Maske, die nichts trifft, ist der Boden gleich", () => {
    const L = start();
    expect(bake(normalizeLook(applyLookOps(L, [])))).toEqual(bake(L));
  });

  it("gelöscht (ausgeblendet) wird nur im Umkreis der Form, überall sonst bleibt jeder Texel gleich", () => {
    const L = start(), R = L.regions[0];
    const lake = R.shapes.lakes[0], path = R.shapes.paths[1];
    const after = normalizeLook(applyLookOps(L, [{ op: "remove", region: "dorf", liste: "lakes", item: lake }, { op: "remove", region: "dorf", liste: "paths", item: path }]));
    const a = bake(L), b = bake(after);
    const ox = R.frame[0] - L.texShift[0], oy = R.frame[1] - L.texShift[1];
    const near = (tx: number, ty: number) => {
      const vx = tx - ox, vy = ty - oy;
      if (((vx - lake.x) / (lake.rx * 1.3 + 6)) ** 2 + ((vy - lake.y) / (lake.ry * 1.3 + 6)) ** 2 < 1) return true;
      return path.some((p, i) => i > 0 && Math.hypot(vx - (p[0] + path[i - 1][0]) / 2, vy - (p[1] + path[i - 1][1]) / 2) < Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) / 2 + 12);
    };
    let changed = 0, outside = 0, same = 0;
    for (let ty = 0; ty < 288; ty++) for (let tx = 0; tx < 384; tx++) {
      const i = (ty * 384 + tx) * 4;
      const eq = a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3];
      if (!eq) { changed++; if (!near(tx, ty)) outside++; } else same++;
    }
    expect(outside).toBe(0);
    expect(changed).toBeGreaterThan(300);
    expect(same).toBeGreaterThan(384 * 288 * 0.6);
  });
});
