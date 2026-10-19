// Schritt 4 des Assistenten: das Modell (AP17b). Es gilt fest für diese Simulation (Frage 10). Verwaltet (laden, messen, wählen) wird es unter Einstellungen → Modelle (AP17c-4).
import { useEffect } from "react";
import { useModelChoices } from "../models/useModelChoices";
import { useAssistent } from "./assistentStore";

export function StepModell() {
  const model = useAssistent((s) => s.draft.model), patch = useAssistent((s) => s.patchDraft);
  const { current, choices, currentInstalled, initial, manage, builtin, ready } = useModelChoices();
  useEffect(() => { if (ready && initial && model === "") patch({ model: initial }); }, [ready, initial]);   // eslint-disable-line react-hooks/exhaustive-deps -- nur einmal: das Standardmodell vorwählen
  const chosen = choices.find((c) => c.value === model);
  return (
    <div data-testid="step-modell">
      <h2 className="mb-1 text-[19px] font-bold">Modell</h2>
      <p className="mb-3 text-[13px] text-dim">Das Sprachmodell der Bewohner. Es gilt fest für diese Simulation; wer ein anderes will, legt eine neue an.</p>
      <section className="rounded-xl border border-line bg-black/15 p-3">
        <label className="grid gap-1 text-xs text-dim">Modell
          <select className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text" value={model} data-testid="modell-wahl" onChange={(e) => patch({ model: e.target.value })}>
            <option value="">{current || "bisheriges Modell"} ({currentInstalled ? "bisheriges" : "bisheriges, hier nicht installiert"})</option>
            {choices.map((m) => <option key={m.value} value={m.value}>{m.label}{m.note ? ` · ${m.note}` : ""}</option>)}
          </select></label>
        {chosen && chosen.note && <p className="mt-1.5 text-[12px] text-dim" data-testid="modell-siegel">{chosen.note}</p>}
        <p className="mt-2 text-[13px] text-dim">{builtin ? "Gewählt wird unter den installierten Modellen; das Modell wird beim Anlegen der Simulation gestartet." : "Gewählt wird unter den Modellen des Servers."}{" "}
          <button type="button" className="underline hover:text-text" data-testid="modelle-verwalten" onClick={manage}>Modelle verwalten …</button></p>
      </section>
    </div>
  );
}
