// Ganzseitige Glasfläche über der Welt für die Einblicke Gedächtnis, Statistik, Wissen und das volle Tagebuch (AP18b). Esc oder ✕ führt zur Welt zurück.
import type { ReactNode } from "react";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";

export function Seite({ titel, children }: { titel: string; children: ReactNode }) {
  const setView = useUiStore((s) => s.setView);
  useRueckweg(true, EBENE.Einblick, () => setView("world"));
  return (
    <section className="glas hud-pop pointer-events-auto absolute inset-x-4 bottom-[86px] top-[66px] z-10 flex flex-col overflow-hidden" aria-label={titel} data-testid="einblick-seite">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="flex-1 text-base font-semibold">{titel}</h2>
        <button type="button" className="btn" onClick={() => setView("world")} data-testid="back-to-world">← Zur Welt</button>
      </header>
      <div className="relative min-h-0 flex-1 [&>*]:h-full">{children}</div>
    </section>
  );
}
