import { useEffect } from "react";
import { startKlang } from "../klang/regie";
import { startLive } from "../net/connect";
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
import { SideBar } from "./SideBar";
import { StartMenu } from "./StartMenu";

export function AppShell() {
  const ready = useSimStore((s) => s.world !== null);
  const view = useUiStore((s) => s.view);
  const savesOpen = useUiStore((s) => s.savesOpen);
  const appMode = useUiStore((s) => s.appMode);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const menu = useUiStore((s) => s.menu);
  const title = menu === "title";                                                          // Titelbild: nur die Welt (langsam wandernd) und das Menü, keine Kopfzeile
  const hideSide = view === "memory" || view === "stats" || collapsed || appMode !== "game" || title;        // Infoleiste: eingeklappt, in Gedächtnis und Statistik, im Editor und im Startmenü aus
  const tools = appMode !== "game" && view === "world";                                    // Welteditor und Startmenü: Werkzeugleiste statt Infoleiste
  useEffect(() => startLive(), []);
  useEffect(() => startKlang(), []);                                                       // Musik, Umgebung, Geräusche, Stimmen (AP17d)

  return (
    <div className={`grid h-full ${title ? "grid-rows-[1fr]" : "grid-rows-[48px_1fr_auto]"}`} data-menu={menu ?? "zu"}>
      {!title && <Header />}
      <main className={`grid min-h-0 ${hideSide && !tools ? "grid-cols-[1fr_0px]" : "grid-cols-[1fr_380px]"}`} data-sidebar={hideSide ? "zu" : "offen"}>
        <div className="relative min-w-0 overflow-hidden bg-[#0e1115]">
          <StartMenu />
          <div className={`h-full ${title ? "menu-drift pointer-events-none" : ""}`}>
          {!ready ? <p className="p-6 text-dim">Verbinde mit der Simulation …</p> : view === "memory" ? <MemoryInspector /> : view === "stats" ? <StatsView /> : view === "history" ? <EventHistory /> : <WorldCanvas />}
          </div>
          <ParameterPanel />
        </div>
        {tools && ready && <WorldEditor />}
        <aside data-testid="sidebar" className={`relative grid min-h-0 grid-rows-[1fr] border-l border-line bg-panel ${hideSide ? "hidden" : ""}`}>
          {ready && <SideBar />}
        </aside>
      </main>
      {ready && !title && <EventComposer />}
      {savesOpen && <SaveLoadDialog />}
    </div>
  );
}
