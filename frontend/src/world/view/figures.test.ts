import { describe, expect, it } from "vitest";
import type { World } from "../../store/types";
import { Figures } from "./figures";

const agent = (id: string, x: number, y: number) => ({ id, name: id, x, y, facing: "down", status: "idle", action: null, location_id: "platz" });
const world = (agents: ReturnType<typeof agent>[]): World => ({ agents: Object.fromEntries(agents.map((a) => [a.id, a])), walks: {}, simulation: { tick_delay_s: 2 } }) as unknown as World;

describe("Figuren", () => {
  it("rücken auf derselben Kachel auseinander, damit beide zu sehen sind", () => {
    const f = new Figures(), w = world([agent("alex", 5, 5), agent("mira", 5, 5)]);
    for (let i = 0; i < 40; i++) f.update(w, 1 / 60);
    const a = f.position("alex")!, m = f.position("mira")!;
    expect(Math.abs(a.x - m.x)).toBeGreaterThanOrEqual(8);
    expect(Math.floor(a.x / 16)).toBe(5);                                      // bleiben auf ihrer Kachel
    expect(Math.floor(m.x / 16)).toBe(5);
  });

  it("gehen Schritt für Schritt ohne Stehen zwischen zwei Takten", () => {
    const f = new Figures(), dt = 1 / 30;
    let x = 5;
    f.update(world([agent("alex", x, 5)]), dt);
    const still: number[] = [];
    for (let k = 0; k < 6; k++) {                                              // alle 2 s eine Kachel weiter
      x++;
      for (let i = 0; i < 60; i++) {
        const before = f.position("alex")!.x;
        f.update(world([agent("alex", x, 5)]), dt);
        if (k >= 2 && f.position("alex")!.x - before < 0.01) still.push(i);
      }
    }
    expect(still.length).toBe(0);
  });
});
