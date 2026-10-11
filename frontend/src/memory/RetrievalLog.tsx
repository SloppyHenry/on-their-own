import { clockOf } from "../lib/clock";
import { api } from "../net/api";
import { useDetail } from "../panels/useDetail";
import { useSimStore } from "../store/simStore";
import { KIND_COLOR, KIND_LABEL } from "./labels";

/** Welche Erinnerungen flossen in welche Entscheidung ein, mit den Teilpunkten (Relevanz, Aktualität, Wichtigkeit, gemeinsam). */
export function RetrievalLog({ agent, onPick }: { agent: string; onPick: (id: string) => void }) {
  const version = useSimStore((s) => s.memoryVersion);
  const { data } = useDetail(() => api.retrievals(agent, 40), `${agent}/${version}`, 0);
  if (!data) return <p className="p-4 text-dim">Lade …</p>;
  if (!data.length) return <p className="p-6 text-center text-dim">Noch kein Abruf. Sobald es Erinnerungen gibt, werden sie vor jeder Entscheidung abgerufen.</p>;
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 pb-4" data-testid="retrievals">
      {data.map((r) => (
        <div key={r.id} className="rounded-lg bg-panel2 p-2.5">
          <div className="text-xs text-dim"><span className="font-mono">Tag {clockOf(r.sim_minute).day}, {clockOf(r.sim_minute).time}</span> · Entscheidung {r.decision_id ? `#${r.decision_id}` : "–"} · {r.tokens} Tokens</div>
          {r.items.map((i) => (
            <button key={i.id} className="mt-1 block w-full cursor-pointer rounded px-1.5 py-1 text-left text-xs hover:bg-line" onClick={() => onPick(i.id)}>
              <span className="font-mono">{i.score.toFixed(2)}</span> <span style={{ color: KIND_COLOR[i.kind] }}>{KIND_LABEL[i.kind] ?? i.kind}</span> · {i.text}
              <span className="block font-mono text-[10px] text-faint">{Object.entries(i.parts).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
