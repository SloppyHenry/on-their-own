import { useEffect, useState } from "react";

export interface Health {
  llm: { reachable: boolean; configured_model: string; model_available: boolean; error: string | null };
}

export function useHealth(everyMs = 10000): Health | null {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && setH(j))
        .catch(() => alive && setH(null));
    load();
    const t = setInterval(load, everyMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [everyMs]);
  return h;
}
