// Schritt 3 des Assistenten: die Regeln (AP17b). Preset, Autonomie, Knappheit und der Beobachtungsmodus (Frage 36: Standard Beobachter).
import { useEffect, useState } from "react";
import { api } from "../net/api";
import type { PresetBrief } from "../types/generated";
import { useAssistent } from "./assistentStore";
import type { Mode } from "./entwurf";
import { Weltregeln } from "./Weltregeln";

const MODES: [Mode, string, string][] = [
  ["observer", "Verborgen", "Die Bewohner ahnen nichts von einem Eingreifenden. Standard."],
  ["creator", "Schöpfer", "Die Bewohner wissen, dass jemand die Welt geschaffen hat und zusieht."],
  ["intervention", "Eingriff", "Wie Verborgen; direkte Nachrichten an einzelne Bewohner sind möglich."],
];

function Slider({ label, value, touched, onChange, onReset, unit = "", testid }: { label: string; value: number; touched: boolean; onChange: (n: number) => void; onReset: () => void; unit?: string; testid: string }) {
  return (
    <label className="mb-2 grid grid-cols-[1fr_60px] items-center gap-x-2 text-xs text-dim">
      <span className="col-span-2 flex justify-between"><span>{label}</span>{touched ? <button type="button" className="underline" onClick={onReset} data-testid={`${testid}-zurueck`}>unverändert lassen</button> : <span className="text-faint">unverändert</span>}</span>
      <input type="range" min={0} max={100} value={value} className="accent-alex" data-testid={testid} onChange={(e) => onChange(+e.target.value)} /><b className="text-right text-text">{value}{unit}</b>
    </label>
  );
}

const card = (on: boolean) => `cursor-pointer rounded-xl border p-2.5 text-left ${on ? "border-alex bg-alex/10" : "border-line bg-black/15"}`;

export function StepRegeln() {
  const draft = useAssistent((s) => s.draft), setRules = useAssistent((s) => s.setRules);
  const r = draft.rules;
  const [presets, setPresets] = useState<PresetBrief[]>([]);
  useEffect(() => { api.presets().then(setPresets, () => setPresets([])); }, []);
  const cards: [string, string, string][] = [["", "Standard (nichts ändern)", "Die Werte der Einstellungen, wie sie sind."], ...presets.map((p): [string, string, string] => [p.id, p.name, p.description])];
  return (
    <div data-testid="step-regeln">
      <h2 className="mb-1 text-[19px] font-bold">Regeln</h2>
      <p className="mb-3 text-[13px] text-dim">Wie sich die Welt verhält. Alles hier lässt sich im Spiel in den Einstellungen wieder ändern, nur der Beobachtungsmodus nicht (er ändert sich dort nur im Editor-Modus).</p>
      <section className="mb-3 rounded-xl border border-line bg-black/15 p-3">
        <h3 className="sub mt-0">Preset</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
          {cards.map(([id, name, d]) => <button key={id || "standard"} type="button" aria-pressed={r.preset === id} data-testid={`preset-${id || "standard"}`} onClick={() => setRules({ preset: id })} className={card(r.preset === id)}><b className="text-[13px]">{name}</b><small className="mt-0.5 block text-xs text-dim">{d}</small></button>)}
        </div>
        <small className="mt-1 block text-dim">Aus einem Preset gelten nur die allgemeinen Werte. Persönlichkeit und Profil kommen aus den Bewohnern.</small>
      </section>
      <section className="mb-3 rounded-xl border border-line bg-black/15 p-3">
        <h3 className="sub mt-0">Feineinstellung</h3>
        <Slider label="Autonomie (50 = unverändert)" value={r.autonomy ?? 50} touched={r.autonomy !== null} onChange={(v) => setRules({ autonomy: v })} onReset={() => setRules({ autonomy: null })} testid="regel-autonomie" />
        <Slider label="Knappheit der Ressourcen" value={r.scarcity ?? 0} touched={r.scarcity !== null} onChange={(v) => setRules({ scarcity: v })} onReset={() => setRules({ scarcity: null })} unit=" %" testid="regel-knappheit" />
      </section>
      <section className="mb-3 rounded-xl border border-line bg-black/15 p-3" data-testid="regeln-ereignisse">
        <h3 className="sub mt-0">Automatische Ereignisse</h3>
        <p className="mb-2 text-xs text-dim">Die Welt bringt von sich aus Gewitter, einen umgestürzten Baum, einen Fuchs im Garten … Niemand löst sie aus; für die Bewohner sind es natürliche Vorgänge. Gilt in beiden Spielarten.</p>
        <span className="segment" role="group" aria-label="Automatische Ereignisse">{([["aus", "Aus"], ["selten", "Selten"], ["manchmal", "Manchmal"], ["oft", "Oft"]] as const).map(([v, l]) => (
          <button key={v} type="button" className={(r.worldEvents ?? "manchmal") === v ? "on" : ""} aria-pressed={(r.worldEvents ?? "manchmal") === v} onClick={() => setRules({ worldEvents: v })} data-testid={`ereignisse-${v}`}>{l}</button>))}</span>
        <small className="ml-2 text-dim">Standard: manchmal</small>
      </section>
      <Weltregeln />
      {draft.playMode === "gott" ? (
      <section className="rounded-xl border border-line bg-black/15 p-3">
        <h3 className="sub mt-0">Wissen über den Gott (erweitert)</h3>
        <p className="mb-2 text-xs text-dim">Nur in der Spielart Gott: Was die Bewohner davon erfahren, dass jemand von außen eingreift.</p>
        <div className="grid grid-cols-3 gap-2 max-[860px]:grid-cols-1">
          {MODES.map(([k, n, d]) => <button key={k} type="button" aria-pressed={r.mode === k} data-testid={`modus-${k}`} onClick={() => setRules({ mode: k })} className={card(r.mode === k)}><b className="text-[13px]">{n}</b><small className="mt-0.5 block text-xs text-dim">{d}</small></button>)}
        </div>
        {r.mode === "creator" && (
          <label className="mt-2 grid gap-1 text-xs text-dim"><span className="flex justify-between"><span>Text für den Schöpfermodus</span><span>{r.creatorText.length}/600</span></span>
            <textarea rows={3} className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text" value={r.creatorText} data-testid="modus-text" onChange={(e) => setRules({ creatorText: e.target.value.slice(0, 600) })} /></label>
        )}
        <small className="mt-1 block text-dim">Im Spiel nur im Editor-Modus änderbar (die Zeit steht still). Eine Änderung gilt ab der nächsten Entscheidung und hinterlässt keine Erinnerung.</small>
      </section>
      ) : (
        <section className="rounded-xl border border-line bg-black/15 p-3" data-testid="modus-leben"><h3 className="sub mt-0">Wissen über den Gott</h3><p className="text-[13px] text-dim">In der Spielart Leben greift niemand von außen ein, die Bewohner wissen nichts davon. Dafür gibt es hier nichts einzustellen.</p></section>
      )}
    </div>
  );
}
