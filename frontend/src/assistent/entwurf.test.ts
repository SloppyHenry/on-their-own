import { describe, expect, it } from "vitest";
import { blankResident, defaultMix, houseCount, newDraft, otherBuildings, pairKey, toRequest } from "./entwurf";

const draft = (n: number) => ({ ...newDraft(5), residents: Array.from({ length: n }, (_, i) => blankResident(`Figur ${i + 1}`)) });

describe("Entwurf: Gebäude und Anfragekörper", () => {
  it("höchstens 2 Personen je Wohnhaus, Gemeinschaftsbauten wachsen mit (wie das Backend)", () => {
    expect(defaultMix(1)).toEqual({ house: 1, workshop: 1, shop: 1 });
    expect(defaultMix(2).house).toBe(1);
    expect(defaultMix(3).house).toBe(2);
    expect(defaultMix(8).house).toBe(4);
    expect(defaultMix(4).stable).toBeUndefined();
    expect(defaultMix(5).stable).toBe(1);
    expect(defaultMix(7).barn).toBe(1);
  });

  it("Wohnhäuser: automatisch aus der Bewohnerzahl, von Hand überschreibbar", () => {
    const d = draft(5);
    expect(houseCount(d)).toBe(3);
    expect(houseCount({ ...d, world: { ...d.world, houses: 5 } })).toBe(5);
    expect(otherBuildings(d)).toMatchObject({ shop: 1, workshop: 1, stable: 1, barn: 0 });
  });

  it("der Anfragekörper enthält nur Geändertes", () => {
    const d = draft(3);
    const base = toRequest(d);
    expect(base.world).toEqual({ kind: "generated", seed: 5, lake: "auto", style: { form: "zufall" } });                  // die Dorfform entscheidet der Seed
    expect(base.relations).toEqual([]);
    expect(base.stories).toEqual([]);
    expect(base.rules).toEqual({ mode: "observer" });
    expect(base).not.toHaveProperty("model");
    const changed = toRequest({
      ...d,
      world: { ...d.world, houses: 3, mix: { shop: 0, workshop: 1 } },
      rel: { "0>1": { trust: 80, sympathy: 70, tension: 5, familiarity: 60 }, "1>0": { trust: 50, sympathy: 50, tension: 10, familiarity: 30 }, "0>7": { trust: 1, sympathy: 1, tension: 1, familiarity: 1 } },
      stories: { [pairKey(1, 0)]: "  Sie kennen sich vom Markt.  ", "1-2": "   " },
      rules: { ...d.rules, preset: "hohe-autonomie", autonomy: 80, scarcity: 0, mode: "creator", events: [{ text: "Heute regnet es.", source: "rule", ops: [{ op: "set_weather" }], preview: ["Wetter"] }] },
      model: "m1",
      run: "running",
    });
    expect(changed.world).toEqual({ kind: "generated", seed: 5, lake: "auto", houses: 3, mix: { workshop: 1 }, style: { form: "zufall" } });
    expect(changed.relations).toEqual([{ a: 0, b: 1, trust: 80, sympathy: 70, tension: 5, familiarity: 60 }]);      // Standard und unbekannte Bewohner entfallen
    expect(changed.stories).toEqual([{ a: 0, b: 1, text: "Sie kennen sich vom Markt." }]);
    expect(changed.rules).toMatchObject({ preset: "hohe-autonomie", autonomy: 80, scarcity: 0, mode: "creator", events: [{ text: "Heute regnet es.", source: "rule", ops: [{ op: "set_weather" }] }] });
    expect(changed.rules?.events?.[0]).not.toHaveProperty("preview");                                                  // die Vorschau gehört nicht zum Körper
    expect(changed.model).toBe("m1");
    expect(changed.run).toBe("running");
  });

  it("die Startwelt kennt weder Seed noch Häuser noch Wohnvorwort", () => {
    const d = draft(2);
    d.residents[0].home = 1;
    const r = toRequest({ ...d, world: { ...d.world, kind: "start" } });
    expect(r.world).toEqual({ kind: "start" });
    expect(r.residents[0].home).toBeNull();
  });
});
