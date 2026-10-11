import { describe, expect, it } from "vitest";
import { conditionText, met, needColor } from "./autonomyText";

const n = { location: (id: string) => ({ lake: "See" }[id] ?? id), agent: (id: string) => ({ mira: "Mira" }[id] ?? id) };

describe("conditionText", () => {
  it("beschreibt jede Bedingung in Worten", () => {
    expect(conditionText({ type: "object_count", kind: "bench", location: "lake", min: 2 }, n)).toBe("Es gibt 2× bench (See)");
    expect(conditionText({ type: "location_visited", location: "lake" }, n)).toBe("See besucht");
    expect(conditionText({ type: "has_resource", resource: "wood", amount: 3 }, n)).toBe("3× Holz dabei");
    expect(conditionText({ type: "talked_with", person: "mira", topic: "Garten" }, n)).toBe("Gespräch mit Mira über „Garten“");
    expect(conditionText({ type: "plant_stage", min_stage: 3 }, n)).toBe("Eigene Pflanze erreicht Stufe 3");
    expect(conditionText(null, n)).toBe("");
  });
});

describe("Bedürfnisse", () => {
  it("Balken zeigen das Gedeckte, Farbe nach Dringlichkeit", () => {
    expect(met(30)).toBe(70);
    expect(met(130)).toBe(0);
    expect(needColor(10)).toContain("warn");
    expect(needColor(90)).toContain("ok");
  });
});
