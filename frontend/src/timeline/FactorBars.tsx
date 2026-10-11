import { useState } from "react";
import { useFactors } from "../net/useOverview";

/** Faktoren einer Option als Balken (grün = spricht dafür, rot = dagegen); umschaltbar auf die Gruppen der Spezifikation. */
export function FactorBars({ factors, max = 40 }: { factors: unknown[][]; max?: number }) {
  const reg = useFactors();
  const [grouped, setGrouped] = useState(false);
  const rows: [string, number][] = factors.map((f) => [String(f[0]), Number(f[1])]);
  let shown = rows;
  if (grouped && reg) {
    const key = Object.fromEntries(reg.factors.map((f) => [f.label, f.key]));
    const sum: Record<string, number> = {};
    for (const [n, v] of rows) { const k = key[n] ?? "base"; sum[k] = (sum[k] ?? 0) + v; }
    shown = Object.entries(sum).map(([k, v]) => [reg.groups[k] ?? k, Math.round(v * 10) / 10]);
  }
  shown = [...shown].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const scale = Math.max(max, ...shown.map((r) => Math.abs(r[1])));
  return (
    <div data-testid="factor-bars">
      <button className="mb-1 cursor-pointer text-[11px] text-dim underline" onClick={() => setGrouped(!grouped)}>{grouped ? "Einzelne Faktoren" : "Nach Gruppen"}</button>
      {shown.map(([name, v]) => (
        <div key={name} className="grid grid-cols-[1fr_90px_44px] items-center gap-2 text-[11px]">
          <span className="truncate text-dim" title={name}>{name}</span>
          <span className="relative h-1.5 rounded-sm bg-bg"><i className="absolute top-0 block h-full rounded-sm" style={{ background: v >= 0 ? "var(--color-ok)" : "var(--color-warn)", width: `${Math.min(50, (Math.abs(v) / scale) * 50)}%`, left: v >= 0 ? "50%" : `${50 - Math.min(50, (Math.abs(v) / scale) * 50)}%` }} /></span>
          <span className="text-right font-mono">{v > 0 ? "+" : ""}{v.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}
