import type { ReactNode } from "react";

/** Eine Karte der Modellverwaltung (Überschrift klein und in Großbuchstaben wie im Mockup). */
export function Karte({ titel, children, testid, hinweis }: { titel: string; children: ReactNode; testid?: string; hinweis?: ReactNode }) {
  return (
    <section data-testid={testid} aria-label={titel} className="mb-3 rounded-[14px] border border-line bg-panel/80 px-3.5 py-3">
      <h3 className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{titel}{hinweis && <span className="text-[11px] font-normal normal-case tracking-normal text-faint">{hinweis}</span>}</h3>
      {children}
    </section>
  );
}

export function Marke({ cls, children, title, testid }: { cls: string; children: ReactNode; title?: string; testid?: string }) {
  return <span title={title} data-testid={testid} className={`ml-1.5 inline-block rounded-full border px-2 text-[11px] font-medium ${cls}`}>{children}</span>;
}
