// Infoleiste rechts mit Reitern: Bewohner, Protokoll, Ansicht. Jeder Reiter bekommt die ganze Höhe, damit das Protokoll lesbar bleibt.
// Details (Figur, Ort, Ereignis) liegen als Schublade über dem Inhalt, die Reiter bleiben bedienbar (ein Reiterwechsel schließt das Detail).
import { AgentDetail } from "../panels/AgentDetail";
import { AgentPanel } from "../panels/AgentPanel";
import { LocationDetail } from "../panels/LocationDetail";
import { EventDetail } from "../timeline/EventDetail";
import { EventTimeline } from "../timeline/EventTimeline";
import { useSimStore } from "../store/simStore";
import { useUiStore, type SideTab } from "../store/uiStore";
import { lookOf } from "../world/dorf/look";
import { ViewControls } from "./ViewSettings";

const TABS: [SideTab, string][] = [["bewohner", "Bewohner"], ["protokoll", "Protokoll"], ["ansicht", "Ansicht"]];

export function SideBar() {
  const tab = useUiStore((s) => s.sideTab), setTab = useUiStore((s) => s.setSideTab);
  const selection = useUiStore((s) => s.selection), select = useUiStore((s) => s.select);
  const dorf = useSimStore((s) => !!lookOf(s.world));
  const count = useSimStore((s) => s.world?.agentOrder.length ?? 0);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-line px-2" role="tablist" aria-label="Infoleiste">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (selection) select(null); }} data-testid={`side-tab-${id}`}
            className={`-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] ${tab === id ? "border-alex text-text" : "border-transparent text-dim hover:text-text"}`}>
            {label}{id === "bewohner" && count > 0 && <span className="ml-1 font-normal text-faint">{count}</span>}
          </button>
        ))}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className={`flex min-h-0 flex-1 flex-col ${tab === "protokoll" ? "" : "overflow-y-auto"}`} role="tabpanel">
          {tab === "bewohner" && <AgentPanel />}
          {tab === "protokoll" && <EventTimeline />}
          {tab === "ansicht" && <ViewControls dorf={dorf} />}
        </div>
        {selection?.kind === "agent" && <AgentDetail id={selection.id} />}
        {selection?.kind === "location" && <LocationDetail id={selection.id} />}
        {selection?.kind === "event" && <EventDetail refId={selection.id} />}
      </div>
    </div>
  );
}
