// Katalog je Werkzeug (AP16b, Mockup Bild 1–3 und 10): was gesetzt wird und mit welchen Optionen. Die Listen kommen vom Backend (`/api/gestalten/katalog`), damit spätere Pakete sie ersetzen können.
import type { ReactNode } from "react";
import { useGestalten } from "./gestaltenStore";

const DACH: Record<string, string> = { rot: "#d65a40", blau: "#5470c8", stroh: "#e0b440", moos: "#6f9a5a", schiefer: "#6a7080", holz: "#8a5a3c" };
const WAND: Record<string, string> = { creme: "#f0e2c4", rosa: "#e4b4b0", gelb: "#ecd27a", blau: "#a9bde0", holz: "#b08a60" };
const BREITE: [number, string][] = [[58, "klein"], [66, "mittel"], [90, "groß"]];

function Seg<T extends string | number>({ werte, wert, onWahl, id }: { werte: [T, string][]; wert: T; onWahl: (w: T) => void; id: string }) {
  return <span className="segment" role="group">{werte.map(([w, l]) => <button key={String(w)} type="button" className={wert === w ? "on" : ""} aria-pressed={wert === w} onClick={() => onWahl(w)} data-testid={`${id}-${w}`}>{l}</button>)}</span>;
}
const Farben = ({ farben, wert, onWahl, id }: { farben: Record<string, string>; wert: string; onWahl: (k: string) => void; id: string }) => (
  <span className="gs-sw">{Object.entries(farben).map(([k, c]) => <button key={k} type="button" className={`gs-swatch ${wert === k ? "on" : ""}`} style={{ background: c }} title={k} aria-label={k} aria-pressed={wert === k} onClick={() => onWahl(k)} data-testid={`${id}-${k}`} />)}</span>
);

export function Katalog(): ReactNode {
  const { werkzeug: w, katalog: k, opt, ort } = useGestalten();
  const setOpt = useGestalten((s) => s.setOpt), setze = useGestalten((s) => s.setze), map = useGestalten((s) => s.rechnung);
  if (w === "haus" && k) {
    const h = opt.haus;
    return (
      <>
        <div className="gs-sub">Gebäude</div>
        <div className="gs-cat">{k.haeuser.map((a) => <button key={a.gebaeude} type="button" className={`gs-catit ${h.gebaeude === a.gebaeude ? "on" : ""}`} aria-pressed={h.gebaeude === a.gebaeude} onClick={() => setOpt({ haus: { ...h, gebaeude: a.gebaeude } })} data-testid={`haus-${a.gebaeude}`}>{a.name}</button>)}</div>
        {h.gebaeude === "house" && (
          <>
            <div className="gs-opt"><span>Größe</span><Seg id="haus-breite" werte={BREITE} wert={h.breite} onWahl={(b) => setOpt({ haus: { ...h, breite: b } })} /></div>
            <div className="gs-opt"><span>Dach</span><Farben id="haus-dach" farben={Object.fromEntries(k.daecher.map((d) => [d, DACH[d] ?? "#888"]))} wert={h.dach} onWahl={(d) => setOpt({ haus: { ...h, dach: d } })} /></div>
            <div className="gs-opt"><span>Wand</span><Farben id="haus-wand" farben={Object.fromEntries(k.waende.map((d) => [d, WAND[d] ?? "#888"]))} wert={h.wand} onWahl={(d) => setOpt({ haus: { ...h, wand: d } })} /></div>
          </>
        )}
        <p className="gs-hinweis">Klick setzt das Haus, die Tür zeigt nach Süden. Innenbereich, Orte, Möbel und ein Weg zur nächsten Straße entstehen von selbst.</p>
      </>
    );
  }
  if (w === "natur" && k) {
    return (
      <>
        <div className="gs-sub">Baum, Deko</div>
        <div className="gs-cat">{k.deko.map((d) => <button key={d.sorte} type="button" className={`gs-catit ${opt.deko.sorte === d.sorte ? "on" : ""}`} aria-pressed={opt.deko.sorte === d.sorte} onClick={() => setOpt({ deko: { sorte: d.sorte } })} data-testid={`deko-${d.sorte}`}>{d.name}</button>)}</div>
      </>
    );
  }
  if (w === "karte" && k) {
    const kn: [number, string][] = k.karte.kacheln.map((n) => [n, `+${n}`]);
    return (
      <>
        <div className="gs-sub">Karte erweitern</div>
        <div className="gs-opt"><span>Süden</span><Seg id="karte-sued-n" werte={kn} wert={opt.karte.sued} onWahl={(n) => setOpt({ karte: { ...opt.karte, sued: n } })} /></div>
        <div className="gs-opt"><span>Osten</span><Seg id="karte-ost-n" werte={kn} wert={opt.karte.ost} onWahl={(n) => setOpt({ karte: { ...opt.karte, ost: n } })} /></div>
        <div className="flex gap-1.5">
          <button type="button" className="btn flex-1" onClick={() => setze({ art: "karte", richtung: "sued", kacheln: opt.karte.sued })} data-testid="karte-sued">↓ Nach Süden</button>
          <button type="button" className="btn flex-1" onClick={() => setze({ art: "karte", richtung: "ost", kacheln: opt.karte.ost })} data-testid="karte-ost">→ Nach Osten</button>
        </div>
        <p className="gs-hinweis">Neue Wiese, nichts Bestehendes ändert sich. Höchstens {k.karte.max} × {k.karte.max} Kacheln.{map ? "" : ""}</p>
      </>
    );
  }
  const text: Record<string, string> = {
    zeiger: ort === "werkstatt" ? "Klick auf die Welt zeigt die Kachel." : "Ansehen: Klick wählt wie sonst, nichts wird verändert.",
    weg: "Klick setzt Punkte, die gestrichelte Vorschau läuft mit dem Zeiger. Doppelklick oder Enter beendet, Esc bricht ab. Ein Weg bleibt begehbar; er schneidet Gras, nie Wasser oder Mauern.",
    see: "Erst die Mitte, dann den Rand anklicken. Ein See ist 1,5 bis 12 Kacheln breit; das Ufer (Sand) entsteht von selbst.",
    garten: "Zwei gegenüberliegende Ecken anklicken. Zaun und Beete entstehen von selbst, die Südseite bleibt offen.",
    loeschen: "Klick auf ein Ding, einen Weg, einen See, einen Garten oder ein Haus. Ein bewohntes Haus (Betten mit Besitzer, Figuren darin) lässt sich nicht löschen.",
    startplatz: "Klick auf eine begehbare Kachel: dort beginnen die Bewohner. Ohne Startplatz lässt sich die Welt speichern, aber noch nicht starten.",
    gebiet: "Klick auf die linke obere Ecke: der gestrichelte Rahmen zeigt, wo das Dorf entsteht. Wiese und Wald weichen dem Dorf, Wege, Wasser und Häuser nicht.",
  };
  return <p className="gs-hinweis" data-testid="werkzeug-hilfe" style={{ marginTop: 14 }}>{text[w]}</p>;
}
