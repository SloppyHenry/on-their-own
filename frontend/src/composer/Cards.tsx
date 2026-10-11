import { useState } from "react";
import { useUiStore } from "../store/uiStore";
import type { InjectProposal } from "../types/generated";
import { useComposer } from "./composerStore";

/** Vorschau komplexer Ereignisse: Klartext der geplanten Änderungen, Ausführen erst nach Bestätigung. */
export function PreviewCard({ p }: { p: InjectProposal }) {
  const confirm = useComposer((s) => s.confirm);
  const cancel = useComposer((s) => s.cancel);
  const busy = useComposer((s) => s.phase === "executing");
  return (
    <section className="rounded-lg border border-plan bg-panel p-3 shadow-xl" role="dialog" aria-label="Vorschau" data-testid="preview-card">
      <h3 className="text-[13px] font-semibold">Das würde passieren {p.directive && <span className="ml-1 rounded bg-warn/20 px-1.5 text-[11px] text-warn">Eingriff</span>}</h3>
      <p className="mt-0.5 text-[12px] text-dim">„{p.text}“</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">{p.preview.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn" onClick={cancel} disabled={busy}>Abbrechen</button>
        <button className="btn on" onClick={() => void confirm()} disabled={busy} data-testid="confirm-event">Ausführen</button>
      </div>
    </section>
  );
}

/** Rückfrage bei Mehrdeutigkeit: Auswahl oder Freitext, danach prüft das Backend erneut. */
export function ClarifyCard({ p }: { p: InjectProposal }) {
  const answer = useComposer((s) => s.answer);
  const cancel = useComposer((s) => s.cancel);
  const [free, setFree] = useState("");
  const c = p.clarification!;
  return (
    <section className="rounded-lg border border-alex bg-panel p-3 shadow-xl" role="dialog" aria-label="Rückfrage" data-testid="clarify-card">
      <h3 className="text-[13px] font-semibold">Rückfrage</h3>
      <p className="mt-1 text-[13px]" data-testid="clarify-question">{c.question}</p>
      {c.options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{c.options.map((o) => <button key={String(o.value)} className="btn" onClick={() => void answer(o.value)}>{o.label}</button>)}</div>
      )}
      {(c.free_text || c.options.length === 0) && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (free.trim()) void answer(free.trim()); }}>
          <input autoFocus className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder="Antwort …" aria-label="Antwort auf die Rückfrage" value={free} onChange={(e) => setFree(e.target.value)} />
          <button className="btn on" type="submit" disabled={!free.trim()}>Antworten</button>
        </form>
      )}
      <div className="mt-2 text-right"><button className="btn" onClick={cancel}>Verwerfen</button></div>
    </section>
  );
}

const STATUS: Record<string, [string, string]> = {
  executed: ["ausgeführt", "text-ok"], rejected: ["abgelehnt", "text-warn"], needs_clarification: ["Rückfrage offen", "text-alex"],
  needs_confirmation: ["Vorschau offen", "text-alex"], ready: ["bereit", "text-dim"], cancelled: ["verworfen", "text-faint"],
};

/** Verlauf der eigenen Eingaben mit Status; ein Eintrag springt zu den erzeugten Protokolleinträgen. */
export function InjectHistory({ items, onReuse }: { items: InjectProposal[]; onReuse: (t: string) => void }) {
  const select = useUiStore((s) => s.select);
  return (
    <section className="max-h-72 overflow-auto rounded-lg border border-line bg-panel p-2 shadow-xl" aria-label="Verlauf der Eingaben" data-testid="inject-history">
      {items.length === 0 && <p className="p-2 text-dim">Noch keine Eingaben.</p>}
      <ul>{items.map((p) => {
        const [label, color] = STATUS[p.status] ?? [p.status, "text-dim"];
        return (
          <li key={p.id} className="flex items-baseline gap-2 border-b border-line/40 px-1 py-1.5 text-[13px]">
            <span className={`w-24 shrink-0 text-[11px] ${color}`}>{label}</span>
            <span className="min-w-0 flex-1 truncate" title={p.reason || p.text}>{p.text}{p.reason && <span className="text-warn"> – {p.reason}</span>}</span>
            {p.event_seqs.length > 0 && <button className="text-[11px] text-plan underline" onClick={() => select({ kind: "event", id: String(p.event_seqs[0]) })}>Protokoll</button>}
            <button className="text-[11px] text-dim underline" onClick={() => onReuse(p.text)}>erneut</button>
          </li>
        );
      })}</ul>
    </section>
  );
}
