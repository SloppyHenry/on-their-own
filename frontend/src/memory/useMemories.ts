import { useCallback, useEffect, useRef, useState } from "react";
import { api, type MemoryQuery } from "../net/api";
import { useSimStore } from "../store/simStore";
import type { MemoryOut } from "../types/generated";

const PAGE = 40;

/** Liste der Erinnerungen eines Agenten mit Nachladen. Neue Erinnerungen (live) laden die geladene Länge im Hintergrund neu. */
export function useMemories(agent: string, query: MemoryQuery) {
  const [items, setItems] = useState<MemoryOut[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const version = useSimStore((s) => s.memoryVersion);
  const key = JSON.stringify([agent, query]);
  const loaded = useRef(PAGE);

  const load = useCallback(async (limit: number, cursor?: string, append = false) => {
    setLoading(true);
    try {
      const page = await api.memories(agent, { ...query, limit, cursor });
      setItems((old) => (append ? [...old, ...page.items] : page.items));
      setTotal(page.total);
      setNext(page.next_cursor ?? null);
      loaded.current = append ? loaded.current + page.items.length : Math.max(PAGE, page.items.length);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { loaded.current = PAGE; void load(PAGE); }, [load]);
  useEffect(() => {
    if (version === 0) return;
    const t = setTimeout(() => void load(Math.min(200, loaded.current)), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return { items, total, loading, hasMore: next !== null, more: () => next && load(PAGE, next, true) };
}
