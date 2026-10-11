export const KIND_LABEL: Record<string, string> = { episode: "Erlebnis", fact: "Wissen", relation: "Beziehung", intention: "Vorhaben", reflection: "Einsicht", summary: "Rückblick" };
export const KIND_COLOR: Record<string, string> = {
  episode: "var(--color-world)", fact: "var(--color-ok)", relation: "var(--color-dialog)", intention: "var(--color-sys)", reflection: "var(--color-plan)", summary: "var(--color-faint)",
};
export const KINDS = Object.keys(KIND_LABEL);
export const SORTS: [string, string][] = [["time", "Neueste zuerst"], ["importance", "Wichtigste zuerst"], ["access", "Oft abgerufen"]];
export const INTENTION_LABEL: Record<string, string> = { open: "offen", done: "erledigt", dropped: "aufgegeben" };
