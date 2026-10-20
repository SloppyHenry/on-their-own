// HUD oben links (AP18b, Mockup Bild 1): Uhr-Plakette (Tag, Zeit, Wochentag, Wetter, Dorfname) und Zeitsteuerung.
import { Icon } from "../lib/Icon";
import { weatherName } from "../lib/names";
import { SimulationControls } from "../controls/SimulationControls";
import { useSimStore } from "../store/simStore";

export function ObenLinks() {
  const world = useSimStore((s) => s.world);
  const clock = world?.clock;
  if (!clock || !world) return null;
  const night = clock.daylight < 0.4;
  return (
    <div className="pointer-events-auto absolute left-4 top-3.5 z-10 flex items-center gap-2" data-testid="hud-oben-links">
      <div className="glas pille !gap-2.5 !py-[7px] !pl-2.5 !pr-3.5" data-testid="clock" title={world.worldName ?? "Dorf"}>
        <Icon name={night ? "moon" : "sun"} size={24} className="text-[#ffd36e]" />
        <span className="grid leading-tight"><b className="text-base tracking-[0.02em]">Tag {clock.day} · {clock.time}</b>
          <small className="text-[11px] text-dim">{clock.weekday} · {weatherName(world.weather.kind)}{world.worldName ? ` · ${world.worldName}` : ""}</small></span>
      </div>
      <SimulationControls />
    </div>
  );
}
