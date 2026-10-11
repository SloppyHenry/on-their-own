import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../net/api";
import { useNames } from "../lib/useNames";
import { useSimStore } from "../store/simStore";
import type { AgentStats, StatsOut } from "../types/generated";
import { Bars, LineChart } from "./LineChart";

const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)} %`);
const col = (rows: Record<string, number | null>[], key: string): [number, number][] => rows.filter((r) => r[key] != null).map((r) => [Number(r.minute), Number(r[key])]);

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-line bg-panel p-4" aria-label={title}><h3 className="sub !mt-0">{title}</h3>{children}</section>;
}

function Overview({ s, names, place }: { s: AgentStats; names: (id: string) => string; place: (id: string) => string }) {
  const a = s.actions, c = s.conversations;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="kpis">
        {[["Aktionen gelungen", a.completed], ["Aktionen gescheitert", a.failed], ["Erfolgsquote", pct(a.success_rate)], ["Gespräche", c.count], ["Ø Beiträge", c.avg_turns ?? "–"], ["Orte entdeckt", s.places.discovered_locations],
          ["Objekte entdeckt", s.places.discovered_objects], ["Entscheidungen", s.llm.decisions]].map(([k, v]) => (
          <div key={String(k)} className="rounded-md bg-panel2 px-3 py-2"><div className="text-[11px] text-dim">{k}</div><div className="font-mono text-lg">{v}</div></div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Aktionen nach Art">
          <table className="w-full text-[12px]"><thead><tr className="text-left text-faint"><th>Aktion</th><th className="text-right">gelungen</th><th className="text-right">gescheitert</th><th className="text-right">Quote</th></tr></thead>
            <tbody>{a.by_action.slice(0, 12).map((r) => <tr key={r.action} className="border-t border-line/40"><td className="py-0.5">{r.action}</td><td className="text-right font-mono">{r.completed}</td><td className="text-right font-mono">{r.failed}</td><td className="text-right font-mono">{pct(r.success_rate)}</td></tr>)}</tbody></table>
          {a.top_rejections.length > 0 && <><h4 className="mt-3 text-[11px] uppercase tracking-wider text-dim">Häufigste Ablehnungsgründe</h4><ul className="mt-1 space-y-0.5 text-[12px]">{a.top_rejections.map((r, i) => <li key={i}><span className="font-mono text-warn">{r.count}×</span> {r.text || r.code}</li>)}</ul></>}
        </Block>
        <Block title="Zeit je Ort">
          <Bars items={s.places.time_by_location.slice(0, 8).map((p) => ({ label: place(p.location) || p.name, value: Math.round(p.minutes / 6) / 10 }))} unit=" Std." />
        </Block>
        <Block title="Gespräche">
          <p className="text-[13px]">{c.count} Gespräche{c.avg_turns != null ? `, im Mittel ${c.avg_turns} Beiträge` : ""}; Vorschläge: <span className="text-ok">{c.proposals_accepted} angenommen</span>, <span className="text-warn">{c.proposals_declined} abgelehnt</span>.</p>
          {c.keywords.length > 0 && <p className="mt-2 text-[12px] text-dim">Häufige Wörter: {c.keywords.map((k) => `${k.word} (${k.count})`).join(", ")}</p>}
        </Block>
        <Block title="Modell">
          <p className="text-[13px]">{s.llm.decisions} Entscheidungen ({s.llm.valid} gültig, {s.llm.fallback} Rückfall), {s.llm.corrections} Korrekturen. Ø Antwortzeit {s.llm.avg_latency_ms != null ? `${(s.llm.avg_latency_ms / 1000).toFixed(1)} s` : "–"}. Tokens: {s.llm.prompt_tokens.toLocaleString("de-DE")} Prompt, {s.llm.completion_tokens.toLocaleString("de-DE")} Antwort.</p>
        </Block>
        <Block title="Erinnerungen und Reflexionen je Tag">
          <Bars items={s.memories_per_day.flatMap((d) => [{ label: `Tag ${d.day}: Erinnerungen`, value: d.memories }, { label: `Tag ${d.day}: Reflexionen`, value: d.reflections }])} />
        </Block>
      </div>
      {s.agent && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Block title="Bedürfnisse und Stimmung"><LineChart title="Bedürfnisse (0–100)" series={[
            { label: "Energie", color: "var(--color-ok)", points: col(s.series.needs_mood, "energy") }, { label: "Hunger", color: "var(--color-warn)", points: col(s.series.needs_mood, "hunger") },
            { label: "Durst", color: "var(--color-world)", points: col(s.series.needs_mood, "thirst") }, { label: "Geselligkeit", color: "var(--color-alex)", points: col(s.series.needs_mood, "social") },
            { label: "Ruhe", color: "var(--color-plan)", points: col(s.series.needs_mood, "calm") }]} />
            <div className="mt-3"><LineChart title="Stimmung (−1 bis +1)" domain={[-1, 1]} series={[{ label: "Stimmung", color: "var(--color-text)", points: col(s.series.needs_mood, "mood") }]} /></div></Block>
          <Block title="Beziehungen">{Object.entries(s.series.relations).map(([other, rows]) => (
            <LineChart key={other} title={`zu ${names(other)}`} series={[{ label: "Vertrauen", color: "var(--color-ok)", points: col(rows as Record<string, number | null>[], "trust") },
              { label: "Sympathie", color: "var(--color-alex)", points: col(rows as Record<string, number | null>[], "sympathy") }, { label: "Spannung", color: "var(--color-warn)", points: col(rows as Record<string, number | null>[], "tension") },
              { label: "Vertrautheit", color: "var(--color-world)", points: col(rows as Record<string, number | null>[], "familiarity") }]} />
          ))}</Block>
        </div>
      )}
    </div>
  );
}

/** Statistik je Agent und gesamt, Zeitraum wählbar; alle Zahlen kommen per SQL aus den Protokolltabellen des Backends. */
export function StatsView() {
  const names = useNames();
  const world = useSimStore((s) => s.world);
  const now = world?.clock.minute ?? 0;
  const [agent, setAgent] = useState<string>("");
  const [range, setRange] = useState<"all" | "6h" | "day">("all");
  const [data, setData] = useState<StatsOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = world?.agentOrder.filter((id) => world.agents[id]?.profile) ?? [];
  const q = useMemo(() => ({ agent: agent || undefined, from_minute: range === "6h" ? Math.max(0, now - 360) : range === "day" ? Math.floor(now / 1440) * 1440 : undefined }), [agent, range, Math.floor(now / 60)]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    api.stats(q).then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => alive && setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"));
    return () => { alive = false; };
  }, [q]);

  const shown = data ? (agent ? data.agents[0] : data.total) : null;
  return (
    <div className="absolute inset-0 overflow-auto px-6 py-4" data-testid="stats-view">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Statistik</h2>
        <div className="flex gap-1" role="group" aria-label="Figur">{[["", "Gesamt"], ...ids.map((i) => [i, names.agent(i)])].map(([id, label]) => <button key={id} className={`btn ${agent === id ? "on" : ""}`} aria-pressed={agent === id} onClick={() => setAgent(id)}>{label}</button>)}</div>
        <div className="flex gap-1" role="group" aria-label="Zeitraum">{([["all", "Alles"], ["day", "Heute"], ["6h", "Letzte 6 Std."]] as const).map(([k, label]) => <button key={k} className={`btn ${range === k ? "on" : ""}`} aria-pressed={range === k} onClick={() => setRange(k)}>{label}</button>)}</div>
        {error && <span role="alert" className="text-warn">{error}</span>}
      </div>
      {shown ? <Overview s={shown} names={names.agent} place={names.location} /> : <p className="text-dim">Lade Statistik …</p>}
    </div>
  );
}
