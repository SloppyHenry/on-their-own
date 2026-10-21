import { useEffect, useState } from "react";
import { api } from "../net/api";
import type { StatusOut } from "../types/generated";
import { Abschnitt } from "./Zeile";

/** Modell- und Lastanzeige aus `/api/status` (alle paar Sekunden aufgefrischt, solange sichtbar). */
export function useStatus(everyMs = 3000, enabled = true): StatusOut | null {
  const [s, setS] = useState<StatusOut | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => api.status().then((j) => alive && setS(j)).catch(() => alive && setS(null));
    void load();
    const t = setInterval(load, everyMs);
    return () => { alive = false; clearInterval(t); };
  }, [everyMs, enabled]);
  return s;
}

const num = (v: number | null | undefined, unit = "", digits = 1) => (v == null ? "–" : `${v.toFixed(digits).replace(".", ",")}${unit}`);

function Wert({ k, v, testid, warn }: { k: string; v: string; testid?: string; warn?: boolean }) {
  return <div>{k}<b data-testid={testid} className={warn ? "warn" : ""}>{v}</b></div>;
}

/** Einstellungen › Modell, oben: ist das Modell erreichbar, wie schnell antwortet es, wie viel Last liegt an (früher die Seite „Status“). */
export function ModellZustand({ onVerwalten }: { onVerwalten: () => void }) {
  const s = useStatus();
  const m = s?.model, l = s?.load;
  const lage = !m ? ["still", "Status wird geladen …"] : m.reachable == null ? ["still", "Noch keine Anfrage"] : m.reachable ? ["", "Verbunden"] : ["aus", "Nicht erreichbar"];
  return (
    <Abschnitt titel="Zustand">
      <div className="einst-zustand" aria-label="Modellstatus">
        <span className={`einst-led ${lage[0]}`} />
        <div className="min-w-0"><b className="text-[15px]"><span data-testid="status-reachable">{lage[1]}</span>{m && <> · {m.model}</>}</b><small className="block truncate text-xs text-dim">{m?.base_url ?? "–"}</small></div>
        <button type="button" className="btn" onClick={onVerwalten} data-testid="modelle-verwalten">Modelle verwalten ›</button>
      </div>
      {m && l && (
        <div className="einst-kv" aria-label="Systemlast">
          <Wert k="Ø Antwort" v={num(m.avg_response_s, " s")} testid="status-avg" />
          <Wert k="Token/s" v={num(m.avg_tokens_per_s, "", 0)} />
          <Wert k="Wartend" v={String(m.queue)} warn={m.queue > 1} />
          <Wert k="Fehler (15 Min.)" v={String(m.errors_15min)} warn={m.errors_15min > 0} />
          <Wert k="Entscheidungen/min" v={String(l.decisions_per_minute)} />
          <Wert k="Spielmin./min" v={String(l.sim_minutes_per_minute)} />
          <Wert k="Gelungen / gescheitert" v={`${l.actions_ok} / ${l.actions_failed}`} testid="status-actions" />
          <Wert k="Anfragen gesamt" v={String(m.calls)} />
        </div>
      )}
    </Abschnitt>
  );
}
