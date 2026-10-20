// Die Spieloberfläche (AP18b): Die Welt füllt den Bildschirm, die Bedienteile schweben klein in den Ecken (Mockup docs/mockups/rework.html, Bilder 1–3).
// Oben links Uhr und Zeit, oben rechts Modell, Ton, Hilfe und Menü, unten links die Bewohner, unten rechts die Einblicke mit dem Ticker. Im Titelbild und im Editor gibt es kein HUD.
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { AgentDetail } from "../panels/AgentDetail";
import { LocationDetail } from "../panels/LocationDetail";
import { EventDetail } from "../timeline/EventDetail";
import { EventHistory } from "../history/EventHistory";
import { MemoryInspector } from "../memory/MemoryInspector";
import { StatsView } from "../stats/StatsView";
import { Bewohnerleiste } from "./Bewohnerleiste";
import { Einblicke } from "./Einblicke";
import { Hilfe } from "./Hilfe";
import { ObenLinks } from "./ObenLinks";
import { ObenRechts } from "./ObenRechts";
import { Seite } from "./Seite";
import { Tagebuch } from "./Tagebuch";
import { useHudTasten } from "./tasten";
import { Werkzeuge } from "./Werkzeuge";

export function Hud() {
  const ready = useSimStore((s) => s.world !== null);
  const view = useUiStore((s) => s.view), selection = useUiStore((s) => s.selection), menu = useUiStore((s) => s.menu), appMode = useUiStore((s) => s.appMode);
  const aktiv = ready && menu !== "title" && appMode === "game";
  useHudTasten(aktiv);
  if (!aktiv) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-testid="hud">
      <ObenLinks />
      <ObenRechts />
      <Bewohnerleiste />
      <Einblicke />
      <Werkzeuge />
      <Tagebuch />
      {view === "memory" && <Seite titel="Gedächtnis"><MemoryInspector /></Seite>}
      {view === "stats" && <Seite titel="Statistik"><StatsView /></Seite>}
      {view === "history" && <Seite titel="Tagebuch · alles"><EventHistory /></Seite>}
      {selection?.kind === "agent" && <AgentDetail id={selection.id} />}
      {selection?.kind === "location" && <LocationDetail id={selection.id} />}
      {selection?.kind === "event" && <EventDetail refId={selection.id} />}
      <Hilfe />
    </div>
  );
}
