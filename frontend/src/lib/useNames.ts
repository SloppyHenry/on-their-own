import { useMemo } from "react";
import type { Names } from "../timeline/describeEvent";
import { useSimStore } from "../store/simStore";

/** Namensauflösung für Sätze; unbekannte Kennungen erscheinen unverändert. */
export function useNames(): Names {
  const agents = useSimStore((s) => s.world?.agents);
  const locations = useSimStore((s) => s.world?.locations);
  return useMemo(() => ({ agent: (id) => agents?.[id]?.name ?? id, location: (id) => locations?.[id]?.name ?? id }), [agents, locations]);
}
