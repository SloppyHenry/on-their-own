import { describe, expect, it } from "vitest";
import { applyEvent, applySnapshot } from "../store/reducers";
import { ev, makeSnapshot } from "../test/fixtures";
import { bodenAt, klangFuer, stimmeVon } from "./buehne";
import { MAX_SYL, parseText, plan, syllables } from "./sprache";
import { standardStimme } from "./stimmen";
import { tageszeit } from "./regie";

const makeWorld = () => applySnapshot(makeSnapshot());

describe("Sprache der Plapperstimmen", () => {
  it("zerlegt Sätze mit ihrem Satzende", () => {
    const ph = parseText("Kommst du heute? Ja, gern. Hm…");
    expect(ph.map((p) => p.end)).toEqual(["?", ",", ".", "…"]);
    expect(ph[0].words.map((w) => w.w)).toEqual(["kommst", "du", "heute"]);
  });
  it("betont nach Vorsilbe die zweite Silbe, Füllwörter nie", () => {
    const s = syllables("vergessen", 0);
    expect(s.map((x) => x.v)).toEqual(["e", "e", "e"]);
    expect(s.findIndex((x) => x.stress)).toBe(1);
    expect(syllables("und", 0).some((x) => x.stress)).toBe(false);
  });
  it("Ja/Nein-Frage steigt am Ende, Aussage fällt", () => {
    const q = plan("Kommst du heute Abend zum Essen?", { base: 150, lively: 1, speed: 1 }), a = plan("Ich gehe jetzt zum Brunnen.", { base: 150, lively: 1, speed: 1 });
    expect(q[q.length - 1].st).toBeGreaterThan(q[q.length - 3].st);
    expect(a[a.length - 1].st).toBeLessThan(a[0].st);
  });
  it("gleicher Text klingt gleich, lange Texte werden gekürzt", () => {
    const v = { base: 120, lively: 0.8, speed: 1 };
    expect(plan("Guten Morgen!", v).map((s) => s.st)).toEqual(plan("Guten Morgen!", v).map((s) => s.st));
    const long = plan("Ich habe heute Morgen lange über unser Gespräch von gestern nachgedacht. ".repeat(4), v);
    expect(long.length).toBe(MAX_SYL); expect(long.truncated).toBe(true); expect(long[long.length - 1].end).toBe("…");
  });
  it("kommt mit Sonderfällen zurecht", () => {
    for (const t of ["", "...", "123", "Hm.", "ÄÖÜ!", "😀 ok"]) expect(() => plan(t, { base: 150, lively: 1, speed: 1 })).not.toThrow();
    expect(plan("", { base: 150, lively: 1, speed: 1 })).toHaveLength(0);
  });
});

describe("Stimmen je Bewohner", () => {
  it("schlägt nach Geschlecht und Alter vor, fest je Kennung", () => {
    const w = standardStimme("mira", { gender: "weiblich", age: 30 }), m = standardStimme("alex", { gender: "männlich", age: 34 }), kid = standardStimme("kind", { gender: "männlich", age: 8 });
    expect(w.base).toBeGreaterThan(m.base);
    expect(kid.base).toBeGreaterThan(m.base);
    expect(standardStimme("mira", { gender: "weiblich", age: 30 })).toEqual(w);
    expect(standardStimme("x", null).style).toBe("plappern");
  });
});

describe("Klänge zu Aktionen und Boden", () => {
  it("ordnet Aktionen Geräusche zu", () => {
    expect(klangFuer("use", { mode: "cook" })).toBe("pot");
    expect(klangFuer("water", {})).toBe("pour");
    expect(klangFuer("gather", { resource: "wood" })).toBe("chop");
    expect(klangFuer("give", { resource: "coins" })).toBe("coins");
    expect(klangFuer("speak", {})).toBeNull();
    expect(klangFuer("use", { mode: "unbekannt" })).toBeNull();
  });
  it("erkennt den Boden unter den Füßen", () => {
    const w = makeWorld();
    const at = (type: string) => { for (let y = 0; y < w.map.rows.length; y++) { const x = [...w.map.rows[y]].findIndex((c) => w.map.legend[c] === type); if (x >= 0) return [x, y] as const; } return null; };
    const g = at("grass"), path = at("path"), water = at("water");
    if (g) expect(bodenAt(w, g[0], g[1], false)).toBe("gras");
    if (g) expect(bodenAt(w, g[0], g[1], true)).toBe("holz");
    if (path) expect(["weg", "stein"]).toContain(bodenAt(w, path[0], path[1], false));
    if (water) expect(bodenAt(w, water[0], water[1], false)).toBeNull();
  });
  it("Tageszeit aus der Uhr", () => {
    const w = makeWorld(), at = (time: string, phase = "day") => tageszeit({ ...w, clock: { ...w.clock, time, phase } });
    expect(at("07:00")).toBe("morgen"); expect(at("12:30")).toBe("mittag"); expect(at("18:00")).toBe("abend"); expect(at("23:00", "night")).toBe("nacht"); expect(at("06:00", "night")).toBe("nacht");
  });
});

describe("Stimmen gehören zur Welt (Spielstand)", () => {
  it("Zustandsabzug und Ereignis setzen die Stimme, ohne Eintrag gilt der Vorschlag", () => {
    let w = applySnapshot(makeSnapshot({ voices: { mira: { base: 260, timbre: "weich", speed: 1, size: 1.1, lively: 1, breath: 0.1, vib: 5, style: "summen" } } }));
    expect(stimmeVon(w, "mira")).toMatchObject({ base: 260, style: "summen" });
    expect(stimmeVon(w, "alex")).toEqual(standardStimme("alex", w.agents.alex.profile));
    const alex = { base: 140, timbre: "rau", speed: 0.9, size: 1, lively: 0.6, breath: 0.08, vib: 4, style: "plappern" };
    w = applyEvent(w, ev("simulation.voice_changed", { agent: "alex", voice: alex }));
    expect(stimmeVon(w, "alex")).toMatchObject(alex);
    w = applyEvent(w, ev("simulation.voice_changed", { agent: "mira", voice: null }));
    expect(w.voices.mira).toBeUndefined();
  });
});
