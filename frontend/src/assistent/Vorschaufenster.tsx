// Vorschau der neuen Welt im Assistenten (AP17b): dieselbe Weltansicht wie im Spiel (DorfView) in einem Fenster unter einem Schleier mit gestricheltem Rahmen.
// Es ist nie die laufende Welt: eine eigene Brücke liefert die Vorschau-Welt, ohne Auswahl, ohne Klang, ohne Folgen.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { World } from "../store/types";
import { useUiStore } from "../store/uiStore";
import { DorfView } from "../world/dorf/DorfView";
import { lookOf } from "../world/dorf/look";
import type { Frame, WorldBridge } from "../world/worldBridge";

export function vorschauBruecke(getWorld: () => World): WorldBridge {
  const listeners = new Set<(f: Frame) => void>();
  return {
    world: getWorld, bubbles: () => ({}), subscribe: () => () => {}, selection: () => null, lastAgent: () => null, follow: () => null, select: () => {},
    mode: () => useUiStore.getState().worldMode, playerPreview: () => false, ghostRegion: () => null, setFollow: () => {},
    emitFrame: (f) => listeners.forEach((fn) => fn(f)), onFrame: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, commands: {},
  };
}

export function Vorschaufenster({ world, caption, level = 0.5 }: { world: World; caption?: ReactNode; level?: number }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const look = useMemo(() => lookOf(world), [world]);
  const mode = useUiStore((s) => s.worldMode);
  useEffect(() => {
    if (!look || !host.current || !canvas.current) return;
    const bridge = vorschauBruecke(() => world), view = new DorfView(canvas.current, host.current, bridge, look, { zoom: false, keys: false });
    const t = requestAnimationFrame(() => { view.centerWorld(); });                  // erst nach der ersten Größenmessung
    return () => { cancelAnimationFrame(t); view.destroy(); };
  }, [look, world, level, mode]);
  return (
    <div className="relative h-[300px] overflow-hidden rounded-xl border-2 border-dashed border-plan bg-[#0e1115]" data-testid="vorschau-fenster">
      <div ref={host} className="absolute inset-0 touch-none select-none"><canvas ref={canvas} className="absolute left-0 top-0" style={{ imageRendering: "pixelated" }} data-testid="vorschau-pixels" /></div>
      <div className="pointer-events-none absolute inset-0 bg-plan/15" data-testid="vorschau-schleier" />
      {caption && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1.5 text-xs">{caption}</div>}
    </div>
  );
}
