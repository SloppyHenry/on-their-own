// Kleine Liniendiagramme als SVG (keine Bibliothek): eine oder mehrere Reihen über der Simulationszeit.
export interface Series {
  label: string;
  color: string;
  points: [number, number][];
}

const W = 560, H = 150, L = 34, R = 8, T = 8, B = 22;
const dayTime = (m: number) => `T${Math.floor(m / 1440) + 1} ${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:00`;

export function LineChart({ series, domain = [0, 100], title }: { series: Series[]; domain?: [number, number]; title: string }) {
  const pts = series.flatMap((s) => s.points);
  if (pts.length < 2) return <p className="text-[12px] text-dim" data-testid="chart-empty">{title}: noch zu wenig Daten.</p>;
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])) || 1;
  const [y0, y1] = domain;
  const sx = (x: number) => L + ((x - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  return (
    <figure data-testid={`chart-${title}`}>
      <figcaption className="mb-1 text-[12px] text-dim">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[36rem]" role="img" aria-label={title}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={sy(y0 + f * (y1 - y0))} y2={sy(y0 + f * (y1 - y0))} stroke="var(--color-line)" /><text x={L - 4} y={sy(y0 + f * (y1 - y0)) + 3} textAnchor="end" fontSize="9" fill="var(--color-faint)">{Math.round(y0 + f * (y1 - y0))}</text></g>)}
        <text x={L} y={H - 6} fontSize="9" fill="var(--color-faint)">{dayTime(x0)}</text>
        <text x={W - R} y={H - 6} fontSize="9" textAnchor="end" fill="var(--color-faint)">{dayTime(x1)}</text>
        {series.map((s) => s.points.length > 1 && <polyline key={s.label} points={s.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="1.6" />)}
      </svg>
      <div className="mt-0.5 flex flex-wrap gap-3 text-[11px]">{series.map((s) => <span key={s.label} className="text-dim"><i className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: s.color }} />{s.label}</span>)}</div>
    </figure>
  );
}

export function Bars({ items, unit = "", max }: { items: { label: string; value: number }[]; unit?: string; max?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1" data-testid="bars">{items.map((i) => (
      <li key={i.label} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-2 text-[12px]"><span className="truncate" title={i.label}>{i.label}</span>
        <span className="h-2 rounded-sm bg-bg"><i className="block h-full rounded-sm bg-alex" style={{ width: `${(i.value / m) * 100}%` }} /></span><span className="text-right font-mono text-dim">{i.value}{unit}</span></li>
    ))}</ul>
  );
}
