import { useEffect, useState } from "react";

/** Lädt ein Detail per REST und aktualisiert es, solange es offen ist. */
export function useDetail<T>(load: () => Promise<T>, key: string, refreshMs = 4000): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    const go = () => load().then((d) => alive && (setData(d), setError(null))).catch((e: Error) => alive && setError(e.message));
    void go();
    const t = refreshMs ? setInterval(go, refreshMs) : undefined;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);
  return { data, error };
}
