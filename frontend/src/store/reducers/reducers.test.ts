import { beforeEach, describe, expect, it } from "vitest";
import { ev, makeSnapshot, resetSeq } from "../../test/fixtures";
import { applyEvent, applyEvents, applySnapshot } from "./index";

beforeEach(() => resetSeq());

describe("Snapshot", () => {
  it("indexiert Agenten, Objekte und Orte", () => {
    const w = applySnapshot(makeSnapshot());
    expect(Object.keys(w.agents)).toEqual(["alex", "mira"]);
    expect(w.agentOrder).toEqual(["alex", "mira"]);
    expect(w.objects.bench.name).toBe("Bank");
    expect(w.seq).toBe(10);
  });
});

describe("Ereignisse", () => {
  const base = () => applySnapshot(makeSnapshot());

  it("agent.moved setzt Position und Blickrichtung", () => {
    const w = applyEvent(base(), ev("agent.moved", { from: [1, 1], to: [2, 1], facing: "right" }, { agents: ["alex"] }));
    expect(w.agents.alex).toMatchObject({ x: 2, y: 1, facing: "right" });
    expect(w.agents.mira.x).toBe(2);
    expect(w.seq).toBe(11);
  });

  it("Aktion beginnt, endet und hinterlässt ein Ergebnis", () => {
    let w = applyEvent(base(), ev("agent.action_started", { action: "gather", ends_at: 440 }, { agents: ["alex"] }));
    expect(w.agents.alex.action).toMatchObject({ type: "gather", ends_at: 440 });
    w = applyEvent(w, ev("agent.action_completed", { action: "gather" }, { agents: ["alex"] }));
    expect(w.agents.alex.action).toBeNull();
    expect(w.activity.alex.lastResult?.ok).toBe(true);
  });

  it("fehlgeschlagene Aktion merkt den Grund", () => {
    const w = applyEvent(base(), ev("agent.action_failed", { action: "water", code: "no_can", text: "Gießkanne fehlt" }, { agents: ["mira"] }));
    expect(w.activity.mira.lastResult).toMatchObject({ ok: false, text: "Gießkanne fehlt" });
  });

  it("Inventar, Bedürfnisse, Status", () => {
    let w = applyEvent(base(), ev("agent.inventory_changed", { resource: "wood", qty: 3, delta: 3 }, { agents: ["alex"] }));
    expect(w.agents.alex.inventory).toEqual({ wood: 3 });
    w = applyEvent(w, ev("agent.inventory_changed", { resource: "wood", qty: 0, delta: -3 }, { agents: ["alex"] }));
    expect(w.agents.alex.inventory).toEqual({});
    w = applyEvent(w, ev("agent.ate", { hunger: 5 }, { agents: ["alex"] }));
    expect(w.agents.alex.needs.hunger).toBe(5);
    w = applyEvent(w, ev("agent.status_changed", { old: "idle", new: "acting" }, { agents: ["alex"] }));
    expect(w.agents.alex.status).toBe("acting");
  });

  it("Objekte entstehen, ändern sich und verschwinden", () => {
    const obj = { id: "crate", kind: "crate", name: "Kiste", x: 2, y: 1, location_id: "paths", state: {} };
    let w = applyEvent(base(), ev("world.object_created", { object: obj }));
    expect(w.objects.crate.name).toBe("Kiste");
    w = applyEvent(w, ev("world.object_changed", { ...obj, state: { open: true } }));
    expect(w.objects.crate.state).toEqual({ open: true });
    w = applyEvent(w, ev("world.object_removed", { object: obj }));
    expect(w.objects.crate).toBeUndefined();
  });

  it("Kacheln und Kartenerweiterung", () => {
    let w = applyEvent(base(), ev("world.tile_changed", { x: 1, y: 1, type: "path" }));
    expect(w.map.rows[1]).toBe("T,.,.T");
    w = applyEvent(w, ev("world.map_extended", { from: [6, 3], to: [8, 4], fill: "grass" }));
    expect(w.map.rows).toHaveLength(4);
    expect(w.map.rows[0]).toBe("TTTTTT..");
    expect(w.map.width).toBe(8);
  });

  it("neue Kachelart bekommt ein freies Zeichen", () => {
    const w = applyEvent(base(), ev("world.tile_type_added", { id: "lava", walkable: false, cost: 0, label: "Lava", char: "T", color: "#f40" }));
    const ch = w.tileTypes.lava.char!;
    expect(ch).not.toBe("T");
    expect(w.map.legend[ch]).toBe("lava");
  });

  it("abgeschnittene Kachelliste markiert den Zustand als veraltet", () => {
    const w = applyEvent(base(), ev("world.tiles_changed", { changes: [], count: 5000, truncated: true }));
    expect(w.stale).toBe(true);
  });

  it("Wetter und Simulationsstatus", () => {
    let w = applyEvent(base(), ev("world.weather_changed", { from: "clear", to: "rain", until: 900 }));
    expect(w.weather).toMatchObject({ kind: "rain", until: 900 });
    w = applyEvent(w, ev("simulation.started", { minute: 430 }));
    expect(w.simulation.state).toBe("running");
    w = applyEvent(w, ev("simulation.speed_changed", { level: "fast", tick_delay_s: 0.2 }));
    expect(w.simulation).toMatchObject({ speed_level: "fast", tick_delay_s: 0.2 });
  });

  it("Uhr folgt der Ereigniszeit", () => {
    const w = applyEvent(base(), ev("world.time", {}, { sim_time: { day: 1, minute: 600, total: 600 } }));
    expect(w.clock).toMatchObject({ time: "10:00", phase: "day", daylight: 1 });
  });

  it("alte und doppelte Ereignisse ändern nichts", () => {
    const w0 = base();
    const e = ev("agent.moved", { from: [1, 1], to: [2, 1], facing: "right" }, { agents: ["alex"], seq: 11 });
    const w1 = applyEvent(w0, e);
    expect(applyEvent(w1, e)).toBe(w1);
    expect(applyEvent(w0, ev("agent.moved", { from: [1, 1], to: [3, 1], facing: "right" }, { agents: ["alex"], seq: 5 }))).toBe(w0);
  });

  it("unbekannter Ereignistyp ändert nur Nummer und Uhr", () => {
    const w = applyEvent(base(), ev("future.thing", { x: 1 }));
    expect(w.seq).toBe(11);
    expect(w.agents).toEqual(base().agents);
  });

  it("Snapshot plus Ereignisse ergeben denselben Zustand wie ein neuerer Snapshot", () => {
    const events = [
      ev("agent.moved", { from: [1, 1], to: [2, 1], facing: "right" }, { agents: ["alex"] }),
      ev("agent.inventory_changed", { resource: "wood", qty: 2, delta: 2 }, { agents: ["alex"] }),
    ];
    const w = applyEvents(base(), events);
    const later = makeSnapshot({ seq: 12 });
    later.agents[0] = { ...later.agents[0], x: 2, inventory: { wood: 2 }, facing: "right" };
    const ref = applySnapshot(later);
    expect(w.agents.alex).toEqual(ref.agents.alex);
  });
});
