// Sicherung des Werkstatt-Entwurfs (AP16-Rest): Weltdatei im Speicher und Aktionsliste liegen sonst nur im Browser-Speicher der Seite. Ein Neuladen (oder ein versehentliches
// Schließen des Tabs) würde sie verlieren. Darum wird der ungespeicherte Entwurf in `sessionStorage` gespiegelt, beim Start wiederhergestellt und beim Verlassen der Seite nachgefragt.
import { useGestalten } from "../gestalten/gestaltenStore";
import type { Aktion } from "../gestalten/typen";
import { betreteWerkstatt, ungespeichert, useWerkstatt, type Weltdatei } from "./werkstattStore";

export const SCHLUESSEL = "on-their-own.werkstatt-entwurf";
export interface Sicherung { id: string; welt: Weltdatei; aktionen: Aktion[] }

export function sichere(s: Sicherung | null): void {
  try { if (s) sessionStorage.setItem(SCHLUESSEL, JSON.stringify(s)); else sessionStorage.removeItem(SCHLUESSEL); } catch { /* Speicher gesperrt oder voll: dann eben keine Sicherung */ }
}

export function ladeSicherung(): Sicherung | null {
  try {
    const t = sessionStorage.getItem(SCHLUESSEL), s = t ? JSON.parse(t) : null;
    return s && typeof s.id === "string" && s.welt && Array.isArray(s.welt.tiles) && Array.isArray(s.aktionen) ? (s as Sicherung) : null;
  } catch { return null; }
}

/** Gibt es in der offenen Werkstatt etwas, das noch nicht in der Datei steht? */
export const entwurfOffen = (): boolean => {
  const w = useWerkstatt.getState();
  return w.offen && (ungespeichert(w) || useGestalten.getState().aktionen.length > 0);
};

/** Stellt einen gesicherten Entwurf wieder her: öffnet die Welt neu und legt Datei und Aktionen darüber. `false`, wenn nichts (mehr) zu retten war. */
export async function stelleEntwurfWiederHer(): Promise<boolean> {
  const s = ladeSicherung();
  if (!s || useWerkstatt.getState().offen) return false;
  if (!(await betreteWerkstatt(s.id, { menu: "title", sel: null, sub: null }))) { sichere(null); return false; }
  await useWerkstatt.getState().wiederherstellen(s.welt);
  if (s.aktionen.length) useGestalten.getState().setzeEntwurf(s.aktionen);
  return true;
}

/** Spiegelt den Entwurf laufend und fragt beim Verlassen der Seite nach. Liefert die Abmeldung. */
export function starteSicherung(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined, war = false;
  const jetzt = () => {
    const w = useWerkstatt.getState();
    if (entwurfOffen() && w.info && w.welt) { war = true; sichere({ id: w.info.id, welt: w.welt, aktionen: useGestalten.getState().aktionen }); }
    else if (war) { war = false; sichere(null); }                                            // gespeichert, verworfen oder bewusst verlassen: nichts mehr zu retten
  };
  const spaeter = () => { clearTimeout(timer); timer = setTimeout(jetzt, 300); };
  const a = useWerkstatt.subscribe(spaeter), b = useGestalten.subscribe(spaeter);
  const vorAbschied = (e: BeforeUnloadEvent) => { if (entwurfOffen()) { jetzt(); e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", vorAbschied);
  return () => { clearTimeout(timer); a(); b(); window.removeEventListener("beforeunload", vorAbschied); };
}
