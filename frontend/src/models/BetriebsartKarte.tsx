// Betriebsart (Mockup docs/mockups/modelle.html): „Eingebaut“ (Simulacra startet llama-server selbst) oder „Externer Server“ (OpenAI-kompatibel, z. B. der Router auf maintux).
import { useEffect, useState } from "react";
import { api } from "../net/api";
import type { ExternalTestOut, LlmStatusOut } from "../types/generated";
import { Karte } from "./Karte";
import { useModelStore } from "./modelStore";
import { BestaetigungsDialog } from "./Dialog";

const STATE_TEXT: Record<string, string> = { stopped: "kein Modell gestartet", starting: "Modell wird geladen …", running: "läuft", failed: "gescheitert" };

export function BetriebsartKarte({ status }: { status: LlmStatusOut }) {
  const run = useModelStore((s) => s.run);
  const builtin = status.mode === "builtin", rt = status.runtime;
  const blocked = status.sim_running ? "Die Simulation läuft. Das Wechseln der Betriebsart geht nur bei angehaltener Simulation." : undefined;
  const [confirmRt, setConfirmRt] = useState(false);
  const [url, setUrl] = useState(status.external_url ?? status.base_url), [key, setKey] = useState("");
  const [test, setTest] = useState<ExternalTestOut | "busy" | null>(null);
  useEffect(() => { if (status.external_url) setUrl(status.external_url); }, [status.external_url]);

  const setMode = (mode: "builtin" | "external") => { if (!status.locked && !blocked && mode !== status.mode) void run(() => api.setLlmMode({ mode, external_url: mode === "external" ? url : null, external_key: null })); };
  const check = async () => {
    setTest("busy");
    try { setTest(await api.testLlm(status.locked ? undefined : url, key || undefined)); } catch { setTest({ reachable: false, models: [], error: "Backend nicht erreichbar", url }); }
  };

  return (
    <Karte titel="Betriebsart" testid="betriebsart">
      {status.locked && <p data-testid="betriebsart-fest" className="mb-2 text-[13px] text-dim">Die Adresse des Modellservers ist in der Umgebung festgelegt (<span className="font-mono text-xs">SIM_LLM_BASE_URL</span>, z. B. in <span className="font-mono text-xs">backend/.env</span>): <span className="font-mono text-xs">{status.base_url}</span>. Das Tool ändert sie nicht; Modelle lassen sich trotzdem laden und messen.</p>}
      <div className="grid gap-2.5 min-[700px]:grid-cols-2">
        <div className={`rounded-xl border p-2.5 ${builtin ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
          <button type="button" aria-pressed={builtin} data-testid="mode-builtin" disabled={status.locked || !!blocked} onClick={() => setMode("builtin")} title={blocked}
            className="block w-full cursor-pointer bg-transparent p-0 text-left text-text disabled:cursor-default">
            <b className="block">Eingebaut</b>
            <small className="text-dim">Simulacra startet <span className="font-mono text-xs">llama-server</span> selbst und lädt das gewählte Modell.</small>
          </button>
          <div className="mt-1.5 text-[12px] text-dim" data-testid="runtime-info">
            {rt.installed ? <>Laufzeit llama.cpp {rt.version ?? ""}{rt.kind ? ` (${rt.kind})` : ""} installiert</> : "Laufzeit llama.cpp noch nicht installiert"}
            {builtin && <> · <span data-testid="runtime-state" data-state={rt.state} className={rt.state === "failed" ? "text-warn" : rt.state === "running" ? "text-ok" : ""}>{rt.model_id && rt.state !== "stopped" ? `${rt.model_id}: ` : ""}{STATE_TEXT[rt.state]}</span></>}
          </div>
          {!rt.installed && !status.locked && (
            <button className="btn mt-1.5" data-testid="runtime-install" disabled={!!status.transfer && ["preparing", "downloading", "verifying", "unpacking"].includes(status.transfer.phase)}
              onClick={() => setConfirmRt(true)}>Laufzeit installieren</button>
          )}
          {builtin && rt.state === "failed" && rt.error && (
            <div className="mt-1.5 text-[12px] text-warn" role="alert" data-testid="runtime-error">{rt.error}
              {rt.log_tail.length > 0 && <details className="mt-1 text-dim"><summary className="cursor-pointer">Letzte Zeilen des Protokolls</summary><pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{rt.log_tail.join("\n")}</pre></details>}</div>
          )}
          {builtin && rt.state === "running" && !status.sim_running && <button className="btn mt-1.5" data-testid="runtime-stop" onClick={() => void run(api.stopModel)}>Modell beenden</button>}
        </div>
        <div className={`rounded-xl border p-2.5 ${!builtin ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
          <button type="button" aria-pressed={!builtin} data-testid="mode-external" disabled={status.locked || !!blocked} onClick={() => setMode("external")} title={blocked}
            className="block w-full cursor-pointer bg-transparent p-0 text-left text-text disabled:cursor-default">
            <b className="block">Externer Server</b>
            <small className="text-dim">OpenAI-kompatibel, z. B. der Router auf maintux.</small>
          </button>
          <div className="mt-1.5 grid gap-1.5">
            <input type="text" aria-label="Adresse" data-testid="extern-adresse" className="rounded-md border border-line bg-bg px-2 py-1 text-[13px]" value={status.locked ? status.base_url : url} disabled={status.locked} onChange={(e) => setUrl(e.target.value)} />
            {!status.locked && <input type="password" aria-label="Schlüssel" data-testid="extern-schluessel" autoComplete="off" className="rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder={status.external_key_set ? "Schlüssel gespeichert (leer lassen = behalten)" : "Schlüssel (optional)"} value={key} onChange={(e) => setKey(e.target.value)} />}
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn" data-testid="extern-testen" onClick={() => void check()}>Testen</button>
              {!status.locked && <button className="btn" data-testid="extern-speichern" disabled={!!blocked || !url.trim()} title={blocked}
                onClick={() => void run(() => api.setLlmMode({ mode: "external", external_url: url, external_key: key || null })).then((ok) => ok && setKey(""))}>{builtin ? "Verwenden" : "Übernehmen"}</button>}
              <small data-testid="extern-ergebnis" className="text-[12px]">
                {test === "busy" ? "… prüfe" : test ? test.reachable ? <span className="text-ok">erreichbar · {test.models.length} Modell{test.models.length === 1 ? "" : "e"}{test.models.length ? `: ${test.models.slice(0, 3).join(", ")}` : ""}</span> : <span className="text-warn">nicht erreichbar ({test.error})</span> : ""}
              </small>
            </div>
          </div>
        </div>
      </div>
      {blocked && <p className="mt-2 text-[12px] text-dim" data-testid="betriebsart-gesperrt">{blocked}</p>}
      {confirmRt && (
        <BestaetigungsDialog titel="Laufzeit installieren?" ja="Herunterladen" onNein={() => setConfirmRt(false)} onJa={() => { setConfirmRt(false); void run(api.installRuntime); }}
          zeilen={[["Was", "llama.cpp (llama-server), die zum Rechner passende Version"], ["Quelle", "github.com/ggml-org/llama.cpp (offizielle Releases)"], ["Prüfung", "SHA-256 gegen die Angabe von GitHub; danach wird geprüft, ob das Programm hier läuft"], ["Ablage", "data/runtime/llama.cpp im Datenordner, nichts außerhalb"]]} />
      )}
    </Karte>
  );
}
