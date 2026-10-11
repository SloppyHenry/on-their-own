export type SeqCheck = "ok" | "duplicate" | "gap";

/** Prüft eine eingehende Ereignisnummer gegen die zuletzt gesehene. Nummern sind lückenlos. */
export function checkSeq(last: number | null, incoming: number): SeqCheck {
  if (last === null) return "ok";
  if (incoming <= last) return "duplicate";
  return incoming === last + 1 ? "ok" : "gap";
}
