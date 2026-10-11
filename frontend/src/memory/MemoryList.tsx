import { clockOf } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { useSimStore } from "../store/simStore";
import type { MemoryOut } from "../types/generated";
import { INTENTION_LABEL, KIND_COLOR, KIND_LABEL } from "./labels";

const FRESH_MS = 30_000;

export function MemoryRow({ m, selected, onSelect }: { m: MemoryOut; selected: boolean; onSelect: () => void }) {
  const fresh = useSimStore((s) => (s.newMemories[m.id] ?? 0) > Date.now() - FRESH_MS);
  const c = clockOf(m.sim_created);
  return (
    <button onClick={onSelect} data-testid="memory-row" data-id={m.id} data-kind={m.kind} aria-pressed={selected}
      className={`block w-full cursor-pointer rounded-md border-l-[3px] px-3 py-2 text-left hover:bg-panel2 ${selected ? "bg-panel2" : ""} ${m.status === "archived" ? "opacity-60" : ""}`}
      style={{ borderLeftColor: KIND_COLOR[m.kind] }}>
      <span className="flex items-center gap-2 text-[11px] text-dim">
        <span style={{ color: KIND_COLOR[m.kind] }}>{KIND_LABEL[m.kind] ?? m.kind}</span>
        {m.intention_state && <span>· {INTENTION_LABEL[m.intention_state]}</span>}
        <span className="font-mono">Tag {c.day} · {c.time}</span>
        <span title="Wichtigkeit">★ {m.importance}</span>
        {m.shared && <span title="gemeinsames Erlebnis"><Icon name="chat" size={12} /></span>}
        {m.access_count > 0 && <span title="so oft abgerufen"><Icon name="think" size={12} /> {m.access_count}</span>}
        {m.status === "archived" && <span>archiviert</span>}
        {fresh && <span className="ml-auto rounded-full bg-ok/20 px-1.5 text-ok">neu</span>}
      </span>
      <span className="mt-0.5 block text-[13px] leading-snug">{m.text}</span>
    </button>
  );
}

export function MemoryList({ items, total, loading, hasMore, more, selected, onSelect }: {
  items: MemoryOut[]; total: number; loading: boolean; hasMore: boolean; more: () => void; selected: string | null; onSelect: (m: MemoryOut) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="memory-list">
      <div className="px-3 pb-1 text-xs text-dim">{total} Erinnerungen{loading ? " · lädt …" : ""}</div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-3">
        {items.map((m) => <MemoryRow key={m.id} m={m} selected={selected === m.id} onSelect={() => onSelect(m)} />)}
        {!items.length && !loading && <p className="px-3 py-6 text-center text-dim">Keine Erinnerungen mit diesen Filtern.</p>}
        {hasMore && <button className="btn mx-auto my-2 block text-xs" onClick={more}>Mehr laden</button>}
      </div>
    </div>
  );
}
