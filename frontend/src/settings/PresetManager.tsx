import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../net/api";
import { EBENE, useRueckweg } from "../ui/zurueck";
import type { PresetBrief, PresetPreview } from "../types/generated";
import { labelOf, shown, specOf } from "./labels";
import { useParamStore } from "./paramStore";
import { Abschnitt, Zeile } from "./Zeile";

/** Einstellungen › Voreinstellungen: mitgelieferte und eigene Sätze laden (mit Vorschau der Änderungen), speichern, duplizieren, umbenennen, löschen. */
export function PresetManager() {
  const refresh = useParamStore((s) => s.refresh);
  const [list, setList] = useState<PresetBrief[]>([]);
  const [preview, setPreview] = useState<PresetPreview | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => api.presets().then(setList).catch(() => setMessage({ text: "Voreinstellungen nicht erreichbar", bad: true })), []);
  useEffect(() => { void load(); }, [load]);
  useRueckweg(!!preview, EBENE.Dialog, () => setPreview(null));                  // Esc heißt Abbrechen

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMessage({ text: ok, bad: false });
      await load();
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.detail : "Backend nicht erreichbar", bad: true });
    }
  };
  const show = (id: string) => api.presetPreview(id).then(setPreview).catch((e) => setMessage({ text: e instanceof ApiError ? e.detail : "Vorschau nicht möglich", bad: true }));
  const apply = (id: string, label: string) => act(async () => {
    const r = await api.loadPreset(id);
    useParamStore.getState().applyResults(r.results, r.values);
    const rejected = r.results.filter((x) => x.status === "rejected");
    setPreview(null);
    if (rejected.length) throw new ApiError(422, `${rejected.length} Werte abgelehnt: ${rejected.map((x) => x.reason).join("; ")}`);
    await refresh();
  }, `„${label}“ geladen.`);

  return (
    <div data-testid="presets">
      {message && <p role="status" className={`mt-3 text-[13px] ${message.bad ? "text-warn" : "text-ok"}`}>{message.text}</p>}
      <Abschnitt titel="Gespeichert">
        {list.map((p) => (
          <Zeile key={p.id} testid={`preset-${p.id}`} hilfe={`${p.description ? `${p.description} · ` : ""}${p.count} Werte`}
            name={renaming?.id === p.id ? (
              <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); void act(() => api.renamePreset(p.id, renaming.name), "Umbenannt."); setRenaming(null); }}>
                <input autoFocus aria-label="Neuer Name" className="einst-feld !py-0.5" value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} />
                <button className="btn" type="submit">OK</button>
              </form>
            ) : <><b>{p.name}</b><span className="text-[11px] text-dim">{p.builtin ? "mitgeliefert" : "eigen"}</span></>}>
            {p.builtin
              ? <button className="btn leise" onClick={() => void act(() => api.duplicatePreset(p.id), "Dupliziert.")}>Duplizieren</button>
              : deleting === p.id
                ? <><button className="btn on" onClick={() => { setDeleting(null); void act(() => api.deletePreset(p.id), "Gelöscht."); }}>Wirklich löschen</button><button className="btn leise" onClick={() => setDeleting(null)}>Abbrechen</button></>
                : <><button className="btn leise" onClick={() => setRenaming({ id: p.id, name: p.name })}>Umbenennen</button><button className="btn leise" onClick={() => setDeleting(p.id)}>Löschen</button></>}
            {deleting !== p.id && <button className="btn" onClick={() => void show(p.id)}>Laden…</button>}
          </Zeile>
        ))}
      </Abschnitt>

      <Abschnitt titel="Aktuellen Stand speichern">
        <form className="einst-zeile" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api.savePreset(name, "", null); setName(""); }, "Gespeichert."); }}>
          <input className="einst-feld" placeholder="Name, z. B. „Winter im Dorf“" aria-label="Name des Presets" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <div className="einst-regler"><button className="btn gold" type="submit" disabled={!name.trim()}>Speichern</button><span className="einst-zurueck leer" aria-hidden="true">↺</span></div>
        </form>
      </Abschnitt>

      {preview && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Voreinstellung laden">
          <div className="glas max-h-[80vh] w-[34rem] max-w-[92vw] overflow-auto p-5">
            <h3 className="text-lg font-semibold">„{preview.preset.name}“ laden?</h3>
            {preview.diff.length === 0 ? <p className="mt-2 text-sm text-dim">Alle Werte entsprechen schon dieser Voreinstellung.</p> : (
              <>
                <p className="mt-2 text-sm text-dim">{preview.diff.length} Werte ändern sich:</p>
                <table className="mt-2 w-full text-[13px]" data-testid="preset-diff">
                  <thead><tr className="text-left text-[11px] text-faint"><th>Einstellung</th><th>jetzt</th><th>danach</th></tr></thead>
                  <tbody>{preview.diff.map((d, i) => (
                    <tr key={i} className="border-t border-line/50"><td className="py-1">{labelOf(d.key) || d.label}{d.agent ? ` (${d.agent})` : ""}</td><td className="font-mono text-xs text-dim">{shown(d.old, specOf(d.key))}</td><td className="font-mono text-xs text-alex">{shown(d.new, specOf(d.key))}</td></tr>
                  ))}</tbody>
                </table>
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setPreview(null)}>Abbrechen</button>
              <button className="btn gold" onClick={() => void apply(preview.preset.id, preview.preset.name)}>Laden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
