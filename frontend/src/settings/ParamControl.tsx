import { useEffect, useState } from "react";
import { Icon } from "../lib/Icon";
import { STATUS_TEXT, shown, type Spec } from "./labels";
import type { Status } from "./paramStore";

const ICON: Record<string, [string, string]> = {
  applied: ["ok", "text-ok"],
  pending_next_decision: ["plan", "text-alex"],
  requires_model_restart: ["go", "text-alex"],
  rejected: ["no", "text-warn"],
  sending: ["go", "text-faint"],
};

export function StatusMark({ status }: { status?: Status }) {
  if (!status) return null;
  const [icon, color] = ICON[status.status] ?? ICON.applied;
  const text = status.status === "sending" ? "wird gesendet …" : status.status === "rejected" ? `abgelehnt: ${status.reason ?? ""}` : STATUS_TEXT[status.status];
  return <span data-testid="param-status" data-status={status.status} title={text} className={`inline-flex items-center gap-1 text-[11px] ${color}`}><Icon name={icon} size={12} />{status.status === "rejected" ? "abgelehnt" : status.status === "sending" ? "…" : status.status === "applied" ? "übernommen" : status.status === "pending_next_decision" ? "ab nächster Entscheidung" : "Neustart nötig"}</span>;
}

interface Props {
  spec: Spec;
  value: unknown;
  def: unknown;
  status?: Status;
  agent?: string | null;
  compact?: boolean;
  onChange: (v: unknown) => void;
  onReset: () => void;
}

/** Ein Regler passend zur Art des Parameters. Zeigt Wert, Einheit, Status der letzten Änderung und einen Knopf zum Standard. */
export function ParamControl({ spec, value, def, status, agent, compact, onChange, onReset }: Props) {
  const id = `p-${spec.key}${agent ? `-${agent}` : ""}`;
  const locked = !!spec.locked;
  const changed = JSON.stringify(value) !== JSON.stringify(def);
  return (
    <div className="py-2" data-testid={`param-${spec.key}`} data-agent={agent ?? undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px]" title={spec.help}>{spec.label}</label>
        <span className="flex items-center gap-2">
          <StatusMark status={status} />
          {changed && !locked && <button className="text-[11px] text-dim underline hover:text-text" onClick={onReset} title={`Standard: ${shown(def, spec)}`} aria-label={`${spec.label} auf Standard zurücksetzen`}>Standard</button>}
        </span>
      </div>
      <Input id={id} spec={spec} value={value} disabled={locked} onChange={onChange} />
      {!compact && <p className="mt-0.5 text-[11px] leading-snug text-faint">{spec.help}{" "}<span className="text-dim">({spec.effect_text})</span></p>}
      {spec.warn && <p className="mt-0.5 text-[11px] text-alex">{spec.warn}</p>}
      {locked && <p className="mt-0.5 text-[11px] text-warn">{spec.locked}</p>}
      {status?.status === "rejected" && status.reason && <p role="alert" className="mt-0.5 text-[11px] text-warn">{status.reason}</p>}
    </div>
  );
}

function Input({ id, spec, value, disabled, onChange }: { id: string; spec: Spec; value: unknown; disabled: boolean; onChange: (v: unknown) => void }) {
  if (spec.type === "bool") {
    return <label className="mt-1 flex cursor-pointer items-center gap-2 text-[13px]"><input id={id} type="checkbox" className="size-4 accent-[#e8ac5c]" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />{value ? "an" : "aus"}</label>;
  }
  if (spec.type === "enum") {
    return <select id={id} className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1 text-[13px]" value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {!spec.options.some((o) => o[0] === value) && <option value={String(value)}>{String(value)}</option>}
      {spec.options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
    </select>;
  }
  if (spec.type === "text") return <TextInput id={id} spec={spec} value={String(value ?? "")} disabled={disabled} onChange={onChange} />;
  const n = Number(value);
  return (
    <div className="mt-1 flex items-center gap-2">
      <input id={id} type="range" className="min-w-0 flex-1 accent-[#e8ac5c]" min={spec.min ?? 0} max={spec.max ?? 100} step={spec.step ?? 1} value={n} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={shown(n, spec)} />
      <span className="w-20 shrink-0 text-right font-mono text-xs" data-testid="param-value">{shown(n, spec)}</span>
    </div>
  );
}

/** Text wird erst nach einer kurzen Pause oder beim Verlassen gesendet (nicht bei jedem Buchstaben). */
function TextInput({ id, spec, value, disabled, onChange }: { id: string; spec: Spec; value: string; disabled: boolean; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 700);
    return () => clearTimeout(t);
  }, [text]);                                                         // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (spec.max_len ?? 0) > 200 ? 3 : 1;
  const common = { id, value: text, disabled, className: "mt-1 w-full rounded-md border border-line bg-bg px-2 py-1 text-[13px]", maxLength: spec.max_len ?? undefined, onBlur: () => text !== value && onChange(text) };
  return rows > 1
    ? <textarea {...common} rows={rows} onChange={(e) => setText(e.target.value)} />
    : <input {...common} onChange={(e) => setText(e.target.value)} />;
}
