// Beziehungsmatrix (AP17b): Startwerte je Richtung (Zeile → Spalte); ein Klick öffnet das Paar mit beiden Richtungen und der Vorgeschichte.
// Die Vorgeschichte wird beim Start bei beiden zu einer gewöhnlichen Erinnerung (Art Fakt), geschrieben wie gelebtes Wissen.
import { LIM, metaHits } from "./begrenzung";
import { pairKey, relChanged, relOf } from "./entwurf";
import { useAssistent } from "./assistentStore";
import type { Rel } from "./wuerfeln";

const LABEL: Record<keyof Rel, string> = { trust: "Vertrauen", sympathy: "Sympathie", tension: "Spannung", familiarity: "Vertrautheit" };
const SHORT: Record<keyof Rel, string> = { trust: "V", sympathy: "S", tension: "Sp", familiarity: "Vt" };

function Richtung({ a, b }: { a: number; b: number }) {
  const { draft } = useAssistent(), setRel = useAssistent((s) => s.setRel);
  const r = relOf(draft, a, b), na = draft.residents[a].profile.name, nb = draft.residents[b].profile.name;
  return (
    <div data-testid={`rel-${a}-${b}`}>
      <h4 className="sub">{na} → {nb}</h4>
      {(Object.keys(LABEL) as (keyof Rel)[]).map((m) => (
        <label key={m} className="grid grid-cols-[1fr_44px] items-center gap-x-2 text-xs text-dim"><span className="col-span-2">{LABEL[m]}</span>
          <input type="range" min={0} max={100} value={r[m]} className="accent-alex" data-testid={`rel-${a}-${b}-${m}`} onChange={(e) => setRel(a, b, { [m]: +e.target.value })} /><b className="text-right text-text">{r[m]}</b></label>
      ))}
    </div>
  );
}

export function Beziehungen() {
  const { draft, pair } = useAssistent(), setPair = useAssistent((s) => s.setPair), setStory = useAssistent((s) => s.setStory), rollRel = useAssistent((s) => s.rollRel), resetRel = useAssistent((s) => s.resetRel);
  const rs = draft.residents, n = rs.length;
  if (n < 2) return <p className="text-[13px] text-dim" data-testid="rel-leer">Mit einem Bewohner gibt es keine Beziehungen.</p>;
  const story = pair ? draft.stories[pairKey(pair[0], pair[1])] ?? "" : "";
  const hits = metaHits(story);
  return (
    <div data-testid="beziehungen">
      <p className="mb-2 text-[13px] text-dim">Startwerte je Richtung (Standard 50 · 50 · 10 · 30). Ein Klick öffnet das Paar. Die Vorgeschichte wird beim Start bei beiden zu einer gewöhnlichen Erinnerung.</p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead><tr><th />{rs.map((r, j) => <th key={j} className="px-1.5 text-left text-xs font-normal text-dim">{r.profile.name}</th>)}</tr></thead>
          <tbody>
            {rs.map((a, i) => (
              <tr key={i}><th className="pr-2 text-left text-xs font-normal text-dim">{a.profile.name}</th>
                {rs.map((_, j) => {
                  if (i === j) return <td key={j} className="text-center text-line">·</td>;
                  const x = relOf(draft, i, j), on = pair && pairKey(pair[0], pair[1]) === pairKey(i, j), chg = relChanged(x) || !!draft.stories[pairKey(i, j)]?.trim();
                  return (
                    <td key={j}><button type="button" data-testid={`rel-zelle-${i}-${j}`} onClick={() => setPair([i, j])} aria-pressed={!!on} style={{ background: `hsl(150 25% ${14 + x.sympathy * 0.12}%)` }}
                      className={`grid min-w-[118px] cursor-pointer rounded-lg border px-2.5 py-1 text-left ${on ? "border-alex" : chg ? "border-warn" : "border-line"}`}>
                      <span className="text-[13px] font-semibold">S {x.sympathy}</span>
                      <small className="text-[10px] text-dim">{(["trust", "tension", "familiarity"] as const).map((m) => `${SHORT[m]} ${x[m]}`).join(" · ")}</small></button></td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="text-dim">S Sympathie · V Vertrauen · Sp Spannung · Vt Vertrautheit (Zeile → Spalte)</small>
      {pair && (
        <div className="mt-2 rounded-xl border border-alex px-3 pb-2 pt-1" data-testid="paar">
          <div className="grid grid-cols-2 gap-6 max-[860px]:grid-cols-1"><Richtung a={pair[0]} b={pair[1]} /><Richtung a={pair[1]} b={pair[0]} /></div>
          <label className="mt-2 grid gap-1 text-xs text-dim"><span className="flex justify-between"><span>Vorgeschichte von {rs[pair[0]].profile.name} und {rs[pair[1]].profile.name}</span><span className={story.length > LIM.story ? "text-warn" : ""}>{story.length}/{LIM.story}</span></span>
            <textarea rows={2} className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text" value={story} data-testid="paar-text" placeholder="z. B. Wir kennen uns seit dem letzten Frühling, als …" onChange={(e) => setStory(pair[0], pair[1], e.target.value)} /></label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn" data-testid="paar-vorschlag" onClick={() => setStory(pair[0], pair[1], `${rs[pair[0]].profile.name} und ${rs[pair[1]].profile.name} kennen sich seit dem letzten Frühling.`)}>Formulierung vorschlagen</button>
            <button type="button" className="btn" data-testid="paar-wuerfeln" onClick={() => rollRel(pair[0], pair[1])}>🎲 Würfeln (±20)</button>
            <button type="button" className="btn" data-testid="paar-standard" onClick={() => resetRel(pair[0], pair[1])}>Auf Standard</button>
          </div>
          {hits.length > 0 && <div role="status" className="mt-2 rounded-lg border border-warn/70 px-3 py-1.5 text-xs text-warn" data-testid="paar-warn">⚠ {hits.map((h) => `„${h}“`).join(", ")}: Bewohner kennen keine Spieler, Leitstelle oder Simulation.</div>}
        </div>
      )}
    </div>
  );
}
