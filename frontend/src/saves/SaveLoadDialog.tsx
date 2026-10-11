import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, exportUrl } from "../net/api";
import { useUiStore } from "../store/uiStore";
import type { SaveOut } from "../types/generated";

const KIND: Record<string, [string, string]> = { manual: ["Manuell", "text-alex"], auto: ["Auto", "text-dim"], backup: ["Sicherung", "text-plan"], import: ["Import", "text-world"] };
const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const when = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Spielstände: speichern (Überschreiben nur mit ausdrücklicher Bestätigung), laden (sichert vorher), löschen, exportieren, importieren. Jeder destruktive Schritt fragt nach. */
export function SaveLoadDialog() {
  const close = useUiStore((s) => s.setSavesOpen);
  const [items, setItems] = useState<SaveOut[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [clash, setClash] = useState(false);
  const [asking, setAsking] = useState<{ kind: "load" | "delete"; id: string } | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => api.saves().then(setItems).catch(() => setMsg({ text: "Spielstände nicht erreichbar", bad: true })), []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setMsg({ text: ok, bad: false });
      await reload();
    } catch (e) {
      const text = e instanceof ApiError ? e.detail : "Backend nicht erreichbar";
      setMsg({ text, bad: true });
      if (e instanceof ApiError && e.status === 409 && /gibt es schon/.test(text)) setClash(true);
    } finally {
      setBusy(false);
    }
  };
  const save = (overwrite: boolean) => act(async () => { await api.save(name, desc, overwrite); setClash(false); setName(""); setDesc(""); }, overwrite ? "Überschrieben." : "Gespeichert.");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Spielstände" data-testid="saves-dialog">
      <div className="flex max-h-[88vh] w-[56rem] max-w-[95vw] flex-col rounded-lg border border-line bg-panel">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">Spielstände</h2>
          <button className="btn" onClick={() => close(false)} aria-label="Schließen">✕</button>
        </header>
        <div className="overflow-auto px-5 py-4">
          <form className="rounded-md border border-line p-3" onSubmit={(e) => { e.preventDefault(); setClash(false); void save(false); }}>
            <h3 className="sub !mt-0">Aktuellen Stand speichern</h3>
            <div className="flex gap-2">
              <input className="w-60 rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder="Name" aria-label="Name des Spielstands" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setClash(false); }} />
              <input className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder="Beschreibung (optional)" aria-label="Beschreibung" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
              <button className="btn on" type="submit" disabled={busy || !name.trim()} data-testid="save-now">Speichern</button>
            </div>
            {clash && (
              <div className="mt-2 rounded-md border border-warn p-2 text-[13px]" role="alert" data-testid="overwrite-ask">
                Einen Spielstand „{name}“ gibt es schon. Wähle einen neuen Namen oder ersetze ihn ausdrücklich.
                <div className="mt-1.5 flex gap-2"><button type="button" className="btn" onClick={() => { setClash(false); document.querySelector<HTMLInputElement>('[aria-label="Name des Spielstands"]')?.focus(); }}>Neuen Namen wählen</button>
                  <button type="button" className="btn on" onClick={() => void save(true)} data-testid="overwrite-yes">Überschreiben</button></div>
              </div>
            )}
          </form>

          {msg && <p role="status" className={`mt-3 text-[13px] ${msg.bad ? "text-warn" : "text-ok"}`} data-testid="saves-message">{msg.text}</p>}

          <div className="mt-4 flex items-center justify-between">
            <h3 className="sub !m-0">Gespeicherte Stände ({items.length})</h3>
            <span><input ref={file} type="file" accept=".zip,application/zip" className="hidden" data-testid="import-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void act(() => api.importSave(f), "Importiert (als neuer Stand)."); e.target.value = ""; }} />
              <button className="btn" onClick={() => file.current?.click()} disabled={busy}>Importieren …</button></span>
          </div>
          <ul className="mt-2" data-testid="saves-list">
            {items.length === 0 && <li className="p-2 text-dim">Noch keine Spielstände.</li>}
            {items.map((s) => {
              const [label, color] = KIND[s.kind] ?? [s.kind, "text-dim"];
              return (
                <li key={s.id} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 border-b border-line/50 py-2 text-[13px]" data-testid={`save-${s.id}`}>
                  <span className={`text-[11px] ${color}`}>{label}</span>
                  <span className="min-w-0"><b className="block truncate" title={s.name}>{s.name}</b>
                    <span className="text-[11px] text-dim">{s.sim_label} · {when(s.created)} · {size(s.size)}{s.model ? ` · ${s.model}` : ""}{s.description ? ` · ${s.description}` : ""}</span></span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {asking?.id === s.id ? (
                      <>
                        <span className="self-center text-[12px] text-warn">{asking.kind === "load" ? "Der aktuelle Stand wird vorher gesichert." : "Endgültig löschen?"}</span>
                        <button className="btn on" disabled={busy} data-testid="confirm-ask" onClick={() => { const a = asking; setAsking(null); void act(() => (a.kind === "load" ? api.loadSave(s.id) : api.deleteSave(s.id)), a.kind === "load" ? "Geladen." : "Gelöscht."); }}>{asking.kind === "load" ? "Laden" : "Löschen"}</button>
                        <button className="btn" onClick={() => setAsking(null)}>Abbrechen</button>
                      </>
                    ) : (
                      <>
                        <button className="btn" disabled={busy || !s.available} onClick={() => setAsking({ kind: "load", id: s.id })}>Laden</button>
                        <a className="btn" href={exportUrl(s.id)} download>Exportieren</a>
                        <button className="btn" disabled={busy} onClick={() => setAsking({ kind: "delete", id: s.id })}>Löschen</button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
