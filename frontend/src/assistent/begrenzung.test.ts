import { describe, expect, it } from "vitest";
import { LIM, metaHits, profileChars, profileErrors, profileWarnings, slug } from "./begrenzung";
import { blankProfile } from "./entwurf";
import { REL_DEFAULT, rng, wuerfelBeziehung, wuerfelFigur } from "./wuerfeln";

const p = (over: object = {}) => ({ ...blankProfile("Ida"), ...over });

describe("Profilmaske: Grenzen und Wortprüfung", () => {
  it("findet Hinweise auf eine höhere Instanz, aber keine Teilwörter", () => {
    expect(metaHits("Der Spieler und die Leitstelle der Simulation, ein Programmierer")).toEqual(["Spieler", "Leitstelle", "Simulation"]);
    expect(metaHits("Ski fahren, Kinder, Skizze")).toEqual([]);
    expect(metaHits("Eine KI weiß das")).toEqual(["KI"]);
    expect(profileWarnings(p({ background: "Wurde vom Schöpfer erdacht." }))).toEqual(["„Schöpfer“ in Hintergrund: Bewohner kennen keine Spieler, Leitstelle oder Simulation."]);
  });

  it("nennt Verstöße gegen die Grenzen wie das Backend", () => {
    expect(profileErrors(p())).toEqual([]);
    const e = profileErrors(p({ name: "X".repeat(30), description: "a".repeat(700), interests: Array(9).fill("i"), goals: Array(4).fill("g"), communication_style: "s".repeat(200) }));
    expect(e).toEqual(expect.arrayContaining(["Name: höchstens 24 Zeichen.", "Beschreibung: höchstens 600 Zeichen.", "Interessen: höchstens 8 Einträge.", "Ziele: höchstens 3 Einträge.", "Kommunikationsstil: höchstens 160 Zeichen."]));
    expect(profileErrors(p({ name: " " }))).toContain("Name fehlt.");
    const big = p({ description: "a".repeat(600), background: "b".repeat(600), interests: Array(8).fill("c".repeat(40)), dislikes: Array(8).fill("e".repeat(40)), goals: Array(3).fill("d".repeat(120)) });
    expect(profileChars(big)).toBeGreaterThan(LIM.total);
    expect(profileErrors(big).some((x) => x.startsWith("Alle Texte zusammen"))).toBe(true);
  });
});

describe("Würfeln", () => {
  it("derselbe Seed und dieselbe Nummer ergeben dasselbe, eine andere Nummer etwas anderes", () => {
    expect(wuerfelFigur(7, 1)).toEqual(wuerfelFigur(7, 1));
    expect(wuerfelFigur(7, 1)).not.toEqual(wuerfelFigur(7, 2));
    const a = rng(5), b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("vergibt keinen Namen doppelt und hält die Werte in 5 bis 95", () => {
    const w = wuerfelFigur(3, 4, ["Anselm", "Britta"]);
    expect(["Anselm", "Britta"]).not.toContain(w.name);
    expect(Object.values(w.personality).every((v) => v >= 5 && v <= 95)).toBe(true);
    expect(w.age).toBeGreaterThanOrEqual(20);
  });
  it("Beziehungen bleiben um den Standard (höchstens ±20)", () => {
    for (let n = 0; n < 30; n++) {
      const r = wuerfelBeziehung(9, n);
      for (const k of Object.keys(REL_DEFAULT) as (keyof typeof REL_DEFAULT)[]) expect(Math.abs(r[k] - REL_DEFAULT[k])).toBeLessThanOrEqual(20);
    }
  });
});

describe("Kennung für den Stimmvorschlag", () => {
  it("wie im Backend: klein, ohne Umlaute und Sonderzeichen", () => {
    expect([slug("Jörg-Peter"), slug("Åse"), slug("   "), slug("Ida"), slug("Straße 7")]).toEqual(["joerg_peter", "ase", "figur", "ida", "strasse_7"]);
  });
});
