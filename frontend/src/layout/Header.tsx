import { Icon } from "../lib/Icon";
import { weatherName } from "../lib/names";
import { SimulationControls } from "../controls/SimulationControls";
import { useHealth } from "../net/useHealth";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import type { Conn } from "../store/types";

const CONN: Record<Conn, [string, string]> = {
  open: ["Verbunden", "bg-ok"],
  connecting: ["Verbinde …", "bg-alex"],
  reconnecting: ["Verbinde neu …", "bg-alex"],
  closed: ["Getrennt", "bg-warn"],
};

export function Header() {
  const world = useSimStore((s) => s.world);
  const conn = useSimStore((s) => s.conn);
  const health = useHealth();
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const openMemory = useUiStore((s) => s.openMemory);
  const [connText, dot] = CONN[conn];
  const clock = world?.clock;
  const avg = world?.simulation.llm.avg_response_s as number | null | undefined;
  const night = clock ? clock.daylight < 0.4 : false;

  return (
    <header className="flex items-center gap-5 border-b border-line bg-panel px-4">
      <span className="text-[13px] font-semibold tracking-[0.18em]">SIMULACRA</span>
      {clock && world && (
        <span data-testid="clock" className="whitespace-nowrap">
          Tag {clock.day}, {clock.time} <Icon name={night ? "moon" : "sun"} className="text-alex" />
          <span className="text-dim"> · {clock.weekday} · <Icon name={world.weather.kind === "rain" ? "rain" : "sun"} className="text-world" /> {weatherName(world.weather.kind)}</span>
        </span>
      )}
      <SimulationControls />
      <span className="flex-1" />
      <button className={`btn ${view === "memory" ? "on" : ""}`} onClick={() => (view === "memory" ? setView("world") : openMemory(useUiStore.getState().lastAgent))} aria-pressed={view === "memory"}>{view === "memory" ? "← Zur Welt" : "Gedächtnis"}</button>
      <span className="text-dim" data-testid="conn"><span className={`mr-1.5 inline-block size-2 rounded-full ${dot}`} />{connText}</span>
      <span className="text-dim" title={health?.llm.error ?? ""}>
        <span className={`mr-1.5 inline-block size-2 rounded-full ${health?.llm.reachable ? "bg-ok" : "bg-warn"}`} />
        {health ? health.llm.configured_model : "Modell unbekannt"}
        {avg != null && avg > 0 && <span className="ml-1 font-mono text-xs"> Ø {avg.toFixed(1)} s</span>}
      </span>
    </header>
  );
}
