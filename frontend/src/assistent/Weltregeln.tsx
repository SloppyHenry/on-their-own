// Weltregeln als Text (AP17b): ein Satz geht durch dieselbe Ereigniseingabe wie im Spiel (AP08), mit Vorschau und Rückfragen, auf der Welt des Entwurfs.
// Erst die ausdrückliche Übernahme macht daraus ein Startereignis; es läuft gleich nach dem Anlegen und erscheint den Bewohnern als natürlicher Vorgang.
import { useState } from "react";
import { ApiError, api } from "../net/api";
import type { InjectProposal } from "../types/generated";
import { requestKey, useAssistent } from "./assistentStore";
import { toRequest } from "./entwurf";

export function Weltregeln() {
  const draft = useAssistent((s) => s.draft), setRules = useAssistent((s) => s.setRules);
  const [text, setText] = useState(""), [free, setFree] = useState("");
  const [p, setP] = useState<InjectProposal | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const events = draft.rules.events;
  const run = async (body: { text?: string; answer_to?: string; answer?: string | number }) => {
    setBusy(true); setError(null);
    const key = requestKey(draft);
    try {
      const out = await api.newSimRules({ draft: { ...toRequest(draft), rules: { ...toRequest(draft).rules, events: [] } }, ...body });
      if (requestKey(useAssistent.getState().draft) === key) setP(out);
    } catch (e) { setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"); }
    finally { setBusy(false); }
  };
  const accept = () => {
    if (!p || !["ready", "needs_confirmation"].includes(p.status)) return;
    setRules({ events: [...events, { text: p.text, source: p.source as "rule" | "llm", ops: p.ops, preview: p.preview }] });
    setP(null); setText(""); setFree("");
  };
  const c = p?.clarification;
  return (
    <section className="mb-3 rounded-xl border border-line bg-black/15 p-3" data-testid="weltregeln">
      <h3 className="sub mt-0">Weltregeln als Text <span className="normal-case tracking-normal text-faint">(werden zu Startereignissen)</span></h3>
      {events.length > 0 && (
        <ul className="mb-2 grid gap-1" data-testid="startereignisse">{events.map((e, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border border-ok/60 px-2.5 py-1 text-[13px]"><span className="flex-1"><b>„{e.text}“</b><span className="block text-xs text-dim">{e.preview.join(" · ")}</span></span>
            <button type="button" className="btn px-2 py-0" aria-label={`Startereignis ${i + 1} entfernen`} data-testid={`startereignis-weg-${i}`} onClick={() => setRules({ events: events.filter((_, j) => j !== i) })}>✕</button></li>))}
        </ul>
      )}
      <textarea rows={2} className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text" value={text} maxLength={1000} data-testid="regeltext" placeholder="z. B. Es herrscht Dürre. Ein Fremder zieht in der ersten Woche ins Dorf." onChange={(e) => { setText(e.target.value); setP(null); }} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={busy || !text.trim() || events.length >= 5} data-testid="regel-vorschau" onClick={() => void run({ text })}>{busy ? "Prüfe …" : "Vorschau erstellen"}</button>
        <small className="text-dim">Dieselbe Ereigniseingabe wie im Spiel (AP08): Vorschau und Rückfragen; ausgeführt wird erst beim Start (höchstens 5 Startereignisse).</small>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-warn" data-testid="regel-fehler">{error}</p>}
      {p && (
        <div className="mt-2 rounded-lg border border-dashed border-plan px-3 py-2 text-[13px]" data-testid="regel-ergebnis" data-status={p.status}>
          {p.status === "rejected" && <p className="text-warn" data-testid="regel-abgelehnt">Abgelehnt: {p.reason}</p>}
          {c && (
            <div data-testid="regel-rueckfrage"><b>Rückfrage:</b> {c.question}
              {c.options.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{c.options.map((o) => <button key={String(o.value)} type="button" className="btn" onClick={() => void run({ answer_to: p.id, answer: o.value })}>{o.label}</button>)}</div>}
              {(c.free_text || c.options.length === 0) && <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (free.trim()) { void run({ answer_to: p.id, answer: free.trim() }); setFree(""); } }}>
                <input className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1" value={free} aria-label="Antwort auf die Rückfrage" onChange={(e) => setFree(e.target.value)} /><button className="btn on" type="submit" disabled={!free.trim()}>Antworten</button></form>}
            </div>
          )}
          {["ready", "needs_confirmation"].includes(p.status) && (
            <div data-testid="regel-vorschau-ergebnis"><b>Das würde zum Start passieren:</b>
              <ul className="ml-5 mt-1 list-disc">{p.preview.map((l, i) => <li key={i}>{l}</li>)}</ul>
              {p.source === "llm" && <small className="block text-dim">Vom Sprachmodell gedeutet: bitte genau prüfen.</small>}
              <small className="block text-dim">Die Bewohner erleben das als natürlichen Vorgang, nicht als Regel.</small>
              <button type="button" className="btn on mt-2" data-testid="regel-uebernehmen" onClick={accept}>Als Startereignis übernehmen</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
