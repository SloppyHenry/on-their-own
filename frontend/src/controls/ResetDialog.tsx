import { useState } from "react";
import { useHealth } from "../net/useHealth";

export const RESET_WORD = "zurücksetzen";

export function ResetDialog({ onConfirm, onCancel }: { onConfirm: (model?: string, keepProfiles?: boolean) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const health = useHealth();
  const models = health?.llm.models ?? [];
  const [model, setModel] = useState<string>("");
  const [keep, setKeep] = useState(false);
  const ok = text.trim().toLowerCase() === RESET_WORD;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Zurücksetzen bestätigen">
      <form className="w-96 rounded-lg border border-line bg-panel p-5" onSubmit={(e) => { e.preventDefault(); if (ok) onConfirm(model || undefined, keep); }}>
        <h3 className="text-lg font-semibold">Simulation zurücksetzen?</h3>
        <p className="mt-2 text-sm text-dim">Die Welt beginnt von vorn. Der bisherige Stand wird vorher unter <span className="font-mono text-xs">data/saves/</span> als Spielstand „Vor dem Zurücksetzen“ gesichert.</p>
        <fieldset className="mt-3 text-sm" aria-label="Profile">
          <label className="flex items-center gap-2"><input type="radio" name="profiles" checked={!keep} onChange={() => setKeep(false)} />Komplett Standard (Startprofile von Alex und Mira)</label>
          <label className="mt-1 flex items-center gap-2"><input type="radio" name="profiles" checked={keep} onChange={() => setKeep(true)} data-testid="keep-profiles" />Aktuelle Profile und Persönlichkeitswerte behalten</label>
        </fieldset>
        {models.length > 0 && (
          <label className="mt-4 block text-sm">Modell der neuen Simulation
            <select className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Modell">
              <option value="">{health?.llm.configured_model} (bisheriges)</option>
              {models.filter((m) => m !== health?.llm.configured_model).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-faint">Das Modell gilt für den ganzen Lauf und lässt sich danach nicht wechseln.</span>
          </label>
        )}
        <label className="mt-4 block text-sm">Zur Bestätigung „{RESET_WORD}“ eingeben
          <input autoFocus className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>Abbrechen</button>
          <button type="submit" className="btn on" disabled={!ok}>Zurücksetzen</button>
        </div>
      </form>
    </div>
  );
}
