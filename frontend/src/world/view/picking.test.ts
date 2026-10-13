import { describe, expect, it } from "vitest";
import { hitTest } from "./picking";
import type { Drawn } from "./renderer";

const spr = (w: number, h: number) => ({ width: w, height: h }) as HTMLCanvasElement;
// Maske: nur die linke Hälfte ist deckend
const halfLeft = (s: HTMLCanvasElement, u: number) => (u < s.width / 2 ? 255 : 0);

describe("Treffer", () => {
  const tree: Drawn = { x: 10, y: 10, w: 20, h: 20, spr: spr(10, 10), target: { kind: "object", id: "baum" } };
  const agent: Drawn = { x: 18, y: 18, w: 6, h: 10, spr: spr(15, 23), target: { kind: "agent", id: "alex" } };

  it("das zuletzt Gezeichnete (vorne) gewinnt", () => {
    expect(hitTest([tree, agent], 20, 20, () => 255)).toEqual({ kind: "agent", id: "alex" });
    expect(hitTest([agent, tree], 20, 20, () => 255)).toEqual({ kind: "object", id: "baum" });
  });

  it("durchsichtige Pixel lassen den Klick zum Dahinterliegenden durch", () => {
    const front: Drawn = { ...tree, target: { kind: "house", id: "0" } }, back: Drawn = { x: 0, y: 0, w: 40, h: 40, spr: spr(4, 4), target: { kind: "object", id: "brunnen" } };
    const alpha = (s: HTMLCanvasElement, u: number) => (s === front.spr ? halfLeft(s, u) : 255);
    expect(hitTest([back, front], 12, 12, alpha)).toEqual({ kind: "house", id: "0" });      // linke Hälfte des Hauses
    expect(hitTest([back, front], 28, 12, alpha)).toEqual({ kind: "object", id: "brunnen" }); // rechte Hälfte durchsichtig → dahinter
  });

  it("Figuren haben einen Pixel Spielraum, daneben trifft nichts", () => {
    expect(hitTest([agent], 17, 20, () => 0)).toEqual({ kind: "agent", id: "alex" });
    expect(hitTest([agent], 40, 40, () => 255)).toBeNull();
  });

  it("Sprites ohne Ziel (Deko) werden übersprungen", () => {
    expect(hitTest([tree, { ...agent, target: undefined }], 20, 20, () => 255)).toEqual({ kind: "object", id: "baum" });
  });
});
