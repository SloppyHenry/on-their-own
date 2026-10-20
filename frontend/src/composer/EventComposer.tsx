import { useEffect, useMemo, useRef, useState } from "react";
import { useNames } from "../lib/useNames";
import { useSimStore } from "../store/simStore";
import { accentOf } from "../world/art/people";
import { ClarifyCard, InjectHistory, PreviewCard } from "./Cards";
import { atMinute, useComposer, type When } from "./composerStore";
import { suggest } from "./suggestions";

const PRESETS: [string, When][] = [["Sofort", { kind: "now" }], ["In 30 Min.", { kind: "in", minutes: 30 }], ["In 2 Std.", { kind: "in", minutes: 120 }]];

const dayOf = (minute: number) => Math.floor(minute / 1440) + 1;
const fmt = (m: number) => `Tag ${dayOf(m)}, ${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Ereigniseingabe als Popover der Gott-Werkzeuge (AP18b): Enter sendet, Shift+Enter macht eine neue Zeile. Das Backend liest, fragt nach, zeigt eine Vorschau und führt aus. */
export function EventComposer() {
  const c = useComposer();
  const world = useSimStore((s) => s.world);
  const names = useNames();
  const box = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [clock, setClock] = useState("18:00");
  const [clockDay, setClockDay] = useState(0);
  const now = world?.clock.minute ?? 0;
  const list = useMemo(() => (focused && c.phase !== "reading" ? suggest(c.text, world) : []), [focused, c.text, c.phase, world]);
  const busy = c.phase === "reading" || c.phase === "executing";

  useEffect(() => { void c.loadHistory(); box.current?.focus(); }, []);                           // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {                                                          // Textfeld wächst mit dem Inhalt (bis vier Zeilen)
    const el = box.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 96)}px`; }
  }, [c.text]);

  const setClockTime = (value: string, offset: number) => {
    setClock(value); setClockDay(offset);
    const [h, m] = value.split(":").map(Number);
    c.setWhen({ kind: "clock", day: dayOf(now) + offset, hour: h || 0, minute: m || 0 });
  };
  const when = atMinute(c.when, now);
  const status = {
    reading: "wird gelesen …", executing: "wird ausgeführt …", clarify: "Rückfrage", preview: "Vorschau", done: `ausgeführt ✓${c.message ? ` – ${c.message}` : ""}`,
    rejected: `abgelehnt: ${c.message}`, error: `Fehler: ${c.message}`, idle: "",
  }[c.phase];

  return (
    <div className="relative px-3 py-2.5" data-testid="composer">
      <div className="pointer-events-none absolute inset-x-3 bottom-full z-30 mb-1 flex flex-col gap-2">
        <div className="pointer-events-auto max-w-[44rem]">
          {c.phase === "clarify" && c.proposal && <ClarifyCard p={c.proposal} />}
          {(c.phase === "preview" || (c.phase === "executing" && c.proposal?.status === "needs_confirmation")) && c.proposal && <PreviewCard p={c.proposal} />}
          {c.historyOpen && <InjectHistory items={c.history} onReuse={(t) => { c.setText(t); box.current?.focus(); }} />}
          {list.length > 0 && c.phase !== "clarify" && c.phase !== "preview" && (
            <ul className="max-h-64 overflow-auto rounded-lg border border-line bg-panel py-1 shadow-xl" role="listbox" aria-label="Vorschläge" data-testid="suggestions">
              {list.map((s) => <li key={s}><button role="option" aria-selected={false} className="block w-full cursor-pointer px-3 py-1 text-left text-[13px] hover:bg-panel2" onMouseDown={(e) => { e.preventDefault(); c.setText(s); box.current?.focus(); }}>{s}</button></li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">Ereignis</span>
        <div className="flex gap-1" role="group" aria-label="Betroffene Figuren">
          {world?.agentOrder.filter((id) => world.agents[id]?.profile).map((id) => (
            <button key={id} aria-pressed={c.agents.includes(id)} className="cursor-pointer rounded-full border px-2.5 py-0.5 text-xs" title="Betroffene Figur (optional)"
              style={c.agents.includes(id) ? { borderColor: accentOf(id), color: "var(--color-text)", background: "#ffffff0a" } : { borderColor: "var(--color-line)", color: "var(--color-dim)" }}
              onClick={() => c.toggleAgent(id)}>{names.agent(id)}</button>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Zeitpunkt">
          {PRESETS.map(([label, w]) => <button key={label} aria-pressed={JSON.stringify(c.when) === JSON.stringify(w)} className={`btn !py-0.5 text-xs ${JSON.stringify(c.when) === JSON.stringify(w) ? "on" : ""}`} onClick={() => c.setWhen(w)}>{label}</button>)}
          <select aria-label="Tag" className="rounded-md border border-line bg-bg px-1 py-0.5 text-xs" value={clockDay} onChange={(e) => c.when.kind === "clock" ? setClockTime(clock, Number(e.target.value)) : setClockDay(Number(e.target.value))}>
            <option value={0}>heute</option><option value={1}>morgen</option><option value={2}>übermorgen</option>
          </select>
          <input type="time" aria-label="Uhrzeit" className="rounded-md border border-line bg-bg px-1 py-0.5 text-xs" value={clock} onChange={(e) => setClockTime(e.target.value, clockDay)} />
          {when != null && <span className="text-[11px] text-alex" data-testid="when-label">{fmt(when)}</span>}
        </div>
        <span className="flex-1" />
        <span role="status" data-testid="composer-status" data-phase={c.phase} className={`max-w-[28rem] truncate text-xs ${c.phase === "rejected" || c.phase === "error" ? "text-warn" : c.phase === "done" ? "text-ok" : "text-dim"}`} title={status}>{status}</span>
        <button className={`btn !py-0.5 text-xs ${c.historyOpen ? "on" : ""}`} onClick={c.toggleHistory} aria-pressed={c.historyOpen} data-testid="open-history">Verlauf</button>
      </div>
      <form className="mt-1.5 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void c.submit(); }}>
        <textarea ref={box} rows={1} className="min-h-[34px] flex-1 resize-none rounded-md border border-line bg-bg px-3 py-1.5 text-[14px]" placeholder="Was soll in der Welt passieren? z. B. „Heute beginnt es zu regnen.“" aria-label="Ereignis beschreiben"
          maxLength={1000} value={c.text} disabled={busy || c.phase === "clarify" || c.phase === "preview"} onChange={(e) => c.setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void c.submit(); } if (e.key === "Escape") { c.cancel(); box.current?.blur(); } }} data-testid="composer-input" />
        <button className="btn on" type="submit" disabled={busy || !c.text.trim() || c.phase === "clarify" || c.phase === "preview"} data-testid="composer-send">{busy ? "…" : "Senden"}</button>
      </form>
    </div>
  );
}
