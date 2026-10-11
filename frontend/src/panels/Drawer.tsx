import type { ReactNode } from "react";
import { useUiStore } from "../store/uiStore";

export function Drawer({ title, sub, children, head }: { title: ReactNode; sub?: ReactNode; children: ReactNode; head?: ReactNode }) {
  const select = useUiStore((s) => s.select);
  return (
    <div className="absolute inset-0 z-10 overflow-auto bg-panel px-4 py-3.5" data-testid="drawer">
      <button className="btn float-right" onClick={() => select(null)} aria-label="Schließen">✕</button>
      <div className="mb-1.5 flex items-center gap-3">{head}<div><h3 className="text-[17px] font-semibold">{title}</h3>{sub && <div className="text-dim">{sub}</div>}</div></div>
      {children}
    </div>
  );
}

export const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="mt-1.5"><div className="text-dim">{label} {Math.round(value)} %</div><div className="mt-1 h-1.5 rounded-sm bg-bg"><i className="block h-full rounded-sm" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div></div>
);
