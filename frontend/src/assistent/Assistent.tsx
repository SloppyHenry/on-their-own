// Assistent „Neue Simulation“ (AP17b, Mockup docs/mockups/assistent.html): fünf Schritte (Welt · Bewohner · Regeln · Modell · Start). Der Entwurf bleibt im Browser,
// bis er angelegt oder verworfen wird; angelegt wird erst im letzten Schritt nach ausdrücklicher Bestätigung.
import { useEffect } from "react";
import { Brotkrumen } from "../ui/Brotkrumen";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { useAssistent } from "./assistentStore";
import { StepBewohner } from "./StepBewohner";
import { StepModell } from "./StepModell";
import { StepRegeln } from "./StepRegeln";
import { StepStart } from "./StepStart";
import { StepWelt } from "./StepWelt";

export const STEPS = ["Welt", "Bewohner", "Regeln", "Modell", "Start"];
const VIEWS = [StepWelt, StepBewohner, StepRegeln, StepModell, StepStart];

/** `onExit`: zurück zu „Neue Simulation“. Der Entwurf bleibt dabei im Browser erhalten, es geht also nichts verloren und es braucht keine Rückfrage. */
export function Assistent({ onExit }: { onExit: () => void }) {
  const step = useAssistent((s) => s.step), setStep = useAssistent((s) => s.setStep), load = useAssistent((s) => s.load), discard = useAssistent((s) => s.discard);
  useEffect(() => { void load(); }, [load]);
  const View = VIEWS[step] ?? StepWelt, last = step === STEPS.length - 1;
  useRueckweg(true, EBENE.MenueUnter, () => { if (step > 0) setStep(step - 1); else onExit(); });                        // Esc: ein Schritt zurück, vom ersten zu „Neue Simulation“
  const trail = [{ label: "Neue Simulation", onClick: onExit }, ...STEPS.slice(0, step + 1).map((label, i) => ({ label, onClick: () => setStep(i) }))];
  return (
    <div data-testid="assistent">
      <Brotkrumen pfad={trail} escZu={`zurück zu ${step > 0 ? STEPS[step - 1] : "Neue Simulation"}`} />
      <div className="px-5 pb-5 pt-3">
      <ol className="mb-4 flex flex-wrap gap-1.5" aria-label="Schritte">
        {STEPS.map((s, i) => (
          <li key={s}><button type="button" data-testid={`schritt-${i}`} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}
            className={`flex cursor-pointer items-center gap-2 rounded-full border bg-transparent py-1 pl-1.5 pr-3.5 text-[13px] ${i === step ? "border-alex text-text" : "border-line text-dim"}`}>
            <i className={`grid size-[22px] place-items-center rounded-full text-xs not-italic ${i === step ? "bg-alex text-[#2b2233]" : i < step ? "bg-ok text-[#1a1322]" : "bg-panel2"}`}>{i < step ? "✓" : i + 1}</i>{s}</button></li>
        ))}
      </ol>
      <View />
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[13px]">
        <button type="button" className="btn" onClick={() => (step > 0 ? setStep(step - 1) : onExit())} data-testid="zurueck">← {step > 0 ? "Zurück" : "Neue Simulation"}</button>
        <span className="flex-1" />
        <small className="text-dim max-[700px]:hidden">Der Entwurf bleibt in diesem Browser, bis er angelegt oder verworfen wird.</small>
        <button type="button" className="btn" onClick={discard} data-testid="verwerfen">Entwurf verwerfen</button>
        {!last && <button type="button" className="btn on" onClick={() => setStep(step + 1)} data-testid="weiter">Weiter →</button>}
      </div>
      </div>
    </div>
  );
}
