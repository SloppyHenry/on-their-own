import type { ReactNode } from "react";

/** Bestätigungsfenster mit Angaben in Zeilen (Datei, Quelle, Größe …): geladen oder gelöscht wird erst danach. */
export function BestaetigungsDialog({ titel, zeilen, ja, onJa, onNein, warnung, jaGesperrt }: {
  titel: string; zeilen: [string, ReactNode][]; ja: string; onJa: () => void; onNein: () => void; warnung?: ReactNode; jaGesperrt?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label={titel} data-testid="bestaetigung" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onNein(); } }}>
      <div className="grid w-[min(460px,92vw)] gap-2.5 rounded-xl border border-alex bg-panel p-4">
        <b className="text-base">{titel}</b>
        <dl className="m-0 grid grid-cols-[84px_1fr] gap-x-2.5 gap-y-1 text-[13px]">
          {zeilen.map(([k, v]) => <div key={k} className="contents"><dt className="text-dim">{k}</dt><dd className="m-0 break-all">{v}</dd></div>)}
        </dl>
        {warnung && <p className="text-[13px] text-warn" role="alert">{warnung}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button className="btn" autoFocus data-testid="bestaetigung-nein" onClick={onNein}>Abbrechen</button>
          <button className="btn on" data-testid="bestaetigung-ja" disabled={jaGesperrt} onClick={onJa}>{ja}</button>
        </div>
      </div>
    </div>
  );
}
