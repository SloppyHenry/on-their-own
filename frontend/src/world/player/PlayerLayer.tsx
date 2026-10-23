// Oberfläche über der Welt für die eigene Figur (AP18h, Mockup Bild 1 und 3): Dauer am Ziel des Weges und die Ablehnung der Welt als Blase über der Figur.
import { useEffect, useRef } from "react";
import { useSimStore } from "../../store/simStore";
import type { WorldBridge } from "../worldBridge";
import { usePlayer } from "./PlayerController";

export function PlayerLayer({ bridge }: { bridge: WorldBridge }) {
  const { minutes, goal, path, reject } = usePlayer();
  const pid = useSimStore((s) => s.world?.player ?? null);
  const label = useRef<HTMLDivElement>(null), bubble = useRef<HTMLDivElement>(null), shown = useRef(false);
  shown.current = !!reject;

  useEffect(() => bridge.onFrame((f) => {
    const el = label.current;
    if (el) {
      el.style.display = f.goal ? "" : "none";
      if (f.goal) el.style.transform = `translate(${f.goal.x}px, ${f.goal.y + 10}px) translateX(-50%)`;
    }
    const me = pid ? f.agents.find((a) => a.id === pid) : null, b = bubble.current;
    if (b) {
      b.style.display = shown.current && me?.visible ? "" : "none";
      if (shown.current && me?.visible) b.style.transform = `translate(${me.x}px, ${me.y - 82}px) translate(-50%, -100%)`;
    }
  }), [bridge, pid]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-testid="player-layer">
      <div ref={label} data-testid="path-preview" className="absolute left-0 top-0 whitespace-nowrap rounded-full border border-[#74aadc] bg-[rgba(30,22,38,.82)] px-2.5 py-px text-[11px] font-bold text-cream" style={{ display: "none" }}>
        {goal && (path ? `etwa ${minutes} Min.` : "kein Weg")}
      </div>
      <div ref={bubble} data-testid="player-reject" role="status" className="reject absolute left-0 top-0" style={{ display: "none" }}>
        <b>Nicht möglich</b>{reject?.text}
      </div>
    </div>
  );
}
