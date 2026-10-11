// Beschriftungen der Parameter für Protokoll und Oberfläche. Das Schema wird einmal geladen und hier abgelegt.
import type { ParamSpecOut } from "../types/generated";

export type Spec = Omit<ParamSpecOut, "default"> & { default: unknown };

const specs = new Map<string, Spec>();

export const registerSpecs = (list: Spec[]) => list.forEach((s) => specs.set(s.key, s));
export const specOf = (key: string): Spec | undefined => specs.get(key);
export const labelOf = (key: string): string => specs.get(key)?.label ?? key;

/** Wert in lesbarer Form (Einheit, an/aus, Anzeigename bei Auswahl, gekürzter Text). */
export function shown(v: unknown, spec?: Spec): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "boolean") return v ? "an" : "aus";
  if (spec?.type === "enum") return spec.options.find((o) => o[0] === v)?.[1] ?? String(v);
  if (typeof v === "number") return `${Number.isInteger(v) ? v : Math.round(v * 100) / 100}${spec?.unit ? ` ${spec.unit}` : ""}`;
  const t = String(v);
  return t.length > 40 ? `${t.slice(0, 37)} …` : t;
}

export const STATUS_TEXT: Record<string, string> = {
  applied: "übernommen",
  pending_next_decision: "gilt ab der nächsten Entscheidung",
  requires_model_restart: "braucht einen Neustart des Modells",
  rejected: "abgelehnt",
};
