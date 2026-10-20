// Werkzeugleiste des Welteditors (AP12c): Dorf anfügen (Erweiterung der laufenden Welt) und neue Simulation mit einem erzeugten Dorf.
// Ablauf immer gleich: Wunsch einstellen → Vorschau (Trockenlauf im Backend, die Welt wird unter einem Schleier angezeigt) → Prüfbericht ansehen → Übernehmen.
import { useState } from "react";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { MAX_EACH, MAX_TOTAL, ROLES, enterEditor, leaveEditor, mixTotal, useEditorStore, wishKey, type Kind, type Lake } from "./editorStore";

const LAKES: [Lake, string][] = [["auto", "Nach Zufall"], ["east", "Im Osten (wie im Startdorf)"], ["south", "Im Süden, mit Brücke"]];
const COUNT_LABEL: Record<string, string> = { locations: "Orte", objects: "Objekte", resource_nodes: "Quellen", links: "Türen", agents: "Figuren" };
export const NEW_WORD = "neu starten";
const field = "rounded-md border border-line bg-bg px-2 py-1";

export function WorldEditor() {
  const tab = useEditorStore((s) => s.tab), fromMenu = useUiStore((s) => s.returnTo !== null);
  useRueckweg(true, EBENE.Werkstatt, leaveEditor);                                                  // Esc und „Zurück“ gehen an dieselbe Stelle: ins Menü, wenn man von dort kam
  return (
    <aside data-testid="editor-panel" className="relative flex min-h-0 flex-col overflow-y-auto border-l border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">Welt gestalten</h2>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={leaveEditor} data-testid="editor-close">{fromMenu ? "← Zurück zum Menü" : "Zurück ins Spiel"}</button>
      </header>
      <div className="flex gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Werkzeug">
        {([["extend", "Dorf anfügen"], ["new", "Neue Simulation"]] as [Kind, string][]).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`btn ${tab === k ? "on" : ""}`} onClick={() => enterEditor(k)} data-testid={`tab-${k}`}>{label}</button>
        ))}
      </div>
      <div className="grid gap-4 p-4 text-[13px]">
        <p className="text-dim" data-testid="editor-intro">
          {tab === "extend"
            ? "Der Generator legt ein weiteres Dorf an die laufende Welt an, mit einer Landstraße zum letzten Dorf. Erst die Vorschau ansehen, dann übernehmen; vorher sichert die Leitstelle den Stand."
            : "Beginnt eine neue Simulation mit einem frisch erzeugten Dorf. Der bisherige Stand wird als Spielstand gesichert, nicht gelöscht."}
        </p>
        <WishForm />
        <PreviewBox />
      </div>
    </aside>
  );
}

function WishForm() {
  const wish = useEditorStore((s) => s.wish), set = useEditorStore((s) => s.set), busy = useEditorStore((s) => s.busy), runPreview = useEditorStore((s) => s.runPreview);
  const tab = useEditorStore((s) => s.tab), mix = wish.mix, total = mixTotal(mix);
  const setCount = (role: string, n: number) => set({ mix: { ...(mix ?? {}), [role]: Math.max(0, Math.min(MAX_EACH, n)) } });
  const bad = mix !== null && (total < 1 || total > MAX_TOTAL);
  const roll = () => { set({ seed: 1 + Math.floor(Math.random() * 99999) }); setTimeout(() => void useEditorStore.getState().runPreview(), 0); };
  return (
    <form className="grid gap-3 rounded-md border border-line p-3" onSubmit={(e) => { e.preventDefault(); if (!bad) void runPreview(); }} aria-label="Wunsch an den Generator">
      <label className="grid gap-1">Seed (gleicher Seed, gleiches Dorf)
        <span className="flex gap-2">
          <input className={`${field} w-28 font-mono`} type="number" min={0} max={2000000000} value={wish.seed} aria-label="Seed" data-testid="seed"
            onChange={(e) => set({ seed: Math.max(0, Math.min(2_000_000_000, Math.floor(Number(e.target.value) || 0))) })} />
          <button type="button" className="btn" onClick={roll} disabled={busy !== null} data-testid="roll">Würfeln</button>
        </span>
      </label>
      <label className="grid gap-1">Ufer des Sees
        <select className={field} value={wish.lake} onChange={(e) => set({ lake: e.target.value as Lake })} aria-label="Ufer des Sees" data-testid="lake">
          {LAKES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <fieldset className="grid gap-1.5" aria-label="Gebäude">
        <label className="flex items-center gap-2"><input type="checkbox" checked={mix === null} onChange={(e) => set({ mix: e.target.checked ? null : { house: 3, shop: 1, workshop: 1, barn: 0, stable: 0 } })} data-testid="mix-default" />
          Gebäude nach Zufall (drei Wohnhäuser, zwei Sondergebäude)</label>
        {mix && ROLES.map(([role, label]) => (
          <div key={role} className="flex items-center gap-2 pl-6">
            <span className="w-24">{label}</span>
            <button type="button" className="btn" aria-label={`${label} weniger`} onClick={() => setCount(role, (mix[role] ?? 0) - 1)} disabled={(mix[role] ?? 0) <= 0}>−</button>
            <span className="w-5 text-center font-mono" data-testid={`mix-${role}`}>{mix[role] ?? 0}</span>
            <button type="button" className="btn" aria-label={`${label} mehr`} onClick={() => setCount(role, (mix[role] ?? 0) + 1)} disabled={(mix[role] ?? 0) >= MAX_EACH || total >= MAX_TOTAL}>＋</button>
          </div>
        ))}
        {bad && <p className="pl-6 text-warn">Ein Dorf braucht 1 bis {MAX_TOTAL} Gebäude.</p>}
      </fieldset>
      {tab === "extend" && <p className="text-[11px] text-faint">Das Dorf wächst nach Süden; die Karte rückt dabei weiter nach unten (höchstens 256 × 256 Kacheln).</p>}
      <button type="submit" className="btn on" disabled={busy !== null || bad} data-testid="preview">{busy === "preview" ? "Vorschau wird erstellt …" : "Vorschau erstellen"}</button>
    </form>
  );
}

function PreviewBox() {
  const { preview, wish, busy, error, checks, done, tab } = {
    preview: useEditorStore((s) => s.preview), wish: useEditorStore((s) => s.wish), busy: useEditorStore((s) => s.busy), error: useEditorStore((s) => s.error),
    checks: useEditorStore((s) => s.checks), done: useEditorStore((s) => s.done), tab: useEditorStore((s) => s.tab),
  };
  const [asking, setAsking] = useState(false), [word, setWord] = useState("");
  const stale = !!preview && preview.key !== wishKey(wish);
  const apply = async () => { if (await useEditorStore.getState().runApply()) { setAsking(false); setWord(""); } };
  const needWord = tab === "new";
  return (
    <section className="grid gap-3" aria-live="polite" data-testid="preview-box">
      {error && <p className="rounded-md border border-warn/60 bg-warn/10 p-2 text-warn" role="alert" data-testid="editor-error">{error}</p>}
      {done && (
        <p className="rounded-md border border-ok/60 bg-ok/10 p-2" data-testid="editor-done">
          {done.kind === "new" ? "Neue Simulation" : "Dorf"} <b>{done.village}</b> angelegt (Seed {done.seed}){done.backup ? <>; vorher gesichert als „{done.backup}“</> : null}.
        </p>
      )}
      {preview && (
        <div className="grid gap-2 rounded-md border border-line p-3" data-testid="preview-result">
          <h3 className="text-[14px] font-semibold">{preview.village}{preview.seed !== wish.seed && <span className="ml-1 text-[11px] font-normal text-dim">(Seed {preview.seed}: der gewünschte bestand die Prüfung nicht)</span>}</h3>
          <p className="text-dim">{Object.entries(preview.counts).filter(([k]) => COUNT_LABEL[k]).map(([k, n]) => `${n} ${COUNT_LABEL[k]}`).join(" · ")}</p>
          {stale && <p className="text-alex" data-testid="stale">Der Wunsch hat sich geändert. Bitte die Vorschau neu erstellen.</p>}
          {preview.kind === "extend" && <p className="text-[11px] text-faint">Die Vorschau liegt unter einem Schleier in der Weltansicht; nichts davon ist schon angewendet.</p>}
        </div>
      )}
      {(preview || checks.length > 0) && <Report checks={preview?.checks ?? checks} />}
      {preview && !asking && (
        <div className="flex gap-2">
          <button type="button" className="btn on" disabled={stale || busy !== null} onClick={() => setAsking(true)} data-testid="apply">{tab === "new" ? "Neue Simulation starten …" : "Übernehmen …"}</button>
          <button type="button" className="btn" onClick={() => useEditorStore.getState().discard()} data-testid="discard">Vorschau verwerfen</button>
        </div>
      )}
      {preview && asking && (
        <form className="grid gap-2 rounded-md border border-alex/60 p-3" onSubmit={(e) => { e.preventDefault(); if (!needWord || word.trim().toLowerCase() === NEW_WORD) void apply(); }} data-testid="confirm">
          {tab === "new" ? (
            <>
              <p>Die Welt <b>{preview.village}</b> ersetzt die laufende Simulation. Der bisherige Stand wird vorher als Spielstand „Vor der neuen Simulation“ gesichert.</p>
              <label className="flex items-center gap-2"><input type="checkbox" checked={wish.keepProfiles} onChange={(e) => useEditorStore.getState().set({ keepProfiles: e.target.checked })} data-testid="keep-profiles" />Profile und Persönlichkeit der Figuren behalten</label>
              <label className="grid gap-1">Zur Bestätigung „{NEW_WORD}“ eingeben
                <input autoFocus className={field} value={word} onChange={(e) => setWord(e.target.value)} data-testid="confirm-word" />
              </label>
            </>
          ) : (
            <p>Das Dorf <b>{preview.village}</b> wird an die Welt angefügt. Vorher wird der Stand als Spielstand „Vor dem Erweitern“ gesichert.</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setAsking(false)}>Abbrechen</button>
            <button type="submit" className="btn on" disabled={busy !== null || (needWord && word.trim().toLowerCase() !== NEW_WORD)} data-testid="apply-confirm">{busy === "apply" ? "Wird übernommen …" : tab === "new" ? "Neue Simulation starten" : "Übernehmen"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Report({ checks }: { checks: { name: string; ok: boolean; detail: string }[] }) {
  const bad = checks.filter((c) => !c.ok);
  return (
    <details className="rounded-md border border-line px-3 py-2" open={bad.length > 0} data-testid="report">
      <summary className="cursor-pointer">Prüfbericht: {checks.length - bad.length} von {checks.length} bestanden</summary>
      <ul className="mt-2 grid gap-0.5">
        {checks.map((c, i) => (
          <li key={i} className={c.ok ? "text-dim" : "text-warn"}><span aria-hidden="true">{c.ok ? "✓" : "✗"}</span> {c.name}{c.detail ? <span className="text-faint"> – {c.detail}</span> : null}</li>
        ))}
      </ul>
    </details>
  );
}
