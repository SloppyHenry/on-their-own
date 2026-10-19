import { Icon } from "../lib/Icon";
import { Portrait } from "../lib/Portrait";
import { ACTIVITIES, USE_VERBS, resourceName, statusName } from "../lib/names";
import { accentOf } from "../world/art/people";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { useOverview } from "../net/useOverview";
import { NeedsBars } from "./NeedsBars";
import { GoalProgress } from "./GoalView";
import type { AgentInfo, World } from "../store/types";

const TARGET_KEYS = ["label", "target", "object_id", "seedbed_id", "plant", "site", "node", "to"];

/** Ziel einer Aktion als lesbarer Name (Ort, Objekt, Quelle oder Person); unbekannte Kennungen bleiben unverändert. */
function targetName(w: World, params: Record<string, unknown>): string {
  const key = TARGET_KEYS.find((k) => typeof params[k] === "string" && params[k]);
  const v = key ? String(params[key]) : "";
  return w.locations[v]?.name ?? w.objects[v]?.name ?? w.agents[v]?.name ?? (w.resources[v] ? resourceName(w.resources[v].resource) : v);
}

export function activityOf(a: AgentInfo, w: World): { text: string; icon: string } {
  if (a.action) {
    const [base, icon] = ACTIVITIES[a.action.type] ?? [a.action.type, "think"];
    const verb = a.action.type === "use" ? USE_VERBS[String(a.action.params?.mode ?? "")] ?? base : base;
    const target = targetName(w, a.action.params);
    if (a.action.type === "move_to") return { text: target ? `→ ${target}` : "unterwegs", icon };   // „geht Wohnzimmer“ liest sich schlecht: Pfeil und Ziel
    return { text: target ? `${verb} · ${target}` : verb, icon };
  }
  const [name, icon] = statusName(a.status);
  if (a.status === "deciding") return { text: a.plan_next ? `überlegt: ${a.plan_next}` : "überlegt, was als Nächstes dran ist", icon };
  return { text: a.plan_next && a.status === "idle" ? `${name} · ${a.plan_next}` : name, icon };
}

function AgentCard({ id }: { id: string }) {
  const w = useSimStore((s) => s.world!);
  const select = useUiStore((s) => s.select);
  const a = w.agents[id];
  const res = w.activity[id]?.lastResult;
  const ov = useOverview()[id];
  const { text, icon } = activityOf(a, w);
  const c = accentOf(id);
  return (
    <button className="mx-2 mb-1.5 grid w-[calc(100%-1rem)] cursor-pointer grid-cols-[32px_1fr] gap-2.5 rounded-lg border-l-[3px] bg-panel2 px-2.5 py-1.5 text-left hover:brightness-110"
      style={{ borderLeftColor: c }} onClick={() => select({ kind: "agent", id })} data-testid={`agent-card-${id}`}>
      <Portrait id={id} size={32} />
      <span className="min-w-0">
        <b style={{ color: c }}>{a.name}</b>{!a.profile && <span className="text-[11px] text-faint" title="Nebenfigur: ohne eigenes Gedächtnis und ohne Ziele"> · Nebenfigur</span>}
        <span className="text-dim"> · {w.locations[a.location_id]?.name ?? "unterwegs"}</span>
        {ov && <span className="text-[11px] text-dim" title="Stimmung" data-testid={`mood-${id}`}> · {ov.mood.word}{ov.resting ? " · Ruhemodus" : ""}</span>}
        <span className="block truncate text-xs text-dim"><Icon name={icon} size={14} /> {text}</span>
        {ov?.goal && <span className="block truncate text-xs" title={ov.goal.text} data-testid={`goal-line-${id}`}><span className="text-dim">Ziel:</span> {ov.goal.text}<GoalProgress g={ov.goal} /></span>}
        {ov && <NeedsBars needs={ov.needs} compact />}
        {res && <span className="block truncate text-xs text-dim"><Icon name={res.ok ? "ok" : "no"} size={14} className={res.ok ? "text-ok" : "text-warn"} /> {res.ok ? (res.text === "move_to" ? "angekommen" : `fertig: ${ACTIVITIES[res.text]?.[0] ?? res.text}`) : res.text}</span>}
      </span>
    </button>
  );
}

export function AgentPanel() {
  const order = useSimStore((s) => s.world?.agentOrder ?? []);
  return (
    <section className="pt-2" aria-label="Bewohner">
      {order.map((id) => <AgentCard key={id} id={id} />)}
    </section>
  );
}
