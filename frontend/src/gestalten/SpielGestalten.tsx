// Gestalten im Spiel (AP16b, Mockup Bild 5 und 6): dieselben Werkzeuge wie in der Werkstatt, aber auf der laufenden Welt und nur in der Spielart Gott. Die Zeit steht still, solange
// das Werkzeug offen ist; „Übernehmen“ schreibt den ganzen Entwurf als einen Schritt in die Welt, vorher sichert das Spiel den Stand. Die Bewohner merken nichts davon.
import { useState } from "react";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { Rueckfrage } from "../ui/Rueckfrage";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { GestaltenHud } from "./GestaltenHud";
import { useGestalten } from "./gestaltenStore";
import { Werkzeugteile } from "./Kopf";
import { uebernehmbar } from "./rechnen";

/** Öffnet das Gestalten im Spiel (Taste B in der Spielart Gott): Ansicht „Welt“, die Zeit hält an. */
export function betreteGestalten() {
  const ui = useUiStore.getState();
  ui.setPop(null); ui.setView("world"); ui.setReturnTo(null); ui.setAppMode("editor");
  void useGestalten.getState().betrete("spiel");
}

export function verlasseGestalten() {
  void useGestalten.getState().verlasse();
  useUiStore.getState().setAppMode("game");
}

export function SpielGestalten() {
  const g = useGestalten(), clock = useSimStore((s) => s.world?.clock);
  const [frage, setFrage] = useState<"verlassen" | "uebernehmen" | null>(null);
  const n = g.aktionen.length, kannUebernehmen = n > 0 && uebernehmbar(g.rechnung) && g.busy === null;
  const gehen = () => { if (n > 0) setFrage("verlassen"); else verlasseGestalten(); };
  useRueckweg(true, EBENE.Werkstatt, () => { gehen(); });
  const kopf = (
    <>
      <b className="text-[#ffd36e]">✎ Gestalten</b>
      <span className="stat still" data-testid="zeit-steht-still">⏸ Die Zeit steht still{clock ? ` · Tag ${clock.day}, ${clock.time}` : ""}</span>
      <span className="sp" />
      <Werkzeugteile />
      <button type="button" className="btn" onClick={gehen} data-testid="gestalten-fertig">Fertig <kbd className="kbd">Esc</kbd></button>
    </>
  );
  const fuss = (
    <>
      {g.fertig && <p className="mb-2 rounded-md border border-ok/60 bg-ok/10 p-2 text-[12.5px]" role="status" data-testid="gestalten-fertig-hinweis">{g.fertig.aktionen} {g.fertig.aktionen === 1 ? "Aktion" : "Aktionen"} übernommen{g.fertig.backup ? <>; vorher gesichert als „{g.fertig.backup}“</> : null}.</p>}
      <div className="flex gap-1.5">
        <button type="button" className="btn flex-1" disabled={n === 0} onClick={g.verwerfen} data-testid="entwurf-verwerfen">Verwerfen</button>
        <button type="button" className="btn gold flex-[2]" disabled={!kannUebernehmen} onClick={() => setFrage("uebernehmen")} data-testid="uebernehmen">Übernehmen …</button>
      </div>
      <p>{n > 0 && !kannUebernehmen && g.busy === null ? "Übernehmen geht erst, wenn alles ✓ ist." : "Der Entwurf liegt unter dem Schleier; erst Übernehmen verändert die Welt."}</p>
    </>
  );
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-20" data-testid="gestalten-spiel"><GestaltenHud kopf={kopf} fuss={fuss} /></div>
      {frage === "uebernehmen" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Entwurf übernehmen" data-testid="uebernehmen-dialog">
          <div className="glas w-[470px] p-6">
            <h3 className="text-[19px] font-semibold">Entwurf übernehmen?</h3>
            <p className="mt-2 text-[13.5px] text-dim">Der ganze Entwurf (<b className="text-text">{n} {n === 1 ? "Aktion" : "Aktionen"}</b>) wird in die laufende Welt geschrieben, als <b className="text-text">ein</b> Schritt.</p>
            <ul className="my-2 list-disc pl-5 text-[13px] text-dim">
              <li>Vorher sichert das Spiel den Stand („Vor dem Gestalten“). Rückweg: Menü › Simulation laden.</li>
              <li>Die Bewohner merken nichts: kein Hinweis in Wahrnehmung, Gedächtnis oder Prompt, nur ein Eintrag im Protokoll.</li>
              <li>Danach läuft die Zeit weiter, wenn sie vorher lief.</li>
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setFrage(null)} data-testid="uebernehmen-abbrechen">Abbrechen</button>
              <button type="button" className="btn gold" autoFocus disabled={g.busy !== null} onClick={() => void g.uebernehmen().then((ok) => ok && setFrage(null))} data-testid="uebernehmen-ok">{g.busy === "uebernehmen" ? "Wird übernommen …" : "Übernehmen"}</button>
            </div>
          </div>
          <Esc onEsc={() => setFrage(null)} />
        </div>
      )}
      {frage === "verlassen" && (
        <Rueckfrage titel="Entwurf verwerfen?" text={`Der Entwurf hat ${n} ${n === 1 ? "Aktion" : "Aktionen"}, die noch nicht übernommen sind. Sie gehen verloren, wenn du jetzt gehst.`} ja="Verwerfen und gehen" nein="Weiter gestalten"
          onNein={() => setFrage(null)} onJa={() => { setFrage(null); verlasseGestalten(); }} testid="gestalten-rueckfrage" />
      )}
    </>
  );
}

function Esc({ onEsc }: { onEsc: () => void }) { useRueckweg(true, EBENE.Dialog, () => { onEsc(); }); return null; }
