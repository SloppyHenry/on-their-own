// Rechte Seite des Gestaltens (AP16b): Katalog des Werkzeugs, Entwurfsliste mit ✕, Prüfung in drei Stufen (✓ ! ✗) und der Fuß des jeweiligen Orts (Speichern oder Übernehmen).
import type { ReactNode } from "react";
import { beschreibung } from "./entwurf";
import { useGestalten } from "./gestaltenStore";
import { Katalog } from "./Katalog";

const ZEICHEN = { ok: "✓", hinweis: "!", fehler: "✗" } as const;

export function Seite({ fuss, gebiet }: { fuss: ReactNode; gebiet?: ReactNode }) {
  const g = useGestalten();
  const r = g.rechnung;
  return (
    <aside className="glas gs-seite pointer-events-auto" data-testid="gestalten-seite" aria-label="Katalog, Entwurf und Prüfung">
      <Katalog />
      {g.werkzeug === "gebiet" && gebiet}
      <div className="gs-sub">Entwurf ({g.aktionen.length}){g.busy === "rechnen" && <span className="ml-2 font-normal normal-case tracking-normal text-faint">wird berechnet …</span>}</div>
      <div className="gs-entwurf" data-testid="entwurf-liste">
        {g.aktionen.length === 0 && <p className="gs-hinweis" style={{ margin: 0 }}>Noch nichts gesetzt.</p>}
        {g.aktionen.map((a, i) => {
          const st = r?.stati[i], bad = st ? !st.ok : false;
          return (
            <div key={i} className={bad ? "bad" : ""} title={bad ? (st?.grund ?? "") : undefined} data-testid={`entwurf-${i}`}>
              <span>{beschreibung(a, g.katalog)}{bad && <span className="n">blockiert</span>}</span>
              <button type="button" aria-label={`${beschreibung(a, g.katalog)} entfernen`} onClick={() => g.entferne(i)} data-testid={`entwurf-x-${i}`}>✕</button>
            </div>
          );
        })}
      </div>
      {r && (
        <>
          <div className="gs-sub">Prüfung</div>
          <div className="gs-pruef" data-testid="pruefung">
            {r.stati.map((s, i) => !s.ok && <div key={`a${i}`} className="fehler" data-stufe="fehler">{ZEICHEN.fehler} {beschreibung(g.aktionen[i], g.katalog)}: {s.grund}</div>)}
            {r.meldungen.map((m, i) => <div key={i} className={m.stufe} data-stufe={m.stufe}>{ZEICHEN[m.stufe]} {m.text}</div>)}
            {r.error && <div className="fehler" data-stufe="fehler">{ZEICHEN.fehler} {r.error}</div>}
          </div>
        </>
      )}
      {g.fehler && !r?.error && <p className="mt-3 rounded-md border border-warn/60 bg-warn/10 p-2 text-[12.5px] text-warn" role="alert" data-testid="gestalten-fehler">{g.fehler}</p>}
      <div className="gs-fuss">{fuss}</div>
    </aside>
  );
}
