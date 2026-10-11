import { conditionText, GOAL_STATE } from "../lib/autonomyText";
import { clockOf } from "../lib/clock";
import { useNames } from "../lib/useNames";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import type { GoalOut } from "../types/generated";
import { useDetail } from "./useDetail";

const when = (m: number) => `Tag ${clockOf(m).day}, ${clockOf(m).time}`;

export function GoalProgress({ g }: { g: GoalOut }) {
  return <div className="mt-1 h-1.5 rounded-sm bg-bg"><i className="block h-full rounded-sm bg-alex" style={{ width: `${Math.round(g.progress * 100)}%` }} /></div>;
}

/** Ziele eines Agenten: langfristig, aktuelles kurzfristiges Ziel mit Plan und Fortschritt, bisherige Ziele mit Ausgang. */
export function GoalView({ agent }: { agent: string }) {
  const names = useNames();
  const version = useSimStore((s) => s.autonomyVersion);
  const { data } = useDetail(() => api.goals(agent, 30), `${agent}/goals/${version}`, 6000);
  if (!data) return null;
  const longs = data.filter((g) => g.kind === "long" && g.state === "active");
  const cur = data.find((g) => g.kind === "short" && g.state === "active");
  const past = data.filter((g) => g.kind === "short" && g.state !== "active").slice(0, 5);
  return (
    <div data-testid="goals">
      <div className="sub">Ziele</div>
      {longs.map((g) => <div key={g.id} className="text-[13px]"><span className="text-dim">langfristig:</span> {g.text}</div>)}
      {cur ? (
        <div className="mt-2 rounded-md bg-panel2 p-2.5" data-testid="current-goal">
          <div className="text-[13px]"><b>{cur.text}</b></div>
          <GoalProgress g={cur} />
          <div className="mt-1 text-xs text-dim">Erfüllt, wenn: {conditionText(cur.condition, names)}</div>
          <ol className="mt-1.5 space-y-0.5 text-xs">
            {cur.plan.map((s, i) => (
              <li key={i} className={i < cur.plan_step ? "text-ok line-through" : i === cur.plan_step ? "text-alex" : "text-dim"}>{i < cur.plan_step ? "✓" : i === cur.plan_step ? "▸" : "·"} {String(s.step)}</li>
            ))}
          </ol>
          {cur.failures > 0 && <div className="mt-1 text-xs text-warn">{cur.failures} Fehlschläge in Folge</div>}
        </div>
      ) : <div className="text-dim">Gerade kein kurzfristiges Ziel.</div>}
      {past.length > 0 && (<><div className="sub">Bisherige Ziele</div>
        {past.map((g) => <div key={g.id} className="border-b border-line py-1 text-xs"><span className={g.state === "achieved" ? "text-ok" : "text-warn"}>{GOAL_STATE[g.state]}</span> · {g.text}<span className="block text-faint">{when(g.updated)} · {g.reason}</span></div>)}</>)}
    </div>
  );
}
