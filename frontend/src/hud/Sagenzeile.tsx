// Sagen und Antworten (AP18h-b2, Mockup Bild 4): eine Zeile unten. Spricht dich jemand an, steht sie von selbst da („Alex wartet auf deine Antwort“, Zähler, Enter);
// mit T öffnest du sie auch ohne Ansprache, der Empfänger kommt aus der Nähe (Tab wechselt). Das Gesagte erscheint als ganz normale Sprechblase.
import { useEffect, useMemo, useRef, useState } from "react";
import { Portrait } from "../lib/Portrait";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { accentOf } from "../world/art/people";
import { pc, SAY_MAX } from "../world/player/PlayerController";

export const ANTWORT_S = 60;                       // Frist in echten Sekunden (Frage 83: mindestens eine Minute)

/** Wer dich gerade angesprochen hat und noch auf Antwort wartet: seine neueste Blase an dich, die jünger ist als deine letzte Äußerung und innerhalb der Frist. */
export function pending(bubbles: ReturnType<typeof useSimStore.getState>["bubbles"], me: string, now: number): { from: string; text: string; left: number } | null {
  const mine = bubbles[me]?.seq ?? -1;
  let best: { from: string; text: string; left: number; seq: number } | null = null;
  for (const b of Object.values(bubbles)) {
    if (b.to !== me || b.seq <= mine) continue;
    const left = ANTWORT_S - Math.floor((now - b.shownAt) / 1000);
    if (left > 0 && (!best || b.seq > best.seq)) best = { from: b.agent, text: b.text, left, seq: b.seq };
  }
  return best;
}

export function Sagenzeile() {
  const w = useSimStore((s) => s.world), bubbles = useSimStore((s) => s.bubbles), pop = useUiStore((s) => s.pop), setPop = useUiStore((s) => s.setPop), sel = useUiStore((s) => s.selection);
  const [now, setNow] = useState(Date.now()), [pick, setPick] = useState(0), input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const me = w?.player ? w.agents[w.player] : null;
  const ask = me && w ? pending(bubbles, me.id, now) : null, open = pop === "sagen" || !!ask;
  useRueckweg(pop === "sagen", EBENE.Popover, () => setPop(null));
  const near = useMemo(() => {
    if (!w || !me) return [];
    const d = (a: { x: number; y: number }) => Math.max(Math.abs(a.x - me.x), Math.abs(a.y - me.y));
    return Object.values(w.agents).filter((a) => a.id !== me.id && (a.location_id === me.location_id || d(a) <= 8)).sort((a, b) => d(a) - d(b));
  }, [w, me?.x, me?.y, me?.location_id, me?.id]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  if (!w || !me || !open) return null;
  const chosen = sel?.kind === "agent" && sel.id !== me.id ? sel.id : null;
  const to = ask?.from ?? chosen ?? near[pick % Math.max(1, near.length)]?.id ?? null;
  const partner = to ? w.agents[to] : null;
  const send = async (el: HTMLInputElement) => {
    if (!to || !el.value.trim()) return;
    const text = el.value;
    el.value = "";
    if (!(await pc.say(to, text))) el.value = text;
    else if (pop === "sagen") setPop(null);
  };
  return (
    <div className="glas hud-pop pointer-events-auto absolute bottom-[82px] left-1/2 z-20 flex w-[640px] max-w-[94%] -translate-x-1/2 items-center gap-2.5 px-3 py-2.5" data-testid="sagenzeile">
      {to && <span className="shrink-0 rounded-[10px]" style={{ boxShadow: `0 0 0 2px ${accentOf(to)}` }}><Portrait id={to} size={36} /></span>}
      <div className="min-w-0 flex-1">
        <small className="mb-[3px] block text-xs text-dim" data-testid="sagen-wer">{ask ? <><b style={{ color: accentOf(ask.from) }}>{partner?.name}</b> wartet auf deine Antwort</> : partner ? <>Sagen zu <b style={{ color: accentOf(partner.id) }}>{partner.name}</b>{near.length > 1 && !chosen ? " · Tab wechselt" : ""}</> : "Niemand in der Nähe"}</small>
        <input ref={input} maxLength={SAY_MAX} aria-label="Sagen" placeholder={partner ? `Antwort an ${partner.name} …` : "Sagen …"} disabled={!partner}
          className="w-full rounded-[10px] border border-world bg-black/20 px-[11px] py-2 text-sm outline-none"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); void send(e.currentTarget); }
            else if (e.key === "Tab" && near.length > 1) { e.preventDefault(); setPick((i) => i + 1); }
            else if (e.key === "Escape" && !ask) { e.preventDefault(); setPop(null); }
          }} />
      </div>
      {ask && <div className="grid justify-items-center text-[11px] text-dim" data-testid="antwort-zaehler"><span>bleibt noch</span><b className="text-[15px] text-cream">{ask.left} s</b></div>}
      <button type="button" className="btn gold !px-3.5 !py-2" onClick={() => input.current && void send(input.current)} data-testid="sagen-senden">Sagen <kbd className="kbd !text-ink">Enter</kbd></button>
    </div>
  );
}
