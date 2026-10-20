// Brotkrumen oben in einem Menübereich (Mockup docs/mockups/rework.html, Bild 7): der Pfad, die letzte Krume ist die Überschrift,
// rechts steht, wohin Esc führt. Die Krumen davor sind anklickbar.
export interface Krume { label: string; onClick?: () => void }

export function Brotkrumen({ pfad, escZu }: { pfad: Krume[]; escZu?: string }) {
  const last = pfad.length - 1;
  return (
    <nav aria-label="Pfad" data-testid="brotkrumen" className="flex flex-wrap items-center gap-x-2 px-5 pt-3.5 text-[13px] text-dim">
      {pfad.map((k, i) => i === last
        ? <h2 key={i} className="text-[19px] font-bold text-text" data-testid="krume-aktuell">{k.label}</h2>
        : <span key={i} className="flex items-center gap-2"><button type="button" data-testid={`krume-${i}`} onClick={k.onClick} className="cursor-pointer bg-transparent p-0 text-dim hover:text-text">{k.label}</button><span aria-hidden="true">›</span></span>)}
      {escZu && <span className="ml-auto flex items-center gap-1.5 text-xs" data-testid="esc-hinweis"><kbd className="kbd">Esc</kbd>{escZu}</span>}
    </nav>
  );
}
