// Modellwahl beim Anlegen einer Simulation (Zurücksetzen-Dialog, Assistent): im eingebauten Betrieb die installierten Modelle mit Siegel,
// sonst die Modelle des externen Servers. Vorgewählt ist das „Standard für neue Simulationen“ (AP17c-4).
import { useEffect } from "react";
import { useHealth } from "../net/useHealth";
import { useUiStore } from "../store/uiStore";
import { sealText } from "./format";
import { useModelStore } from "./modelStore";

export interface Choice { value: string; label: string; note: string }

export function useModelChoices() {
  const health = useHealth(), status = useModelStore((s) => s.status), load = useModelStore((s) => s.loadStatus);
  useEffect(() => { if (!status) void load(); }, [status, load]);
  const current = health?.llm.configured_model ?? status?.sim_model ?? "";
  const builtin = status?.mode === "builtin";
  const choices: Choice[] = builtin
    ? status.installed.filter((m) => m.id !== current).map((m) => ({ value: m.id, label: `${m.name} ${m.quant ?? ""}`.trim(), note: m.probe ? sealText(m.probe) : "noch nicht gemessen" }))
    : (health?.llm.models ?? []).filter((m) => m !== current).map((m) => ({ value: m, label: m, note: "" }));
  const currentInstalled = !builtin || !!status?.installed.some((m) => m.id === current);
  const initial = builtin && status.default_model && status.default_model !== current ? status.default_model : "";
  const manage = () => useUiStore.getState().openSettings("models");
  return { current, builtin, choices, currentInstalled, initial, manage, ready: builtin ? !!status : !!health };
}
