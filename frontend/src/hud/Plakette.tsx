// Plaketten oben links unter der Uhr (AP18h, Mockup Bild 1 und 5): „Kamera folgt Kim“ und der Takt deiner Figur („Kim wartet · frei seit 07:52“, im Autopilot „Autopilot“).
import { useEffect, useRef } from "react";
import { api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";

export function Plakette() {
  const w = useSimStore((s) => s.world), follow = useUiStore((s) => s.follow);
  const me = w?.player ? w.agents[w.player] : null, frei = useRef("");
  const free = !!me && !me.action;
  useEffect(() => { if (free && w) frei.current = w.clock.time; }, [free]);                  // seit wann frei: Zeit beim Übergang (beim Laden: jetzt)
  if (!w || !me) return null;
  return (
    <div className="pointer-events-none absolute left-4 top-[62px] z-10 flex items-center gap-2" data-testid="plakette">
      {follow === me.id && <div className="glas pille pointer-events-auto !px-[11px] !py-1 text-xs" data-testid="plakette-folgt"><b className="text-world">◎</b> Kamera folgt {me.name} <kbd className="kbd">F</kbd></div>}
      {w.playerAutopilot
        ? <div className="glas pille !px-[11px] !py-1 text-xs !border-plan text-[#e6d9ff]" data-testid="plakette-takt"><b className="text-plan">⚙ Autopilot</b> {me.name} entscheidet selbst <button type="button" className="btn !px-2 !py-0 !text-xs" data-testid="uebernehmen" onClick={() => void api.playerTakeover().catch(() => undefined)}>Übernehmen</button></div>
        : free && <div className="glas pille !px-[11px] !py-1 text-xs" data-testid="plakette-takt"><b className="text-world">◐</b> {me.name} wartet <small className="text-dim">· frei seit {frei.current || w.clock.time}</small></div>}
      {w.playerWaiting && (
        <div className="glas pille pointer-events-auto fixed left-1/2 top-3.5 z-20 -translate-x-1/2 !border-alex !px-[18px] !py-[9px] text-[13px]" data-testid="banner-wartet" role="status">
          <b className="text-[#ffd36e]">Die Zeit steht:</b> {me.name} ist dran
        </div>
      )}
    </div>
  );
}
