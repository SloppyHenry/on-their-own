// Weltfläche: Welten nach Mockup A zeichnet DorfView (Bild A mit allen Effekten in einer Fläche); Welten ohne eigene Gestaltung
// (alte Spielstände) zeichnet WorldView im kleinen Puffer mit Farbstimmung, Lichtschein, Tilt-Shift und Teilchen als eigene Ebenen.
// Darüber die DOM-Schilder. Daten kommen über die Brücke.
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../editor/editorStore";
import { useWerkstatt } from "../welten/werkstattStore";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { Overlays } from "./Overlays";
import { isTyping, pc, usePlayer } from "./player/PlayerController";
import { PlayerLayer } from "./player/PlayerLayer";
import { DorfView } from "./dorf/DorfView";
import { lookOf } from "./dorf/look";
import { WorldView, type ViewLike } from "./view/WorldView";
import { createBridge } from "./worldBridge";
import { verbindeBuehne } from "../klang/buehne";
import { EBENE, anmelden } from "../ui/zurueck";

const TILT_MASK = "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0) 36%, rgba(0,0,0,0) 84%, rgba(0,0,0,0.75) 100%)";

export function WorldCanvas() {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), glow = useRef<HTMLCanvasElement>(null);
  const atmo = useRef<HTMLCanvasElement>(null), grade = useRef<HTMLDivElement>(null), tilt = useRef<HTMLDivElement>(null);
  const [bridge] = useState(createBridge);
  const [view, setView] = useState<ViewLike | null>(null);
  const editorWorld = useEditorStore((s) => s.preview?.world), werkWorld = useWerkstatt((s) => s.vorschau);
  const previewWorld = werkWorld ?? editorWorld;                                                       // im Welteditor und in der Werkstatt zeigt die Ansicht die Vorschau statt der laufenden Welt
  const editorKind = useEditorStore((s) => s.preview?.kind ?? "");
  const previewKind = werkWorld ? "new" : editorKind;
  const liveLook = useSimStore((s) => { const l = lookOf(s.world); return l ? JSON.stringify(l) : ""; });   // stabil über neue Schnappschüsse
  const lookJson = useMemo(() => { if (!previewWorld) return liveLook; const l = lookOf(previewWorld); return l ? JSON.stringify(l) : ""; }, [previewWorld, liveLook]);
  const cam = useRef<{ key: string; x: number; y: number; level: number } | null>(null);               // Kamera über den Austausch der Ansicht hinweg (neues Gebiet in der Vorschau)
  const viewRef = useRef<ViewLike | null>(null);
  const fly = useEditorStore((s) => s.fly);
  const dorf = !!lookJson;
  const playerId = useSimStore((s) => s.world?.player ?? null), player = !!playerId;
  const focus = useUiStore((s) => s.focusRequest);
  useEffect(() => { if (focus) bridge.commands.focusTile?.(focus.x, focus.y); }, [focus, bridge]);
  useEffect(() => verbindeBuehne(bridge, () => ({ w: host.current?.clientWidth ?? 1, h: host.current?.clientHeight ?? 1 })), [bridge]);   // Klang: nur Sichtbares, am Ort im Bild

  useEffect(() => {
    const v: ViewLike = lookJson ? new DorfView(canvas.current!, host.current!, bridge, JSON.parse(lookJson))
      : new WorldView({ host: host.current!, canvas: canvas.current!, glow: glow.current!, atmo: atmo.current!, grade: grade.current!, tilt: tilt.current! }, bridge);
    setView(v);
    viewRef.current = v;
    const key = previewKind === "new" ? "neu" : "laufend";                                              // die Welt einer neuen Simulation hat ihre eigene Kamera
    if (v instanceof DorfView && cam.current?.key === key) { v.kam.setLevel(cam.current.level); v.kam.set(cam.current.x, cam.current.y); }
    if (import.meta.env.DEV || location.search.includes("messen")) Object.assign(window, { __welt: v, __sim: useSimStore, __ui: useUiStore });   // Prüf- und Messzugang
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target as Element | null) || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (e.key === "0") bridge.commands.fit?.();
      if (e.key === "f" || e.key === "F") { const me = useSimStore.getState().world?.player; if (me) bridge.setFollow(bridge.follow() === me ? null : me); else bridge.commands.toggleFollow?.(); }   // mit eigener Figur folgt F immer ihr
    };
    window.addEventListener("keydown", onKey);
    const offEsc = anmelden(EBENE.Innenansicht, () => { if (v.interior < 0) return false; if (bridge.follow() && bridge.follow() === useSimStore.getState().world?.player) bridge.setFollow(null); bridge.commands.leaveInterior?.(); });    // wer der eigenen Figur folgt, würde sonst gleich wieder ins Haus gezogen          // Esc gehört zuerst der Innenansicht (Raum → Haus → Dorf), erst dann dem Menü
    return () => {
      offEsc();
      window.removeEventListener("keydown", onKey);
      if (v instanceof DorfView) cam.current = { key, x: v.kam.x, y: v.kam.y, level: v.kam.level };
      v.destroy();
    };
  }, [bridge, lookJson]);                                                                              // previewKind gehört zum Austausch des Looks und ändert ihn nie allein

  useEffect(() => {                                                                                    // Kamerafahrt zum neuen Dorf (Vorschau und nach dem Übernehmen)
    if (!fly) return;
    const v = viewRef.current as (ViewLike & { flyTile?: (x: number, y: number) => void }) | null;
    v?.flyTile?.(fly.x, fly.y);
    useEditorStore.getState().clearFly();
  }, [fly, view]);

  // Eigene Figur (AP18h): Klick auf eine Kachel schickt sie dorthin (`move_to`), Klick auf ein Ding oder eine Figur wählt wie bisher aus. Die Kamera folgt ihr von Anfang an.
  useEffect(() => { if (playerId) useUiStore.getState().setFollow(playerId); return () => { if (useUiStore.getState().follow === playerId) useUiStore.getState().setFollow(null); }; }, [playerId]);
  useEffect(() => {
    if (!view) return;
    if (!player) { view.player = null; pc.clear(); return; }
    let hover: [number, number] | null = null;
    view.player = {
      click: (hit, tile) => {
        if (hit || !tile) return false;
        void pc.moveTo([tile.x, tile.y]);
        return true;
      },
      hover: (t) => { hover = t ? [t.x, t.y] : null; },
      preview: () => { const s = usePlayer.getState(), me = pc.here(), act = useSimStore.getState().world?.agents[playerId!]?.action;
        const rest = s.path && me && act?.type === "move_to" ? s.path.slice(Math.max(0, s.path.findIndex((q) => q[0] === me[0] && q[1] === me[1]) + 1)) : null;   // nur noch der Rest des Weges
        return { from: me, path: rest, goal: act?.type === "move_to" ? s.goal : null, hover }; },
    };
  }, [player, playerId, view]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e1115]">
      <div ref={host} className="absolute inset-0 touch-none select-none" data-testid="world-canvas">
        <canvas key={dorf ? "dorf" : "welt"} ref={canvas} className="absolute left-0 top-0" style={{ imageRendering: "pixelated" }} data-testid="world-pixels" data-view={dorf ? "dorf" : "welt"} />
        <div ref={grade} className="pointer-events-none absolute inset-0" style={{ mixBlendMode: "multiply", display: dorf ? "none" : undefined }} />
        <canvas ref={glow} className="pointer-events-none absolute inset-0 size-full" style={{ mixBlendMode: "plus-lighter", display: dorf ? "none" : undefined }} data-testid="fx-layer" />
        <div ref={tilt} className="pointer-events-none absolute inset-0" style={{ backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", maskImage: TILT_MASK, WebkitMaskImage: TILT_MASK, display: dorf ? "none" : undefined }} />
        <canvas ref={atmo} className="pointer-events-none absolute inset-0 size-full" style={{ display: dorf ? "none" : undefined }} />
      </div>
      <Overlays bridge={bridge} />
      {player && <PlayerLayer bridge={bridge} />}
    </div>
  );
}
