import { useState } from "react";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { ResetDialog } from "./ResetDialog";

const SPEEDS: [string, string][] = [["0.5x", "0,5×"], ["1x", "1×"], ["2x", "2×"], ["4x", "4×"], ["max", "Max"]];

/** Jeder Knopf ruft die API; angezeigt wird, was das Backend meldet (Ereignisse), nicht was wir hoffen. */
export function SimulationControls() {
  const sim = useSimStore((s) => s.world?.simulation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  if (!sim) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar");
    } finally {
      setBusy(false);
    }
  };
  const running = sim.state === "running";
  const stopped = sim.state === "stopped";

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1" role="group" aria-label="Steuerung">
        {running ? (
          <button className="btn on" disabled={busy} onClick={() => run(api.pause)} title="Pause" aria-label="Pause">❚❚</button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => run(stopped ? api.start : api.resume)} title={stopped ? "Start" : "Fortsetzen"} aria-label={stopped ? "Start" : "Fortsetzen"}>▶</button>
        )}
        <button className="btn" disabled={busy || running} onClick={() => run(() => api.step(1))} title="Einzelschritt" aria-label="Einzelschritt">⏭</button>
      </div>
      <div className="flex gap-1" role="group" aria-label="Tempo">
        {SPEEDS.map(([k, label]) => (
          <button key={k} className={`btn ${sim.speed_level === k ? "on" : ""}`} disabled={busy} onClick={() => run(() => api.speed(k))}>{label}</button>
        ))}
      </div>
      <button className="btn" disabled={busy} onClick={() => setResetting(true)}>⟲ Zurücksetzen</button>
      {error && <span className="max-w-60 truncate text-xs text-warn" role="alert" title={error}>{error}</span>}
      {resetting && <ResetDialog onCancel={() => setResetting(false)} onConfirm={(model, keep) => { setResetting(false); void run(() => api.reset(model, keep)); }} />}
    </div>
  );
}
