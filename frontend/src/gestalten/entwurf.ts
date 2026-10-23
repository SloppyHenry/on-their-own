// Der Entwurf (AP16b): eine Liste von Aktionen mit Rückgängig und Wiederholen, dazu Text und Umriss je Aktion für Entwurfsliste und Schleier.
import type { Aktion, Katalog, Punkt } from "./typen";

export interface Stapel { aktionen: Aktion[]; wieder: Aktion[] }
export const LEER: Stapel = { aktionen: [], wieder: [] };

/** Neue Aktion: ein Wiederholen-Stapel gilt danach nicht mehr. */
export const hinzu = (s: Stapel, a: Aktion): Stapel => ({ aktionen: [...s.aktionen, a], wieder: [] });
export const entfernen = (s: Stapel, i: number): Stapel => ({ aktionen: s.aktionen.filter((_, k) => k !== i), wieder: [] });
export function rueckgaengig(s: Stapel): Stapel {
  const a = s.aktionen[s.aktionen.length - 1];
  return a ? { aktionen: s.aktionen.slice(0, -1), wieder: [...s.wieder, a] } : s;
}
export function wiederholen(s: Stapel): Stapel {
  const a = s.wieder[s.wieder.length - 1];
  return a ? { aktionen: [...s.aktionen, a], wieder: s.wieder.slice(0, -1) } : s;
}

const pt = (v: unknown): Punkt | null => (Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number" ? [v[0], v[1]] : null);
const ORT = { ost: "Osten", sued: "Süden" } as Record<string, string>;

/** Kurztext der Aktion für die Entwurfsliste. */
export function beschreibung(a: Aktion, k: Katalog | null): string {
  switch (a.art) {
    case "weg": return `Weg, ${(a.punkte as unknown[]).length} Punkte`;
    case "see": return "See";
    case "garten": { const r = a.rechteck as number[]; return `Garten ${r[2]} × ${r[3]}`; }
    case "haus": return `Haus: ${k?.haeuser.find((h) => h.gebaeude === a.gebaeude)?.name ?? String(a.gebaeude)}`;
    case "deko": return k?.deko.find((d) => d.sorte === a.sorte)?.name ?? String(a.sorte);
    case "loeschen": { const t = pt(a.tile); return `Gelöscht: ${t ? `${t[0]}, ${t[1]}` : "?"}`; }
    case "karte": return `Karte: ${ORT[String(a.richtung)] ?? a.richtung} +${a.kacheln}`;
    case "startplatz": return "Startplatz";
    default: return String(a.art);
  }
}

/** Umriss in Kacheln (x0, y0, x1, y1, beide Ecken eingeschlossen) für den Schleier „neu im Entwurf“; `null` ohne Ort (Karte). */
export function umrissKacheln(a: Aktion): [number, number, number, number] | null {
  if (a.art === "weg") {
    const p = (a.punkte as unknown[]).map(pt).filter((q): q is Punkt => !!q);
    return p.length ? [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))] : null;
  }
  if (a.art === "see") { const m = pt(a.mitte), r = Number(a.rx) * 1.4 + 1; return m ? [Math.floor(m[0] - r), Math.floor(m[1] - r * 0.75), Math.ceil(m[0] + r), Math.ceil(m[1] + r * 0.75)] : null; }
  if (a.art === "garten") { const r = a.rechteck as number[]; return [r[0], r[1], r[0] + r[2] - 1, r[1] + r[3] - 1]; }
  if (a.art === "haus") { const t = pt(a.tuer); return t ? [t[0] - 3, t[1] - 1, t[0] + 3, t[1]] : null; }
  const t = pt(a.tile);
  return t && a.art !== "loeschen" ? [t[0], t[1], t[0], t[1]] : null;
}

/** Breite des Hauses in Kacheln (Sprite mit Rand), halb nach links und rechts der Tür, für den Geist beim Setzen. */
export const HAUS_BREITE: Record<string, number> = { shop: 84, workshop: 92, barn: 100, stable: 96 };
export const hausPixel = (gebaeude: string, breite: number) => (gebaeude === "house" ? breite + 12 : (HAUS_BREITE[gebaeude] ?? 90));
