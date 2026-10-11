import { METRIC_LABEL } from "../lib/autonomyText";
import { clockOf } from "../lib/clock";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { accentOf } from "../world/draw/characters";
import { useDetail } from "./useDetail";

const METRICS = ["trust", "sympathy", "tension", "familiarity"] as const;
const COLOR: Record<string, string> = { trust: "var(--color-ok)", sympathy: "var(--color-dialog)", tension: "var(--color-warn)", familiarity: "var(--color-world)" };

/** Beziehung zu den anderen: Werte, gemeinsame Erlebnisse, offene Konflikte und die jüngsten Änderungen mit Grund. */
export function RelationView({ agent }: { agent: string }) {
  const version = useSimStore((s) => s.autonomyVersion);
  const { data } = useDetail(() => api.relations(agent), `${agent}/rel/${version}`, 8000);
  if (!data?.length) return null;
  return (
    <div data-testid="relations">
      <div className="sub">Beziehungen</div>
      {data.map((r) => (
        <div key={r.other_id} className="mb-2 rounded-md bg-panel2 p-2.5">
          <b style={{ color: accentOf(r.other_id) }}>{r.other_name}</b>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            {METRICS.map((m) => (
              <div key={m} data-metric={m}><div className="flex justify-between text-[11px] text-dim"><span>{METRIC_LABEL[m]}</span><span className="font-mono">{Math.round(r.values[m])}</span></div>
                <div className="h-1 rounded-sm bg-bg"><i className="block h-full rounded-sm" style={{ width: `${r.values[m]}%`, background: COLOR[m] }} /></div></div>
            ))}
          </div>
          {r.conflicts.map((c) => <div key={c} className="mt-1.5 text-xs text-warn">offen: {c}</div>)}
          {r.shared.length > 0 && <div className="mt-1.5 text-xs text-dim">Gemeinsam: {r.shared.slice(0, 3).join(" · ")}</div>}
          {r.log.length > 0 && (
            <div className="mt-1.5 space-y-0.5 border-t border-line pt-1.5">{r.log.slice(0, 5).map((l, i) => (
              <div key={i} className="text-[11px] text-dim"><span className="font-mono text-faint">T{clockOf(l.sim_minute).day} {clockOf(l.sim_minute).time}</span> {Object.entries(l.deltas).map(([k, v]) => `${METRIC_LABEL[k]} ${v > 0 ? "+" : ""}${v}`).join(", ")} – {l.reason}{l.source === "reflection" ? " (Einsicht)" : ""}</div>))}</div>
          )}
        </div>
      ))}
    </div>
  );
}
