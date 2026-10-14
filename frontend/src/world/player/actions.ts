// Handlungen im Kontextmenü der Mitspieler-Vorschau, abgeleitet aus dem Aktionskatalog (Objektarten mit Modi, Vorräte, Figuren).
// Vorerst nur Vorschlag; später prüft das Backend jede Absicht wie bei KI-Agenten (`propose`).
import type { World } from "../../store/types";
import { OBJECT_KINDS } from "../../types/generated";
import type { Target } from "../view/scene";

export interface Choice { label: string; action: string; params: Record<string, unknown> }

const RES_NAME: Record<string, string> = { wood: "Holz", stone: "Steine", food: "Vorrat", seeds: "Saatgut", water: "Wasser", reed: "Schilf" };
const MODE_LABEL: Record<string, string> = {
  sleep: "schlafen", sit: "sitzen", cook: "kochen", read: "lesen", write: "schreiben", light: "anzünden", extinguish: "löschen",
  lock: "abschließen", unlock: "aufschließen", fish: "angeln", harvest: "ernten",
  row: "rudern", collect: "Post holen", fix: "aufrichten", pet: "streicheln",
};
const LIGHTS = new Set(["lantern", "candle", "floor_lamp"]);
const SKIP_MODES = new Set(["post", "store", "retrieve"]);       // brauchen Empfänger oder Inhalt: eigene Einträge

export function choicesFor(t: Target, w: World): Choice[] {
  if (t.kind === "agent") return [{ label: "ansprechen", action: "speak", params: { to: t.id } }, { label: "ansehen", action: "inspect", params: { target: t.id } }];
  if (t.kind === "house") return [{ label: "hineinschauen", action: "view", params: { house: t.id } }, { label: "hingehen", action: "move_to", params: { house: t.id } }];
  if (t.kind === "resource") {
    const n = w.resources[t.id];
    if (!n) return [];
    return n.resource === "water" ? [{ label: "trinken", action: "drink", params: { node: t.id } }] : [{ label: "sammeln", action: "gather", params: { node: t.id, resource: n.resource } }];
  }
  const o = w.objects[t.id];
  if (!o) return [];
  const kind = OBJECT_KINDS[o.kind], out: Choice[] = [{ label: "ansehen", action: "inspect", params: { object_id: o.id } }];
  if (kind?.portable || o.portable) out.push({ label: "nehmen", action: "take", params: { object_id: o.id } });
  for (const m of kind?.modes ?? []) {
    if ((m === "lock" && o.state.locked) || (m === "unlock" && !o.state.locked) || (m === "light" && o.state.lit) || (m === "extinguish" && !o.state.lit)) continue;
    if (SKIP_MODES.has(m) || (m === "fix" && o.state.upright !== false)) continue;
    const label = LIGHTS.has(o.kind) && o.kind === "floor_lamp" ? (m === "light" ? "einschalten" : "ausschalten") : MODE_LABEL[m] ?? m;
    out.push({ label, action: "use", params: { object_id: o.id, mode: m } });
  }
  if (o.kind === "mailbox") for (const a of Object.values(w.agents)) out.push({ label: `Brief an ${a.name}`, action: "use", params: { object_id: o.id, mode: "post", to: a.id } });
  if (o.kind === "seedbed") out.push({ label: "pflanzen", action: "plant", params: { seedbed_id: o.id } });
  if (o.kind === "plant") out.push({ label: "gießen", action: "water", params: { object_id: o.id } });
  if (o.kind === "meal") out.push({ label: "essen", action: "eat", params: { item: o.id } });
  return out;
}

/** Bezeichnung eines Ziels für die Vorschau („würde Bett (Alex) benutzen“). */
export function nameOf(t: Target, w: World): string {
  if (t.kind === "agent") return w.agents[t.id]?.name ?? t.id;
  if (t.kind === "house") return "Haus";
  if (t.kind === "resource") return w.resources[t.id]?.label ?? RES_NAME[w.resources[t.id]?.resource ?? ""] ?? "Vorrat";
  return w.objects[t.id]?.name ?? t.id;
}
