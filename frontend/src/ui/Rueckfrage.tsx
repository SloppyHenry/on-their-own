// Rückfrage vor dem Verlassen, wenn etwas Ungesichertes verloren ginge. Esc heißt hier „weiter bearbeiten“, nie „verwerfen“.
import { EBENE, useRueckweg } from "./zurueck";

export function Rueckfrage({ titel, text, ja, nein, onJa, onNein, testid = "rueckfrage" }: { titel: string; text: string; ja: string; nein: string; onJa: () => void; onNein: () => void; testid?: string }) {
  useRueckweg(true, EBENE.Dialog, () => { onNein(); });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label={titel} data-testid={testid}>
      <div className="w-96 rounded-lg border border-line bg-panel p-5">
        <h3 className="text-lg font-semibold">{titel}</h3>
        <p className="mt-2 text-sm text-dim">{text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn on" autoFocus onClick={onNein} data-testid={`${testid}-nein`}>{nein}</button>
          <button type="button" className="btn" onClick={onJa} data-testid={`${testid}-ja`}>{ja}</button>
        </div>
      </div>
    </div>
  );
}
