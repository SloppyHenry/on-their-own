// Tagebuch (AP18b, Mockup Bild 3): Protokoll und Verlauf in einem. Als Schublade rechts mit Filterchips; „Alles · Ausfuhr“ öffnet die volle Ansicht mit Suche, Zeitraum und Export.
import { EventTimeline } from "../timeline/EventTimeline";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";

export function Tagebuch() {
  const open = useUiStore((s) => s.drawer === "tagebuch" && s.view === "world"), setDrawer = useUiStore((s) => s.setDrawer), setView = useUiStore((s) => s.setView);
  useRueckweg(open, EBENE.Schublade, () => setDrawer(null));
  if (!open) return null;
  return (
    <aside className="glas hud-pop pointer-events-auto absolute bottom-[86px] right-4 top-[66px] z-10 flex w-[400px] flex-col overflow-hidden" data-testid="tagebuch" aria-label="Tagebuch">
      <header className="flex items-center gap-2 px-3.5 pb-1 pt-3">
        <h3 className="flex-1 text-base font-semibold">📖 Tagebuch</h3>
        <button type="button" className="btn" onClick={() => { setDrawer(null); setView("history"); }} data-testid="tagebuch-alles">Alles · Ausfuhr</button>
        <button type="button" className="btn rund leise" onClick={() => setDrawer(null)} aria-label="Tagebuch schließen" title="Schließen (Esc)">✕</button>
      </header>
      <EventTimeline />
    </aside>
  );
}
