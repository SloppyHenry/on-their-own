// Das Gerüst (AP18b): Die Welt füllt den ganzen Bildschirm. Bedienteile schweben als HUD in den Ecken (`hud/`), das Menü liegt darüber. Nur der Welteditor
// (AP12c) bekommt noch eine Leiste neben der Welt.
import { useEffect } from "react";
import { startKlang } from "../klang/regie";
import { startLive } from "../net/connect";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { starteEsc } from "../ui/zurueck";
import { SaveLoadDialog } from "../saves/SaveLoadDialog";
import { WorldCanvas } from "../world/WorldCanvas";
import { WorldEditor } from "../editor/WorldEditor";
import { Hud } from "../hud/Hud";
import { StartMenu } from "./StartMenu";

export function AppShell() {
  const ready = useSimStore((s) => s.world !== null);
  const savesOpen = useUiStore((s) => s.savesOpen);
  const appMode = useUiStore((s) => s.appMode);
  const menu = useUiStore((s) => s.menu);
  const title = menu === "title";                                                          // Titelbild: nur die Welt (langsam wandernd) und das Menü
  const tools = appMode !== "game" && ready;                                               // Welteditor: Werkzeugleiste neben der Welt
  useEffect(() => startLive(), []);
  useEffect(() => starteEsc(), []);                                                        // Esc: eine Ebene zurück (AP18a, ui/zurueck.ts)
  useEffect(() => startKlang(), []);                                                       // Musik, Umgebung, Geräusche, Stimmen (AP17d)

  return (
    <div className="h-full overflow-hidden" data-menu={menu ?? "zu"}>
      <main className={`grid h-full min-h-0 ${tools ? "grid-cols-[1fr_380px]" : "grid-cols-[1fr]"}`}>
        <div className="relative min-w-0 overflow-hidden bg-[#0e1115]">
          <div className={`h-full ${title ? "menu-drift pointer-events-none" : ""}`}>
            {!ready ? <p className="p-6 text-dim">Verbinde mit der Simulation …</p> : <WorldCanvas />}
          </div>
          <Hud />
          <StartMenu />
        </div>
        {tools && <WorldEditor />}
      </main>
      {savesOpen && <SaveLoadDialog />}
    </div>
  );
}
