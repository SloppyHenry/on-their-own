// Schilder, Sprech- und Denkblasen und Raumnamen als DOM über der Weltfläche: scharfe Schrift bei jedem Zoom. Inhalt kommt aus React, Lage und Auswahl aus dem Bildtakt der
// Weltansicht (`schilder.ts`, Ausweichen in `blasen.ts`). Wer im Haus ist, wird draußen nicht gezeigt; sein Bildnis steht dann auf dem Dach (AP18c, Frage 18).
import { useEffect, useRef, useState } from "react";
import { activityOf } from "../panels/AgentPanel";
import { Portrait } from "../lib/Portrait";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "./art/people";
import { setzeSchilder } from "./schilder";
import type { WorldBridge } from "./worldBridge";

export function Overlays({ bridge }: { bridge: WorldBridge }) {
  const world = useSimStore((s) => s.world);
  const root = useRef<HTMLDivElement>(null);
  const select = useUiStore((s) => s.select);
  const [interior, setInterior] = useState<{ i: number; rooms: string[]; room: string | null }>({ i: -1, rooms: [], room: null });
  const [roofs, setRoofs] = useState<string[][]>([]);                                                  // wer in welchem Haus ist (Bildnisse auf dem Dach)
  const wenig = useUiStore((s) => s.wenigText);

  useEffect(() => {
    let cur = "", cacheOcc = "";
    return bridge.onFrame((f) => {
      const el = root.current;
      if (!el) return;
      const occ = f.houses.map((h) => h.occupants.join(","));
      if (occ.join("|") !== cacheOcc) { cacheOcc = occ.join("|"); setRoofs(f.houses.map((h) => [...h.occupants])); }
      const key = `${f.interior}|${f.room ?? ""}`;
      if (key !== cur) { cur = key; setInterior({ i: f.interior, rooms: f.interior < 0 ? [] : f.room ? [f.room] : f.interiorRooms, room: f.room ?? null }); }   // draußen keine Raumschilder
      el.dataset.houses = f.houses.map((h) => (h.occupants.length ? "besetzt" : "leer")).join(",");
      el.dataset.interior = String(f.interior);
      const w = bridge.world(), sel = bridge.selection(), W = el.clientWidth;
      if (w) setzeSchilder(el, f, w, bridge.bubbles(), useSimStore.getState().pulses, { selected: sel?.kind === "agent" ? sel.id : null, follow: bridge.follow(), wenig: useUiStore.getState().wenigText });
      for (const h of f.houses) {                                   // unsichtbare Marke in der Hausmitte (für Tests und Hilfen)
        let m = el.querySelector<HTMLElement>(`[data-house="${h.i}"]`);
        if (!m) { m = document.createElement("div"); m.dataset.house = String(h.i); m.className = "absolute left-0 top-0 h-px w-px"; el.querySelector("[data-markers]")?.appendChild(m); }
        m.style.transform = `translate(${h.x}px, ${h.cy}px)`;
        m.style.display = f.interior < 0 ? "" : "none";
      }
      const marke = el.querySelector<HTMLElement>("[data-marke]");                               // Werkstatt: Startplatz oder gewählte Ecke
      if (marke) { marke.style.display = f.goal && !bridge.playerActive() ? "" : "none"; if (f.goal) marke.style.transform = `translate(${f.goal.x}px, ${f.goal.y - 6}px) translate(-50%, -100%)`; }
      const veil = el.querySelector<SVGSVGElement>("[data-testid=ghost]");
      if (veil) {
        const poly = veil.querySelector("polygon"), label = veil.querySelector<SVGGElement>("[data-ghost-label]");
        veil.style.display = f.ghost ? "" : "none";
        if (f.ghost && poly) {
          poly.setAttribute("points", f.ghost.map((q) => q.join(",")).join(" "));
          const top = f.ghost.reduce((a, q) => (q[1] < a[1] ? q : a), f.ghost[0]);
          label?.setAttribute("transform", `translate(${Math.max(8, Math.min(W - 220, top[0] - 100))} ${Math.max(18, top[1] - 8)})`);
        }
      }
      const tip = el.querySelector<HTMLElement>("[data-testid=hover-tip]");
      if (tip) {
        tip.style.opacity = f.tip ? "1" : "0";
        if (f.tip) {
          if (tip.textContent !== f.tip.text) tip.textContent = f.tip.text;
          const half = tip.offsetWidth / 2, x = Math.max(half + 4, Math.min(f.tip.x, W - half - 4));
          tip.style.transform = `translate(${x}px, ${Math.max(f.tip.y - 14, tip.offsetHeight + 4)}px) translate(-50%, -100%)`;
        }
      }
      for (const r of f.rooms) { const lab = el.querySelector<HTMLElement>(`[data-room="${r.id}"]`); if (lab) lab.style.transform = `translate(${r.x}px, ${r.y}px) translate(-50%, -100%)`; }
    });
  }, [bridge]);

  const inHouse = interior.i >= 0 && !interior.room ? Object.values(world?.agents ?? {}).filter((a) => interior.rooms.includes(a.location_id)).map((a) => a.name) : [];
  return (
    <div ref={root} className={`pointer-events-none absolute inset-0 overflow-hidden ${wenig ? "w-vb" : ""}`} data-testid="overlays"
      onClick={(e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-bubble]"); if (b?.dataset.seq) select({ kind: "event", id: b.dataset.seq }); }}>
      <div data-markers="" />
      <div data-testid="werkstatt-marke" data-marke="" className="absolute left-0 top-0 z-[3] text-xl [text-shadow:0_2px_4px_#000a]" style={{ display: "none" }}>📍</div>
      <svg data-testid="ghost" className="absolute inset-0 z-[1] size-full" style={{ display: "none" }} aria-hidden="true">
        <polygon fill="rgba(150,120,220,0.27)" stroke="#d9c8ff" strokeWidth="2" strokeDasharray="8 6" strokeLinejoin="round" />
        <g data-ghost-label=""><rect x="0" y="-14" width="212" height="20" rx="10" fill="#2b2233" fillOpacity="0.88" /><text x="106" y="0" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff8ec">Vorschau – noch nicht übernommen</text></g>
      </svg>
      <div data-testid="hover-tip" className="absolute left-0 top-0 z-[5] whitespace-nowrap rounded-md bg-[#2b2233]/85 px-2 py-0.5 text-[11px] font-semibold text-[#fff8ec] shadow transition-opacity duration-150" style={{ opacity: 0 }} />
      {interior.i >= 0 && (
        <button type="button" data-testid="leave-house" onClick={() => bridge.commands.leaveInterior?.()}
          className="pointer-events-auto absolute left-3 top-3 z-[4] rounded-full border-2 border-[#3b2c3d] bg-[#fff8ec] px-4 py-1.5 text-sm font-semibold text-[#3b2c3d] shadow">
          {interior.room ? <>← ganzes Haus <span className="font-normal opacity-70">(Esc)</span></> : <>← Haus{inHouse.length ? ` · ${inHouse.join(", ")}` : ""} <span className="font-normal opacity-70">(Esc: zurück ins Dorf)</span></>}
        </button>
      )}
      {interior.rooms.map((id) => (
        <div key={id} data-room={id} className="absolute left-0 top-0 z-[1] whitespace-nowrap rounded-full bg-[#2b2233]/60 px-2 py-0.5 text-[11px] font-semibold text-[#fff8ec]">{world?.locations[id]?.name ?? id}</div>
      ))}
      {Object.values(world?.agents ?? {}).map((a) => (
        <div key={a.id}>
          <div data-tag={a.id} className="w-tag" style={{ borderColor: "transparent", display: "none", ["--c" as string]: accentOf(a.id) }}><i />{a.name}</div>
          <div data-bubble={a.id} data-testid={`bubble-${a.id}`} className="w-say" style={{ display: "none", ["--c2" as string]: accentOf(a.id) }}><b>{a.name}</b><span data-text="" /></div>
          <div data-mark={a.id} className="w-mark"><i>•</i><i>•</i><i>•</i></div>
          <div data-think={a.id} data-testid={`think-${a.id}`} className="w-think"><span className="was" data-was="" /><span className="denkt" data-denkt="" /></div>
          <div data-memo={a.id} className="w-memo"><span>＋</span><em /></div>
        </div>
      ))}
      {roofs.map((r, i) => r.length > 0 && (
        <div key={i} data-roof={i} data-testid={`roof-${i}`} className="w-roof" style={{ display: "none" }}>
          {r.map((id) => <span key={id} data-chip={id} className="chipw" style={{ ["--c" as string]: accentOf(id) }}><Portrait id={id} size={20} />{world?.agents[id]?.name}{world ? ` · ${activityOf(world.agents[id], world).text.slice(0, 18)}` : ""}</span>)}
        </div>
      ))}
    </div>
  );
}
