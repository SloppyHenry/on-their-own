// Menü → Einstellungen → Modelle (AP17c-4, Mockup docs/mockups/modelle.html): Hardware, Betriebsart, Empfehlungen, Bestand, Suche, Übertragung und Probelauf.
import { useEffect } from "react";
import { BetriebsartKarte } from "./BetriebsartKarte";
import { ProbeLeiste, TransferLeiste } from "./Fortschritt";
import { HardwareKarte } from "./HardwareKarte";
import { InstalliertKarte } from "./InstalliertKarte";
import { EmpfohlenKarte, SucheKarte } from "./KatalogKarten";
import { useModelStore } from "./modelStore";

export function ModelleSeite() {
  const status = useModelStore((s) => s.status), error = useModelStore((s) => s.error), load = useModelStore((s) => s.loadStatus), hw = useModelStore((s) => s.loadHardware), clear = useModelStore((s) => s.clearError);
  useEffect(() => { void load(); void hw(); }, [load, hw]);
  return (
    <div data-testid="modelle" className="pt-1">
      <p className="mb-3 text-[13px] text-dim">Das Sprachmodell der Bewohner. Es gilt für neue Simulationen; eine laufende behält ihr Modell.</p>
      {error && <p role="alert" data-testid="modelle-fehler" className="mb-3 flex items-start gap-2 rounded-lg border border-warn/60 px-3 py-2 text-[13px] text-warn"><span className="flex-1">{error}</span><button className="btn" onClick={clear}>✕</button></p>}
      <HardwareKarte />
      {!status ? <p className="text-dim">Lade Modellverwaltung …</p> : (
        <>
          <BetriebsartKarte status={status} />
          {status.transfer && <TransferLeiste t={status.transfer} />}
          {status.probe && <ProbeLeiste p={status.probe} />}
          <InstalliertKarte status={status} />
          <EmpfohlenKarte status={status} />
          <SucheKarte status={status} />
        </>
      )}
    </div>
  );
}
