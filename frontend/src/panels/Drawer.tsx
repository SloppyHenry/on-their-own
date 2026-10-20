import type { ReactNode } from "react";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";

/** Glas-Karte rechts über der Welt (Bewohner, Ort, Ereignis). Esc oder ✕ schließt sie. Ist das Tagebuch offen, rückt sie links daneben. */
export function Drawer({ title, sub, children, head }: { title: ReactNode; sub?: ReactNode; children: ReactNode; head?: ReactNode }) {
  const select = useUiStore((s) => s.select), tagebuch = useUiStore((s) => s.drawer === "tagebuch");
  useRueckweg(true, EBENE.Auswahl, () => select(null));
  return (
    <div className={`glas hud-pop pointer-events-auto absolute bottom-[86px] top-[66px] z-10 w-[410px] max-w-[94%] overflow-auto px-4 py-3.5 ${tagebuch ? "right-[428px]" : "right-4"}`} data-testid="drawer">
      <button className="btn rund leise float-right" onClick={() => select(null)} aria-label="Schließen" title="Schließen (Esc)">✕</button>
      <div className="mb-1.5 flex items-center gap-3">{head}<div><h3 className="text-[17px] font-semibold">{title}</h3>{sub && <div className="text-dim">{sub}</div>}</div></div>
      {children}
    </div>
  );
}

export const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="mt-1.5"><div className="text-dim">{label} {Math.round(value)} %</div><div className="mt-1 h-1.5 rounded-sm bg-bg"><i className="block h-full rounded-sm" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div></div>
);
