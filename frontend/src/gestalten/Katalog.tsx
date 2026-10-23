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
  const setOpt = useGestalten((s) => s.setOpt), setze = useGestalten((s) => s.setze), map = useGestalten((s) => s.rechnung), innen = useGestalten((s) => s.innen);
  if (innen) return <InnenKatalog />;
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
    zeiger: (ort === "werkstatt" ? "Klick auf die Welt zeigt die Kachel. " : "Ansehen: Klick wählt wie sonst, nichts wird verändert. ") + "Klick auf ein Haus zeigt es von innen; dort richtest du es ein.",
    weg: "Klick setzt Punkte, die gestrichelte Vorschau läuft mit dem Zeiger. Doppelklick oder Enter beendet, Esc bricht ab. Ein Weg bleibt begehbar; er schneidet Gras, nie Wasser oder Mauern.",
    see: "Erst die Mitte, dann den Rand anklicken. Ein See ist 1,5 bis 12 Kacheln breit; das Ufer (Sand) entsteht von selbst.",
    garten: "Zwei gegenüberliegende Ecken anklicken. Zaun und Beete entstehen von selbst, die Südseite bleibt offen.",
    loeschen: "Klick auf ein Ding, einen Weg, einen See, einen Garten oder ein Haus. Ein bewohntes Haus (Betten mit Besitzer, Figuren darin) lässt sich nicht löschen.",
    startplatz: "Klick auf eine begehbare Kachel: dort beginnen die Bewohner. Ohne Startplatz lässt sich die Welt speichern, aber noch nicht starten.",
    gebiet: "Klick auf die linke obere Ecke: der gestrichelte Rahmen zeigt, wo das Dorf entsteht. Wiese und Wald weichen dem Dorf, Wege, Wasser und Häuser nicht.",
  };
  return <p className="gs-hinweis" data-testid="werkzeug-hilfe" style={{ marginTop: 14 }}>{text[w]}</p>;
}

const TAPETE: Record<string, string> = { streifen: "#96aac4", blumen: "#ecbec4", ranken: "#78a078", kacheln: "#f2ecde", bretter: "#a67852" };
const BODEN: Record<string, string> = { dielen: "#c98c56", dielenHell: "#e2b884", parkett: "#b27042", fliesen: "#ece2ce", werkstatt: "#967050" };
const TEPPICH: Record<string, string> = { blau: "#5d7fb0", rosa: "#d97a92", gruen: "#7fa878" };
const NIX = "–";

/** Katalog im Haus (Mockup Bild 7–9): Möbel, Wandschmuck, Teppich, Farben; „Löschen“ und „Zeiger“ erklären sich selbst. */
function InnenKatalog(): ReactNode {
  const { werkzeug: w, katalog: k, opt } = useGestalten();
  const setOpt = useGestalten((s) => s.setOpt), raus = useGestalten((s) => s.verlasseInnen);
  const i = opt.innen, set = (p: Partial<typeof i>) => setOpt({ innen: { ...i, ...p } });
  const kopf = <button type="button" className="btn mt-3 w-full" onClick={() => raus?.()} data-testid="nach-draussen">← Nach draußen <kbd className="kbd">Esc</kbd></button>;
  const ik = k?.innen;
  let inhalt: ReactNode;
  if (w === "moebel" && ik) {
    inhalt = (<><div className="gs-sub">Möbel</div><div className="gs-cat">{ik.moebel.map((q) => <button key={q.kind} type="button" className={`gs-catit ${i.moebel === q.kind ? "on" : ""}`} aria-pressed={i.moebel === q.kind} onClick={() => set({ moebel: q.kind })} data-testid={`moebel-${q.kind}`}>{q.name}<small>{q.modes.join(", ") || "Dekoration"}</small></button>)}</div>
      <p className="gs-hinweis">Vor jeder Tür bleibt eine Kachel frei; Möbel dürfen keinen Weg im Haus abschneiden. Schlafzimmer brauchen ein Bett, Küchen einen Herd.</p></>);
  } else if (w === "wand" && ik) {
    inhalt = (<><div className="gs-sub">Wandschmuck</div><div className="gs-cat">{ik.wand.map((q) => <button key={q.kind} type="button" className={`gs-catit ${i.wand === q.kind ? "on" : ""}`} aria-pressed={i.wand === q.kind} onClick={() => set({ wand: q.kind })} data-testid={`wand-${q.kind}`}>{q.kind.split(":")[0]}{q.kind.includes(":") && <small>{q.kind.split(":")[1]}</small>}</button>)}</div>
      <p className="gs-hinweis">Hängt an der Rückwand des Raums, über der angeklickten Kachel.</p></>);
  } else if (w === "teppich" && ik) {
    inhalt = (<><div className="gs-sub">Teppich</div><div className="gs-opt"><span>Farbe</span><span className="gs-sw">{ik.teppiche.map((c) => <button key={c} type="button" className={`gs-swatch ${i.teppich === c ? "on" : ""}`} style={{ background: TEPPICH[c] }} title={c} aria-label={c} aria-pressed={i.teppich === c} onClick={() => set({ teppich: c })} data-testid={`teppich-${c}`} />)}</span></div></>);
  } else if (w === "farbe" && ik) {
    const reihe = (titel: string, id: string, werte: string[], farben: (v: string) => string, wert: string | null, key: "tapete" | "boden" | "vorhang") => (
      <div className="gs-opt"><span>{titel}</span><span className="gs-sw">
        <button type="button" className={`gs-swatch ${wert === null ? "on" : ""}`} style={{ background: "transparent", color: "#a99fb3" }} aria-label={`${titel} nicht ändern`} aria-pressed={wert === null} onClick={() => set({ [key]: null })} data-testid={`${id}-keine`}>{NIX}</button>
        {werte.map((v) => <button key={v} type="button" className={`gs-swatch ${wert === v ? "on" : ""}`} style={{ background: farben(v) }} title={v} aria-label={v} aria-pressed={wert === v} onClick={() => set({ [key]: v })} data-testid={`${id}-${v}`} />)}</span></div>);
    inhalt = (<><div className="gs-sub">Farben des Raums</div>{reihe("Tapete", "tapete", ik.tapeten, (v) => TAPETE[v] ?? "#888", i.tapete, "tapete")}{reihe("Boden", "boden", ik.boeden, (v) => BODEN[v] ?? "#888", i.boden, "boden")}{reihe("Vorhang", "vorhang", ik.vorhaenge, (v) => v, i.vorhang, "vorhang")}
      <p className="gs-hinweis">Klick auf einen Raum setzt die gewählten Farben; „–“ lässt den Teil, wie er ist.</p></>);
  } else if (w === "loeschen") {
    inhalt = <p className="gs-hinweis" style={{ marginTop: 14 }}>Löschen: Klick auf ein Möbel oder einen Teppich; Wandschmuck löscht ein Klick auf die oberste Reihe des Raums darunter. Betten mit Besitzer und Türen bleiben.</p>;
  } else {
    inhalt = <p className="gs-hinweis" style={{ marginTop: 14 }}>Das Haus von innen: Räume anklicken zeigt sie groß. Zum Einrichten ein Werkzeug links wählen.</p>;
  }
  return <>{kopf}{inhalt}</>;
}
