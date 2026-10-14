// Dinge im Dorf (AP15), reine Hilfen ohne Zeichnen: wer im Boot oder Sessel sitzt, welche Laternen leuchten.
import type { AgentInfo, ObjectInfo, World } from "../../store/types";
import { placeOf, type Look } from "./look";

/** Wer rudert oder vom Boot angelt, sitzt im Boot; wer den Sessel benutzt, sitzt darin (AP15). */
export function seatOf(w: World, a: AgentInfo): ObjectInfo | null {
  const id = a.action?.type === "use" ? a.action.params?.object_id : null, o = typeof id === "string" ? w.objects[id] : undefined;
  return o && (o.kind === "boat" || o.kind === "armchair") && o.x != null && o.y != null ? o : null;
}

/** Bildstelle (Weltpixel) einer Figur im Boot, sonst null. */
export function boatSpot(w: World, L: Look, a: AgentInfo): [number, number] | null {
  const s = seatOf(w, a), h = s?.kind === "boat" ? placeOf(L, s.id) : null;
  return h ? [h.region.frame[0] + h.p.at[0], h.region.frame[1] + h.p.at[1] - 3] : null;
}

/** Lichtschein aus `look.lights` (Weltpixel): an Laternen nur, wenn sie brennen (AP15); Fenster und Tür wie in A. */
export function glowing(w: World, L: Look): number[][] {
  const lanterns = Object.values(w.objects).filter((o) => o.kind === "lantern");
  const out: number[][] = [];
  for (const R of L.regions) {
    for (const [x, y, h, k] of R.lights) {
      const l = lanterns.find((o) => R.place[o.id] && R.place[o.id].at[0] === x && R.place[o.id].at[1] === y);
      if (!l || l.state.lit) out.push([x + R.frame[0], y + R.frame[1], h, k]);
    }
  }
  return out;
}
