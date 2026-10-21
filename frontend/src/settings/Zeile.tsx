// Bausteine der Einstellungen (Mockup docs/mockups/einstellungen.html): Abschnitt mit Überschrift und Karte, eingeklappte Feinheiten und die Zeile
// (links Name und ein Satz Erklärung, rechts der Regler in fester Spalte, ganz rechts ↺ zum Standard).
import type { ReactNode } from "react";

export function Abschnitt({ titel, notiz, children }: { titel: string; notiz?: string; children: ReactNode }) {
  return (
    <section className="einst-sec" aria-label={titel} data-zeile={titel}>
      <h4>{titel}</h4>
      {notiz && <p className="einst-notiz">{notiz}</p>}
      <div className="einst-karte">{children}</div>
    </section>
  );
}

/** Feinheiten: eingeklappt, außer dort ist schon etwas geändert. */
export function Feinheiten({ anzahl, geaendert, children }: { anzahl: number; geaendert: number; children: ReactNode }) {
  return (
    <details className="einst-fein" open={geaendert > 0 || undefined} data-testid="feinheiten">
      <summary>Feinheiten · {anzahl} Regler{geaendert ? ` · ${geaendert} geändert` : ""}</summary>
      <div className="einst-karte">{children}</div>
    </details>
  );
}

interface ZeileProps {
  name: ReactNode;
  hilfe?: ReactNode;
  /** Für das `label` des Reglers. */
  fuer?: string;
  geaendert?: boolean;
  /** Fundort in der Suche (Seite › Abschnitt). */
  ort?: ReactNode;
  unter?: ReactNode;
  breit?: boolean;
  zeile?: string;
  testid?: string;
  agent?: string;
  /** Zurück auf den Standard; ohne `aufStandard` bleibt der Platz frei, damit die Regler untereinander bündig stehen. */
  aufStandard?: { label: string; title?: string; onClick: () => void };
  children?: ReactNode;
}

export function Zeile({ name, hilfe, fuer, geaendert, ort, unter, breit, zeile, testid, agent, aufStandard, children }: ZeileProps) {
  const kopf = (
    <div className="min-w-0">
      {ort && <div className="einst-ort">{ort}</div>}
      <div className="einst-name">{geaendert && <span className="einst-punkt" title="geändert" />}{fuer ? <label htmlFor={fuer}>{name}</label> : <span>{name}</span>}</div>
      {hilfe && <div className="einst-hilfe">{hilfe}</div>}
      {unter}
    </div>
  );
  const zurueck = aufStandard && geaendert
    ? <button type="button" className="einst-zurueck" onClick={aufStandard.onClick} title={aufStandard.title} aria-label={aufStandard.label}>↺</button>
    : <span className="einst-zurueck leer" aria-hidden="true">↺</span>;
  return breit ? (
    <div className="einst-zeile breit" data-zeile={zeile} data-testid={testid} data-agent={agent}>
      <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{kopf}</div>{zurueck}</div>
      {children}
    </div>
  ) : (
    <div className="einst-zeile" data-zeile={zeile} data-testid={testid} data-agent={agent}>
      {kopf}
      <div className="einst-regler">{children}{zurueck}</div>
    </div>
  );
}

/** Kopf einer Seite: Titel, ein Satz, wofür sie gilt, rechts Knöpfe. */
export function SeitenKopf({ titel, lead, bild, geltung, children }: { titel: string; lead: ReactNode; bild?: ReactNode; geltung?: "spiel" | "geraet" | null; children?: ReactNode }) {
  return (
    <div className="einst-head">
      {bild}
      <div className="min-w-0"><h3>{titel}</h3><p>{lead}</p></div>
      <div className="r">
        {geltung === "geraet" && <span className="einst-scope geraet" data-testid="geltung">▭ nur dieses Gerät</span>}
        {geltung === "spiel" && <span className="einst-scope" data-testid="geltung">◆ dieser Spielstand</span>}
        {children}
      </div>
    </div>
  );
}
