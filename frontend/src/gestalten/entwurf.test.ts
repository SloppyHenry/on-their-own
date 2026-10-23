import { describe, expect, it } from "vitest";
import { LEER, beschreibung, entfernen, hinzu, rueckgaengig, umrissKacheln, wiederholen } from "./entwurf";
import type { Katalog } from "./typen";

const a = { art: "deko", sorte: "bank", tile: [3, 4] }, b = { art: "weg", punkte: [[1, 1], [5, 1], [5, 4]] }, c = { art: "see", mitte: [10, 10], rx: 3 };
const katalog = { deko: [{ sorte: "bank", name: "Bank", blockiert: false }], haeuser: [{ gebaeude: "shop", name: "Laden" }], daecher: [], waende: [], karte: { richtungen: [], kacheln: [], max: 256 } } as Katalog;

describe("Entwurf", () => {
  it("sammelt Aktionen der Reihe nach", () => {
    const s = hinzu(hinzu(LEER, a), b);
    expect(s.aktionen).toEqual([a, b]);
    expect(s.wieder).toEqual([]);
  });
  it("Rückgängig und Wiederholen sind Gegenstücke", () => {
    const s = hinzu(hinzu(LEER, a), b), r = rueckgaengig(s);
    expect(r.aktionen).toEqual([a]);
    expect(r.wieder).toEqual([b]);
    expect(wiederholen(r)).toEqual(s);
    expect(rueckgaengig(LEER)).toBe(LEER);
    expect(wiederholen(LEER)).toBe(LEER);
  });
  it("eine neue Aktion verwirft den Wiederholen-Stapel", () => {
    const r = rueckgaengig(hinzu(hinzu(LEER, a), b));
    expect(hinzu(r, c).wieder).toEqual([]);
  });
  it("entfernt eine Aktion mitten aus der Liste", () => {
    expect(entfernen(hinzu(hinzu(hinzu(LEER, a), b), c), 1).aktionen).toEqual([a, c]);
  });
  it("beschreibt die Aktionen in Worten", () => {
    expect(beschreibung(b, katalog)).toBe("Weg, 3 Punkte");
    expect(beschreibung(a, katalog)).toBe("Bank");
    expect(beschreibung({ art: "haus", gebaeude: "shop" }, katalog)).toBe("Haus: Laden");
    expect(beschreibung({ art: "garten", rechteck: [1, 1, 5, 4] }, null)).toBe("Garten 5 × 4");
    expect(beschreibung({ art: "karte", richtung: "sued", kacheln: 16 }, null)).toBe("Karte: Süden +16");
  });
  it("Umriss in Kacheln: Weg, Garten, Deko; Karte und Löschen haben keinen", () => {
    expect(umrissKacheln(b)).toEqual([1, 1, 5, 4]);
    expect(umrissKacheln({ art: "garten", rechteck: [2, 3, 5, 4] })).toEqual([2, 3, 6, 6]);
    expect(umrissKacheln(a)).toEqual([3, 4, 3, 4]);
    expect(umrissKacheln({ art: "karte", richtung: "ost", kacheln: 8 })).toBeNull();
    expect(umrissKacheln({ art: "loeschen", tile: [1, 1] })).toBeNull();
  });
});
