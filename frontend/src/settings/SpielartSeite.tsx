// Einstellungen › Spielart (AP18d, neu geordnet nach docs/mockups/einstellungen.html): Leben oder Gott als Bildkarten. Gehört zum Spielstand. Wechseln geht in
// beide Richtungen, mit Bestätigung; die Bewohner merken nichts davon. Darunter (aus dem Aufbau) „Was die Bewohner wissen“, nur in der Spielart Gott.
import { useState } from "react";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { Rueckfrage } from "../ui/Rueckfrage";
import { Abschnitt } from "./Zeile";

const ARTEN = [
  { id: "leben", titel: "Leben", ja: ["zuschauen, Zeit steuern, Einblicke"], nein: ["keine Ereignisse von dir", "kein Gestalten"] },
  { id: "gott", titel: "Gott", ja: ["Ereignisse eingeben", "die Welt gestalten (Zeit steht still)", "Bewohner und Regeln ändern"], nein: [] },
] as const;

export function SpielartSeite() {
  const aktuell = useSimStore((s) => s.world?.playMode ?? "gott");
  const [frage, setFrage] = useState<"leben" | "gott" | null>(null), [fehler, setFehler] = useState<string | null>(null);
  const wechseln = async (m: "leben" | "gott") => { setFrage(null); setFehler(null); try { await api.setPlayMode(m); } catch (e) { setFehler(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"); } };
  return (
    <div data-testid="spielart-seite">
      <Abschnitt titel="Wer verändert die Welt">
        <div className="einst-bilder">
          {ARTEN.map((k) => (
            <button key={k.id} type="button" className="einst-bild gross" aria-pressed={aktuell === k.id} data-testid={`spielart-${k.id}`} disabled={aktuell === k.id} onClick={() => setFrage(k.id)}>
              <div className="img" style={{ backgroundImage: `url(/einstellungen/${k.id}.jpg)` }} />
              <div className="tx">
                <b>{k.titel}{aktuell === k.id && <span className="einst-marke gold">aktuell</span>}</b>
                <ul>{k.ja.map((x) => <li key={x}>{x}</li>)}{k.nein.map((x) => <li key={x} className="nein">{x}</li>)}</ul>
              </div>
            </button>
          ))}
        </div>
        <div className="einst-zeile breit einst-hilfe">Wechseln geht in beide Richtungen, mit Rückfrage. Bereits Geschehenes bleibt.</div>
      </Abschnitt>
      {fehler && <p role="alert" className="mt-3 text-[13px] text-warn">{fehler}</p>}
      {frage && (
        <Rueckfrage titel={`Spielart „${frage === "leben" ? "Leben" : "Gott"}“ wählen?`} testid="spielart-frage"
          text={frage === "leben" ? "Ab jetzt verändern nur noch die Bewohner die Welt. Die Werkzeuge Ereignis und Gestalten verschwinden. Bereits Geschehenes bleibt." : "Ab jetzt kannst du von außen eingreifen: Ereignisse eingeben und die Welt gestalten. Die Bewohner merken nichts davon."}
          ja="Spielart wechseln" nein="Abbrechen" onNein={() => setFrage(null)} onJa={() => void wechseln(frage)} />
      )}
    </div>
  );
}
