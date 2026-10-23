import { describe, expect, it } from "vitest";
import { baueSzene, type Eingang } from "./szene";
import { START_OPTIONEN } from "./typen";

const basis: Eingang = { werkzeug: "zeiger", opt: START_OPTIONEN, pending: [], hover: [10, 10], raster: true, aktionen: [], stati: [], welt: [48, 32], gebietEcke: null };

describe("Szene des Cursors", () => {
  it("das Raster liegt um den Zeiger und fehlt ohne Zeiger oder bei ausgeschaltetem Raster", () => {
    expect(baueSzene(basis).raster).toHaveLength(28);
    expect(baueSzene({ ...basis, hover: null }).raster).toHaveLength(0);
    expect(baueSzene({ ...basis, raster: false }).raster).toHaveLength(0);
  });
  it("Haus: der Geist ist so breit wie das Sprite, die Türmarke liegt unter der Tür", () => {
    const s = baueSzene({ ...basis, werkzeug: "haus" });
    const xs = s.geist[0].punkte.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(78 / 16, 5);                       // Wohnhaus 66 + 12 Pixel Rand
    expect(s.tuer).toEqual([10, 11]);
  });
  it("Weg: Linie durch die Kachelmitten bis zum Zeiger, Punkte für die gesetzten", () => {
    const s = baueSzene({ ...basis, werkzeug: "weg", pending: [[2, 2], [5, 2]] });
    expect(s.geist[0]).toEqual({ art: "linie", punkte: [[2.5, 2.5], [5.5, 2.5], [10.5, 10.5]] });
    expect(s.geist[1].punkte).toHaveLength(2);
  });
  it("See: Ellipse um die Mitte mit dem Radius bis zum Zeiger", () => {
    const s = baueSzene({ ...basis, werkzeug: "see", pending: [[10, 6]] });
    const xs = s.geist[0].punkte.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(8 * (1 - 1e-12), 0);               // Radius 4 → 8 Kacheln breit
  });
  it("Garten: das Rechteck zwischen den Ecken", () => {
    const s = baueSzene({ ...basis, werkzeug: "garten", pending: [[4, 4]] });
    expect(s.geist[0].punkte).toEqual([[4, 4], [11, 4], [11, 11], [4, 11]]);
  });
  it("Schleier für jede Aktion mit Ort, blockierte Stellen aus den Antworten", () => {
    const s = baueSzene({ ...basis, aktionen: [{ art: "deko", sorte: "bank", tile: [3, 3] }, { art: "karte", richtung: "ost", kacheln: 8 }], stati: [{ ok: false, ort: [3, 3] }, { ok: true }] });
    expect(s.schleier).toHaveLength(1);
    expect(s.blockiert).toHaveLength(1);
  });
  it("Karte erweitern zeigt die neue Fläche im Osten und Süden", () => {
    const s = baueSzene({ ...basis, werkzeug: "karte" });
    expect(s.rand).toHaveLength(2);
    expect(s.rand[0].punkte[0]).toEqual([48, 0]);
    expect(s.rand[1].punkte[3]).toEqual([0, 48]);
  });
  it("Gebiet: der Rahmen hängt an der Zeigerkachel, nach dem Klick an der gewählten Ecke", () => {
    expect(baueSzene({ ...basis, werkzeug: "gebiet" }).gebiet?.form.punkte[0]).toEqual([10, 10]);
    expect(baueSzene({ ...basis, werkzeug: "gebiet", gebietEcke: [3, 4] }).gebiet?.form.punkte[0]).toEqual([3, 4]);
    expect(baueSzene({ ...basis, werkzeug: "weg" }).gebiet).toBeNull();
  });
});
