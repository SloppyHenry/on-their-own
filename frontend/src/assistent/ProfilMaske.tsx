// Profilmaske eines Bewohners (AP17b): dieselbe im Assistenten, im Charaktereditor und später für Mitspieler-Charaktere. Zähler und Wortprüfung beim Tippen.
import { useEffect, useState, type ReactNode } from "react";
import { GENDERS, LIM, PKEYS, PLABEL, metaHits, profileChars, profileWarnings, splitList, type Personality, type Profile } from "./begrenzung";
import { KNOWN, type Known } from "./entwurf";

export interface MaskValue { profile: Profile; personality: Personality; known?: Known[] }

const inputCls = "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text disabled:opacity-60";

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-[11px] ${n > max ? "text-warn" : "text-dim"}`}>{n}/{max}</span>;
}

function Field({ label, children, count, testid }: { label: string; children: ReactNode; count?: ReactNode; testid?: string }) {
  return <label className="mb-2 grid gap-1 text-xs text-dim" data-testid={testid}><span className="flex justify-between"><span>{label}</span>{count}</span>{children}</label>;
}

/** Kommagetrennte Liste: der Text bleibt beim Tippen stehen (auch „a, “), erst die fertige Liste geht nach außen. */
function ListField({ label, value, onChange, disabled, testid }: { label: string; value: string[]; onChange: (v: string[]) => void; disabled?: boolean; testid: string }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => { if (JSON.stringify(splitList(text)) !== JSON.stringify(value)) setText(value.join(", ")); }, [value]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <Field label={label}><input className={inputCls} value={text} disabled={disabled} data-testid={testid} onChange={(e) => { setText(e.target.value); onChange(splitList(e.target.value)); }} /></Field>;
}

export function ProfilMaske({ value, onChange, readOnly, home, stimme, tid = "mask" }: { value: MaskValue; onChange: (v: MaskValue) => void; readOnly?: boolean; home?: ReactNode; stimme?: ReactNode; tid?: string }) {
  const { profile: p, personality: q } = value;
  const set = (patch: Partial<Profile>) => onChange({ ...value, profile: { ...p, ...patch } });
  const warns = profileWarnings(p), total = profileChars(p);
  return (
    <div data-testid={tid}>
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 max-[860px]:grid-cols-1">
        <Field label="Name" count={<Counter n={p.name.length} max={LIM.name} />}><input className={inputCls} value={p.name} disabled={readOnly} data-testid={`${tid}-name`} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Geschlecht"><select className={inputCls} value={p.gender} disabled={readOnly} data-testid={`${tid}-gender`} onChange={(e) => set({ gender: e.target.value as Profile["gender"] })}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Alter"><input className={inputCls} type="number" min={0} max={120} value={p.age} disabled={readOnly} data-testid={`${tid}-age`} onChange={(e) => set({ age: Math.max(0, Math.min(120, Math.round(+e.target.value || 0))) })} /></Field>
      </div>
      <Field label="Beschreibung (wie die Figur ist)" count={<Counter n={p.description.length} max={LIM.text} />}><textarea className={inputCls} rows={3} value={p.description} disabled={readOnly} data-testid={`${tid}-description`} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label="Hintergrund (Vorgeschichte der Figur)" count={<Counter n={p.background.length} max={LIM.text} />}><textarea className={inputCls} rows={3} value={p.background} disabled={readOnly} data-testid={`${tid}-background`} onChange={(e) => set({ background: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
        <ListField label={`Interessen (mit Komma trennen, höchstens ${LIM.items})`} value={p.interests} onChange={(v) => set({ interests: v })} disabled={readOnly} testid={`${tid}-interests`} />
        <ListField label="Abneigungen" value={p.dislikes} onChange={(v) => set({ dislikes: v })} disabled={readOnly} testid={`${tid}-dislikes`} />
        <ListField label={`Ziele (höchstens ${LIM.goals})`} value={p.goals} onChange={(v) => set({ goals: v })} disabled={readOnly} testid={`${tid}-goals`} />
        <Field label="Kommunikationsstil" count={<Counter n={p.communication_style.length} max={LIM.style} />}><input className={inputCls} value={p.communication_style} disabled={readOnly} data-testid={`${tid}-style`} onChange={(e) => set({ communication_style: e.target.value })} /></Field>
      </div>
      <p className={`mb-1 text-[11px] ${total > LIM.total ? "text-warn" : "text-faint"}`} data-testid={`${tid}-total`}>Alle Texte zusammen: {total}/{LIM.total} Zeichen</p>
      {warns.length > 0 && <div role="status" className="mb-2 rounded-lg border border-warn/70 px-3 py-1.5 text-xs text-warn" data-testid={`${tid}-warn`}>{warns.map((w) => <div key={w}>⚠ {w} Bitte umformulieren, wenn es nicht Teil der Figur ist.</div>)}</div>}
      <h4 className="sub">Persönlichkeit <span className="normal-case tracking-normal text-faint">0 = gar nicht, 100 = sehr</span></h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 max-[860px]:grid-cols-1">
        {PKEYS.map((k) => (
          <label key={k} className="grid grid-cols-[1fr_44px] items-center gap-x-2 text-xs text-dim">
            <span className="col-span-2">{PLABEL[k]}</span>
            <input type="range" min={0} max={100} value={q[k]} disabled={readOnly} data-testid={`${tid}-p-${k}`} className="accent-alex" onChange={(e) => onChange({ ...value, personality: { ...q, [k]: +e.target.value } })} />
            <b className="text-right text-text">{q[k]}</b>
          </label>
        ))}
      </div>
      {value.known && (
        <div className="mt-3 grid grid-cols-2 gap-6 max-[860px]:grid-cols-1">
          <div>
            <h4 className="sub">Bekannte Orte zu Beginn</h4>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN.map(([k, n]) => (
                <label key={k} className="flex items-center gap-1.5 rounded-full border border-line bg-black/15 px-2.5 py-0.5 text-xs"><input type="checkbox" checked={value.known!.includes(k)} disabled={readOnly} data-testid={`${tid}-known-${k}`}
                  onChange={(e) => onChange({ ...value, known: e.target.checked ? [...value.known!, k] : value.known!.filter((x) => x !== k) })} />{n}</label>
              ))}
            </div>
            <small className="text-dim">Was nicht angehakt ist, erkunden die Bewohner selbst.</small>
          </div>
          <div>
            <h4 className="sub">Stimme und Aussehen</h4>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {!stimme && <span className="rounded-full border border-line bg-black/15 px-2.5 py-0.5">♪ Stimme: im Spiel unter Einstellungen → Ton einstellbar</span>}
              <span className="rounded-full border border-line bg-black/15 px-2.5 py-0.5">Aussehen: automatisch aus der Kennung</span>
            </div>
            {stimme && <div className="mt-2">{stimme}</div>}
            <small className="text-dim">Der Avatar-Editor folgt später und hängt sich hier ein.</small>
          </div>
        </div>
      )}
      {home}
    </div>
  );
}

export { metaHits };
