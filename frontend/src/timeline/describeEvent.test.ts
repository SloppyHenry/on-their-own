import { describe, expect, it } from "vitest";
import { EVENT_CATEGORY, type EventType } from "../types/generated";
import { ev } from "../test/fixtures";
import { describeEvent } from "./describeEvent";

const names = { agent: (id: string) => ({ alex: "Alex", mira: "Mira" }[id] ?? id), location: (id: string) => ({ garden: "Garten", square: "Platz" }[id] ?? id) };
const obj = { id: "o", kind: "axe", name: "Axt" };

describe("describeEvent", () => {
  it("liefert für jeden Ereignistyp einen nicht leeren Satz, auch bei fehlenden Feldern", () => {
    for (const type of Object.keys(EVENT_CATEGORY) as EventType[]) {
      const d = describeEvent(ev(type, { object: obj, location: { name: "Nook" }, to: [1, 2], from: [0, 0], text: "x", changes: [], to_location: "garden", from_location: "square", new: "idle", d: 0 }, { agents: ["alex"] }), names);
      expect(d.text.length, type).toBeGreaterThan(2);
      expect(d.icon, type).toBeTruthy();
    }
  });

  it("Beispielsätze", () => {
    expect(describeEvent(ev("agent.dialogue", { speaker: "alex", to: "mira", text: "Hallo!" }, { agents: ["alex", "mira"] }), names).text).toBe("Alex zu Mira: „Hallo!“");
    expect(describeEvent(ev("agent.location_changed", { from_location: "square", to_location: "garden" }, { agents: ["mira"] }), names).text).toBe("Mira verlässt Platz und betritt Garten.");
    expect(describeEvent(ev("agent.action_started", { action: "water" }, { agents: ["mira"] }), names).text).toBe("Mira gießt.");
    expect(describeEvent(ev("agent.action_failed", { action: "water", code: "x", text: "Gießkanne fehlt" }, { agents: ["mira"] }), names).text).toBe("Mira scheitert: Gießkanne fehlt");
  });

  it("unbekannter Typ zeigt den Typnamen", () => {
    expect(describeEvent(ev("future.thing", {}), names).text).toBe("future.thing");
  });
});
