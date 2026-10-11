import { useEffect, useState } from "react";
import { useSimStore } from "../store/simStore";
import type { AgentOverview, FactorRegistry } from "../types/generated";
import { api } from "./api";

/** Ziele, Stimmung und Bedürfnisse aller Agenten. Bedürfnisse ändern sich stetig (ohne Ereignisse), darum zusätzlich alle 5 Sekunden. */
export function useOverview(): Record<string, AgentOverview> {
  const [data, setData] = useState<Record<string, AgentOverview>>({});
  const version = useSimStore((s) => s.autonomyVersion);
  useEffect(() => {
    let alive = true;
    const load = () => api.overview().then((o) => alive && setData(Object.fromEntries(o.map((a) => [a.id, a])))).catch(() => undefined);
    void load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [version]);
  return data;
}

let cache: FactorRegistry | null = null;

/** Zuordnung Faktorname -> Gruppe (einmal geladen, ändert sich nicht). */
export function useFactors(): FactorRegistry | null {
  const [reg, setReg] = useState<FactorRegistry | null>(cache);
  useEffect(() => {
    if (!cache) api.factors().then((r) => { cache = r; setReg(r); }).catch(() => undefined);
  }, []);
  return reg;
}
