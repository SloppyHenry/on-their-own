// Würfeln (AP17b): derselbe Seed und dieselbe Wurfnummer ergeben dasselbe. eine ganze Figur (Name, Geschlecht, Alter, Beschreibung, Hintergrund, Interessen, Ziele, Stil, zwölf Werte); Beziehungen um den Standard.
import { PKEYS, type Personality } from "./begrenzung";


/** Kleine Zufallsfolge (mulberry32), unabhängig vom Browser. */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMEN_W = ["Britta", "Dora", "Franka", "Hedi", "Ida", "Lena", "Nora", "Paula", "Greta", "Marta", "Elsa", "Wilma"];
const NAMEN_M = ["Anselm", "Cem", "Emil", "Gustav", "Jakob", "Malte", "Otto", "Rudi", "Karl", "Bruno", "Fritz", "Theo"];
const NAMEN_D = ["Robin", "Sascha", "Kim", "Jona", "Noa", "Luca"];
export const NAMEN = [...NAMEN_W, ...NAMEN_M, ...NAMEN_D];
const GESCHLECHT = ["weiblich", "männlich", "weiblich", "männlich", "divers"] as const;
const BERUFE = ["Imkerin", "Tischler", "Schäfer", "Bäckerin", "Fischer", "Lehrerin", "Gärtner", "Schneiderin", "Müller", "Heilkundige", "Korbflechter", "Köhlerin", "Postbote", "Wirtin"];
const HERKUNFT = ["wuchs im Dorf auf", "kam vor Jahren aus der Stadt", "zog nach dem Tod der Eltern her", "lebte lange am Fluss, bevor das Dorf zur Heimat wurde", "kam als Kind mit einem Wanderzirkus", "erbte das Haus von einer Tante"];
const INTERESSEN = ["Pilze sammeln", "Schach", "Angeln", "Kräuter", "Geschichten erzählen", "Holzschnitzen", "Sterne beobachten", "Backen", "Vögel", "Musik", "Gärtnern", "Wandern", "Karten spielen", "Imkerei"];
const ABNEIGUNGEN = ["Lärm", "Streit", "Unpünktlichkeit", "Verschwendung", "Kälte", "Prahlerei", "Hektik", "Klatsch"];
const ZIELE = ["den Garten zum Blühen bringen", "jemanden im Dorf besser kennenlernen", "ein Fest für alle ausrichten", "ein Handwerk meistern", "den See erkunden", "das Haus herrichten", "Vorräte für den Winter anlegen", "eine alte Geschichte aufschreiben"];
const STIL = ["ruhig und überlegt", "herzlich und gesprächig", "knapp und direkt", "neugierig, stellt viele Fragen", "trocken, mit leisem Humor", "freundlich, hört lieber zu"];
const ZUG: Record<string, [string, string]> = {
  sociability: ["Sucht gern Gesellschaft und kommt schnell ins Gespräch.", "Ist lieber für sich und spricht nur, wenn es etwas zu sagen gibt."],
  curiosity: ["Will alles ausprobieren und fragt nach.", "Bleibt beim Bewährten."],
  helpfulness: ["Hilft, ohne lange zu fragen.", "Kümmert sich zuerst um die eigenen Dinge."],
  risk_taking: ["Wagt gern etwas Neues.", "Geht kein Risiko ein."],
  conflict_readiness: ["Sagt offen, was ihr oder ihm nicht passt.", "Geht Streit aus dem Weg."],
  cooperation: ["Arbeitet am liebsten gemeinsam mit anderen.", "Macht lieber alles allein."],
  calm_need: ["Braucht viel Ruhe und feste Pausen.", "Kommt auch bei Trubel gut zurecht."],
  persistence: ["Gibt nicht auf, bevor etwas fertig ist.", "Lässt Angefangenes auch mal liegen."],
  spontaneity: ["Handelt aus dem Bauch heraus.", "Plant alles genau."],
  autonomy: ["Entscheidet selbst und lässt sich ungern reinreden.", "Fragt gern andere um Rat."],
};

export interface Gewuerfelt { name: string; gender: "männlich" | "weiblich" | "divers"; age: number; description: string; background: string; interests: string[]; dislikes: string[]; goals: string[]; communication_style: string; personality: Personality }

/** Eine ganze Figur: Geschlecht, Name dazu, Alter, Beschreibung (aus den auffälligsten Werten), Hintergrund, Interessen, Abneigungen, Ziel, Stil und die zwölf Werte. */
export function wuerfelFigur(seed: number, n: number, taken: string[] = []): Gewuerfelt {
  const R = rng(seed * 1000 + n), mid = 35 + Math.floor(R() * 30), pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)];
  const some = <T,>(a: readonly T[], k: number) => { const b = [...a], out: T[] = []; while (out.length < k && b.length) out.push(b.splice(Math.floor(R() * b.length), 1)[0]); return out; };
  const gender = pick(GESCHLECHT), pool0 = gender === "weiblich" ? NAMEN_W : gender === "männlich" ? NAMEN_M : NAMEN_D;
  const free = pool0.filter((x) => !taken.includes(x)), pool = free.length ? free : pool0;
  const name = pool[Math.floor(R() * pool.length)];
  const personality = Object.fromEntries(PKEYS.map((k) => [k, Math.max(5, Math.min(95, mid - 35 + Math.floor(R() * 70)))])) as Personality;
  const age = 20 + Math.floor(R() * 50);
  const auffaellig = Object.entries(personality).filter(([k]) => k in ZUG).sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50)).slice(0, 2);
  const description = auffaellig.map(([k, v]) => ZUG[k][v >= 50 ? 0 : 1]).join(" ");
  const job = pick(BERUFE), background = `${name} ${pick(HERKUNFT)} und arbeitet als ${job}.`;
  return { name, gender, age, description, background, interests: some(INTERESSEN, 3), dislikes: some(ABNEIGUNGEN, 2), goals: some(ZIELE, 1), communication_style: pick(STIL), personality };
}

export type Rel = { trust: number; sympathy: number; tension: number; familiarity: number };
export const REL_DEFAULT: Rel = { trust: 50, sympathy: 50, tension: 10, familiarity: 30 };

/** Beziehung um den Standard, höchstens ±20 je Wert. */
export function wuerfelBeziehung(seed: number, n: number): Rel {
  const R = rng(seed * 7919 + n);
  const v = (base: number) => Math.max(0, Math.min(100, base + Math.floor(R() * 41) - 20));
  return { trust: v(REL_DEFAULT.trust), sympathy: v(REL_DEFAULT.sympathy), tension: v(REL_DEFAULT.tension), familiarity: v(REL_DEFAULT.familiarity) };
}
