import { api } from "../net/api";
import type { LlmStatusOut } from "../types/generated";
import { PHASE_TEXT, bytesText, etaText, fraction, speedText } from "./format";
import { useModelStore } from "./modelStore";

/** Laufende oder gerade beendete Übertragung (Modell laden oder llama.cpp einrichten): Balken, Geschwindigkeit, Abbrechen. */
export function TransferLeiste({ t }: { t: NonNullable<LlmStatusOut["transfer"]> }) {
  const run = useModelStore((s) => s.run);
  const active = t.phase === "preparing" || t.phase === "downloading" || t.phase === "verifying" || t.phase === "unpacking";
  const pct = Math.round(fraction(t) * 100);
  const tone = t.phase === "failed" ? "text-warn" : t.phase === "done" ? "text-ok" : "text-dim";
  const detail = t.phase === "downloading" ? [t.total ? `${bytesText(t.done)} von ${bytesText(t.total)}` : bytesText(t.done), speedText(t.speed_bps), etaText(t.eta_s)].filter(Boolean).join(" · ")
    : t.phase === "verifying" ? `${pct} %` : "";
  return (
    <div data-testid="transfer" data-phase={t.phase} className="mb-3 grid gap-1.5 rounded-xl border border-alex/60 bg-black/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[14px]">{t.kind === "runtime" ? "Laufzeit" : "Modell"}: {t.label}</b>
        <span className={`text-[12px] ${tone}`} data-testid="transfer-phase">{PHASE_TEXT[t.phase]}</span>
        <span className="flex-1" />
        {active ? <button className="btn" data-testid="transfer-cancel" onClick={() => void run(api.cancelTransfer)}>Abbrechen</button>
          : <button className="btn" data-testid="transfer-dismiss" onClick={() => void run(api.cancelTransfer)}>Ausblenden</button>}
      </div>
      {(active || t.phase === "done") && (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.phase === "done" ? 100 : pct} className="h-2 overflow-hidden rounded bg-line">
          <i className="block h-full bg-alex transition-[width]" style={{ width: `${t.phase === "done" ? 100 : t.total ? pct : 5}%` }} />
        </div>
      )}
      {detail && <small className="text-dim" data-testid="transfer-detail">{detail}</small>}
      {t.error && <p role="alert" className="text-[13px] text-warn">{t.error}</p>}
    </div>
  );
}

/** Probelauf: zehn Anfragen mit Zähler; „Modell wird geladen“, solange der Server startet. */
export function ProbeLeiste({ p }: { p: NonNullable<LlmStatusOut["probe"]> }) {
  const run = useModelStore((s) => s.run);
  if (p.phase === "done" || p.phase === "cancelled") return null;
  if (p.phase === "failed") return <p role="alert" data-testid="probe-fehler" className="mb-3 text-[13px] text-warn">Der Probelauf für {p.model_id} ist gescheitert: {p.error}</p>;
  return (
    <div data-testid="probe" data-phase={p.phase} className="mb-3 grid gap-1.5 rounded-xl border border-plan/60 bg-black/20 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <b className="text-[14px]">Probelauf: {p.model_id}</b>
        <span className="text-[12px] text-dim" data-testid="probe-text">{p.phase === "starting" ? "Modell wird geladen …" : `${p.step} von ${p.n} Anfragen …`}</span>
        <span className="flex-1" />
        <button className="btn" data-testid="probe-cancel" onClick={() => void run(api.cancelProbe)}>Überspringen</button>
      </div>
      <div className="h-2 overflow-hidden rounded bg-line"><i className="block h-full bg-plan transition-[width]" style={{ width: `${p.phase === "starting" ? 3 : (p.step / Math.max(1, p.n)) * 100}%` }} /></div>
    </div>
  );
}
