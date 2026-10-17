import { Icon } from "../lib/Icon";
import { InsightsMenu } from "./InsightsMenu";
import { weatherName } from "../lib/names";
import { SimulationControls } from "../controls/SimulationControls";
import { useHealth } from "../net/useHealth";
import { useStatus } from "../settings/StatusPanels";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { enterEditor, leaveEditor } from "../editor/editorStore";
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
  const setSavesOpen = useUiStore((s) => s.setSavesOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const openSettings = useUiStore((s) => s.openSettings);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const appMode = useUiStore((s) => s.appMode);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const status = useStatus(4000);
  const [connText, dot] = CONN[conn];
  const clock = world?.clock;
  const avg = world?.simulation.llm.avg_response_s as number | null | undefined;
  const night = clock ? clock.daylight < 0.4 : false;

  return (
    <header className="flex min-w-0 items-center gap-3 overflow-hidden border-b border-line bg-panel px-3">
      <span className="text-[13px] font-semibold tracking-[0.18em]">SIMULACRA</span>
      {clock && world && (
        <span data-testid="clock" className="whitespace-nowrap">
          Tag {clock.day}, {clock.time} <Icon name={night ? "moon" : "sun"} className="text-alex" />
          <span className="text-dim"><span className="max-[1500px]:hidden"> · {clock.weekday}</span><span className="max-[1340px]:hidden"> · <Icon name={world.weather.kind === "rain" ? "rain" : "sun"} className="text-world" /> {weatherName(world.weather.kind)}</span></span>
        </span>
      )}
      <SimulationControls />
      <span className="min-w-0 flex-1" />
      {/* Bedienknöpfe dürfen bei schmalem Fenster seitlich rollen; Verbindung und Modell rechts bleiben immer sichtbar. */}
      <nav className="flex min-w-0 shrink items-center gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Bereiche">
      <button className={`btn ${settingsOpen ? "on" : ""}`} onClick={() => (settingsOpen ? closeSettings() : openSettings())} aria-pressed={settingsOpen} data-testid="open-settings">Einstellungen</button>
      <button className="btn" onClick={() => setSavesOpen(true)} data-testid="open-saves">Spielstände</button>
      <button className={`btn ${appMode !== "game" ? "on" : ""}`} onClick={() => (appMode === "game" ? (setView("world"), enterEditor()) : leaveEditor())} aria-pressed={appMode !== "game"} data-testid="open-editor">Welt gestalten</button>
      {appMode === "game" && view !== "memory" && view !== "stats" && (
        <button className={`btn ${collapsed ? "" : "on"}`} onClick={toggleSidebar} aria-pressed={!collapsed} title={collapsed ? "Infoleiste (Bewohner, Protokoll) einblenden" : "Infoleiste (Bewohner, Protokoll) ausblenden"} data-testid="toggle-sidebar" aria-label="Infoleiste">{collapsed ? "«" : "»"}</button>
      )}
      <InsightsMenu />
      </nav>
      <button type="button" className="flex shrink-0 cursor-pointer items-center gap-3 rounded-md border border-line px-2.5 py-1 hover:bg-white/5" onClick={() => openSettings("status")}
        title={`${connText} · Modell: ${health ? health.llm.configured_model : "unbekannt"}${health?.llm.error ? ` · ${health.llm.error}` : ""} — Klick: Status`} data-testid="status-chip">
      <span className="whitespace-nowrap text-dim" data-testid="conn"><span className={`mr-1.5 inline-block size-2 rounded-full ${dot}`} /><span className="max-[1600px]:sr-only">{connText}</span></span>
      <span className="max-w-[10rem] truncate whitespace-nowrap text-dim">
        <span className={`mr-1.5 inline-block size-2 rounded-full ${health?.llm.reachable ? "bg-ok" : "bg-warn"}`} />
        {health ? health.llm.configured_model : "Modell unbekannt"}
        {avg != null && avg > 0 && <span className="ml-1 font-mono text-xs"> Ø {avg.toFixed(1)} s</span>}
        {status && status.model.queue > 0 && <span className="ml-1 font-mono text-xs text-alex" title="Anfragen warten auf das Modell"> · {status.model.queue} wartet</span>}
        {status && status.model.errors_15min > 0 && <span className="ml-1 font-mono text-xs text-warn" title="Fehlgeschlagene Modellanfragen in den letzten 15 Minuten"> · {status.model.errors_15min} Fehler</span>}
      </span>
      </button>
    </header>
  );
}
