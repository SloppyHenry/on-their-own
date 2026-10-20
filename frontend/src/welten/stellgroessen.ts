// Stellgrößen des Generators (AP18f) im Browser: Namen, Wertebereiche und die Anfrage daraus. Dieselben Werte wie `backend/simulacra/generator/stil.py`.
import type { Stellgroessen } from "../types/generated";

export type Stil = Required<Stellgroessen>;
export const VORGABE: Stil = { form: "strasse", groesse: "klein", seen: 1, wasser: "bach", wald: "mittel", baeume: 10, gaerten: 1, felder: 0, wege: "geschwungen" };

export const FORMEN: [Stil["form"], string, string][] = [
  ["strasse", "Straßendorf", "Häuser an einer Seite der Straße (wie bisher)"],
  ["beidseitig", "Beidseitig", "Häuser auf beiden Seiten der Straße, Türwege um die Häuser herum"],
  ["haufen", "Haufendorf", "Häuser um den Platz verstreut, Türwege zum Platz"],
  ["zufall", "Nach Zufall", "eine der drei Formen, passend zum Seed"],
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
export const geaendert = (s: Stil) => anfrage(s) !== null;
