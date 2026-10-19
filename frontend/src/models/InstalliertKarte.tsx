// „Installiert“: Siegel und Messwerte, Testen, Starten, als Standard für neue Simulationen, Löschen mit Rückfrage.
import { useState } from "react";
import { api } from "../net/api";
import type { InstalledOut, LlmStatusOut } from "../types/generated";
import { BestaetigungsDialog } from "./Dialog";
import { SEAL_CLASS, bytesText, sealText } from "./format";
import { Karte, Marke } from "./Karte";
import { useModelStore } from "./modelStore";

export function InstalliertKarte({ status }: { status: LlmStatusOut }) {
  const run = useModelStore((s) => s.run);
  const [del, setDel] = useState<InstalledOut | null>(null);
  const builtin = status.mode === "builtin";
  const probing = !!status.probe && (status.probe.phase === "starting" || status.probe.phase === "running");
  const lock = status.sim_running ? "Die Simulation läuft. Das geht nur bei angehaltener Simulation." : "";
  return (
    <Karte titel="Installiert" testid="installiert">
      <div className="grid gap-2">
        {status.installed.map((m) => {
          const loading = status.transfer?.model_id === m.id && ["preparing", "downloading", "verifying"].includes(status.transfer.phase);
          return (
            <div key={m.id} data-testid={`installiert-${m.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-1 rounded-xl border border-line bg-black/15 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[15px] font-bold">{m.name} <span className="font-medium text-dim">{m.quant ?? ""}</span>
                  {m.probe && <Marke cls={SEAL_CLASS[m.probe.seal]} testid="siegel" title={`Gemessen auf ${m.probe.hardware ?? "diesem Rechner"}${m.probe.tokens_per_s ? `, ${m.probe.tokens_per_s} Token/s` : ""}`}>{sealText(m.probe)}</Marke>}
                  {m.running && <Marke cls="border-ok text-ok" testid="laeuft">läuft</Marke>}
                  {m.is_default && <Marke cls="border-alex text-alex" testid="standard">Standard für neue Simulationen</Marke>}
                  {m.is_sim_model && <Marke cls="border-line text-dim" title="Das Modell der laufenden Simulation">dieser Simulation</Marke>}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-dim">
                  <span>{bytesText(m.size_bytes)}</span><span>{m.license ?? "Lizenz unbekannt"}</span>
                  <span title={m.source === "extern" ? "Die Datei wurde nicht über das Tool geladen (z. B. vom Install-Skript); die Prüfsumme ist unbekannt" : "Über das Tool geladen und gegen Hugging Face geprüft"}>{m.source === "extern" ? "von außen" : m.repo}</span>
                  {!m.probe && <span>noch nicht gemessen</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {!m.is_default && <button className="btn" data-testid="als-standard" title="Dieses Modell ist beim Anlegen einer neuen Simulation vorgewählt. Eine laufende behält ihres." onClick={() => void run(() => api.setDefaultModel(m.id))}>Als Standard</button>}
                {builtin && !m.running && <button className="btn" data-testid="starten" disabled={!status.runtime.installed || !!lock || probing || loading} title={!status.runtime.installed ? "Zuerst die Laufzeit installieren" : lock || undefined} onClick={() => void run(() => api.startModel(m.id))}>Starten</button>}
                {builtin && <button className="btn" data-testid="testen" disabled={!status.runtime.installed || !!lock || probing || loading} title={!status.runtime.installed ? "Zuerst die Laufzeit installieren" : lock || "Zehn Entscheidungen messen (ca. 1 Minute)"} onClick={() => void run(() => api.probeModel(m.id))}>Testen</button>}
                <button className="btn" data-testid="loeschen" aria-label={`${m.name} löschen`} title="Löschen" disabled={loading || probing && status.probe?.model_id === m.id} onClick={() => setDel(m)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
      {status.installed.length === 0 && <p className="text-[13px] text-dim" data-testid="nichts-installiert">Noch kein Modell installiert.{builtin ? "" : " Im externen Betrieb liefert der Server die Modelle."}</p>}
      {del && (
        <BestaetigungsDialog titel="Modell löschen?" ja="Löschen" onNein={() => setDel(null)} onJa={() => { const id = del.id; setDel(null); void run(() => api.deleteModel(id)); }}
          zeilen={[["Datei", `${del.file} (${bytesText(del.size_bytes)})`], ["Folge", "Die Datei und das Messergebnis werden gelöscht. Neu laden geht jederzeit."]]}
          warnung={del.running && status.sim_running ? "Die Simulation läuft und nutzt dieses Modell." : del.is_sim_model ? "Die laufende Simulation hat dieses Modell gewählt; sie bräuchte dann ein anderes." : undefined} />
      )}
    </Karte>
  );
}
