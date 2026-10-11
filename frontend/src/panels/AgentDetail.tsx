import { formatTime } from "../lib/clock";
import { Icon } from "../lib/Icon";
import { Portrait } from "../lib/Portrait";
import { DIRECTIONS, resourceName } from "../lib/names";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "../world/draw/characters";
import { activityOf } from "./AgentPanel";
import { Bar, Drawer } from "./Drawer";
import { useDetail } from "./useDetail";

const NEED_LABEL: Record<string, string> = { energy: "Energie", hunger: "Hunger", thirst: "Durst" };

export function AgentDetail({ id }: { id: string }) {
  const w = useSimStore((s) => s.world!);
  const select = useUiStore((s) => s.select);
  const follow = useUiStore((s) => s.follow);
  const setFollow = useUiStore((s) => s.setFollow);
  const { data } = useDetail(() => api.agent(id), id);
  const a = w.agents[id];
  if (!a) return null;
  const c = accentOf(id);
  const { text, icon } = activityOf(a, w);
  const held = Object.values(w.objects).filter((o) => o.holder === id).map((o) => o.name);
  const inv = Object.entries(a.inventory).map(([k, v]) => `${resourceName(k)} ×${v}`);
  const prof = a.profile;

  return (
    <Drawer head={<Portrait id={id} size={56} />} title={<span style={{ color: c }}>{a.name}</span>} sub={prof ? `${prof.age} · ${prof.gender}` : undefined}>
      <dl className="my-2.5 grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1 text-[13px]">
        <dt className="text-dim">Status</dt><dd><Icon name={icon} /> {text}</dd>
        <dt className="text-dim">Position</dt><dd className="font-mono text-xs">({a.x}, {a.y}) · {w.locations[a.location_id]?.name ?? "—"} · blickt nach {DIRECTIONS[a.facing] ?? a.facing}</dd>
        <dt className="text-dim">Trägt</dt><dd>{[...inv, ...held].join(", ") || "nichts"}</dd>
        {data?.mood && (<><dt className="text-dim">Stimmung</dt><dd>{data.mood}</dd></>)}
      </dl>
      <button className={`btn ${follow === id ? "on" : ""}`} onClick={() => setFollow(follow === id ? null : id)}>Kamera folgt</button>
      {prof && prof.goals.length > 0 && (<><div className="sub">Ziele</div><ul className="list-disc pl-5 text-dim">{prof.goals.map((g) => <li key={g}>{g}</li>)}</ul></>)}
      <div className="sub">Bedürfnisse</div>
      {Object.entries(a.needs).map(([k, v]) => <Bar key={k} label={NEED_LABEL[k] ?? k} value={k === "energy" ? v : v} color={c} />)}
      <div className="sub">Letzte Entscheidungen</div>
      <table className="my-1.5 w-full border-collapse text-xs"><tbody>
        {(data?.decisions ?? []).slice(0, 8).map((d) => (
          <tr key={d.id} className="cursor-default border-b border-line align-top"><td className="py-1 pr-2 font-mono text-faint">{formatTime(d.sim_minute)}</td><td className="py-1 pr-2">{d.intent || d.chosen || d.action}</td>
            <td className={`py-1 ${d.outcome === "ok" ? "text-ok" : d.outcome ? "text-warn" : "text-dim"}`}>{d.outcome_text ?? d.status}</td></tr>
        ))}
      </tbody></table>
      <div className="sub">Erinnerungen (ab AP05)</div>
      <div className="text-dim">Erscheinen, sobald das Gedächtnis da ist.</div>
      <button className="btn mt-4" onClick={() => select(null)}>Schließen</button>
    </Drawer>
  );
}
