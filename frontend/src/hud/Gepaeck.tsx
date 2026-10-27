// Gepäck (AP18h-b3, Mockup Bild 6): was die eigene Figur in den Händen hält und im Rucksack trägt, mit Ablegen, Geben an … (nur in Reichweite, also am selben Ort) und Essen.
// Alles sind normale Handlungen (`drop`, `give`, `eat`); die Welt entscheidet.
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { pc } from "../world/player/PlayerController";

const RES: Record<string, [string, string]> = { wood: ["🪵", "Holz"], stone: ["🪨", "Stein"], food: ["🍎", "Vorrat"], seeds: ["🌱", "Saatgut"], water: ["💧", "Wasser"], reed: ["🌾", "Schilf"] };

export function Gepaeck() {
  const w = useSimStore((s) => s.world), setPop = useUiStore((s) => s.setPop);
  useRueckweg(true, EBENE.Popover, () => setPop(null));
  const me = w?.player ? w.agents[w.player] : null;
  if (!w || !me) return null;
  const near = Object.values(w.agents).filter((a) => a.id !== me.id && a.location_id === me.location_id);
  const held = Object.values(w.objects).filter((o) => o.holder === me.id);
  const res = Object.entries(me.inventory).filter(([, n]) => n > 0);
  const run = (action: string, params: Record<string, unknown>) => { setPop(null); void pc.act(action, params); };
  const row = (key: string, ic: string, name: string, acts: [string, () => void][]) => (
    <div key={key} className="mt-[5px] flex flex-wrap items-center gap-2 rounded-[11px] border border-line bg-white/[.03] px-[11px] py-2 text-[13px]" data-testid="gepaeck-zeile">
      <span className="w-6 text-center text-lg">{ic}</span><b className="font-semibold">{name}</b>
      <span className="ml-auto flex flex-wrap gap-1.5">{acts.map(([l, f]) => <button key={l} type="button" className="btn !px-2.5 !py-0.5 !text-xs" onClick={f}>{l}</button>)}</span>
    </div>
  );
  const gives = (params: Record<string, unknown>): [string, () => void][] => near.map((a) => [`Geben an ${a.name}`, () => run("give", { to: a.id, ...params })]);
  return (
    <div className="glas hud-pop pointer-events-auto absolute bottom-[82px] left-1/2 z-20 max-h-[60%] w-[470px] -translate-x-1/2 overflow-auto px-4 py-3.5" data-testid="gepaeck" role="menu">
      <h4 className="text-[15px] font-semibold">🎒 Gepäck <small className="font-normal text-dim">· was {me.name} trägt</small></h4>
      <div className="mt-2.5 text-[11px] font-bold uppercase tracking-[.1em] text-dim">In den Händen</div>
      {held.length === 0 && <p className="mt-1 text-xs text-dim">Nichts.</p>}
      {held.map((o) => row(o.id, "✋", o.name, [...(o.kind === "meal" ? [["Essen", () => run("eat", { item: o.id })] as [string, () => void]] : []), ["Ablegen", () => run("drop", { object_id: o.id })], ...gives({ object_id: o.id })]))}
      <div className="mt-2.5 text-[11px] font-bold uppercase tracking-[.1em] text-dim">Im Rucksack</div>
      {res.length === 0 && <p className="mt-1 text-xs text-dim">Nichts.</p>}
      {res.map(([r, n]) => row(r, RES[r]?.[0] ?? "•", `${n} ${RES[r]?.[1] ?? r}`, [...(r === "food" ? [["Essen", () => run("eat", {})] as [string, () => void]] : []), ...gives({ resource: r, amount: 1 })]))}
      <div className="mt-2.5 text-[11.5px] text-dim">{near.length ? `Geben geht nur, wer am selben Ort steht: ${near.map((a) => a.name).join(", ")}.` : "Niemand steht in Reichweite zum Geben."}</div>
    </div>
  );
}
