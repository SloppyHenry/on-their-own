// HUD unten links (AP18b, Mockup Bild 1): die Bewohner als Bildnisse mit Name, Laune und Zustandszeichen. Klick öffnet die Karte, Doppelklick folgt (bis 8 Bewohner).
import { Icon } from "../lib/Icon";
import { Portrait } from "../lib/Portrait";
import { useOverview } from "../net/useOverview";
import { activityOf } from "../panels/AgentPanel";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { accentOf } from "../world/art/people";

export function Bewohnerleiste() {
  const w = useSimStore((s) => s.world), ov = useOverview();
  const select = useUiStore((s) => s.select), sel = useUiStore((s) => s.selection), setFollow = useUiStore((s) => s.setFollow);
  if (!w) return null;
  const order = w.agentOrder;
  return (
    <section className="glas pointer-events-auto absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-380px)] items-end gap-1.5 overflow-x-auto p-2 [scrollbar-width:none]" aria-label="Bewohner" data-testid="bewohner">
      {order.map((id) => {
        const a = w.agents[id], c = accentOf(id), { text, icon } = activityOf(a, w), mood = ov[id]?.mood.value ?? 0, on = sel?.kind === "agent" && sel.id === id;
        return (
          <button key={id} type="button" data-testid={`agent-card-${id}`} aria-pressed={on} title={`${a.name} · ${text}`}
            onClick={() => select(on ? null : { kind: "agent", id })} onDoubleClick={() => { select({ kind: "agent", id }); setFollow(id); }}
            className={`group relative grid w-[66px] cursor-pointer justify-items-center gap-[3px] rounded-xl border px-0.5 pb-[3px] pt-1 ${on ? "border-alex bg-white/5" : "border-transparent hover:border-line hover:bg-white/5"}`}>
            <span className="rounded-[10px]" style={{ boxShadow: `0 0 0 2px ${c}, 0 3px 0 #0006` }}><Portrait id={id} size={46} /></span>
            <b className="text-xs" style={{ color: c }}>{a.name}</b>
            <span className="block h-1.5 w-10 overflow-hidden rounded-full bg-white/10"><i className="block h-full rounded-full" style={{ width: `${Math.max(6, Math.min(100, 50 + mood / 2))}%`, background: c }} /></span>
            <span className="absolute right-1.5 top-0 grid size-[22px] place-items-center rounded-full border border-line bg-panel2 text-dim"><Icon name={icon} size={13} /></span>
            <span className="glas-weich pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap px-2.5 py-1 text-xs group-hover:block">{a.name} · {text}</span>
          </button>
        );
      })}
    </section>
  );
}
