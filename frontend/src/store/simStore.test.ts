import { beforeEach, describe, expect, it } from "vitest";
import { ev, makeSnapshot, resetSeq } from "../test/fixtures";
import { matchesFilters } from "../timeline/filter";
import { DEFAULT_FILTERS } from "./uiStore";
import { mergeEvents, useSimStore } from "./simStore";

beforeEach(() => { resetSeq(); useSimStore.getState().setSnapshot(makeSnapshot()); });

describe("mergeEvents", () => {
  const e = (seq: number) => ev("a", {}, { seq });
  it("hängt Neueres an", () => expect(mergeEvents([e(1), e(2)], [e(3)]).map((x) => x.seq)).toEqual([1, 2, 3]));
  it("sortiert Älteres (Verlauf) davor und entfernt Doppelte", () => expect(mergeEvents([e(3), e(4)], [e(1), e(2), e(3)]).map((x) => x.seq)).toEqual([1, 2, 3, 4]));
  it("kappt auf die letzten Einträge", () => expect(mergeEvents([e(1), e(2), e(3)], [e(4)], 3).map((x) => x.seq)).toEqual([2, 3, 4]));
});

describe("Store", () => {
  const talk = () => ev("agent.dialogue", { speaker: "alex", to: "mira", text: "Hallo" }, { agents: ["alex", "mira"], category: "dialogue" });

  it("Live-Dialog erzeugt eine Sprechblase, nachgeliefertes Ereignis nicht", () => {
    useSimStore.getState().pushEvents([talk()], false);
    expect(useSimStore.getState().bubbles).toEqual({});
    useSimStore.getState().pushEvents([talk()], true);
    expect(useSimStore.getState().bubbles.alex).toMatchObject({ text: "Hallo", to: "mira" });
  });

  it("Ereignisse werden angewendet und gespeichert", () => {
    useSimStore.getState().pushEvents([ev("agent.moved", { from: [1, 1], to: [2, 1], facing: "right" }, { agents: ["alex"] })], true);
    const s = useSimStore.getState();
    expect(s.world!.agents.alex.x).toBe(2);
    expect(s.events).toHaveLength(1);
  });

  it("ein neuer Snapshot leert Protokoll und Blasen", () => {
    useSimStore.getState().pushEvents([talk()], true);
    useSimStore.getState().setSnapshot(makeSnapshot({ seq: 99 }));
    expect(useSimStore.getState().events).toEqual([]);
    expect(useSimStore.getState().bubbles).toEqual({});
    expect(useSimStore.getState().world!.seq).toBe(99);
  });
});

describe("Protokollfilter", () => {
  const f = DEFAULT_FILTERS;
  it("blendet Einzelschritte standardmäßig aus", () => {
    expect(matchesFilters(ev("agent.moved", {}, { agents: ["alex"] }), "x", f)).toBe(false);
    expect(matchesFilters(ev("agent.moved", {}, { agents: ["alex"] }), "x", { ...f, moves: true })).toBe(true);
  });
  it("filtert nach Kategorie, Agent und Text", () => {
    const d = ev("agent.dialogue", {}, { agents: ["alex"], category: "dialogue" });
    expect(matchesFilters(d, "Alex sagt Hallo", { ...f, categories: { ...f.categories, dialogue: false } })).toBe(false);
    expect(matchesFilters(d, "Alex sagt Hallo", { ...f, agent: "mira" })).toBe(false);
    expect(matchesFilters(d, "Alex sagt Hallo", { ...f, agent: "alex", text: "hallo" })).toBe(true);
    expect(matchesFilters(d, "Alex sagt Hallo", { ...f, text: "tschüss" })).toBe(false);
  });
});
