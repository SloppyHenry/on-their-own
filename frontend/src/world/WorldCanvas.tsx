// Weltfläche: Pixelbild im kleinen Puffer (hochskaliert ohne Glättung), darüber Farbstimmung, Lichtschein, Tilt-Shift, Teilchen
// und die DOM-Schilder. Gezeichnet wird von WorldView; Daten kommen über die Brücke.
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../store/uiStore";
import { Overlays } from "./Overlays";
import { isTyping, PlayerController, usePlayer } from "./player/PlayerController";
import { PlayerLayer } from "./player/PlayerLayer";
import { WorldView } from "./view/WorldView";
import { createBridge } from "./worldBridge";

const TILT_MASK = "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0) 36%, rgba(0,0,0,0) 84%, rgba(0,0,0,0.75) 100%)";

export function WorldCanvas() {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), glow = useRef<HTMLCanvasElement>(null);
  const atmo = useRef<HTMLCanvasElement>(null), grade = useRef<HTMLDivElement>(null), tilt = useRef<HTMLDivElement>(null);
  const [bridge] = useState(createBridge);
  const [pc] = useState(() => new PlayerController(() => bridge.world()));
  const [view, setView] = useState<WorldView | null>(null);
  const player = useUiStore((s) => s.playerPreview);
  const focus = useUiStore((s) => s.focusRequest);
  useEffect(() => { if (focus) bridge.commands.focusTile?.(focus.x, focus.y); }, [focus, bridge]);

  useEffect(() => {
    const v = new WorldView({ host: host.current!, canvas: canvas.current!, glow: glow.current!, atmo: atmo.current!, grade: grade.current!, tilt: tilt.current! }, bridge);
    setView(v);
    if (import.meta.env.DEV || location.search.includes("messen")) (window as unknown as { __welt?: WorldView }).__welt = v;   // Prüf- und Messzugang
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target as Element | null) || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (e.key === "Enter" && bridge.playerPreview()) { e.preventDefault(); const sel = bridge.selection(); usePlayer.setState({ say: { open: true, to: sel?.kind === "agent" ? sel.id : null }, menu: null }); return; }
      if (e.key === "0") bridge.commands.fit?.();
      if (e.key === "f" || e.key === "F") bridge.commands.toggleFollow?.();
      if (e.key === "Escape" && v.interior >= 0) bridge.commands.leaveInterior?.();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); v.destroy(); };
  }, [bridge]);

  // Mitspieler-Vorschau hinter dem Schalter: Klick geht/handelt, Umschalt- oder Rechtsklick wählt aus (wie bisher)
  useEffect(() => {
    if (!view) return;
    if (!player) { view.player = null; pc.clear(); usePlayer.setState({ ghost: null }); return; }
    let hover: [number, number] | null = null;
    view.player = {
      click: (hit, tile, sx, sy) => {
        if (hit) { usePlayer.setState({ menu: { x: sx, y: sy, target: hit } }); return true; }
        usePlayer.setState({ menu: null });
        if (tile) pc.moveTo([tile.x, tile.y]);
        return !!tile;
      },
      hover: (t) => { hover = t ? [t.x, t.y] : null; },
      preview: () => { const s = usePlayer.getState(); return { ghost: s.ghost ?? pc.place(), path: s.path, goal: s.goal, hover }; },
    };
  }, [player, view, pc]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e1115]">
      <div ref={host} className="absolute inset-0 touch-none select-none" data-testid="world-canvas">
        <canvas ref={canvas} className="absolute left-0 top-0" style={{ imageRendering: "pixelated" }} data-testid="world-pixels" />
        <div ref={grade} className="pointer-events-none absolute inset-0" style={{ mixBlendMode: "multiply" }} />
        <canvas ref={glow} className="pointer-events-none absolute inset-0 size-full" style={{ mixBlendMode: "plus-lighter" }} data-testid="fx-layer" />
        <div ref={tilt} className="pointer-events-none absolute inset-0" style={{ backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", maskImage: TILT_MASK, WebkitMaskImage: TILT_MASK }} />
        <canvas ref={atmo} className="pointer-events-none absolute inset-0 size-full" />
      </div>
      <Overlays bridge={bridge} />
      {player && <PlayerLayer bridge={bridge} view={view} pc={pc} />}
      <ViewMenu />
    </div>
  );
}

function ViewMenu() {
  const mode = useUiStore((s) => s.worldMode), setMode = useUiStore((s) => s.setWorldMode);
  const player = useUiStore((s) => s.playerPreview), setPlayer = useUiStore((s) => s.setPlayerPreview);
  const btn = (on: boolean) => `rounded-md px-2 py-0.5 ${on ? "bg-white/15 text-white" : "text-dim hover:text-white"}`;
  return (
    <div className="absolute right-3 top-3 z-[4] flex flex-col items-end gap-1.5 text-xs" data-testid="view-menu">
      <div className="flex items-center gap-1 rounded-lg bg-bg/80 px-1.5 py-1" role="group" aria-label="Ansicht">
        <span className="px-1 text-dim">Ansicht:</span>
        <button type="button" className={btn(mode === "tiefe")} aria-pressed={mode === "tiefe"} onClick={() => setMode("tiefe")}>Tiefe</button>
        <button type="button" className={btn(mode === "flach")} aria-pressed={mode === "flach"} onClick={() => setMode("flach")}>Flach</button>
        <label className="ml-2 flex cursor-pointer items-center gap-1.5 px-1 text-dim">
          <input type="checkbox" checked={player} onChange={(e) => setPlayer(e.target.checked)} data-testid="player-toggle" />
          Mitspieler-Steuerung (Vorschau)
        </label>
      </div>
      <div className="rounded-lg bg-bg/80 px-2.5 py-1.5 text-dim">
        {player ? "Klick: gehen/handeln · Umschalt- oder Rechtsklick: auswählen · Enter: sagen · " : "Klick aufs Haus: hineinschauen · Doppelklick: folgen · "}Mausrad: Zoom · Ziehen: verschieben · F: folgen · 0: Gesamtansicht
      </div>
    </div>
  );
}
