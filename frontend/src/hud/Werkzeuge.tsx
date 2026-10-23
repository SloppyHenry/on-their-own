// Werkzeuge unten in der Mitte (AP18b, Mockup Bild 5): Ereignis (E) und Gestalten (B). Nur in der Spielart Gott (AP18d); alte Spielstände gelten als Gott.
import { useEffect } from "react";
import { EventComposer } from "../composer/EventComposer";
import { betreteGestalten } from "../gestalten/SpielGestalten";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { isTyping } from "../world/player/PlayerController";

export function Werkzeuge() {
  const gott = useSimStore((s) => s.world?.playMode === "gott");
  return gott ? <GottWerkzeuge /> : null;                                                       // in der Spielart Leben gibt es keine Leiste (nur die Bewohner verändern die Welt)
}

function GottWerkzeuge() {
  const pop = useUiStore((s) => s.pop), setPop = useUiStore((s) => s.setPop), menu = useUiStore((s) => s.menu);
  useRueckweg(pop !== null, EBENE.Popover, () => setPop(null));
  const gestalten = betreteGestalten;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as Element | null) || menu !== null) return;
      if (e.key === "e" || e.key === "E") { e.preventDefault(); setPop(pop === "ereignis" ? null : "ereignis"); }
      else if (e.key === "b" || e.key === "B") gestalten();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pop, menu, setPop]);
  return (
    <>
      {pop === "ereignis" && (
        <div className="glas hud-pop pointer-events-auto absolute bottom-[82px] left-1/2 z-20 w-[min(760px,94%)] -translate-x-1/2" data-testid="ereignis-popover"><EventComposer /></div>
      )}
      <div className="glas pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 p-1.5" role="group" aria-label="Werkzeuge" data-testid="werkzeuge">
        <button type="button" className={`btn !px-4 !py-2 font-semibold ${pop === "ereignis" ? "on" : ""}`} aria-pressed={pop === "ereignis"} onClick={() => setPop(pop === "ereignis" ? null : "ereignis")} data-testid="werkzeug-ereignis">✦ Ereignis <kbd className="kbd max-[1320px]:hidden">E</kbd></button>
        <button type="button" className="btn !px-4 !py-2 font-semibold" onClick={gestalten} data-testid="open-editor">✎ Gestalten <kbd className="kbd max-[1320px]:hidden">B</kbd></button>
      </div>
    </>
  );
}
