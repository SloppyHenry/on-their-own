import { describe, expect, it } from "vitest";
import { START_OPTIONEN, type Punkt } from "./typen";
import { LEISTE, hausAktion, kandidat, klickSchritt, rechteck, seeRadius, wegFertig } from "./werkzeug";

const o = START_OPTIONEN;

describe("Weg", () => {
  it("jeder Klick setzt einen Punkt, derselbe Punkt noch einmal beendet", () => {
    let s = klickSchritt("weg", [], [2, 2], o);
    expect(s).toEqual({ pending: [[2, 2]], aktion: null });
    s = klickSchritt("weg", s.pending, [6, 2], o);
    s = klickSchritt("weg", s.pending, [6, 2], o);
    expect(s.pending).toEqual([]);
    expect(s.aktion).toEqual({ art: "weg", punkte: [[2, 2], [6, 2]] });
  });
  it("ein einzelner Punkt zweimal angeklickt ergibt keinen Weg", () => {
    const s = klickSchritt("weg", [[2, 2]], [2, 2], o);
    expect(s).toEqual({ pending: [[2, 2]], aktion: null });
  });
  it("Enter beendet ab zwei Punkten", () => {
    expect(wegFertig([[1, 1]])).toBeNull();
    expect(wegFertig([[1, 1], [2, 1]])).toEqual({ art: "weg", punkte: [[1, 1], [2, 1]] });
  });
  it("Kandidat: die angefangene Linie bis zum Zeiger", () => {
    expect(kandidat("weg", [], [3, 3], o)).toBeNull();
    expect(kandidat("weg", [[1, 1]], [4, 1], o)).toEqual({ art: "weg", punkte: [[1, 1], [4, 1]] });
    expect(kandidat("weg", [[1, 1], [4, 1]], [4, 1], o)).toEqual({ art: "weg", punkte: [[1, 1], [4, 1]] });
  });
});

describe("See und Garten", () => {
  it("See: erst die Mitte, dann der Rand; der Radius ist begrenzt", () => {
    const s = klickSchritt("see", [], [10, 10], o);
    expect(s.pending).toEqual([[10, 10]]);
    expect(klickSchritt("see", s.pending, [14, 10], o).aktion).toEqual({ art: "see", mitte: [10, 10], rx: 4 });
    expect(seeRadius([0, 0], [1, 0])).toBe(1.5);
    expect(seeRadius([0, 0], [40, 0])).toBe(12);
  });
  it("Garten: zwei beliebige Ecken ergeben das Rechteck samt beider Eckkacheln", () => {
    expect(rechteck([8, 5], [4, 2])).toEqual([4, 2, 5, 4]);
    const s = klickSchritt("garten", [], [4, 2], o);
    expect(klickSchritt("garten", s.pending, [8, 5], o).aktion).toEqual({ art: "garten", rechteck: [4, 2, 5, 4] });
  });
  it("Garten und See haben vor dem ersten Klick keine Form zum Prüfen (See schon: die Mitte an der Zeigerkachel)", () => {
    expect(kandidat("garten", [], [1, 1], o)).toBeNull();
    expect(kandidat("see", [], [1, 1], o)).toEqual({ art: "see", mitte: [1, 1], rx: 3 });
  });
});

describe("Setzen mit einem Klick", () => {
  const t: Punkt = [7, 8];
  it("Haus: Wohnhaus mit Farben, andere Gebäudearten ohne", () => {
    expect(klickSchritt("haus", [], t, o).aktion).toEqual({ art: "haus", tuer: t, gebaeude: "house", breite: 66, dach: "rot", wand: "creme" });
    expect(hausAktion(t, { ...o.haus, gebaeude: "shop" })).toEqual({ art: "haus", tuer: t, gebaeude: "shop" });
  });
  it("Baum und Deko, Löschen, Startplatz", () => {
    expect(klickSchritt("natur", [], t, o).aktion).toEqual({ art: "deko", sorte: "baum", tile: t });
    expect(klickSchritt("loeschen", [], t, o).aktion).toEqual({ art: "loeschen", tile: t });
    expect(klickSchritt("startplatz", [], t, o).aktion).toEqual({ art: "startplatz", tile: t });
  });
  it("Zeiger, Gebiet und Karte setzen durch Klicks nichts", () => {
    for (const w of ["zeiger", "gebiet", "karte"] as const) expect(klickSchritt(w, [], t, o).aktion).toBeNull();
  });
  it("ohne Zeiger gibt es nichts zu prüfen", () => {
    expect(kandidat("haus", [], null, o)).toBeNull();
  });
});

describe("Leiste", () => {
  it("zehn Werkzeuge in fünf Gruppen; Startplatz und Gebiet nur in der Werkstatt", () => {
    expect(LEISTE).toHaveLength(10);
    expect(LEISTE.filter((t) => t.gruppe).map((t) => t.gruppe)).toEqual(["Ansehen", "Zeichnen", "Setzen", "Ändern", "Welt"]);
    expect(LEISTE.filter((t) => t.w).map((t) => t.id)).toEqual(["startplatz", "gebiet"]);
  });
});
