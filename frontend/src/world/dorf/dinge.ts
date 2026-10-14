// Dinge im Dorf (AP15), reine Hilfen ohne Zeichnen: wer im Boot oder Sessel sitzt, welche Laternen leuchten.
import type { AgentInfo, ObjectInfo, World } from "../../store/types";
import type { Look } from "./look";

/** Wer rudert oder vom Boot angelt, sitzt im Boot; wer den Sessel benutzt, sitzt darin (AP15). */
export function seatOf(w: World, a: AgentInfo): ObjectInfo | null {
  const id = a.action?.type === "use" ? a.action.params?.object_id : null, o = typeof id === "string" ? w.objects[id] : undefined;
  return o && (o.kind === "boat" || o.kind === "armchair") && o.x != null && o.y != null ? o : null;
}

/** Bildstelle (Dorfkoordinaten) einer Figur im Boot, sonst null. */
export function boatSpot(w: World, L: Look, a: AgentInfo): [number, number] | null {
  const s = seatOf(w, a);
  return s?.kind === "boat" && L.place[s.id] ? [L.place[s.id].at[0], L.place[s.id].at[1] - 3] : null;
}

/** Lichtschein aus `look.lights`: an Laternen nur, wenn sie brennen (AP15); Fenster und Tür wie in A. */
export function glowing(w: World, L: Look): number[][] {
  const lanterns = Object.values(w.objects).filter((o) => o.kind === "lantern" && L.place[o.id]);
  return L.lights.filter(([x, y]) => { const l = lanterns.find((o) => L.place[o.id].at[0] === x && L.place[o.id].at[1] === y); return !l || !!l.state.lit; });
}
