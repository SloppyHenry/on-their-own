// Aus Klicks werden Aktionen (AP16b): reine Funktionen ohne Oberfläche. Wege, Seen und Gärten brauchen mehrere Klicks (Punkte, Mitte und Rand, zwei Ecken),
// alles andere genügt einer. Dasselbe Aktionsdatum geht an die Backend-Aktionen (`generator/edit/`), als Kandidat auch für die Prüfung „Fehler am Cursor“.
import type { Aktion, Optionen, Punkt, Werkzeug } from "./typen";

/** Werkzeuge in der Reihenfolge der Leiste (Tasten 1–9, 0); `w` = nur in der Werkstatt. */
export const LEISTE: { id: Werkzeug; zeichen: string; name: string; gruppe?: string; w?: boolean }[] = [
  { id: "zeiger", zeichen: "⇱", name: "Zeiger", gruppe: "Ansehen" }, { id: "weg", zeichen: "〰", name: "Weg", gruppe: "Zeichnen" }, { id: "see", zeichen: "◍", name: "See" },
  { id: "garten", zeichen: "▦", name: "Garten" }, { id: "haus", zeichen: "⌂", name: "Haus", gruppe: "Setzen" }, { id: "natur", zeichen: "♣", name: "Baum, Deko" },
  { id: "loeschen", zeichen: "✕", name: "Löschen", gruppe: "Ändern" }, { id: "startplatz", zeichen: "⚑", name: "Startplatz", gruppe: "Welt", w: true },
  { id: "gebiet", zeichen: "✦", name: "Gebiet", w: true }, { id: "karte", zeichen: "⤢", name: "Karte" },
];

export const gleich = (a: Punkt | undefined, b: Punkt | undefined) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const klemme = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Der See reicht von der Mitte bis zum Zeiger; die Höhe ist drei Viertel der Breite (wie der Standard der Aktion). */
export function seeRadius(mitte: Punkt, rand: Punkt): number {
  return Math.round(klemme(Math.hypot(rand[0] - mitte[0], rand[1] - mitte[1]), 1.5, 12) * 2) / 2;
}

export function rechteck(a: Punkt, b: Punkt): [number, number, number, number] {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]) + 1, Math.abs(a[1] - b[1]) + 1];
}

/** Die Aktion, die ein Haus mit der Tür auf dieser Kachel wäre. */
export function hausAktion(tuer: Punkt, o: Optionen["haus"]): Aktion {
  return o.gebaeude === "house" ? { art: "haus", tuer, gebaeude: "house", breite: o.breite, dach: o.dach, wand: o.wand } : { art: "haus", tuer, gebaeude: o.gebaeude };
}

/**
 * Die Aktion, die der nächste Klick auf `hover` ergäbe (oder die gerade gezogene Form bis zum Zeiger), für die Prüfung am Cursor.
 * `null`, wenn es noch nichts zu prüfen gibt.
 */
export function kandidat(w: Werkzeug, pending: Punkt[], hover: Punkt | null, o: Optionen): Aktion | null {
  if (!hover) return null;
  switch (w) {
    case "weg": {
      const p = pending.length === 0 ? [] : gleich(pending[pending.length - 1], hover) ? pending : [...pending, hover];
      return p.length >= 2 ? { art: "weg", punkte: p } : null;
    }
    case "see": return pending[0] ? { art: "see", mitte: pending[0], rx: seeRadius(pending[0], hover) } : { art: "see", mitte: hover, rx: 3 };
    case "garten": return pending[0] ? { art: "garten", rechteck: rechteck(pending[0], hover) } : null;
    case "haus": return hausAktion(hover, o.haus);
    case "natur": return { art: "deko", sorte: o.deko.sorte, tile: hover };
    case "loeschen": return { art: "loeschen", tile: hover };
    case "startplatz": return { art: "startplatz", tile: hover };
    default: return null;
  }
}

/** Ein Klick auf eine Kachel: neuer Stand der angefangenen Form und gegebenenfalls die fertige Aktion. */
export function klickSchritt(w: Werkzeug, pending: Punkt[], t: Punkt, o: Optionen): { pending: Punkt[]; aktion: Aktion | null } {
  switch (w) {
    case "weg": {
      if (gleich(pending[pending.length - 1], t)) return pending.length >= 2 ? { pending: [], aktion: { art: "weg", punkte: pending } } : { pending, aktion: null };   // zweiter Klick auf denselben Punkt = fertig
      return { pending: [...pending, t], aktion: null };
    }
    case "see": return pending[0] ? { pending: [], aktion: { art: "see", mitte: pending[0], rx: seeRadius(pending[0], t) } } : { pending: [t], aktion: null };
    case "garten": return pending[0] ? { pending: [], aktion: { art: "garten", rechteck: rechteck(pending[0], t) } } : { pending: [t], aktion: null };
    default: { const a = kandidat(w, [], t, o); return { pending: [], aktion: a }; }
  }
}

/** Das Weg-Werkzeug beendet auch mit Enter. */
export const wegFertig = (pending: Punkt[]): Aktion | null => (pending.length >= 2 ? { art: "weg", punkte: pending } : null);
