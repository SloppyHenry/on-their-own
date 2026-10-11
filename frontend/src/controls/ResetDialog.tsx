import { useState } from "react";

export const RESET_WORD = "zurücksetzen";

export function ResetDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const ok = text.trim().toLowerCase() === RESET_WORD;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Zurücksetzen bestätigen">
      <form className="w-96 rounded-lg border border-line bg-panel p-5" onSubmit={(e) => { e.preventDefault(); if (ok) onConfirm(); }}>
        <h3 className="text-lg font-semibold">Simulation zurücksetzen?</h3>
        <p className="mt-2 text-sm text-dim">Die Welt beginnt von vorn. Der bisherige Stand wird vorher unter <span className="font-mono text-xs">data/backups/</span> gesichert.</p>
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
