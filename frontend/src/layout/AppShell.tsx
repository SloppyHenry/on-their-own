import { useEffect } from "react";
import { startLive } from "../net/connect";
import { AgentDetail } from "../panels/AgentDetail";
import { AgentPanel } from "../panels/AgentPanel";
import { LocationDetail } from "../panels/LocationDetail";
import { EventDetail } from "../timeline/EventDetail";
import { EventTimeline } from "../timeline/EventTimeline";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { MemoryInspector } from "../memory/MemoryInspector";
import { WorldCanvas } from "../world/WorldCanvas";
import { ParameterPanel } from "../settings/ParameterPanel";
import { Header } from "./Header";

export function AppShell() {
  const ready = useSimStore((s) => s.world !== null);
  const selection = useUiStore((s) => s.selection);
  const view = useUiStore((s) => s.view);
  useEffect(() => startLive(), []);

  return (
    <div className="grid h-full grid-rows-[48px_1fr]">
      <Header />
      <main className={`grid min-h-0 ${view === "memory" ? "grid-cols-[1fr_0px]" : "grid-cols-[1fr_380px]"}`}>
        <div className="relative min-w-0 overflow-hidden bg-[#0e1115]">
          {!ready ? <p className="p-6 text-dim">Verbinde mit der Simulation …</p> : view === "memory" ? <MemoryInspector /> : <WorldCanvas />}
          <ParameterPanel />
        </div>
        <aside className={`relative grid min-h-0 grid-rows-[auto_1fr] border-l border-line bg-panel ${view === "memory" ? "hidden" : ""}`}>
          {ready && <><AgentPanel /><EventTimeline /></>}
          {selection?.kind === "agent" && <AgentDetail id={selection.id} />}
          {selection?.kind === "location" && <LocationDetail id={selection.id} />}
          {selection?.kind === "event" && <EventDetail refId={selection.id} />}
        </aside>
      </main>
    </div>
  );
}
