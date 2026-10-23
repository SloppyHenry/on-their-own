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
import { Hud } from "../hud/Hud";
import { useGestalten } from "../gestalten/gestaltenStore";
import { SpielGestalten } from "../gestalten/SpielGestalten";
import { Werkstatt } from "../welten/Werkstatt";
import { StartMenu } from "./StartMenu";

export function AppShell() {
  const ready = useSimStore((s) => s.world !== null);
  const savesOpen = useUiStore((s) => s.savesOpen);
  const appMode = useUiStore((s) => s.appMode);
  const menu = useUiStore((s) => s.menu);
  const gestalten = useGestalten((s) => (s.offen ? s.ort : null));
  const title = menu === "title";                                                          // Titelbild: nur die Welt (langsam wandernd) und das Menü
  const tools = appMode === "editor" && ready && gestalten !== null;                       // Gestalten (AP16b): der Werkzeugkasten schwebt über der Welt
  useEffect(() => startLive(), []);
  useEffect(() => starteEsc(), []);                                                        // Esc: eine Ebene zurück (AP18a, ui/zurueck.ts)
  useEffect(() => startKlang(), []);                                                       // Musik, Umgebung, Geräusche, Stimmen (AP17d)

  return (
    <div className="h-full overflow-hidden" data-menu={menu ?? "zu"}>
      <main className="grid h-full min-h-0 grid-cols-[1fr]">
        <div className="relative min-w-0 overflow-hidden bg-[#0e1115]">
          <div className={`h-full ${title ? "menu-drift pointer-events-none" : ""}`}>
            {!ready ? <p className="p-6 text-dim">Verbinde mit der Simulation …</p> : <WorldCanvas />}
          </div>
          <Hud />
          {tools && (gestalten === "werkstatt" ? <Werkstatt /> : <SpielGestalten />)}
          <StartMenu />
        </div>
      </main>
      {savesOpen && <SaveLoadDialog />}
    </div>
  );
}
