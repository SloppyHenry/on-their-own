// Bedienteile für die Stellgrößen des Generators (AP18f, Mockup Bild 9): Dorfform, Kartengröße, Seen, Wasserlauf, Wald, Bäume, Gärten, Felder und Wege.
// Gilt für „Selbst definieren › Welt“ und „Editoren › Welten › Welt erzeugen“. Was nicht passt, lässt der Generator weg; der Prüfbericht nennt es.
import { FORMEN, GROESSEN, VORGABE, WALD, WASSER, WEGE, ZAHLEN, geaendert, type Stil } from "./stellgroessen";

function Segment<T extends string>({ wert, opts, onChange, tid }: { wert: T; opts: [T, string][]; onChange: (v: T) => void; tid: string }) {
  return <span className="segment" role="group">{opts.map(([v, l]) => <button key={v} type="button" className={wert === v ? "on" : ""} aria-pressed={wert === v} onClick={() => onChange(v)} data-testid={`${tid}-${v}`}>{l}</button>)}</span>;
}

function Zeile({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-1.5 flex flex-wrap items-center gap-2.5 text-[13px]"><span className="w-28 shrink-0 text-dim">{label}</span>{children}</div>;
}

export function StellgroessenFeld({ stil, onChange }: { stil: Stil; onChange: (s: Stil) => void }) {
  const set = <K extends keyof Stil>(k: K, v: Stil[K]) => onChange({ ...stil, [k]: v });
  return (
    <section className="rounded-xl border border-line bg-black/15 p-3" data-testid="stellgroessen">
      <div className="mb-2 flex items-center gap-2"><h3 className="sub m-0">Stellgrößen</h3>
        {geaendert(stil) && <button type="button" className="ml-auto text-xs underline text-dim hover:text-text" onClick={() => onChange({ ...VORGABE })} data-testid="stell-zurueck">auf Vorgaben</button>}</div>
      <Zeile label="Dorfform">
        <span className="segment" role="group" aria-label="Dorfform">{FORMEN.map(([v, l, tip]) => <button key={v} type="button" title={tip} className={stil.form === v ? "on" : ""} aria-pressed={stil.form === v} onClick={() => set("form", v)} data-testid={`stell-form-${v}`}>{l}</button>)}</span>
      </Zeile>
      <small className="mb-2 block pl-[7.5rem] text-xs text-dim" data-testid="stell-form-text">{FORMEN.find(([v]) => v === stil.form)?.[2]}</small>
      <Zeile label="Kartengröße"><Segment wert={stil.groesse} opts={GROESSEN} onChange={(v) => set("groesse", v)} tid="stell-groesse" /></Zeile>
      {ZAHLEN.filter(([k]) => k !== "baeume").map(([k, l, lo, hi]) => (
        <Zeile key={k} label={l}>
          <button type="button" className="btn px-2 py-0" aria-label={`${l} weniger`} disabled={stil[k] <= lo} onClick={() => set(k, stil[k] - 1)}>−</button>
          <b className="w-5 text-center text-base" data-testid={`stell-${k}`}>{stil[k]}</b>
          <button type="button" className="btn px-2 py-0" aria-label={`${l} mehr`} disabled={stil[k] >= hi} onClick={() => set(k, stil[k] + 1)}>＋</button>
        </Zeile>
      ))}
      <Zeile label="Wasserlauf"><Segment wert={stil.wasser} opts={WASSER} onChange={(v) => set("wasser", v)} tid="stell-wasser" /></Zeile>
      <Zeile label="Wald"><Segment wert={stil.wald} opts={WALD} onChange={(v) => set("wald", v)} tid="stell-wald" /></Zeile>
      <Zeile label="Bäume im Dorf">
        <input type="range" min={0} max={40} value={stil.baeume} aria-label="Bäume im Dorf" className="accent-alex" onChange={(e) => set("baeume", +e.target.value)} data-testid="stell-baeume" /><b className="w-6 text-right">{stil.baeume}</b>
      </Zeile>
      <Zeile label="Wege"><Segment wert={stil.wege} opts={WEGE} onChange={(v) => set("wege", v)} tid="stell-wege" /></Zeile>
    </section>
  );
}
