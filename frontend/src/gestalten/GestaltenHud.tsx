// Rahmen des Gestaltens (AP16b): schwebt als HUD über der Weltfläche (Mockup `gestalten-neu`): oben die Leiste des Orts, links die Werkzeuge, rechts Katalog, Entwurf und Prüfung.
// Werkstatt und Spiel liefern nur `kopf` (obere Leiste) und `fuss` (Speichern oder Übernehmen); Werkzeuge, Entwurf und Prüfung sind dieselben.
import "./gestalten.css";
import type { ReactNode } from "react";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { useGestalten } from "./gestaltenStore";
import { Leiste } from "./Leiste";
import { Seite } from "./Seite";

export function GestaltenHud({ kopf, fuss, gebiet }: { kopf: ReactNode; fuss: ReactNode; gebiet?: ReactNode }) {
  const abbrechen = useGestalten((s) => s.abbrechen), werkzeug = useGestalten((s) => s.werkzeug), pending = useGestalten((s) => s.pending.length);
  useRueckweg(werkzeug !== "zeiger" || pending > 0, EBENE.Werkzeug, () => abbrechen());          // Esc: erst die angefangene Form, dann das Werkzeug, dann erst der Ort
  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-testid="gestalten">
      <div className="glas gs-kopf pointer-events-auto" data-testid="gestalten-kopf">{kopf}</div>
      <Leiste />
      <Seite fuss={fuss} gebiet={gebiet} />
      <Pfeile />
    </div>
  );
}

/** Karte erweitern: ein Pfeil je Seite am Rand der Weltfläche (Mockup Bild 10). */
function Pfeile() {
  const w = useGestalten((s) => s.werkzeug), opt = useGestalten((s) => s.opt), setze = useGestalten((s) => s.setze);
  if (w !== "karte") return null;
  return (
    <>
      <button type="button" className="gs-pfeil pointer-events-auto" style={{ right: 366, top: "50%" }} onClick={() => setze({ art: "karte", richtung: "ost", kacheln: opt.karte.ost })} title={`Osten: +${opt.karte.ost} Kacheln`} aria-label="Karte nach Osten erweitern" data-testid="pfeil-ost">→</button>
      <button type="button" className="gs-pfeil pointer-events-auto" style={{ left: "46%", bottom: 24 }} onClick={() => setze({ art: "karte", richtung: "sued", kacheln: opt.karte.sued })} title={`Süden: +${opt.karte.sued} Kacheln`} aria-label="Karte nach Süden erweitern" data-testid="pfeil-sued">↓</button>
    </>
  );
}
