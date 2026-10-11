import { beforeEach, describe, expect, it } from "vitest";
import { ev, makeSnapshot, resetSeq } from "../../test/fixtures";
import { applyClock, applyEvent, applySnapshot } from "./index";
import { routeBetween, walkPos } from "./walks";

beforeEach(() => resetSeq());

const at = (total: number) => ({ sim_time: { day: 1, minute: total % 1440, total } });
const walking = (minute: number, arrive = [421, 422, 424], path = [[2, 1], [3, 1], [3, 2]]) =>
  ev("agent.walking", { from: [1, 1], path, arrive, label: "Bank", reason: "start" }, { agents: ["alex"], ...at(minute) });

describe("Fahrplan", () => {
  it("walkPos folgt den Ankunftsminuten", () => {
    const w = { from: [1, 1] as [number, number], path: [[2, 1], [3, 1], [3, 2]] as [number, number][], arrive: [421, 422, 424] };
    expect(walkPos(w, 420)).toEqual({ tile: [1, 1], facing: null });
    expect(walkPos(w, 422)).toEqual({ tile: [3, 1], facing: "right" });
    expect(walkPos(w, 423)).toEqual({ tile: [3, 1], facing: "right" });
    expect(walkPos(w, 999)).toEqual({ tile: [3, 2], facing: "down" });
  });

  it("der Uhrtakt bewegt die Figur ohne weitere Ereignisse", () => {
    let w = applyEvent(applySnapshot(makeSnapshot()), walking(420));
    expect([w.agents.alex.x, w.agents.alex.y]).toEqual([1, 1]);
    w = applyClock(w, 422);
    expect([w.agents.alex.x, w.agents.alex.y, w.agents.alex.facing]).toEqual([3, 1, "right"]);
    expect(w.clock.minute).toBe(422);
    const same = applyClock(w, 423);
    expect(same.agents).toBe(w.agents);                       // nichts geändert: dieselben Objekte, kein Neuzeichnen
    expect(applyClock(w, 400)).toBe(w);                       // nie rückwärts
  });

  it("ein Ereignis mit späterer Minute führt den Weg ebenfalls mit", () => {
    let w = applyEvent(applySnapshot(makeSnapshot()), walking(420));
    w = applyEvent(w, ev("agent.status_changed", { old: "idle", new: "walking" }, { agents: ["mira"], ...at(421) }));
    expect([w.agents.alex.x, w.agents.alex.y]).toEqual([2, 1]);
  });

  it("Ankunft beendet den Weg auf der gemeldeten Kachel", () => {
    let w = applyEvent(applySnapshot(makeSnapshot()), walking(420));
    w = applyEvent(w, ev("agent.arrived", { target: "bench", label: "Bank", at: [3, 2] }, { agents: ["alex"], ...at(424) }));
    expect(w.walks.alex).toBeUndefined();
    expect([w.agents.alex.x, w.agents.alex.y]).toEqual([3, 2]);
  });

  it("Abbruch übernimmt die Kachel aus dem Ereignis und hält die Figur an", () => {
    let w = applyEvent(applySnapshot(makeSnapshot()), walking(420));
    w = applyEvent(w, ev("agent.action_interrupted", { action: "move_to", reason: "versetzt", at: [9, 9] }, { agents: ["alex"], ...at(421) }));
    expect(w.walks.alex).toBeUndefined();
    expect([w.agents.alex.x, w.agents.alex.y]).toEqual([9, 9]);
    expect([applyClock(w, 430).agents.alex.x]).toEqual([9]);
  });

  it("Ortswechsel mit Kachel versetzt die Figur (auch ohne Weg)", () => {
    const w = applyEvent(applySnapshot(makeSnapshot()), ev("agent.location_changed", { from_location: "paths", to_location: "lake", at: [30, 30] }, { agents: ["mira"] }));
    expect([w.agents.mira.x, w.agents.mira.y, w.agents.mira.location_id]).toEqual([30, 30, "lake"]);
  });

  it("ein Snapshot mitten im Weg läuft von der aktuellen Kachel weiter", () => {
    const s = makeSnapshot();
    s.agents[0] = { ...s.agents[0], x: 2, y: 1, walk: { path: [[3, 1], [3, 2]], arrive: [422, 424] } };
    const w = applySnapshot(s);
    expect(w.walks.alex.from).toEqual([2, 1]);
    expect([applyClock(w, 424).agents.alex.x, applyClock(w, 424).agents.alex.y]).toEqual([3, 2]);
  });
});

describe("Route der Figur", () => {
  const walk = { from: [1, 1] as [number, number], path: [[2, 1], [3, 1], [3, 2]] as [number, number][], arrive: [1, 2, 3] };
  it("liefert alle Zwischenkacheln, wenn mehrere Schritte zwischen zwei Bildern liegen", () => {
    expect(routeBetween(walk, [1, 1], [3, 2])).toEqual([[2, 1], [3, 1], [3, 2]]);
    expect(routeBetween(walk, [2, 1], [3, 1])).toEqual([[3, 1]]);
  });
  it("null, wenn die Kacheln nicht auf der Route liegen oder rückwärts", () => {
    expect(routeBetween(walk, [9, 9], [3, 2])).toBeNull();
    expect(routeBetween(walk, [3, 2], [2, 1])).toBeNull();
    expect(routeBetween(undefined, [1, 1], [2, 1])).toBeNull();
  });
});
