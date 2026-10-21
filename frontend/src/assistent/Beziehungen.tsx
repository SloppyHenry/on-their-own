// Beziehungsmatrix (AP17b): Startwerte je Richtung (Zeile → Spalte); ein Klick öffnet das Paar mit beiden Richtungen und der Vorgeschichte.
// Die Vorgeschichte wird beim Start bei beiden zu einer gewöhnlichen Erinnerung (Art Fakt), geschrieben wie gelebtes Wissen.
import { LIM, metaHits } from "./begrenzung";
import { pairKey, relChanged, relOf } from "./entwurf";
import { useAssistent } from "./assistentStore";
import type { Rel } from "./wuerfeln";

const LABEL: Record<keyof Rel, string> = { trust: "Vertrauen", sympathy: "Sympathie", tension: "Spannung", familiarity: "Vertrautheit" };

const WORT = (v: number) => (v < 15 ? "kaum" : v < 35 ? "wenig" : v < 55 ? "mittel" : v < 75 ? "ziemlich" : "sehr");
function Satz({ von, zu, r, tid }: { von: string; zu: string; r: Rel; tid: string }) {
  return (
    <div className="text-xs" data-testid={tid}><b className="text-text">{von} sieht {zu}:</b>{" "}
      <span className="text-dim">Sympathie <b className="text-text">{WORT(r.sympathy)}</b> · Vertrauen <b className="text-text">{WORT(r.trust)}</b> · Spannung <b className="text-text">{WORT(r.tension)}</b> · Vertrautheit <b className="text-text">{WORT(r.familiarity)}</b></span></div>
  );
}

function PaarKarte({ i, j, an, bn, on, onOpen }: { i: number; j: number; an: string; bn: string; on: boolean; onOpen: () => void }) {
  const { draft } = useAssistent();
  const x = relOf(draft, i, j), y = relOf(draft, j, i), chg = relChanged(x) || relChanged(y) || !!draft.stories[pairKey(i, j)]?.trim();
  return (
    <button type="button" data-testid={`rel-paar-${i}-${j}`} onClick={onOpen} aria-pressed={on}
      className={`grid cursor-pointer gap-1 rounded-xl border px-3 py-2 text-left ${on ? "border-alex bg-alex/10" : chg ? "border-warn/70 bg-black/15" : "border-line bg-black/15"}`}>
      <span className="flex items-center justify-between"><b className="text-[13px]">{an} ↔ {bn}</b><small className="text-[11px] text-dim">{chg ? "angepasst" : "Standard"}</small></span>
      <Satz von={an} zu={bn} r={x} tid={`rel-zelle-${i}-${j}`} />
      <Satz von={bn} zu={an} r={y} tid={`rel-zelle-${j}-${i}`} />
    </button>
  );
}

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
      <p className="mb-2 text-[13px] text-dim">Wie die Bewohner zueinander stehen, wenn die Simulation beginnt. Jeder sieht den anderen für sich: Sympathie (mögen), Vertrauen, Spannung (Reibung) und Vertrautheit (wie gut man sich kennt). Standard: Fremde, die sich ein wenig kennen. Ein Klick auf ein Paar öffnet es.</p>
      <div className="grid grid-cols-2 gap-2 max-[860px]:grid-cols-1" data-testid="rel-paare">
        {rs.flatMap((a, i) => rs.map((b, j) => (j <= i ? null : (
          <PaarKarte key={`${i}-${j}`} i={i} j={j} an={a.profile.name} bn={b.profile.name} on={!!pair && pairKey(pair[0], pair[1]) === pairKey(i, j)} onOpen={() => setPair([i, j])} />
        ))))}
      </div>
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
