import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../net/api";
import type { PresetBrief, PresetPreview } from "../types/generated";
import { shown, specOf } from "./labels";
import { useParamStore } from "./paramStore";

/** Mitgelieferte und eigene Presets: ansehen (mit Vorschau der Änderungen), laden, speichern, duplizieren, umbenennen, löschen. */
export function PresetManager() {
  const groups = useParamStore((s) => s.groups);
  const refresh = useParamStore((s) => s.refresh);
  const [list, setList] = useState<PresetBrief[]>([]);
  const [preview, setPreview] = useState<PresetPreview | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => api.presets().then(setList).catch(() => setMessage({ text: "Presets nicht erreichbar", bad: true })), []);
  useEffect(() => { void load(); }, [load]);

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
    <div className="grid gap-5" data-testid="presets">
      {message && <p role="status" className={`text-[13px] ${message.bad ? "text-warn" : "text-ok"}`}>{message.text}</p>}
      <ul className="grid gap-2">
        {list.map((p) => (
          <li key={p.id} className="rounded-md border border-line bg-panel2 p-3" data-testid={`preset-${p.id}`}>
            <div className="flex items-baseline justify-between gap-2">
              {renaming?.id === p.id ? (
                <form className="flex flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); void act(() => api.renamePreset(p.id, renaming.name), "Umbenannt."); setRenaming(null); }}>
                  <input autoFocus aria-label="Neuer Name" className="flex-1 rounded-md border border-line bg-bg px-2 py-0.5 text-[13px]" value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} />
                  <button className="btn" type="submit">OK</button>
                </form>
              ) : <h4 className="text-[14px] font-semibold">{p.name} {p.builtin && <span className="ml-1 text-[11px] font-normal text-faint">mitgeliefert</span>}</h4>}
              <span className="text-[11px] text-faint">{p.count} Werte</span>
            </div>
            {p.description && <p className="mt-0.5 text-[12px] text-dim">{p.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className="btn" onClick={() => void show(p.id)}>Ansehen und laden …</button>
              <button className="btn" onClick={() => void act(() => api.duplicatePreset(p.id), "Dupliziert.")}>Duplizieren</button>
              {!p.builtin && <button className="btn" onClick={() => setRenaming({ id: p.id, name: p.name })}>Umbenennen</button>}
              {!p.builtin && (deleting === p.id
                ? <><button className="btn on" onClick={() => { setDeleting(null); void act(() => api.deletePreset(p.id), "Gelöscht."); }}>Wirklich löschen</button><button className="btn" onClick={() => setDeleting(null)}>Abbrechen</button></>
                : <button className="btn" onClick={() => setDeleting(p.id)}>Löschen</button>)}
            </div>
          </li>
        ))}
      </ul>

      {preview && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Preset laden">
          <div className="max-h-[80vh] w-[34rem] max-w-[92vw] overflow-auto rounded-lg border border-line bg-panel p-5">
            <h3 className="text-lg font-semibold">„{preview.preset.name}“ laden?</h3>
            {preview.diff.length === 0 ? <p className="mt-2 text-sm text-dim">Alle Werte entsprechen schon dem Preset.</p> : (
              <>
                <p className="mt-2 text-sm text-dim">{preview.diff.length} Werte ändern sich:</p>
                <table className="mt-2 w-full text-[13px]" data-testid="preset-diff">
                  <thead><tr className="text-left text-[11px] text-faint"><th>Einstellung</th><th>jetzt</th><th>danach</th></tr></thead>
                  <tbody>{preview.diff.map((d, i) => (
                    <tr key={i} className="border-t border-line/50"><td className="py-1">{d.label}{d.agent ? ` (${d.agent})` : ""}</td><td className="font-mono text-xs text-dim">{shown(d.old, specOf(d.key))}</td><td className="font-mono text-xs text-alex">{shown(d.new, specOf(d.key))}</td></tr>
                  ))}</tbody>
                </table>
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setPreview(null)}>Abbrechen</button>
              <button className="btn on" onClick={() => void apply(preview.preset.id, preview.preset.name)}>Laden</button>
            </div>
          </div>
        </div>
      )}

      <form className="rounded-md border border-line p-3" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api.savePreset(name, desc, picked.length ? picked : null); setName(""); setDesc(""); }, "Gespeichert."); }}>
        <h3 className="sub !mt-0">Aktuellen Stand speichern</h3>
        <input className="w-full rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder="Name" aria-label="Name des Presets" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <input className="mt-1.5 w-full rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder="Beschreibung (optional)" aria-label="Beschreibung" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
        <fieldset className="mt-2"><legend className="text-[11px] text-faint">Nur diese Gruppen speichern (keine Auswahl = alles)</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">{groups.map((g) => (
            <label key={g.id} className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={picked.includes(g.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, g.id] : picked.filter((x) => x !== g.id))} />{g.label}</label>
          ))}</div>
        </fieldset>
        <button className="btn mt-2" type="submit" disabled={!name.trim()}>Speichern</button>
      </form>
    </div>
  );
}
