import { clockOf } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { api } from "../net/api";
import { useNames } from "../lib/useNames";
import { useDetail } from "../panels/useDetail";
import { useUiStore } from "../store/uiStore";
import type { MemoryOut } from "../types/generated";
import { accentOf } from "../world/art/people";
import { INTENTION_LABEL, KIND_COLOR, KIND_LABEL } from "./labels";

const when = (min: number) => { const c = clockOf(min); return `Tag ${c.day}, ${c.time}`; };

function Mini({ m, onPick }: { m: MemoryOut; onPick: (id: string) => void }) {
  return (
    <button className="block w-full cursor-pointer truncate rounded px-1.5 py-1 text-left text-xs hover:bg-panel2" onClick={() => onPick(m.id)} title={m.text}>
      <span style={{ color: KIND_COLOR[m.kind] }}>{KIND_LABEL[m.kind]}</span> · {m.text}
    </button>
  );
}

export function MemoryDetail({ agent, id, onPick, onClose }: { agent: string; id: string; onPick: (id: string) => void; onClose: () => void }) {
  const names = useNames();
  const select = useUiStore((s) => s.select);
  const setView = useUiStore((s) => s.setView);
  const { data, error } = useDetail(() => api.memory(agent, id), `${agent}/${id}`, 0);
  if (error) return <aside className="p-4 text-warn">{error}</aside>;
  if (!data) return <aside className="p-4 text-dim">Lade …</aside>;
  const m = data.memory;
  const jump = () => { if (m.source_event_id) { setView("world"); select({ kind: "event", id: m.source_event_id }); } };
  return (
    <aside className="min-h-0 overflow-auto border-l border-line bg-panel px-4 py-3.5" data-testid="memory-detail">
      <button className="btn float-right" onClick={onClose} aria-label="Schließen">✕</button>
      <div className="text-xs" style={{ color: KIND_COLOR[m.kind] }}>{KIND_LABEL[m.kind]}{m.intention_state ? ` · ${INTENTION_LABEL[m.intention_state]}` : ""}{m.status === "archived" ? " · archiviert" : ""}</div>
      <p className="mt-1 text-[15px] leading-snug">{m.text}</p>
      <dl className="my-3 grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1 text-[13px]">
        <dt className="text-dim">Entstanden</dt><dd className="font-mono text-xs">{when(m.sim_created)}</dd>
        <dt className="text-dim">Wichtigkeit</dt><dd>★ {m.importance} von 10</dd>
        <dt className="text-dim">Gemeinsam</dt><dd>{m.shared ? "ja, ein gemeinsames Erlebnis" : "nein"}</dd>
        {m.persons.length > 0 && (<><dt className="text-dim">Beteiligte</dt><dd>{m.persons.map((p, i) => <span key={p} style={{ color: accentOf(p) }}>{i ? ", " : ""}{names.agent(p)}</span>)}</dd></>)}
        {m.location_id && (<><dt className="text-dim">Ort</dt><dd>{names.location(m.location_id)}</dd></>)}
        <dt className="text-dim">Abgerufen</dt><dd>{m.access_count}× {m.sim_last_access != null && <span className="text-dim">· zuletzt {when(m.sim_last_access)}</span>}</dd>
      </dl>
      {m.keywords.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{m.keywords.slice(0, 14).map((k) => <span key={k} className="rounded bg-panel2 px-1.5 text-[11px] text-dim">{k}</span>)}</div>}
      {m.source_event_id && <button className="btn text-xs" onClick={jump}><Icon name="link" size={12} /> Quellereignis im Protokoll</button>}
      {data.sources.length > 0 && (<><div className="sub">Entstanden aus ({data.sources.length})</div>{data.sources.map((s) => <Mini key={s.id} m={s} onPick={onPick} />)}</>)}
      {data.derived.length > 0 && (<><div className="sub">Darauf stützen sich</div>{data.derived.map((s) => <Mini key={s.id} m={s} onPick={onPick} />)}</>)}
      <div className="sub">Abrufe ({data.retrievals.length})</div>
      {data.retrievals.length ? (
        <table className="w-full border-collapse text-xs"><tbody>
          {data.retrievals.map((r) => <tr key={r.id} className="border-b border-line"><td className="py-1 font-mono text-faint">{when(r.sim_minute)}</td><td>Entscheidung {r.decision_id ? `#${r.decision_id}` : "–"}</td><td className="text-right font-mono">{r.score?.toFixed(2)}</td></tr>)}
        </tbody></table>
      ) : <div className="text-dim">noch nie abgerufen</div>}
    </aside>
  );
}
