import { ACTIVITIES, USE_VERBS, resourceName, statusName } from "../lib/names";
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
