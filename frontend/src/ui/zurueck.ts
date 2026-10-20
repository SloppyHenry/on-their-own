// Zentraler Rückweg (AP18a): Esc nimmt immer genau eine Ebene zurück. Jede offene Ebene (Dialog, Menübereich, Assistentenschritt, Schublade, Detail,
// Innenansicht, Editor) meldet hier einen Rückweg an; Esc ruft den obersten auf. Höhere `ebene` gehen vor, bei gleicher Ebene die zuletzt angemeldete.
// Ein Rückweg darf `false` liefern („hier nichts zu tun“), dann kommt die nächste Ebene dran. Sonst gilt Esc als verbraucht.
import { useEffect, useRef } from "react";

export type Rueckweg = () => boolean | void;

/** Reihenfolge von unten nach oben: was weiter oben liegt, liegt auch im Bild weiter vorn. */
export const EBENE = { Spiel: 0, Auswahl: 10, Innenansicht: 20, Schublade: 30, Einblick: 40, Werkstatt: 50, Menue: 60, MenueUnter: 65, Popover: 70, Dialog: 80 } as const;

interface Eintrag { ebene: number; n: number; fn: Rueckweg }
let eintraege: Eintrag[] = [];
let zaehler = 0;

/** Meldet einen Rückweg an; die Rückgabe meldet ihn wieder ab. */
export function anmelden(ebene: number, fn: Rueckweg): () => void {
  const e: Eintrag = { ebene, n: ++zaehler, fn };
  eintraege = [...eintraege, e].sort((a, b) => b.ebene - a.ebene || b.n - a.n);
  return () => { eintraege = eintraege.filter((x) => x !== e); };
}

/** Nimmt eine Ebene zurück (die oberste, die zuständig ist). Liefert, ob etwas geschehen ist. */
export function zurueck(): boolean {
  for (const e of eintraege) if (e.fn() !== false) return true;
  return false;
}

export const anzahlEbenen = () => eintraege.length;

/** Meldet den Rückweg an, solange `aktiv` gilt. Die Funktion darf sich jederzeit ändern, ohne dass die Ebene ihren Platz verliert. */
export function useRueckweg(aktiv: boolean, ebene: number, fn: Rueckweg) {
  const neu = useRef(fn);
  neu.current = fn;
  useEffect(() => (aktiv ? anmelden(ebene, () => neu.current()) : undefined), [aktiv, ebene]);
}

/** Ein Feld, in dem getippt wird: das erste Esc nimmt ihm den Fokus. Ein leeres Feld oder eine Auswahl hält nichts fest, dort geht Esc gleich zurück. */
function haeltFest(el: EventTarget | null): el is HTMLElement {
  const t = el as HTMLElement | null;
  if (!t?.matches?.("input, textarea, [contenteditable='true']")) return false;
  if (t.matches("input[type=checkbox], input[type=radio], input[type=range], input[type=button]")) return false;
  return ((t as HTMLInputElement).value ?? t.textContent ?? "") !== "";
}

/** Hört auf Esc (einmal je Fenster). Gibt die Abmeldung zurück. */
export function starteEsc(): () => void {
  const auf = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (haeltFest(e.target)) { e.preventDefault(); (e.target as HTMLElement).blur(); return; }
    if (zurueck()) e.preventDefault();
  };
  window.addEventListener("keydown", auf);
  return () => window.removeEventListener("keydown", auf);
}
