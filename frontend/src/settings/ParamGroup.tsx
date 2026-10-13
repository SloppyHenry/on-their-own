import { useNames } from "../lib/useNames";
import { accentOf } from "../world/art/people";
import { ParamControl } from "./ParamControl";
import { idOf, useParamStore } from "./paramStore";
import type { Spec } from "./labels";

/** Die Regler einer Gruppe. Parameter je Agent erscheinen nebeneinander (je Agent eine Spalte), globale untereinander. */
export function ParamGroup({ specs, compact = false }: { specs: Spec[]; compact?: boolean }) {
  const values = useParamStore((s) => s.values);
  const status = useParamStore((s) => s.status);
  const set = useParamStore((s) => s.set);
  const reset = useParamStore((s) => s.reset);
  const names = useNames();
  if (!values) return null;
  const agents = values.agents;
  const globals = specs.filter((s) => s.scope === "global");
  const perAgent = specs.filter((s) => s.scope === "agent");

  return (
    <div>
      {globals.map((s) => (
        <ParamControl key={s.key} spec={s} value={values.values[s.key]} def={s.default} status={status[idOf(s.key)]} compact={compact}
          onChange={(v) => set(s.key, v)} onReset={() => void reset({ keys: [s.key] })} />
      ))}
      {perAgent.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, agents.length)}, minmax(0, 1fr))` }}>
          {agents.map((a) => (
            <section key={a} aria-label={names.agent(a)} data-testid={`agent-col-${a}`}>
              <h4 className="mb-1 border-b-2 pb-1 text-[13px] font-semibold" style={{ borderColor: accentOf(a) }}>{names.agent(a)}</h4>
              {perAgent.map((s) => {
                const cur = (values.values[s.key] as Record<string, unknown>)?.[a];
                const def = (values.defaults[s.key] as Record<string, unknown>)?.[a];
                return <ParamControl key={s.key} spec={s} agent={a} value={cur} def={def} status={status[idOf(s.key, a)]} compact
                  onChange={(v) => set(s.key, v, a)} onReset={() => void reset({ keys: [s.key], agent: a })} />;
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
