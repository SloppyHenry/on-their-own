import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../lib/Icon";
import { useUiStore } from "../store/uiStore";
import { STATUS_TEXT, shown, type Spec } from "./labels";
import type { Status } from "./paramStore";
import { Zeile } from "./Zeile";

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
  return <span data-testid="param-status" data-status={status.status} title={text} className={`inline-flex items-center gap-1 text-[11px] font-normal ${color}`}><Icon name={icon} size={12} />{status.status === "rejected" ? "abgelehnt" : status.status === "sending" ? "…" : status.status === "applied" ? "übernommen" : status.status === "pending_next_decision" ? "ab nächster Entscheidung" : "Neustart nötig"}</span>;
}

export type Als = "tilt" | "select" | "area";

interface Props {
  spec: Spec;
  value: unknown;
  def: unknown;
  status?: Status;
  agent?: string | null;
  /** Darstellung: `tilt` (Mitte = unverändert), `select` statt Knöpfen, `area` (mehrzeilig, über die ganze Breite). */
  als?: Als;
  /** Anzeige für den Wert 0 (z. B. „aus“). */
  null?: string;
  /** Erklärung nur als Tooltip (Unterseite eines Bewohners). */
  knapp?: boolean;
  ort?: ReactNode;
  onChange: (v: unknown) => void;
  onReset: () => void;
}

/** Wert in der Zeile: Einheit, „aus“ für 0 oder bei `tilt` der Abstand zur Mitte. */
export function wertText(spec: Spec, v: unknown, als?: Als, nullText?: string): string {
  const n = Number(v);
  if (als === "tilt") { const d = n - 50; return d === 0 ? "Mitte" : d > 0 ? `+${d}` : `−${-d}`; }
  if (nullText && n === 0) return nullText;
  return shown(v, spec);
}

/** Ein Regler als Zeile passend zur Art des Parameters. Zeigt Wert, Status der letzten Änderung und ↺ zum Standard. */
export function ParamControl({ spec, value, def, status, agent, als, null: nullText, knapp, ort, onChange, onReset }: Props) {
  const id = `p-${spec.key}${agent ? `-${agent}` : ""}`;
  const locked = !!spec.locked;
  const changed = !locked && JSON.stringify(value) !== JSON.stringify(def);
  const breit = als === "area" || (spec.type === "text" && (spec.max_len ?? 0) > 200);
  const unter = (
    <>
      {spec.warn && <p className="mt-0.5 text-[11px] text-alex">{spec.warn}</p>}
      {status?.status === "rejected" && status.reason && <p role="alert" className="mt-0.5 text-[11px] text-warn">{status.reason}</p>}
    </>
  );
  return (
    <Zeile name={<>{spec.label}<StatusMark status={status} /></>} hilfe={knapp ? undefined : spec.help} fuer={locked ? undefined : id} geaendert={changed} ort={ort} unter={unter} breit={breit}
      zeile={agent ? `${spec.key}|${agent}` : spec.key} testid={`param-${spec.key}`} agent={agent ?? undefined}
      aufStandard={{ label: `${spec.label} auf Standard zurücksetzen`, title: `Standard: ${wertText(spec, def, als, nullText)}`, onClick: onReset }}>
      {locked ? <Gesperrt spec={spec} value={value} /> : <Eingabe id={id} spec={spec} value={value} als={als} nullText={nullText} breit={breit} onChange={onChange} />}
    </Zeile>
  );
}

/** Im Betrieb nicht änderbar (das Modell): Wert und der Weg dorthin, wo man es ändern kann. */
function Gesperrt({ spec, value }: { spec: Spec; value: unknown }) {
  const openMenuAt = useUiStore((s) => s.openMenuAt), menu = useUiStore((s) => s.menu);
  return (
    <span className="text-right text-xs text-dim" title={spec.locked ?? undefined}>
      <b className="font-mono text-xs text-text" data-testid="param-value">{String(value ?? "–")}</b><br />
      <button type="button" className="cursor-pointer text-[#ffd36e] hover:underline" onClick={() => openMenuAt({ menu: menu ?? "pause", sel: "newsim", sub: null })}>Neue Simulation mit anderem Modell ›</button>
    </span>
  );
}

function Eingabe({ id, spec, value, als, nullText, breit, onChange }: { id: string; spec: Spec; value: unknown; als?: Als; nullText?: string; breit: boolean; onChange: (v: unknown) => void }) {
  if (spec.type === "bool") return <input id={id} type="checkbox" role="switch" className="schalter" checked={value === true} aria-checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
  if (spec.type === "enum") {
    if (als === "select" || spec.options.length > 5) {
      return <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {!spec.options.some((o) => o[0] === value) && <option value={String(value)}>{String(value)}</option>}
        {spec.options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
      </select>;
    }
    return (
      <span className="segment" role="group" aria-label={spec.label} id={id}>
        {spec.options.map(([v, l]) => <button key={v} type="button" className={value === v ? "on" : ""} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
      </span>
    );
  }
  if (spec.type === "text") return <TextInput id={id} spec={spec} value={String(value ?? "")} mehrzeilig={breit} onChange={onChange} />;
  const n = Number(value);
  const range = <input id={id} type="range" min={spec.min ?? 0} max={spec.max ?? 100} step={spec.step ?? 1} value={n} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={wertText(spec, n, als, nullText)} />;
  return (
    <>
      {als === "tilt" ? <span className="einst-tilt">{range}<span className="einst-tiltlab" aria-hidden="true"><span>weniger</span><span>mehr</span></span></span> : range}
      <span className="einst-wert" data-testid="param-value">{wertText(spec, n, als, nullText)}</span>
    </>
  );
}

/** Text wird erst nach einer kurzen Pause oder beim Verlassen gesendet (nicht bei jedem Buchstaben). */
function TextInput({ id, spec, value, mehrzeilig, onChange }: { id: string; spec: Spec; value: string; mehrzeilig: boolean; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 700);
    return () => clearTimeout(t);
  }, [text]);                                                         // eslint-disable-line react-hooks/exhaustive-deps
  const common = { id, value: text, maxLength: spec.max_len ?? undefined, onBlur: () => text !== value && onChange(text) };
  return mehrzeilig
    ? <textarea {...common} rows={3} onChange={(e) => setText(e.target.value)} />
    : <input type="text" {...common} onChange={(e) => setText(e.target.value)} />;
}
