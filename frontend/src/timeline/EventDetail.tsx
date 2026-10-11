import { clockOf } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { useNames } from "../lib/useNames";
import { api } from "../net/api";
import { Drawer } from "../panels/Drawer";
import { useDetail } from "../panels/useDetail";
import { useUiStore } from "../store/uiStore";
import type { Decision, EventOut } from "../types/generated";
import { describeEvent, type Names } from "./describeEvent";

function Linked({ items, names }: { items: EventOut[]; names: Names }) {
  const select = useUiStore((s) => s.select);
  if (!items.length) return <div className="text-dim">keine</div>;
  return <>{items.slice(0, 12).map((e) => (
    <button key={e.id} className="block w-full cursor-pointer truncate rounded px-1 py-0.5 text-left text-xs hover:bg-panel2" onClick={() => select({ kind: "event", id: String(e.seq) })}>
      <span className="font-mono text-faint">#{e.seq}</span> <Icon name="link" size={12} /> {describeEvent(e, names).text}
    </button>
  ))}</>;
}

function Options({ d }: { d: Decision }) {
  if (!d.options?.length) return null;
  return (<><div className="sub">Optionen (Punkte)</div>
    <table className="w-full border-collapse text-xs"><thead><tr className="text-left text-dim"><th className="py-1">Option</th><th>Punkte</th></tr></thead><tbody>
      {d.options.map((o) => <tr key={o.id} className={`border-b border-line ${o.id === d.chosen ? "font-semibold text-alex" : ""}`}><td className="py-1">{o.id === d.chosen ? "▶ " : ""}{o.label}</td><td className="font-mono">{o.score.toFixed(2)}</td></tr>)}
    </tbody></table></>);
}

export function EventDetail({ refId }: { refId: string }) {
  const names = useNames();
  const { data, error } = useDetail(() => api.event(refId), refId, 0);
  if (error) return <Drawer title="Ereignis"><p className="text-warn">{error}</p></Drawer>;
  if (!data) return <Drawer title="Ereignis"><p className="text-dim">Lade …</p></Drawer>;
  const ev = data.event;
  const clock = clockOf(ev.sim_time.total);
  return (
    <Drawer title={describeEvent(ev, names).text} sub={<span className="font-mono text-xs">#{ev.seq} · {ev.type} · {ev.category}</span>}>
      <dl className="my-2.5 grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1 text-[13px]">
        <dt className="text-dim">Zeit</dt><dd className="font-mono text-xs">Tag {clock.day}, {clock.time}</dd>
        <dt className="text-dim">Beteiligte</dt><dd>{ev.agents.map(names.agent).join(", ") || "—"}</dd>
        <dt className="text-dim">Ort</dt><dd>{ev.location ? names.location(ev.location) : "—"}</dd>
        <dt className="text-dim">Kennung</dt><dd className="break-all font-mono text-xs">{ev.id}</dd>
        <dt className="text-dim">Sichtbarkeit</dt><dd>{ev.visibility}</dd>
      </dl>
      {ev.type === "agent.decision" && <Options d={ev.data as unknown as Decision} />}
      <div className="sub">Verursacht durch</div><Linked items={data.chain} names={names} />
      <div className="sub">Folgen</div><Linked items={data.consequences} names={names} />
      <div className="sub">Alle Felder</div>
      <pre className="overflow-auto rounded-md bg-bg p-2 font-mono text-[11px] text-dim">{JSON.stringify(ev.data, null, 2)}</pre>
    </Drawer>
  );
}
