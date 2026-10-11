// Namensschilder und Sprechblasen als DOM über dem Canvas: scharfe Schrift bei jedem Zoom. Inhalt kommt aus React, Position aus dem Bild-Takt der Szene.
import { useEffect, useRef } from "react";
import { activityOf } from "../panels/AgentPanel";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "./draw/characters";
import type { WorldBridge } from "./worldBridge";

const MAX_CHARS = 140;
export const bubbleDuration = (text: string) => Math.min(12000, Math.max(3500, 2500 + 55 * text.length));

export function Overlays({ bridge }: { bridge: WorldBridge }) {
  const world = useSimStore((s) => s.world);
  const root = useRef<HTMLDivElement>(null);
  const select = useUiStore((s) => s.select);

  useEffect(() => {
    bridge.onFrame((f) => {
      const el = root.current;
      if (!el) return;
      const bubbles = bridge.bubbles(), now = Date.now();
      for (const a of f.agents) {
        const tag = el.querySelector<HTMLElement>(`[data-tag="${a.id}"]`), bub = el.querySelector<HTMLElement>(`[data-bubble="${a.id}"]`);
        if (tag) { tag.style.display = a.visible ? "" : "none"; tag.style.transform = `translate(${a.x}px, ${a.y + 4 * f.zoom}px) translateX(-50%)`; }
        if (!bub) continue;
        const b = bubbles[a.id], show = !!b && a.visible && now - b.shownAt < bubbleDuration(b.text);
        bub.style.display = show ? "" : "none";
        if (!show) continue;
        if (bub.dataset.id !== b.id) {
          bub.dataset.id = b.id;
          bub.dataset.seq = String(b.seq);
          bub.textContent = b.text.length > MAX_CHARS ? `${b.text.slice(0, MAX_CHARS - 1)}…` : b.text;
          bub.title = b.text.length > MAX_CHARS ? "Klicken für den ganzen Text im Protokoll" : "";
        }
        bub.style.transform = `translate(${a.x}px, ${a.y - 24 * f.zoom}px) translate(-25%, -100%)`;
      }
    });
    return () => bridge.onFrame(null);
  }, [bridge]);

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="overlays"
      onClick={(e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-bubble]"); if (b?.dataset.seq) select({ kind: "event", id: b.dataset.seq }); }}>
      {Object.values(world?.agents ?? {}).map((a) => (
        <div key={a.id}>
          <div data-tag={a.id} className="absolute left-0 top-0 z-[2] whitespace-nowrap rounded-[5px] border bg-bg/80 px-1.5 text-[11px] font-medium text-white" style={{ borderColor: accentOf(a.id), display: "none" }}>
            <b style={{ color: accentOf(a.id) }}>{a.name}</b> · {world ? activityOf(a, world).text : ""}
          </div>
          <div data-bubble={a.id} data-testid={`bubble-${a.id}`} className="bubble pointer-events-auto absolute left-0 top-0 z-[3] max-w-52 cursor-pointer px-2.5 py-1.5 text-xs leading-snug" style={{ display: "none" }} />
        </div>
      ))}
    </div>
  );
}
