// Stimme eines Bewohners im Assistenten (AP17b): derselbe Regler und derselbe Klang wie in Einstellungen → Ton (AP17d). Ohne eigene Angabe gilt der Vorschlag
// aus Geschlecht und Alter. Die Stimme gehört zur Figur in der Welt; die Bewohner erfahren nichts davon.
import { useState } from "react";
import { KLANGFARBEN, SPRECHARTEN, standardStimme, type Klangfarbe, type Sprechart, type Stimme } from "../klang/stimmen";
import { probeStimme } from "../klang/probe";
import { SLIDERS, Slider } from "../settings/TonSettings";
import type { Voice } from "../types/generated";
import { slug, type Profile } from "./begrenzung";

const SATZ = "Ich gehe jetzt zum Brunnen und hole Wasser.";

export function StimmeFeld({ profile, value, onChange }: { profile: Profile; value: Voice | null; onChange: (v: Voice | null) => void }) {
  const [open, setOpen] = useState(false);
  const vorschlag = standardStimme(slug(profile.name), profile), v: Stimme = (value as Stimme | null) ?? vorschlag;
  const hoeren = (x: Stimme) => probeStimme(slug(profile.name), SATZ, x);
  const set = (patch: Partial<Stimme>) => onChange({ ...v, ...patch } as Voice);
  return (
    <div data-testid="stimme-feld">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full border border-line bg-black/15 px-2.5 py-0.5" data-testid="stimme-zeile">♪ Stimme: {value ? "eigene" : "Vorschlag"} ({v.base} Hz, {KLANGFARBEN[v.timbre]})</span>
        <button type="button" className="btn px-2 py-0 text-xs" onClick={() => hoeren(v)} data-testid="stimme-hoeren">▶ anhören</button>
        <button type="button" className="btn px-2 py-0 text-xs" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="stimme-einstellen">{open ? "schließen" : "einstellen …"}</button>
        {value && <button type="button" className="text-[11px] text-dim underline" onClick={() => onChange(null)} data-testid="stimme-standard">Standard</button>}
      </div>
      {open && (
        <div className="mt-2 grid gap-1">
          {SLIDERS.map(([p, label, min, max, f, fmt]) => <Slider key={p} label={label} min={min} max={max} value={Math.round((v[p] as number) * f)} fmt={fmt} onChange={(n) => set({ [p]: n / f } as Partial<Stimme>)} onCommit={() => hoeren({ ...v })} />)}
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-0.5 text-[11px] text-dim">Klang<select className="rounded-md border border-line bg-bg px-2 py-1 text-text" value={v.timbre} onChange={(e) => set({ timbre: e.target.value as Klangfarbe })}>{Object.entries(KLANGFARBEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="grid gap-0.5 text-[11px] text-dim">Art<select className="rounded-md border border-line bg-bg px-2 py-1 text-text" value={v.style} onChange={(e) => set({ style: e.target.value as Sprechart })}>{Object.entries(SPRECHARTEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
        </div>
      )}
    </div>
  );
}
