// HUD unten rechts (AP18b, Mockup Bild 1): Einblicke als kleine Leiste (Tagebuch, Gedächtnis, Statistik, Wissen) und darüber ein Ticker der letzten drei Ereignisse, der verblasst.
import { useMemo } from "react";
import { useNames } from "../lib/useNames";
import { useSimStore } from "../store/simStore";
import { DEFAULT_FILTERS, useUiStore } from "../store/uiStore";
import { describeEvent } from "../timeline/describeEvent";
import { matchesFilters } from "../timeline/filter";

const ITEMS = [["tagebuch", "📖", "Tagebuch", "T"], ["memory", "🧠", "Gedächtnis", "G"], ["stats", "📊", "Statistik", ""], ["wissen", "🔎", "Wissen", ""]] as const;

export function Einblicke() {
  const view = useUiStore((s) => s.view), setView = useUiStore((s) => s.setView), drawer = useUiStore((s) => s.drawer), setDrawer = useUiStore((s) => s.setDrawer), memoryTab = useUiStore((s) => s.memoryTab);
  const openMemory = useUiStore((s) => s.openMemory);
  const on = (id: string) => (id === "tagebuch" ? drawer === "tagebuch" && view === "world" : id === "wissen" ? view === "memory" && memoryTab === "knowledge" : id === "memory" ? view === "memory" && memoryTab !== "knowledge" : view === "stats");
  const open = (id: string) => {
    if (on(id)) return id === "tagebuch" ? setDrawer(null) : setView("world");
    if (id === "tagebuch") { setView("world"); setDrawer("tagebuch"); }
    else if (id === "stats") { setDrawer(null); setView("stats"); }
    else openMemory(useUiStore.getState().lastAgent, id === "wissen" ? "knowledge" : "memories");
  };
  return (
    <>
      {!drawer && view === "world" && <Ticker />}
      <div className="glas pointer-events-auto absolute bottom-4 right-4 z-10 flex gap-1 p-1.5" role="group" aria-label="Einblicke" data-testid="einblicke">
        {ITEMS.map(([id, ic, label, key]) => (
          <button key={id} type="button" aria-pressed={on(id)} onClick={() => open(id)} data-testid={`einblick-${id}`} title={`${label}${key ? ` (${key})` : ""}`}
            className={`flex cursor-pointer flex-col items-center gap-px rounded-[10px] border px-2.5 py-[5px] text-[11px] max-[1320px]:text-[0px] ${on(id) ? "border-line bg-white/5 text-[#ffd36e]" : "border-transparent bg-transparent text-dim hover:border-line hover:text-[#ffd36e]"}`}>
            <span className="text-[17px] leading-none text-text">{ic}</span><span className="max-[1320px]:hidden">{label}</span><span className="sr-only">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Die drei jüngsten Ereignisse, die auch im Tagebuch stünden. Neue erscheinen unten, ältere verblassen und verschwinden von selbst. */
function Ticker() {
  const events = useSimStore((s) => s.events), names = useNames();
  const last = useMemo(() => {
    const out: { seq: number; text: string }[] = [];
    for (let i = events.length - 1; i >= 0 && out.length < 3; i--) {
      const ev = events[i], d = describeEvent(ev, names);
      if (matchesFilters(ev, d.text, DEFAULT_FILTERS)) out.unshift({ seq: ev.seq, text: d.text });
    }
    return out;
  }, [events, names]);
  return (
    <div className="pointer-events-none absolute bottom-[86px] right-4 z-10 grid w-[360px] justify-items-end gap-[5px] max-[1320px]:w-[300px]" data-testid="ticker" aria-live="off">
      {last.map((e, i) => (
        <div key={e.seq} className="max-w-full" style={{ animation: "ticker-aus 24s forwards" }}>
          <div className="glas-weich hud-pop px-[11px] py-[5px] text-xs" style={{ opacity: i === 0 && last.length === 3 ? 0.45 : i === 1 && last.length >= 2 ? 0.75 : 1 }}>{e.text}</div>
        </div>
      ))}
    </div>
  );
}
