import { met, NEED_LABEL, needColor } from "../lib/autonomyText";
import type { NeedOut } from "../types/generated";

/** Bedürfnisse als schmale Balken (voll = gedeckt). Kritische Bedürfnisse sind rot beschriftet. */
export function NeedsBars({ needs, compact = false }: { needs: NeedOut[]; compact?: boolean }) {
  return (
    <div className={compact ? "mt-1 grid grid-cols-3 gap-x-2 gap-y-0.5" : "space-y-1.5"} data-testid="needs">
      {needs.map((n) => {
        const m = met(n.value);
        return (
          <div key={n.key} title={`${NEED_LABEL[n.key] ?? n.label}: ${Math.round(m)} % gedeckt${n.critical ? " – dringend" : ""}`} data-need={n.key}>
            <div className={`flex justify-between ${compact ? "text-[10px]" : "text-xs"} ${n.critical ? "text-warn" : "text-dim"}`}><span>{NEED_LABEL[n.key] ?? n.label}</span>{!compact && <span className="font-mono">{Math.round(m)} %</span>}</div>
            <div className="h-1 rounded-sm bg-bg"><i className="block h-full rounded-sm" style={{ width: `${m}%`, background: needColor(m) }} /></div>
          </div>
        );
      })}
    </div>
  );
}
