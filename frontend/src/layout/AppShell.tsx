import { useEffect } from "react";
import { startLive } from "../net/connect";
import { AgentDetail } from "../panels/AgentDetail";
import { AgentPanel } from "../panels/AgentPanel";
import { LocationDetail } from "../panels/LocationDetail";
import { EventDetail } from "../timeline/EventDetail";
import { EventTimeline } from "../timeline/EventTimeline";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { EventHistory } from "../history/EventHistory";
import { SaveLoadDialog } from "../saves/SaveLoadDialog";
import { StatsView } from "../stats/StatsView";
import { MemoryInspector } from "../memory/MemoryInspector";
import { WorldCanvas } from "../world/WorldCanvas";
import { EventComposer } from "../composer/EventComposer";
import { ParameterPanel } from "../settings/ParameterPanel";
import { WorldEditor } from "../editor/WorldEditor";
import { Header } from "./Header";

export function AppShell() {
  const ready = useSimStore((s) => s.world !== null);
  const selection = useUiStore((s) => s.selection);
  const view = useUiStore((s) => s.view);
  const savesOpen = useUiStore((s) => s.savesOpen);
  const appMode = useUiStore((s) => s.appMode);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const hideSide = view === "memory" || view === "stats" || collapsed || appMode !== "game";        // Infoleiste: eingeklappt, in Gedächtnis und Statistik, im Editor und im Startmenü aus
  const tools = appMode !== "game" && view === "world";                                    // Welteditor und Startmenü: Werkzeugleiste statt Infoleiste
  useEffect(() => startLive(), []);

  return (
    <div className="grid h-full grid-rows-[48px_1fr_auto]">
      <Header />
      <main className={`grid min-h-0 ${hideSide && !tools ? "grid-cols-[1fr_0px]" : "grid-cols-[1fr_380px]"}`} data-sidebar={hideSide ? "zu" : "offen"}>
        <div className="relative min-w-0 overflow-hidden bg-[#0e1115]">
          {!ready ? <p className="p-6 text-dim">Verbinde mit der Simulation …</p> : view === "memory" ? <MemoryInspector /> : view === "stats" ? <StatsView /> : view === "history" ? <EventHistory /> : <WorldCanvas />}
          <ParameterPanel />
        </div>
        {tools && ready && <WorldEditor />}
        <aside data-testid="sidebar" className={`relative grid min-h-0 grid-rows-[auto_1fr] border-l border-line bg-panel ${hideSide ? "hidden" : ""}`}>
          {ready && <><AgentPanel /><EventTimeline /></>}
          {selection?.kind === "agent" && <AgentDetail id={selection.id} />}
          {selection?.kind === "location" && <LocationDetail id={selection.id} />}
          {selection?.kind === "event" && <EventDetail refId={selection.id} />}
        </aside>
      </main>
      {ready && <EventComposer />}
      {savesOpen && <SaveLoadDialog />}
    </div>
  );
}
