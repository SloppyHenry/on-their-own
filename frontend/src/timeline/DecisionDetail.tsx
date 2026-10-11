import { useState } from "react";
import { clockOf } from "../lib/clock";
import { api } from "../net/api";
import { useDetail } from "../panels/useDetail";
import { FactorBars } from "./FactorBars";

/** „Warum?“ zu einer Entscheidung: Erklärtext aus den gespeicherten Daten, Ziel, Optionen mit Punkten und Faktoren. Der genannte Zweck des Agenten steht getrennt. */
export function DecisionDetail({ id }: { id: number }) {
  const { data } = useDetail(() => api.decision(id), `dec/${id}`, 0);
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="text-dim">Lade …</div>;
  const chosen = data.options.find((o) => o.id === data.chosen);
  const shown = open ?? data.chosen;
  const ranked = [...data.options].sort((a, b) => b.score - a.score);
  return (
    <div data-testid="decision-detail">
      <div className="sub">Warum?</div>
      <p className="text-[13px] leading-snug" data-testid="why">{data.why || "Keine Erklärung gespeichert."}</p>
      {data.intent && <p className="mt-1 text-xs text-dim">Vom Agenten genannter Zweck: „{data.intent}“</p>}
      <dl className="my-2 grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1 text-xs">
        <dt className="text-dim">Zeit</dt><dd className="font-mono">Tag {clockOf(data.sim_minute).day}, {clockOf(data.sim_minute).time}</dd>
        {data.goal && (<><dt className="text-dim">Aktives Ziel</dt><dd>{String(data.goal.text)}{data.goal.step ? ` · Schritt: ${String(data.goal.step)}` : ""}</dd></>)}
        {data.mood && (<><dt className="text-dim">Stimmung</dt><dd>{String(data.mood.word)}</dd></>)}
        <dt className="text-dim">Platz der Wahl</dt><dd>{data.rank ? `${data.rank} von ${data.options.length}` : "–"}{data.best === false ? " (nicht die bestbewertete)" : ""}</dd>
        <dt className="text-dim">Ergebnis</dt><dd className={data.outcome === "accepted" ? "text-ok" : "text-warn"}>{data.outcome === "accepted" ? "ausgeführt" : `abgelehnt: ${data.outcome_text ?? ""}`}</dd>
      </dl>
      <div className="sub">Optionen (Punkte)</div>
      <table className="w-full border-collapse text-xs"><tbody>
        {ranked.map((o) => (
          <tr key={o.id} className={`cursor-pointer border-b border-line ${o.id === data.chosen ? "font-semibold text-alex" : ""}`} onClick={() => setOpen(o.id)}>
            <td className="py-1">{o.id === data.chosen ? "▶ " : ""}{o.label}</td><td className="font-mono">{o.score.toFixed(1)}</td></tr>
        ))}
      </tbody></table>
      {(open ? data.options.find((o) => o.id === shown) : chosen) && <div className="mt-2 rounded-md bg-panel2 p-2"><div className="mb-1 text-[11px] text-dim">Faktoren: {(open ? data.options.find((o) => o.id === shown) : chosen)!.label}</div><FactorBars factors={(open ? data.options.find((o) => o.id === shown) : chosen)!.factors} /></div>}
    </div>
  );
}
