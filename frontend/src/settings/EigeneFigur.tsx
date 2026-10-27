// Einstellungen › Spielart › Eigene Figur (AP18h, Mockup Bild 5 und 8): „Anhalten, wenn ich dran bin“, „Autopilot, wenn ich nichts tue“ mit Frist in echten Minuten, Sicht und
// „Eigene Figur wechseln“ (mit Bestätigung; die bisherige Figur wird ein normaler Bewohner, für den das Modell entscheidet). Gilt für diesen Spielstand.
import { useState } from "react";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { Rueckfrage } from "../ui/Rueckfrage";
import { Abschnitt, Zeile } from "./Zeile";

export function EigeneFigur() {
  const w = useSimStore((s) => s.world);
  const [neu, setNeu] = useState(""), [frage, setFrage] = useState(false), [fehler, setFehler] = useState<string | null>(null);
  if (!w?.player || w.playMode !== "leben") return null;
  const me = w.agents[w.player], others = Object.values(w.agents).filter((a) => a.id !== w.player);
  const run = async (f: () => Promise<unknown>) => { setFehler(null); try { await f(); } catch (e) { setFehler(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"); } };
  return (
    <div data-testid="eigene-figur">
      <Abschnitt titel={`Eigene Figur: ${me?.name ?? w.player}`} notiz="Die Welt läuft weiter, deine Figur wartet, bis du etwas tust. Diese Schalter gelten für diesen Spielstand.">
        <Zeile name="Anhalten, wenn ich dran bin" hilfe="Ist deine Figur frei und spricht jemand sie an (oder ihre Handlung ist zu Ende), steht die Zeit, bis du etwas tust. Rundenweise spielen." fuer="takt-hold">
          <input id="takt-hold" type="checkbox" role="switch" className="schalter" checked={w.playerHold} data-testid="takt-hold" onChange={(e) => void run(() => api.setPlayerTakt({ hold: e.target.checked }))} />
        </Zeile>
        <Zeile name="Autopilot, wenn ich nichts tue" hilfe="Danach entscheidet das Modell für deine Figur wie für jeden Bewohner, bis du wieder eingreifst („Übernehmen“)." fuer="takt-auto"
          unter={<span className="einst-hilfe">nach <input type="number" min={1} max={240} className="mx-1 w-14 rounded-md border border-line bg-bg px-1.5 py-0.5 text-center text-text" aria-label="Minuten bis zum Autopiloten" data-testid="takt-minuten" value={w.playerAutoMinutes}
            onChange={(e) => void run(() => api.setPlayerTakt({ auto_minutes: Math.max(1, Math.min(240, Math.round(+e.target.value || 1))) }))} /> Minuten ohne Eingabe (echte Zeit)</span>}>
          <input id="takt-auto" type="checkbox" role="switch" className="schalter" checked={w.playerAuto} data-testid="takt-auto" onChange={(e) => void run(() => api.setPlayerTakt({ auto: e.target.checked }))} />
        </Zeile>
        <Zeile name="Sicht" hilfe="Du siehst die ganze Welt wie sonst. „Nur sehen, was meine Figur sieht“ kommt später."><span className="chip">ganze Welt</span></Zeile>
        <Zeile name="Eigene Figur wechseln …" hilfe={`Mit Bestätigung. ${me?.name ?? "Die bisherige Figur"} wird ein normaler Bewohner, für den das Modell entscheidet.`}>
          <select className="rounded-md border border-line bg-bg px-2 py-1" value={neu} data-testid="figur-wahl" onChange={(e) => setNeu(e.target.value)}>
            <option value="">wählen …</option>
            {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" className="btn" disabled={!neu} data-testid="figur-wechseln" onClick={() => setFrage(true)}>Wechseln</button>
        </Zeile>
      </Abschnitt>
      {fehler && <p role="alert" className="mt-3 text-[13px] text-warn">{fehler}</p>}
      {frage && (
        <Rueckfrage titel="Eigene Figur wechseln?" testid="figur-frage" text={`Ab jetzt steuerst du ${w.agents[neu]?.name ?? neu}. ${me?.name ?? "Die bisherige Figur"} wird ein normaler Bewohner. Bereits Geschehenes bleibt.`}
          ja="Figur wechseln" nein="Abbrechen" onNein={() => setFrage(false)} onJa={() => { setFrage(false); void run(() => api.setPlayerFigure(neu)); setNeu(""); }} />
      )}
    </div>
  );
}
