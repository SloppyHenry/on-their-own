import { Icon } from "../lib/Icon";
import { Portrait } from "../lib/Portrait";
import { ACTIVITIES, statusName } from "../lib/names";
import { accentOf } from "../world/draw/characters";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import type { AgentInfo } from "../store/types";

export function activityOf(a: AgentInfo): { text: string; icon: string } {
  if (a.action) {
    const [verb, icon] = ACTIVITIES[a.action.type] ?? [a.action.type, "think"];
    const target = String(a.action.params.target ?? a.action.params.label ?? "");
    return { text: target ? `${verb} · ${target}` : verb, icon };
  }
  const [name, icon] = statusName(a.status);
  return { text: a.plan_next && a.status === "idle" ? `${name} · ${a.plan_next}` : name, icon };
}

function AgentCard({ id }: { id: string }) {
  const w = useSimStore((s) => s.world!);
  const select = useUiStore((s) => s.select);
  const a = w.agents[id];
  const res = w.activity[id]?.lastResult;
  const { text, icon } = activityOf(a);
  const c = accentOf(id);
  return (
    <button className="mx-3 mb-2 grid w-[calc(100%-1.5rem)] cursor-pointer grid-cols-[44px_1fr] gap-3 rounded-lg border-l-[3px] bg-panel2 px-3 py-2.5 text-left hover:brightness-110"
      style={{ borderLeftColor: c }} onClick={() => select({ kind: "agent", id })} data-testid={`agent-card-${id}`}>
      <Portrait id={id} />
      <span className="min-w-0">
        <b style={{ color: c }}>{a.name}</b>
        <span className="text-dim"> · {w.locations[a.location_id]?.name ?? "unterwegs"}</span>
        <span className="block truncate text-xs text-dim"><Icon name={icon} size={14} /> {text}</span>
        {res && <span className="block truncate text-xs text-dim"><Icon name={res.ok ? "ok" : "no"} size={14} className={res.ok ? "text-ok" : "text-warn"} /> {res.text}</span>}
      </span>
    </button>
  );
}

export function AgentPanel() {
  const order = useSimStore((s) => s.world?.agentOrder ?? []);
  return (
    <section>
      <h2 className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">Bewohner</h2>
      {order.map((id) => <AgentCard key={id} id={id} />)}
    </section>
  );
}
