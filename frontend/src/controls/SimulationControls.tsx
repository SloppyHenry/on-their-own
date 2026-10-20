import { useState } from "react";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";

const SPEEDS: [string, string][] = [["0.5x", "½"], ["1x", "1×"], ["2x", "2×"], ["4x", "4×"], ["max", "Max"]];

/** Zeitsteuerung im HUD (AP18b): Pause oder Start, Einzelschritt, Tempo. Jeder Knopf ruft die API; angezeigt wird, was das Backend meldet, nicht was wir hoffen. Zurücksetzen gibt es nur noch im Menü (Neue Simulation). */
export function SimulationControls() {
  const sim = useSimStore((s) => s.world?.simulation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const rund = "btn rund !h-[30px] !w-[30px]";

  return (
    <div className="glas pille !gap-1 !p-[5px]" data-testid="zeit">
      <div className="flex gap-1" role="group" aria-label="Steuerung">
        {running ? (
          <button className={`${rund} on`} disabled={busy} onClick={() => run(api.pause)} title="Pause" aria-label="Pause">❚❚</button>
        ) : (
          <button className={rund} disabled={busy} onClick={() => run(stopped ? api.start : api.resume)} title={stopped ? "Start" : "Fortsetzen"} aria-label={stopped ? "Start" : "Fortsetzen"}>▶</button>
        )}
        <button className={rund} disabled={busy || running} onClick={() => run(() => api.step(1))} title="Einzelschritt" aria-label="Einzelschritt">⏭</button>
      </div>
      <div className="segment" role="group" aria-label="Tempo">
        {SPEEDS.map(([k, label]) => (
          <button key={k} className={sim.speed_level === k ? "on" : ""} disabled={busy} onClick={() => run(() => api.speed(k))} aria-pressed={sim.speed_level === k}>{label}</button>
        ))}
      </div>
      {error && <span className="max-w-60 truncate px-1 text-xs text-warn" role="alert" title={error}>{error}</span>}
    </div>
  );
}
