import { useCallback, useEffect, useState } from "react";
import { Icon } from "../lib/Icon";
import { formatTime } from "../lib/clock";
import { useNames } from "../lib/useNames";
import { ApiError, api, eventsExportUrl } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { describeEvent } from "../timeline/describeEvent";
import type { EventCategory, EventOut } from "../types/generated";

const CATS: [string, string][] = [["", "alle Kategorien"], ["world", "Welt"], ["dialogue", "Dialog"], ["planning", "Planung"], ["memory", "Gedächtnis"], ["system", "System"]];
interface F { category: string; agent: string; location: string; prefix: string; text: string; fromDay: string; fromTime: string; toDay: string; toTime: string }
const EMPTY: F = { category: "", agent: "", location: "", prefix: "", text: "", fromDay: "", fromTime: "00:00", toDay: "", toTime: "23:59" };
const minute = (day: string, time: string): number | undefined => {
  if (!day) return undefined;
  const [h, m] = time.split(":").map(Number);
  return (Number(day) - 1) * 1440 + (h || 0) * 60 + (m || 0);
};

/** Verlauf aller Ereignisse mit Filtern (Zeitraum, Art, Kategorie, Figur, Ort, Text) und Export als CSV oder JSON. */
export function EventHistory() {
  const names = useNames();
  const world = useSimStore((s) => s.world);
  const select = useUiStore((s) => s.select);
  const [f, setF] = useState<F>(EMPTY);
  const [rows, setRows] = useState<EventOut[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useCallback(() => ({ category: f.category || undefined, agent: f.agent || undefined, location: f.location || undefined, type_prefix: f.prefix || undefined, q: f.text || undefined,
    from_minute: minute(f.fromDay, f.fromTime), to_minute: minute(f.toDay, f.toTime) }), [f]);

  const load = useCallback(async (before?: number) => {
    try {
      const page = await api.events({ ...query(), order: "desc", limit: 200, ...(before ? { before_seq: before } : {}) } as Parameters<typeof api.events>[0] & { category?: EventCategory });
      setRows((r) => (before ? [...r, ...page.items] : page.items));
      setMore(page.items.length === 200);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar");
    }
  }, [query]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  const set = (patch: Partial<F>) => setF((x) => ({ ...x, ...patch }));
  const field = "rounded-md border border-line bg-bg px-2 py-1 text-[13px]";
  return (
    <div className="absolute inset-0 flex flex-col px-5 py-3" data-testid="history-view">
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <h2 className="mr-2 text-lg font-semibold">Verlauf</h2>
        <select aria-label="Kategorie" className={field} value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="Figur" className={field} value={f.agent} onChange={(e) => set({ agent: e.target.value })}><option value="">alle Figuren</option>{world?.agentOrder.map((id) => <option key={id} value={id}>{names.agent(id)}</option>)}</select>
        <select aria-label="Ort" className={field} value={f.location} onChange={(e) => set({ location: e.target.value })}><option value="">alle Orte</option>{Object.values(world?.locations ?? {}).filter((l) => !l.props?.fallback).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <input aria-label="Ereignisart" className={`${field} w-40`} placeholder="Art, z. B. agent.dialogue" value={f.prefix} onChange={(e) => set({ prefix: e.target.value })} />
        <input aria-label="Volltext" className={`${field} w-44`} placeholder="Text suchen …" value={f.text} onChange={(e) => set({ text: e.target.value })} />
        <span className="flex items-center gap-1 text-[12px] text-dim">von Tag<input aria-label="Von Tag" type="number" min={1} className={`${field} w-16`} value={f.fromDay} onChange={(e) => set({ fromDay: e.target.value })} /><input aria-label="Von Uhrzeit" type="time" className={field} value={f.fromTime} onChange={(e) => set({ fromTime: e.target.value })} /></span>
        <span className="flex items-center gap-1 text-[12px] text-dim">bis Tag<input aria-label="Bis Tag" type="number" min={1} className={`${field} w-16`} value={f.toDay} onChange={(e) => set({ toDay: e.target.value })} /><input aria-label="Bis Uhrzeit" type="time" className={field} value={f.toTime} onChange={(e) => set({ toTime: e.target.value })} /></span>
        <button className="btn" onClick={() => setF(EMPTY)}>Zurücksetzen</button>
        <span className="flex-1" />
        <a className="btn" data-testid="export-csv" href={eventsExportUrl("csv", query())} download>CSV</a>
        <a className="btn" data-testid="export-json" href={eventsExportUrl("json", query())} download>JSON</a>
      </div>
      {error && <p role="alert" className="text-warn">{error}</p>}
      <p className="mb-1 text-[12px] text-dim" data-testid="history-count">{rows.length}{more ? "+" : ""} Ereignisse (neueste zuerst)</p>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line">
        <table className="w-full text-[13px]"><tbody>{rows.map((e) => {
          const d = describeEvent(e, names);
          return (
            <tr key={e.seq} className="cursor-pointer border-b border-line/40 hover:bg-panel2" onClick={() => select({ kind: "event", id: String(e.seq) })} data-type={e.type}>
              <td className="whitespace-nowrap px-2 py-1 font-mono text-xs text-faint">T{e.sim_time.day} {formatTime(e.sim_time.total)}</td>
              <td className="px-1"><Icon name={d.icon} size={14} className="text-dim" /></td>
              <td className="px-2 py-1">{d.text}</td>
              <td className="whitespace-nowrap px-2 text-[11px] text-faint">{e.type}</td>
            </tr>
          );
        })}</tbody></table>
        {more && <div className="p-2 text-center"><button className="btn" onClick={() => void load(rows[rows.length - 1].seq)}>Mehr laden</button></div>}
      </div>
    </div>
  );
}
