// HUD oben rechts (AP18b): Modellpunkt (Klick: Menü › Einstellungen › Status), Ton, Hilfe, Menü.
import { useHealth } from "../net/useHealth";
import { useStatus } from "../settings/StatusPanels";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { useTon } from "../klang/einstellungen";
import type { Conn } from "../store/types";

const CONN: Record<Conn, [string, string]> = {
  open: ["Verbunden", "bg-ok"],
  connecting: ["Verbinde …", "bg-alex"],
  reconnecting: ["Verbinde neu …", "bg-alex"],
  closed: ["Getrennt", "bg-warn"],
};

export function ObenRechts() {
  const conn = useSimStore((s) => s.conn), world = useSimStore((s) => s.world);
  const health = useHealth(), status = useStatus(4000);
  const menu = useUiStore((s) => s.menu), setMenu = useUiStore((s) => s.setMenu), openSettings = useUiStore((s) => s.openSettings);
  const help = useUiStore((s) => s.help), setHelp = useUiStore((s) => s.setHelp);
  const tonAn = useTon((s) => s.an), setTon = useTon((s) => s.set);
  const [connText, dot] = CONN[conn];
  const avg = world?.simulation.llm.avg_response_s as number | null | undefined;
  const ok = conn === "open" && (health?.llm.reachable ?? true);
  return (
    <div className="pointer-events-auto absolute right-4 top-3.5 z-10 flex items-center gap-2" data-testid="hud-oben-rechts">
      <button type="button" className="glas pille cursor-pointer !px-3 !py-1.5 text-xs text-dim hover:text-text" onClick={() => openSettings("status")} data-testid="status-chip"
        title={`${connText} · Modell: ${health ? health.llm.configured_model : "unbekannt"}${health?.llm.error ? ` · ${health.llm.error}` : ""} — Klick: Einstellungen › Status`}>
        <i className={`inline-block size-2 rounded-full ${ok ? "bg-ok" : conn === "open" ? "bg-warn" : dot}`} />
        <span data-testid="conn" className="sr-only">{connText}</span>
        <span className="max-w-[11rem] truncate">{health ? health.llm.configured_model : "Modell unbekannt"}
          {avg != null && avg > 0 && <span className="ml-1 font-mono"> Ø {avg.toFixed(1)} s</span>}
          {status && status.model.queue > 0 && <span className="ml-1 font-mono text-alex" title="Anfragen warten auf das Modell"> · {status.model.queue} wartet</span>}
          {status && status.model.errors_15min > 0 && <span className="ml-1 font-mono text-warn" title="Fehlgeschlagene Modellanfragen in den letzten 15 Minuten"> · {status.model.errors_15min} Fehler</span>}
        </span>
      </button>
      <button type="button" className="glas btn rund" onClick={() => setTon({ an: !tonAn })} onContextMenu={(e) => { e.preventDefault(); openSettings("ton"); }} aria-pressed={tonAn}
        title={tonAn ? "Ton aus (Rechtsklick: Einstellungen Ton)" : "Ton an (Rechtsklick: Einstellungen Ton)"} aria-label={tonAn ? "Ton ausschalten" : "Ton einschalten"} data-testid="ton-toggle">{tonAn ? "🔊" : "🔇"}</button>
      <button type="button" className={`glas btn rund ${help ? "on" : ""}`} onClick={() => setHelp(!help)} title="Hilfe (?)" aria-label="Hilfe" aria-pressed={help} data-testid="open-help">?</button>
      <button type="button" className={`glas btn ${menu ? "on" : ""}`} onClick={() => setMenu(menu ? null : "pause")} aria-pressed={!!menu} title="Menü (Esc)" data-testid="open-menu">☰ Menü</button>
    </div>
  );
}
