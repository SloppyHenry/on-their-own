// Phaser läuft nur in diesem Container. Alles andere (Schilder, Blasen) sind DOM-Overlays; Daten kommen über die Brücke.
import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import { Overlays } from "./Overlays";
import { WorldScene } from "./scenes/WorldScene";
import { createBridge } from "./worldBridge";

export function WorldCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLCanvasElement>(null);
  const [bridge] = useState(createBridge);

  useEffect(() => {
    bridge.fx = fx.current;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current!,
      backgroundColor: "#0e1115",
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      render: { pixelArt: true, roundPixels: true, antialias: false },
      disableContextMenu: true,
      banner: false,
      scene: new WorldScene(bridge),
    });
    // Phaser merkt sich die Lage des Canvas; ändert sich das Layout (Seitenleiste, Fenstergröße), wäre der Zeiger verschoben. Darum vor jedem Zeigerereignis neu messen.
    const el = host.current!;
    const remeasure = () => game.scale.updateBounds();
    const ro = new ResizeObserver(() => game.scale.refresh());
    ro.observe(el);
    for (const ev of ["pointerdown", "pointermove", "wheel"]) el.addEventListener(ev, remeasure, { capture: true, passive: true });
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "0") bridge.commands.fit?.();
      if (e.key === "f" || e.key === "F") bridge.commands.toggleFollow?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      for (const ev of ["pointerdown", "pointermove", "wheel"]) el.removeEventListener(ev, remeasure, { capture: true });
      game.destroy(true);
    };
  }, [bridge]);

  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0" data-testid="world-canvas" />
      <canvas ref={fx} className="pointer-events-none absolute inset-0 size-full" data-testid="fx-layer" />
      <Overlays bridge={bridge} />
      <div className="absolute right-3 top-3 z-[4] rounded-lg bg-bg/80 px-2.5 py-1.5 text-xs text-dim">Mausrad: Zoom · Ziehen: verschieben · Doppelklick: folgen · F: folgen · 0: Gesamtansicht</div>
    </div>
  );
}
