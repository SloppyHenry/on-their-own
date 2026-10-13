// Namensschilder, Sprechblasen und Raumnamen als DOM über der Weltfläche: scharfe Schrift bei jedem Zoom. Inhalt kommt aus React,
// Position aus dem Bildtakt der Weltansicht. Wer im Haus ist, wird draußen nicht gezeigt; sein Schild steht dann über dem Dach (Frage 18).
import { useEffect, useRef, useState } from "react";
import { activityOf } from "../panels/AgentPanel";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "./art/people";
import type { Frame, WorldBridge } from "./worldBridge";

const MAX_CHARS = 140;
const STACK = 22;                                       // Abstand der Schilder über dem Dach (px)
export const bubbleDuration = (text: string) => Math.min(12000, Math.max(3500, 2500 + 55 * text.length));

/** Lage des Schildes: am Fuß der Figur oder über dem Dach ihres Hauses. */
function tagPlace(f: Frame, id: string): { x: number; y: number; up: boolean; head: number } | null {
  const a = f.agents.find((x) => x.id === id);
  if (!a) return null;
  if (a.house >= 0 && f.interior < 0) {
    const h = f.houses[a.house];
    if (!h) return null;
    const k = h.occupants.indexOf(id);
    return { x: h.x, y: h.y - k * STACK, up: true, head: h.y - h.occupants.length * STACK };
  }
  return a.visible ? { x: a.x, y: a.y + 4 * a.scale, up: false, head: a.y - 26 * a.scale } : null;
}

export function Overlays({ bridge }: { bridge: WorldBridge }) {
  const world = useSimStore((s) => s.world);
  const root = useRef<HTMLDivElement>(null);
  const select = useUiStore((s) => s.select);
  const [interior, setInterior] = useState<{ i: number; rooms: string[]; room: string | null }>({ i: -1, rooms: [], room: null });

  useEffect(() => {
    let cur = "";
    return bridge.onFrame((f) => {
      const el = root.current;
      if (!el) return;
      const key = `${f.interior}|${f.room ?? ""}`;
      if (key !== cur) { cur = key; setInterior({ i: f.interior, rooms: f.room ? [f.room] : f.interiorRooms, room: f.room ?? null }); }
      el.dataset.houses = f.houses.map((h) => (h.occupants.length ? "besetzt" : "leer")).join(",");
      el.dataset.interior = String(f.interior);
      const bubbles = bridge.bubbles(), pulses = useSimStore.getState().pulses, now = Date.now(), W = el.clientWidth, H = el.clientHeight;
      for (const a of f.agents) {
        const tag = el.querySelector<HTMLElement>(`[data-tag="${a.id}"]`), bub = el.querySelector<HTMLElement>(`[data-bubble="${a.id}"]`);
        const pulse = pulses[a.id], active = pulse && now - pulse.at < 2500 ? pulse.kind : "";
        const at = tagPlace(f, a.id), on = !!at && at.x > -60 && at.x < W + 60 && at.y > -40 && at.y < H + 40;
        if (tag) {
          tag.dataset.pulse = active;
          tag.dataset.inside = at?.up ? "1" : "";
          const badge = tag.querySelector<HTMLElement>("[data-badge]");
          if (badge) badge.textContent = active === "saved" ? "  ＋ gemerkt" : active === "recalled" ? "  ↺ erinnert sich" : "";
          tag.style.display = on ? "" : "none";
          if (at) tag.style.transform = `translate(${at.x}px, ${at.y}px) translateX(-50%)${at.up ? " translateY(-100%)" : ""}`;
        }
        if (!bub) continue;
        const b = bubbles[a.id], show = !!b && on && now - b.shownAt < bubbleDuration(b.text);
        bub.style.display = show ? "" : "none";
        if (!show || !at) continue;
        if (bub.dataset.id !== b.id) {
          bub.dataset.id = b.id;
          bub.dataset.seq = String(b.seq);
          bub.textContent = b.text.length > MAX_CHARS ? `${b.text.slice(0, MAX_CHARS - 1)}…` : b.text;
          bub.title = b.text.length > MAX_CHARS ? "Klicken für den ganzen Text im Protokoll" : "";
        }
        const left = Math.max(4, Math.min(at.x - bub.offsetWidth * 0.25, W - bub.offsetWidth - 4));   // nie über den Rand hinaus
        bub.style.transform = `translate(${left}px, ${at.head - 4}px) translateY(-100%)`;
      }
      for (const h of f.houses) {                                   // unsichtbare Marke in der Hausmitte (für Tests und Hilfen)
        let m = el.querySelector<HTMLElement>(`[data-house="${h.i}"]`);
        if (!m) { m = document.createElement("div"); m.dataset.house = String(h.i); m.className = "absolute left-0 top-0 h-px w-px"; el.querySelector("[data-markers]")?.appendChild(m); }
        m.style.transform = `translate(${h.x}px, ${h.cy}px)`;
        m.style.display = f.interior < 0 ? "" : "none";
      }
      for (const r of f.rooms) { const lab = el.querySelector<HTMLElement>(`[data-room="${r.id}"]`); if (lab) lab.style.transform = `translate(${r.x}px, ${r.y}px) translate(-50%, -100%)`; }
    });
  }, [bridge]);

  const inHouse = interior.i >= 0 && !interior.room ? Object.values(world?.agents ?? {}).filter((a) => interior.rooms.includes(a.location_id)).map((a) => a.name) : [];
  return (
    <div ref={root} className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="overlays"
      onClick={(e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-bubble]"); if (b?.dataset.seq) select({ kind: "event", id: b.dataset.seq }); }}>
      <div data-markers="" />
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
          <div data-tag={a.id} className="absolute left-0 top-0 z-[2] whitespace-nowrap rounded-[5px] border bg-bg/80 px-1.5 text-[11px] font-medium text-white" style={{ borderColor: accentOf(a.id), display: "none" }}>
            <b style={{ color: accentOf(a.id) }}>{a.name}</b> · {world ? activityOf(a, world).text : ""}<span data-badge className="text-[10px]" />
          </div>
          <div data-bubble={a.id} data-testid={`bubble-${a.id}`} className="bubble pointer-events-auto absolute left-0 top-0 z-[3] max-w-52 cursor-pointer px-2.5 py-1.5 text-xs leading-snug" style={{ display: "none" }} />
        </div>
      ))}
    </div>
  );
}
