// Stellgrößen des Generators (AP18f) im Browser: Namen, Wertebereiche und die Anfrage daraus. Dieselben Werte wie `backend/simulacra/generator/stil.py`.
import type { Stellgroessen } from "../types/generated";

export type Stil = Required<Stellgroessen>;
/** Was der Generator ohne Angabe nimmt (das Dorf wie bisher): nur davon abweichende Werte gehen in die Anfrage. */
export const VORGABE: Stil = { form: "strasse", groesse: "klein", seen: 1, wasser: "bach", wald: "mittel", baeume: 10, gaerten: 1, felder: 0, wege: "geschwungen" };
/** Womit die Oberfläche beginnt: wie die Vorgabe, aber die Dorfform entscheidet der Seed, damit jedes Dorf anders aussieht. */
export const START: Stil = { ...VORGABE, form: "zufall" };

export const FORMEN: [Stil["form"], string, string][] = [
  ["strasse", "Entlang der Straße", "Die Häuser stehen an einer Seite der Straße (wie bisher)"],
  ["beidseitig", "Zwei Häuserreihen", "Häuser auf beiden Seiten der Straße"],
  ["haufen", "Dicht beieinander", "Die Häuser drängen sich um den Dorfplatz"],
  ["anger", "Rund um die Wiese", "Eine Dorfwiese mit Platz in der Mitte, Ringstraßen darum, Häuser an den Ringen"],
  ["fluss", "Am Fluss", "Ein Fluss quer durch die Karte, die Straße am Ufer, eine Brücke nach Süden"],
  ["streu", "Verstreute Höfe", "Einzelne Höfe an eigenen Gassen, weit auseinander, in der Mitte ein kleiner Platz"],
  ["zufall", "Überraschung", "Der Seed sucht eine der sechs Formen aus"],
];
export const GROESSEN: [Stil["groesse"], string][] = [["klein", "Klein"], ["mittel", "Mittel"], ["gross", "Groß"]];
export const WASSER: [Stil["wasser"], string][] = [["keiner", "Keiner"], ["bach", "Bach"], ["fluss", "Fluss"]];
export const WALD: [Stil["wald"], string][] = [["licht", "Licht"], ["mittel", "Mittel"], ["dicht", "Dicht"]];
export const WEGE: [Stil["wege"], string][] = [["geschwungen", "Geschwungen"], ["gerade", "Gerade"]];
export const ZAHLEN: [keyof Pick<Stil, "seen" | "baeume" | "gaerten" | "felder">, string, number, number][] = [["seen", "Seen", 0, 4], ["baeume", "Bäume im Dorf", 0, 40], ["gaerten", "Gärten", 0, 5], ["felder", "Felder", 0, 4]];

/** Nur was von der Vorgabe abweicht geht mit (ohne Angabe ergibt der Generator das Dorf wie bisher); null, wenn nichts abweicht. */
export function anfrage(s: Stil): Stellgroessen | null {
  const diff = Object.fromEntries((Object.keys(VORGABE) as (keyof Stil)[]).filter((k) => s[k] !== VORGABE[k]).map((k) => [k, s[k]]));
  return Object.keys(diff).length ? (diff as Stellgroessen) : null;
}
export const geaendert = (s: Stil) => (Object.keys(START) as (keyof Stil)[]).some((k) => s[k] !== START[k]);
