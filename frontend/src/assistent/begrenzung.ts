// Profilmaske (AP17b): Bezeichnungen, Grenzen und Wortprüfung, gleich wie im Backend (`agents/schema.py`). Das Backend prüft immer selbst; hier
// stehen die Zähler und Warnungen schon beim Tippen.
export const PKEYS = ["sociability", "curiosity", "helpfulness", "risk_taking", "conflict_readiness", "cooperation", "calm_need", "conversation_initiative", "suggestion_acceptance", "persistence", "spontaneity", "autonomy"] as const;
export type PKey = (typeof PKEYS)[number];
export const PLABEL: Record<PKey, string> = {
  sociability: "Geselligkeit", curiosity: "Neugier", helpfulness: "Hilfsbereitschaft", risk_taking: "Risikobereitschaft", conflict_readiness: "Konfliktbereitschaft",
  cooperation: "Kooperationsneigung", calm_need: "Bedürfnis nach Ruhe", conversation_initiative: "Gesprächsinitiative", suggestion_acceptance: "Bereitschaft, Vorschläge anzunehmen",
  persistence: "Zielpersistenz", spontaneity: "Spontaneität", autonomy: "Autonomie",
};
export const FALLBACK_LIMITS = { maxResidents: 8, secondsPerDecision: 4.5, maxPerHouse: 2 };
export const LIM = { name: 24, text: 600, style: 160, item: 40, items: 8, goal: 120, goals: 3, story: 300, total: 2000 };
export const GENDERS = ["männlich", "weiblich", "divers"] as const;

export interface Profile {
  name: string;
  gender: (typeof GENDERS)[number];
  age: number;
  description: string;
  background: string;
  interests: string[];
  dislikes: string[];
  goals: string[];
  communication_style: string;
  known_places?: string[];
}
export type Personality = Record<PKey, number>;

const META = /(?<![\p{L}])(spieler\p{L}*|nutzer\p{L}*|benutzer\p{L}*|leitstelle\p{L}*|simulation\p{L}*|editor\p{L}*|schöpfer\p{L}*|ki|sprachmodell\p{L}*|prompt\p{L}*)(?![\p{L}])/giu;
export const metaHits = (text: string) => [...text.matchAll(META)].map((m) => m[0]);

export const profileChars = (p: Profile) => p.description.length + p.background.length + p.communication_style.length + p.interests.join(", ").length + p.dislikes.join(", ").length + p.goals.join(", ").length;

/** Hinweise der Wortprüfung („Spieler“ in Hintergrund …) für ein Profil. */
export function profileWarnings(p: Profile): string[] {
  const fields: [string, string][] = [["Beschreibung", p.description], ["Hintergrund", p.background], ["Kommunikationsstil", p.communication_style], ["Interessen", p.interests.join(", ")], ["Abneigungen", p.dislikes.join(", ")], ["Ziele", p.goals.join(", ")]];
  return fields.flatMap(([f, t]) => metaHits(t).map((w) => `„${w}“ in ${f}: Bewohner kennen keine Spieler, Leitstelle oder Simulation.`));
}

/** Grenzverstöße für die Anzeige (das Backend prüft dasselbe noch einmal). */
export function profileErrors(p: Profile): string[] {
  const e: string[] = [];
  if (!p.name.trim()) e.push("Name fehlt.");
  else if (p.name.length > LIM.name) e.push(`Name: höchstens ${LIM.name} Zeichen.`);
  if (p.description.length > LIM.text) e.push(`Beschreibung: höchstens ${LIM.text} Zeichen.`);
  if (p.background.length > LIM.text) e.push(`Hintergrund: höchstens ${LIM.text} Zeichen.`);
  if (p.communication_style.length > LIM.style) e.push(`Kommunikationsstil: höchstens ${LIM.style} Zeichen.`);
  for (const [k, n, c, each] of [["interests", "Interessen", LIM.items, LIM.item], ["dislikes", "Abneigungen", LIM.items, LIM.item], ["goals", "Ziele", LIM.goals, LIM.goal]] as const) {
    const l = p[k];
    if (l.length > c) e.push(`${n}: höchstens ${c} Einträge.`);
    if (l.some((x) => x.length > each)) e.push(`${n}: ein Eintrag hat mehr als ${each} Zeichen.`);
  }
  if (profileChars(p) > LIM.total) e.push(`Alle Texte zusammen: höchstens ${LIM.total} Zeichen (${profileChars(p)}).`);
  return e;
}

export const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Kennung wie im Backend (`agents/schema.py: slug`), nur für den Vorschlag der Stimme. */
export const slug = (name: string) => (name.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "figur");
