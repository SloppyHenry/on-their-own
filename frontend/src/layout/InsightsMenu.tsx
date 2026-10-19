// Untermenü „Einblicke“ in der Kopfzeile: Verlauf, Statistik, Gedächtnis. Sie gehören nicht zum Spielgeschehen selbst,
// darum stehen sie nicht als eigene Knöpfe in der Kopfzeile. Ist ein Einblick offen, führt „← Zur Welt“ zurück.
import { useEffect, useRef, useState } from "react";
import { useUiStore, type View } from "../store/uiStore";

const ITEMS: [Exclude<View, "world">, string, string][] = [
  ["history", "Verlauf", "open-history-view"],
  ["stats", "Statistik", "open-stats"],
  ["memory", "Gedächtnis", "open-memory"],
];

export function InsightsMenu() {
  const view = useUiStore((s) => s.view), setView = useUiStore((s) => s.setView), openMemory = useUiStore((s) => s.openMemory);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const current = ITEMS.find(([v]) => v === view);
  const choose = (v: Exclude<View, "world">) => { setOpen(false); if (v === "memory") openMemory(useUiStore.getState().lastAgent); else setView(v); };
  return (
    <div ref={root} className="relative flex shrink-0 items-center gap-2">
      {current && <button className="btn" onClick={() => setView("world")} data-testid="back-to-world">← Zur Welt</button>}
      <button className={`btn ${current ? "on" : ""}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="open-insights">
        {current ? `Einblick: ${current[1]}` : "Einblicke"} ▾
      </button>
      {open && (
        <div role="menu" className="fixed z-50 mt-1 flex min-w-40 flex-col rounded-lg border border-line bg-panel p-1 shadow-lg" style={{ top: 44, right: root.current ? window.innerWidth - root.current.getBoundingClientRect().right : 0 }}>
          {ITEMS.map(([v, label, testid]) => (
            <button key={v} role="menuitem" className={`cursor-pointer rounded-md px-3 py-1.5 text-left hover:bg-white/10 ${view === v ? "text-alex" : ""}`} onClick={() => choose(v)} data-testid={testid}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
