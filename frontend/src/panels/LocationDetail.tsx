import { formatTime } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { resourceName } from "../lib/names";
import { useNames } from "../lib/useNames";
import { api } from "../net/api";
import { describeEvent } from "../timeline/describeEvent";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "../world/art/people";
import { Drawer } from "./Drawer";
import { useDetail } from "./useDetail";

export function LocationDetail({ id }: { id: string }) {
  const names = useNames();
  const select = useUiStore((s) => s.select);
  const { data, error } = useDetail(() => api.location(id), id);
  if (error) return <Drawer title="Ort"><p className="text-warn">{error}</p></Drawer>;
  if (!data) return <Drawer title="Ort"><p className="text-dim">Lade …</p></Drawer>;
  const loc = data.location;
  return (
    <Drawer title={loc.name} sub={<span className="font-mono text-xs">{loc.id} · Rechteck {loc.rect.join(", ")}</span>}>
      <div className="sub">Objekte</div>
      <table className="w-full border-collapse text-xs"><tbody>
        {data.objects.map((o) => <tr key={o.id} className="border-b border-line"><td className="py-1">{o.name}</td><td className="py-1 text-dim">{Object.keys(o.state).length ? JSON.stringify(o.state) : ""}</td></tr>)}
        {data.resources.map((r) => <tr key={r.id} className="border-b border-line"><td className="py-1">{resourceName(r.resource)}</td><td className="py-1 text-dim">{Math.round(r.amount)} / {Math.round(r.cap)}</td></tr>)}
      </tbody></table>
      <div className="sub">Anwesend</div>
      <div>{data.agents.length ? data.agents.map((a, i) => <span key={a} style={{ color: accentOf(a) }}>{i ? ", " : ""}{names.agent(a)}</span>) : <span className="text-dim">niemand</span>}</div>
      <div className="sub">Jüngste Ereignisse hier</div>
      {data.recent_events.slice(0, 10).map((e) => {
        const d = describeEvent(e, names);
        return <button key={e.id} className="grid w-full cursor-pointer grid-cols-[44px_18px_1fr] gap-1.5 rounded px-2 py-1 text-left text-[13px] hover:bg-panel2" onClick={() => select({ kind: "event", id: String(e.seq) })}>
          <span className="font-mono text-xs text-faint">{formatTime(e.sim_time.total)}</span><Icon name={d.icon} className="text-world" /><span>{d.text}</span></button>;
      })}
    </Drawer>
  );
}
