// Tastenkürzel des Spiels (AP18b; mit eigener Figur ist T „Sagen“, AP18h): Leertaste Pause, Punkt Einzelschritt, T Tagebuch, G Gedächtnis, V Tiefe/Flach, ? Hilfe. Nicht beim Tippen, nicht mit Strg/Cmd/Alt.
import { useEffect } from "react";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { isTyping } from "../world/player/PlayerController";

export function useHudTasten(aktiv: boolean) {
  useEffect(() => {
    if (!aktiv) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as Element | null)) return;
      const ui = useUiStore.getState();
      if (ui.menu !== null) return;
      const sim = useSimStore.getState().world?.simulation;
      if (e.key === " " && !(e.target as HTMLElement)?.closest?.("button, a, [role=button]")) {
        e.preventDefault();
        if (sim) void (sim.state === "running" ? api.pause() : sim.state === "stopped" ? api.start() : api.resume()).catch(() => undefined);
      } else if (e.key === "." && sim && sim.state !== "running") void api.step(1).catch(() => undefined);
      else if ((e.key === "t" || e.key === "T") && !useSimStore.getState().world?.player) { if (ui.drawer === "tagebuch") ui.setDrawer(null); else { ui.setView("world"); ui.setDrawer("tagebuch"); } }
      else if (e.key === "g" || e.key === "G") { if (ui.view === "memory") ui.setView("world"); else ui.openMemory(ui.lastAgent, "memories"); }
      else if (e.key === "v" || e.key === "V") ui.setWorldMode(ui.worldMode === "tiefe" ? "flach" : "tiefe");
      else if (e.key === "?") ui.setHelp(!ui.help);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktiv]);
}
