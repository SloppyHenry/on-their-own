import { clockOf } from "../lib/clock";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useDetail } from "./useDetail";

/** Historie fehlgeschlagener oder abgelehnter Aktionen mit Ablehnungscode und Ort. */
export function FailureList({ agent }: { agent: string }) {
  const version = useSimStore((s) => s.autonomyVersion + s.memoryVersion);
  const { data } = useDetail(() => api.failures(agent, 8), `${agent}/fail/${version}`, 10000);
  if (!data) return null;
  return (
    <div data-testid="failures">
      <div className="sub">Fehlschläge</div>
      {data.length === 0 && <div className="text-dim">Bisher keine.</div>}
      {data.map((f) => (
        <div key={f.id} className="border-b border-line py-1 text-xs"><span className="font-mono text-faint">T{clockOf(f.sim_minute).day} {clockOf(f.sim_minute).time}</span> {f.action} <span className="text-warn">{f.code}</span>
          <span className="block text-dim">{f.text}</span></div>
      ))}
    </div>
  );
}
