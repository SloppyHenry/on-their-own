// Die Rechnung des Entwurfs (AP16b): zwei Wege, eine Antwortform. Spiel: Trockenlauf auf der laufenden Welt (`/api/world/draft/preview`); Werkstatt: zustandslos auf der Weltdatei
// (`/api/worlds/draft`). Beide liefern je Aktion „geht“ oder den Grund, den Prüfbericht und auf Wunsch die Welt, wie sie nach dem Entwurf aussähe.
import { api } from "../net/api";
import type { Aktion, Ort, Rechnung } from "./typen";

export async function rechne(ort: Ort, aktionen: Aktion[], basis: () => Record<string, unknown> | null, mitAbzug: boolean): Promise<Rechnung> {
  if (ort === "spiel") {
    const r = await api.entwurfVorschau(aktionen);
    return { stati: r.stati, meldungen: r.meldungen, fehler: r.fehler, hinweise: r.hinweise, ok: r.ok, digest: r.digest ?? null, snapshot: r.snapshot, error: r.error };
  }
  const welt = basis();
  if (!welt) throw new Error("Keine Welt geöffnet.");
  const r = await api.entwurfDatei(welt, aktionen, mitAbzug);
  return { stati: r.stati, meldungen: r.meldungen, fehler: r.fehler, hinweise: r.hinweise, ok: r.ok, digest: r.digest, welt: r.world, snapshot: r.snapshot };
}

/** Sind alle Aktionen angenommen und gibt es keinen Fehler (✗)? Nur dann lässt sich im Spiel übernehmen. */
export const uebernehmbar = (r: Rechnung | null) => !!r && r.ok && !r.error && r.digest !== null;
