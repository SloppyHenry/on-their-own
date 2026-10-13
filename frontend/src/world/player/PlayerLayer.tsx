// Oberfläche der Mitspieler-Vorschau: Hinweis „nichts wird gesendet“, Kontextmenü, Feld „Sagen …“, Dauer am Ziel des Weges.
import { useEffect, useRef } from "react";
import { useSimStore } from "../../store/simStore";
import type { WorldView } from "../view/WorldView";
import type { WorldBridge } from "../worldBridge";
import { choicesFor, nameOf, type Choice } from "./actions";
import { SAY_MAX, usePlayer, type PlayerController } from "./PlayerController";

export function PlayerLayer({ bridge, view, pc }: { bridge: WorldBridge; view: WorldView | null; pc: PlayerController }) {
  const { menu, say, intents, minutes, goal, path } = usePlayer();
  const world = useSimStore((s) => s.world);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => bridge.onFrame((f) => {
    const el = label.current;
    if (!el) return;
    el.style.display = f.goal ? "" : "none";
    if (f.goal) el.style.transform = `translate(${f.goal.x}px, ${f.goal.y + 10}px) translateX(-50%)`;
  }), [bridge]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); usePlayer.setState({ menu: null }); } };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [menu]);

  const choose = (c: Choice) => {
    const t = usePlayer.getState().menu?.target;
    usePlayer.setState({ menu: null });
    if (!t) return;
    if (c.action === "speak") usePlayer.setState({ say: { open: true, to: t.id } });
    else if (c.action === "view") view?.enterInterior(Number(t.id));
    else if (c.action === "move_to" && t.kind === "house") { const d = view?.doorOf(Number(t.id)); if (d) pc.moveTo([d.x, d.y]); }
    else pc.interact(t, c.action, c.params);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-testid="player-layer">
      <div className="absolute bottom-3 left-3 max-w-[60%] rounded-lg bg-[#2b2233]/85 px-3 py-1.5 text-xs text-[#fff8ec]">
        <b>Mitspieler-Vorschau</b> – nichts wird an die Simulation geschickt
        {intents[0] && <div data-testid="player-intent" className="mt-0.5 text-[#ffd94f]">{intents[0]}</div>}
      </div>
      <div ref={label} data-testid="path-preview" className="absolute left-0 top-0 whitespace-nowrap rounded-full bg-[#fff8ec] px-2 py-0.5 text-[11px] font-semibold text-[#3b2c3d] shadow" style={{ display: "none" }}>
        {goal && (path ? `≈ ${minutes} Min.` : "kein Weg")}
      </div>
      {menu && world && (
        <div data-testid="player-menu" role="menu" className="pointer-events-auto absolute flex min-w-36 flex-col overflow-hidden rounded-lg border-2 border-[#3b2c3d] bg-[#fff8ec] text-sm text-[#3b2c3d] shadow-lg"
          style={{ left: menu.x + 6, top: menu.y + 6 }}>
          <div className="bg-[#3b2c3d] px-3 py-1 text-xs font-semibold text-[#fff8ec]">{nameOf(menu.target, world)}</div>
          {choicesFor(menu.target, world).map((c) => (
            <button key={`${c.action}:${String(c.params.mode ?? "")}`} type="button" role="menuitem" className="px-3 py-1 text-left hover:bg-[#ffd94f]/50" onClick={() => choose(c)}>{c.label}</button>
          ))}
        </div>
      )}
      {say.open && <SayBox to={say.to} name={say.to ? world?.agents[say.to]?.name ?? say.to : null} pc={pc} />}
    </div>
  );
}

function SayBox({ to, name, pc }: { to: string | null; name: string | null; pc: PlayerController }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const close = () => usePlayer.setState({ say: { open: false, to: null } });
  return (
    <div className="pointer-events-auto absolute bottom-14 left-1/2 w-[min(32rem,90%)] -translate-x-1/2 rounded-xl border-2 border-[#3b2c3d] bg-[#fff8ec] p-2 text-[#3b2c3d] shadow-lg" data-testid="say-box">
      <div className="mb-1 text-xs font-semibold">Sagen {name ? `zu ${name}` : "(an alle in der Nähe)"} · Enter: sagen · Esc: abbrechen</div>
      <input ref={input} maxLength={SAY_MAX} placeholder="Sagen …" aria-label="Sagen" className="w-full rounded-md border border-[#3b2c3d]/40 bg-white px-2 py-1 text-sm outline-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (pc.say(to, e.currentTarget.value)) close(); }
        }} />
    </div>
  );
}
