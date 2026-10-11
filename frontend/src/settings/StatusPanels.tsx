import { useEffect, useState } from "react";
import { api } from "../net/api";
import type { StatusOut } from "../types/generated";

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

const num = (v: number | null | undefined, unit = "", digits = 1) => (v == null ? "–" : `${v.toFixed(digits)}${unit}`);

function Row({ k, v, testid, warn }: { k: string; v: string; testid?: string; warn?: boolean }) {
  return <div className="flex justify-between border-b border-line/50 py-1 text-[13px]"><dt className="text-dim">{k}</dt><dd data-testid={testid} className={`font-mono text-xs ${warn ? "text-warn" : ""}`}>{v}</dd></div>;
}

export function StatusPanels() {
  const s = useStatus();
  if (!s) return <p className="text-dim">Status wird geladen …</p>;
  const m = s.model, l = s.load;
  return (
    <div className="grid gap-6">
      <section aria-label="Modellstatus">
        <h3 className="sub">Modell</h3>
        <dl>
          <Row k="Modell" v={m.model} />
          <Row k="Adresse" v={m.base_url} />
          <Row k="Erreichbar" v={m.reachable == null ? "noch keine Anfrage" : m.reachable ? "ja" : "nein"} warn={m.reachable === false} testid="status-reachable" />
          <Row k="Ø Antwortzeit" v={num(m.avg_response_s, " s")} testid="status-avg" />
          <Row k="Token je Sekunde" v={num(m.avg_tokens_per_s, "", 0)} />
          <Row k="Wartende Anfragen" v={String(m.queue)} warn={m.queue > 1} />
          <Row k="Fehler (15 Min.)" v={String(m.errors_15min)} warn={m.errors_15min > 0} />
          <Row k="Anfragen gesamt" v={String(m.calls)} />
        </dl>
      </section>
      <section aria-label="Systemlast">
        <h3 className="sub">Last</h3>
        <dl>
          <Row k="Zustand" v={l.state} />
          <Row k="Tempo" v={l.speed_level} />
          <Row k="Entscheidungen je Minute" v={String(l.decisions_per_minute)} />
          <Row k="Simulationsminuten je Minute" v={String(l.sim_minutes_per_minute)} />
          <Row k="Aktionen gelungen / gescheitert" v={`${l.actions_ok} / ${l.actions_failed}`} testid="status-actions" />
          <Row k="Gleichzeitige Anfragen" v={String(l.max_concurrent)} />
          <Row k="Energiesparen" v={l.power_save ? "an" : "aus"} />
        </dl>
      </section>
    </div>
  );
}
