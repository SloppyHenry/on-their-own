import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { useNames } from "../lib/useNames";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import type { EventCategory, EventOut } from "../types/generated";
import { accentOf } from "../world/draw/characters";
import { describeEvent } from "./describeEvent";
import { matchesFilters } from "./filter";

const CAT_LABEL: [EventCategory, string, string][] = [["world", "Welt", "var(--color-world)"], ["dialogue", "Dialog", "var(--color-dialog)"], ["planning", "Planung", "var(--color-plan)"], ["memory", "Gedächtnis", "var(--color-ok)"], ["system", "System", "var(--color-sys)"]];
type Row = { kind: "day"; day: number } | { kind: "ev"; ev: EventOut; text: string; icon: string };

export function EventTimeline() {
  const events = useSimStore((s) => s.events);
  const order = useSimStore((s) => s.world?.agentOrder ?? []);
  const names = useNames();
  const filters = useUiStore((s) => s.filters);
  const setFilters = useUiStore((s) => s.setFilters);
  const select = useUiStore((s) => s.select);
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let day = 0;
    for (const ev of events) {
      const d = describeEvent(ev, names);
      if (!matchesFilters(ev, d.text, filters)) continue;
      if (ev.sim_time.day !== day) { day = ev.sim_time.day; out.push({ kind: "day", day }); }
      out.push({ kind: "ev", ev, text: d.text, icon: d.icon });
    }
    return out;
  }, [events, names, filters]);

  const v = useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => 28, overscan: 14 });
  useEffect(() => { if (pinned && rows.length) v.scrollToIndex(rows.length - 1, { align: "end" }); }, [rows.length, pinned, v]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };
  const toggleCat = (c: EventCategory) => setFilters({ categories: { ...filters.categories, [c]: !filters.categories[c] } });

  return (
    <section className="flex min-h-0 flex-col border-t border-line">
      <h2 className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">Protokoll</h2>
      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {CAT_LABEL.map(([c, label, col]) => (
          <button key={c} onClick={() => toggleCat(c)} aria-pressed={filters.categories[c]} className="cursor-pointer rounded-full border px-2.5 py-0.5 text-xs"
            style={filters.categories[c] ? { borderColor: col, color: "var(--color-text)", background: "#ffffff0a" } : { borderColor: "var(--color-line)", color: "var(--color-dim)" }}>{label}</button>
        ))}
        {order.map((id) => (
          <button key={id} onClick={() => setFilters({ agent: filters.agent === id ? null : id })} aria-pressed={filters.agent === id} className="cursor-pointer rounded-full border px-2.5 py-0.5 text-xs"
            style={filters.agent === id ? { borderColor: accentOf(id), color: "var(--color-text)" } : { borderColor: "var(--color-line)", color: "var(--color-dim)" }}>{names.agent(id)}</button>
        ))}
        <button onClick={() => setFilters({ moves: !filters.moves })} aria-pressed={filters.moves} className="cursor-pointer rounded-full border border-line px-2.5 py-0.5 text-xs text-dim" title="Einzelne Schritte anzeigen">{filters.moves ? "Schritte an" : "Schritte aus"}</button>
      </div>
      <input className="mx-3 mb-2 rounded-md border border-line bg-bg px-2 py-1 text-xs" placeholder="Suchen …" value={filters.text} onChange={(e) => setFilters({ text: e.target.value })} aria-label="Protokoll durchsuchen" />
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto px-1.5 pb-2" data-testid="timeline">
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((it) => {
            const r = rows[it.index];
            return (
              <div key={it.key} data-index={it.index} ref={v.measureElement} className="absolute left-0 top-0 w-full" style={{ transform: `translateY(${it.start}px)` }}>
                {r.kind === "day" ? <div className="px-2 pb-0.5 pt-2 text-[11px] uppercase tracking-widest text-faint">Tag {r.day}</div> : (
                  <button onClick={() => select({ kind: "event", id: String(r.ev.seq) })} data-type={r.ev.type} className={`grid w-full cursor-pointer grid-cols-[44px_18px_1fr] gap-1.5 rounded-md px-2 py-1 text-left text-[13px] hover:bg-panel2 ${r.ev.category === "dialogue" ? "italic" : ""}`}>
                    <span className="font-mono text-xs text-faint">{formatTime(r.ev.sim_time.total)}</span>
                    <Icon name={r.icon} className={{ world: "text-world", dialogue: "text-dialog", planning: "text-plan", memory: "text-plan", system: "text-sys" }[r.ev.category]} />
                    <span>{r.text}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!pinned && <button className="btn mx-auto mb-2 text-xs" onClick={() => { setPinned(true); v.scrollToIndex(rows.length - 1, { align: "end" }); }}>↓ Zu den neuesten</button>}
    </section>
  );
}
