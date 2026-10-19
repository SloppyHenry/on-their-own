// „Empfohlen für diesen Rechner“ und „Alle Modelle suchen“ (Live-Liste von Hugging Face und kuratierte Liste, nach Passung geordnet).
import { useEffect, useState } from "react";
import type { LlmStatusOut } from "../types/generated";
import { fileId } from "./format";
import { Karte } from "./Karte";
import { KatalogZeile } from "./KatalogZeile";
import { DEFAULT_QUERY, useModelStore, type CatalogQuery } from "./modelStore";

const SOURCE: Record<string, string> = { live: "Hugging Face, frisch geladen", cache: "Hugging Face, aus dem Zwischenspeicher", stale: "Hugging Face, ältere Fassung (nicht erreichbar)", curated: "nur unsere kuratierte Liste (kein Netz)" };
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

function Stand() {
  const c = useModelStore((s) => s.catalog);
  if (!c) return null;
  return <span data-testid="katalog-stand">Liste: {SOURCE[c.source]}{c.fetched_at ? `, Stand ${time(c.fetched_at)}` : ""}</span>;
}

export function EmpfohlenKarte({ status }: { status: LlmStatusOut }) {
  const c = useModelStore((s) => s.catalog), busy = useModelStore((s) => s.catalogBusy), err = useModelStore((s) => s.catalogError);
  const rec = (c?.recommended ?? []).filter((i) => !status.installed.some((m) => m.id === fileId(i.file.file)));
  return (
    <Karte titel="Empfohlen für diesen Rechner" testid="empfohlen" hinweis={<Stand />}>
      {err && <p role="alert" className="text-[13px] text-warn" data-testid="katalog-fehler">Die Modellliste ließ sich nicht laden: {err}</p>}
      {!c && !err && <p className="text-dim">{busy ? "Liste wird geladen …" : ""}</p>}
      {c?.note && <p className="mb-2 text-[12px] text-warn" data-testid="katalog-hinweis">{c.note}</p>}
      <div className="grid gap-2">{rec.map((i) => <KatalogZeile key={i.repo} item={i} status={status} best />)}</div>
      {c && rec.length === 0 && <p className="text-[13px] text-dim">{c.recommended.length ? "Alle empfohlenen Modelle sind schon installiert." : "Für diesen Rechner passt aus der Liste nichts. Unter „Alle Modelle suchen“ lässt sich ohne den Filter „nur passende“ stöbern."}</p>}
      <p className="mt-2 text-[12px] text-dim">Die Liste kommt live von Hugging Face und aus unseren geprüften Empfehlungen. Die Zeit je Entscheidung ist eine <b>Schätzung</b>; erst die Messung nach dem Laden sagt, ob das Modell hier taugt.</p>
    </Karte>
  );
}

export function SucheKarte({ status }: { status: LlmStatusOut }) {
  const load = useModelStore((s) => s.loadCatalog), c = useModelStore((s) => s.catalog), busy = useModelStore((s) => s.catalogBusy);
  const [q, setQ] = useState<CatalogQuery>(DEFAULT_QUERY);
  useEffect(() => {
    const t = setTimeout(() => void load(q), q.q ? 350 : 0);              // beim Tippen kurz warten, sonst sofort
    return () => clearTimeout(t);
  }, [q, load]);
  const hidden = c ? Object.entries(c.hidden).filter(([, n]) => n > 0) : [];
  return (
    <Karte titel="Alle Modelle suchen" testid="suche">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input type="search" aria-label="Suche" data-testid="suche-feld" placeholder="z. B. qwen, gemma, llama …" className="min-w-[180px] flex-1 rounded-md border border-line bg-bg px-2 py-1 text-[13px]" value={q.q} onChange={(e) => setQ({ ...q, q: e.target.value })} />
        <label className="flex items-center gap-1.5 text-[13px] text-dim"><input type="checkbox" data-testid="nur-passende" checked={q.onlyFit} onChange={(e) => setQ({ ...q, onlyFit: e.target.checked })} />nur passende</label>
        <label className="flex items-center gap-1.5 text-[13px] text-dim" title="Sonst nur bekannte Herausgeber (Qwen, unsloth, bartowski, google …)"><input type="checkbox" data-testid="alle-herausgeber" checked={q.allPublishers} onChange={(e) => setQ({ ...q, allPublishers: e.target.checked })} />alle Herausgeber</label>
        <button className="btn" data-testid="liste-aktualisieren" disabled={busy} onClick={() => void load(q, true)}>Liste aktualisieren</button>
      </div>
      <div className="grid gap-2" data-testid="suche-treffer" aria-busy={busy}>
        {(c?.items ?? []).map((i) => <KatalogZeile key={i.repo} item={i} status={status} />)}
      </div>
      {c && c.items.length === 0 && <p className="text-[13px] text-dim">Keine Treffer.</p>}
      {c && c.total > c.items.length && <p className="mt-2 text-[12px] text-dim">{c.items.length} von {c.total} Treffern; die Suche eingrenzen zeigt andere.</p>}
      {hidden.length > 0 && <p className="mt-1 text-[12px] text-faint" data-testid="ausgeblendet">Ausgeblendet: {hidden.map(([k, n]) => `${n} ${k}`).join(", ")}.</p>}
    </Karte>
  );
}
