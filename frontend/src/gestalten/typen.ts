// Typen des Gestaltens (AP16b): Aktionen, Antworten der Entwurf-Endpunkte (AP16a, `api/models_gestalten.py`) und der Katalog.
import type { StateSnapshot } from "../types/generated";

export type Punkt = [number, number];
/** Eine Aktion des Entwurfs; `art` sagt, welche (weg, see, garten, haus, deko, loeschen, karte, startplatz), der Rest sind ihre Felder. */
export type Aktion = { art: string } & Record<string, unknown>;
export type Werkzeug = "zeiger" | "weg" | "see" | "garten" | "haus" | "natur" | "loeschen" | "startplatz" | "gebiet" | "karte" | "moebel" | "wand" | "teppich" | "farbe";
export type Ort = "werkstatt" | "spiel";

export interface AktionStatus { ok: boolean; grund?: string | null; ort?: number[] | null }
export interface Meldung { stufe: "ok" | "hinweis" | "fehler"; text: string; ort?: number[] | null }

/** Was beide Wege (Spiel und Werkstatt) auf eine Liste von Aktionen antworten. */
export interface Rechnung {
  stati: AktionStatus[];
  meldungen: Meldung[];
  fehler: number;
  hinweise: number;
  /** Keine abgelehnte Aktion und kein ✗. */
  ok: boolean;
  digest: string | null;
  /** Die Weltdatei nach dem Entwurf (nur Werkstatt). */
  welt?: Record<string, unknown>;
  snapshot?: StateSnapshot | null;
  /** Im Spiel: Meldung des Trockenlaufs der Engine, wenn er scheiterte. */
  error?: string | null;
}

export interface DekoSorte { sorte: string; name: string; blockiert: boolean }
export interface HausArt { gebaeude: string; name: string; breiten?: number[] }
export interface InnenKatalog { moebel: { kind: string; name: string; modes: string[] }[]; wand: { kind: string; breite: number }[]; tapeten: string[]; boeden: string[]; vorhaenge: string[]; teppiche: string[] }
export interface Katalog { deko: DekoSorte[]; haeuser: HausArt[]; daecher: string[]; waende: string[]; karte: { richtungen: string[]; kacheln: number[]; max: number }; innen: InnenKatalog }

export interface Optionen {
  haus: { gebaeude: string; breite: number; dach: string; wand: string };
  deko: { sorte: string };
  karte: { ost: number; sued: number };
  /** Haus von innen: gewähltes Möbel, Wandschmuck, Teppichfarbe und Stile (null = nicht ändern). */
  innen: { moebel: string; wand: string; teppich: string; tapete: string | null; boden: string | null; vorhang: string | null };
}
export const START_OPTIONEN: Optionen = { haus: { gebaeude: "house", breite: 66, dach: "rot", wand: "creme" }, deko: { sorte: "baum" }, karte: { ost: 16, sued: 16 }, innen: { moebel: "sofa", wand: "fenster", teppich: "blau", tapete: null, boden: null, vorhang: null } };

// Antworten der Endpunkte (`api/models_gestalten.py`)
interface Kopf { stati: AktionStatus[]; meldungen: Meldung[]; fehler: number; hinweise: number }
export interface DraftPreview extends Kopf { ok: boolean; error?: string | null; digest?: string | null; counts: Record<string, number>; snapshot?: StateSnapshot | null }
export interface DraftApplied { patch: string; backup?: string | null; counts: Record<string, number>; actions: number }
export interface FileDraft extends Kopf { ok: boolean; spielbar: boolean; digest: string; world: Record<string, unknown>; snapshot?: StateSnapshot | null }
