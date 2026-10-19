// Schritt 4 des Assistenten: das Modell (AP17b). Es gilt fest für diese Simulation (Frage 10). Die Modellverwaltung (AP17c-4) kommt an dieselbe Stelle.
import { useHealth } from "../net/useHealth";
import { useAssistent } from "./assistentStore";

export function StepModell() {
  const model = useAssistent((s) => s.draft.model), patch = useAssistent((s) => s.patchDraft), health = useHealth();
  const models = health?.llm.models ?? [];
  return (
    <div data-testid="step-modell">
      <h2 className="mb-1 text-[19px] font-bold">Modell</h2>
      <p className="mb-3 text-[13px] text-dim">Das Sprachmodell der Bewohner. Es gilt fest für diese Simulation; wer ein anderes will, legt eine neue an.</p>
      <section className="rounded-xl border border-line bg-black/15 p-3">
        <label className="grid gap-1 text-xs text-dim">Modell
          <select className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text" value={model} data-testid="modell-wahl" onChange={(e) => patch({ model: e.target.value })}>
            <option value="">{health?.llm.configured_model ?? "bisheriges Modell"} (bisheriges)</option>
            {models.filter((m) => m !== health?.llm.configured_model).map((m) => <option key={m} value={m}>{m}</option>)}
          </select></label>
        <p className="mt-2 text-[13px] text-dim">Die Modellverwaltung (Hardware, Katalog, Download) folgt mit AP17c-4 an dieser Stelle. Bis dahin steht hier die Modellliste des Servers wie im Dialog „Zurücksetzen“.</p>
      </section>
    </div>
  );
}
