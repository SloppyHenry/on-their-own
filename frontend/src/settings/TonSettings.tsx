// Einstellungen „Ton“ (AP17d, Mockup docs/mockups/klang.html; Zeilen wie docs/mockups/einstellungen.html): Mischpult, Musik anhören, Stimme je Bewohner. Einzelne Klänge anhören gehört später in den
// Sound-Generator, nicht hierher; die Quelle CC0 ist vorerst aus (`CC0_AKTIV` in klang/einstellungen.ts). Mischpult und Quellen gelten für dieses Gerät, die Stimmen gehören zur Welt (Spielstand).
import { useEffect, useState } from "react";
import { stimmeVon } from "../klang/buehne";
import { CC0_AKTIV, useTon, type Quelle, type Regler } from "../klang/einstellungen";
import type { Stueck } from "../klang/musik";
import { probeStimme } from "../klang/probe";
import { freigeben, getMusikProbe, laeuft, setMusikProbe } from "../klang/regie";
import { KLANGFARBEN, SPRECHARTEN, standardStimme, type Klangfarbe, type Sprechart, type Stimme } from "../klang/stimmen";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import type { Voice } from "../types/generated";
import { accentOf } from "../world/art/people";
import { Portrait } from "../lib/Portrait";
import { Abschnitt, Zeile } from "./Zeile";

const seg = (on: boolean) => `cursor-pointer rounded px-2 py-0.5 text-xs ${on ? "bg-white/15 text-white" : "text-dim hover:text-white"}`;
const KANAL: [Regler, string, string][] = [["music", "Musik", "Hintergrundmusik nach Tageszeit, Wetter und Ort"], ["amb", "Umgebung", "Vögel, Bach, Wind, Regen, Grillen, Feuer"], ["fig", "Figuren", "Schritte, Türen, Kochen, Werkzeuge, Schlafen"], ["voice", "Stimmen", "Plappern beim Sprechen (nur aus Code)"]];
const STUECKE: [Stueck, string][] = [["morgen", "Morgen"], ["mittag", "Mittag"], ["abend", "Abend"], ["nacht", "Nacht"], ["drinnen", "Drinnen (Stube)"]];
export const SLIDERS: [keyof Stimme, string, number, number, number, (v: number) => string][] = [
  ["base", "Tonhöhe", 80, 330, 1, (v) => `${v} Hz`], ["speed", "Tempo", 60, 160, 100, (v) => `${v} %`], ["size", "Größe", 80, 135, 100, (v) => `${v} %`],
  ["lively", "Lebhaft", 0, 200, 100, (v) => `${v} %`], ["breath", "Hauch", 0, 40, 100, (v) => `${v} %`],
];
const SAETZE = ["Ich gehe jetzt zum Brunnen und hole Wasser.", "Kommst du heute Abend zum Essen?", "Wo hast du die Schaufel hingelegt?", "Das ist ja großartig!", "Hm… ich weiß nicht so recht…"];

export function TonSettings() {
  const t = useTon();
  const [now, setNow] = useState(laeuft.musik);
  useEffect(() => { const i = setInterval(() => setNow(laeuft.musik), 800); return () => clearInterval(i); }, []);
  const prozent = (v: number) => `${v} %`;
  return (
    <div data-testid="ton-settings">
      <Abschnitt titel="Allgemein">
        <Zeile name="Ton" hilfe="Auch über den Lautsprecher oben rechts." fuer="ton-an">
          <input id="ton-an" type="checkbox" role="switch" className="schalter" checked={t.an} onChange={(e) => t.set({ an: e.target.checked })} data-testid="ton-an" />
        </Zeile>
        <Zeile name="Lautstärke" fuer="ton-gesamt" hilfe={t.an ? (now ? <span data-testid="ton-laeuft">Musik: {now}</span> : undefined) : "Der Browser spielt Ton erst nach einem Klick in die Seite."}>
          <Regler id="ton-gesamt" value={Math.round(t.gesamt * 100)} onChange={(v) => t.set({ gesamt: v / 100 })} fmt={prozent} disabled={!t.an} testid="ton-gesamt" />
        </Zeile>
      </Abschnitt>
      <Abschnitt titel="Mischpult">
        {KANAL.map(([k, label, help]) => (
          <Zeile key={k} name={label} hilfe={help} fuer={`ton-${k}`} testid={`ton-kanal-${k}`}>
            <Regler id={`ton-${k}`} value={Math.round(t.vol[k] * 100)} onChange={(v) => t.setVol(k, v / 100)} fmt={prozent} disabled={!t.an} />
            {k !== "voice" && CC0_AKTIV && <Quellen value={t.quelle[k]} onChange={(q) => t.setQuelle(k, q)} name={label} />}
          </Zeile>
        ))}
      </Abschnitt>
      <MusikProbe />
      <Stimmen />
    </div>
  );
}

/** Schieberegler mit Wert rechts, wie bei den übrigen Einstellungen. */
function Regler({ id, value, onChange, fmt, disabled, testid }: { id: string; value: number; onChange: (v: number) => void; fmt: (v: number) => string; disabled?: boolean; testid?: string }) {
  return (
    <>
      <input id={id} type="range" min={0} max={100} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} data-testid={testid} />
      <span className="einst-wert">{fmt(value)}</span>
    </>
  );
}

export function Slider({ label, value, onChange, onCommit, fmt, min = 0, max = 100, disabled, help, testid }: { label: string; value: number; onChange: (v: number) => void; onCommit?: () => void; fmt: (v: number) => string; min?: number; max?: number; disabled?: boolean; help?: string; testid?: string }) {
  return (
    <label className="grid grid-cols-[6.5rem_minmax(0,1fr)_4rem] items-center gap-2" title={help}>
      <span>{label}</span>
      <input type="range" className="min-w-0 accent-[#e8ac5c]" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} aria-label={label} data-testid={testid} />
      <span className="text-right font-mono text-xs">{fmt(value)}</span>
    </label>
  );
}

function Quellen({ value, onChange, name }: { value: Quelle; onChange: (q: Quelle) => void; name: string }) {
  return (
    <span className="flex rounded-md border border-line p-0.5" role="group" aria-label={`Quelle ${name}`}>
      <button type="button" className={seg(value === "code")} aria-pressed={value === "code"} onClick={() => onChange("code")}>Code</button>
      <button type="button" className={seg(value === "cc0")} aria-pressed={value === "cc0"} onClick={() => onChange("cc0")}>CC0</button>
    </span>
  );
}

function MusikProbe() {
  const [on, setOn] = useState<Stueck | null>(getMusikProbe());
  const play = (s: Stueck | null) => { freigeben(); setMusikProbe(s); setOn(s); };
  useEffect(() => () => setMusikProbe(null), []);                    // beim Verlassen der Einstellungen wieder die Musik zur Lage
  return (
    <Abschnitt titel="Musik anhören">
      <Zeile breit name="Stücke" hilfe="Drinnen spielt ein eigenes Lied, die Umgebung von draußen klingt gedämpft.">
        <div className="flex flex-wrap gap-1">
          {STUECKE.map(([s, label]) => <button key={s} type="button" className={`btn ${on === s ? "on" : ""}`} onClick={() => play(on === s ? null : s)} data-testid={`ton-musik-${s}`}>▶ {label}</button>)}
          {on && <button type="button" className="btn" onClick={() => play(null)}>■ zurück zur Musik im Spiel</button>}
        </div>
      </Zeile>
    </Abschnitt>
  );
}

function Stimmen() {
  const world = useSimStore((s) => s.world);
  const [text, setText] = useState(SAETZE[0]);
  const [draft, setDraft] = useState<Record<string, Partial<Stimme>>>({});         // während des Ziehens, bis die Welt die Stimme bestätigt
  const [error, setError] = useState<string | null>(null);
  const [offen, setOffen] = useState<Record<string, boolean>>({});                 // Regler je Stimme aufgeklappt (eigene Stimmen sind es von selbst)
  if (!world) return null;
  const stimme = (id: string): Stimme => ({ ...stimmeVon(world, id), ...draft[id] });
  /** Stimme in der Welt speichern (wandert mit dem Spielstand) und gleich anhören. */
  const commit = (id: string, patch: Partial<Stimme> = {}) => {
    const v = { ...stimme(id), ...patch };
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } })); setError(null);
    probeStimme(id, text, v);
    api.setVoice(id, v as Voice).then(() => setDraft((d) => { const n = { ...d }; delete n[id]; return n; }), (e) => setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"));
  };
  const zuruecksetzen = (id: string) => { setError(null); setDraft((d) => { const n = { ...d }; delete n[id]; return n; }); api.setVoice(id, null).catch((e) => setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar")); };
  return (
    <div data-testid="ton-stimmen">
      <Abschnitt titel="Stimmen der Bewohner" notiz="Jede Figur hat eine eigene Stimme (Vorschlag nach Geschlecht und Alter). Sie gehört zum Spielstand und gilt in allen Browsern; die Bewohner merken davon nichts.">
        <Zeile breit name="Probesatz" fuer="ton-probesatz">
          <input id="ton-probesatz" className="einst-feld" value={text} onChange={(e) => setText(e.target.value)} data-testid="ton-probesatz" />
          <div className="flex flex-wrap gap-1">{SAETZE.map((s, i) => <button key={s} type="button" className="chip" onClick={() => setText(s)}>{["Aussage", "Ja/Nein-Frage", "W-Frage", "Ausruf", "Zögern"][i]}</button>)}</div>
        </Zeile>
        {error && <p role="alert" className="px-4 pb-2 text-[12px] text-warn">{error}</p>}
        {world.agentOrder.map((id) => {
          const a = world.agents[id], v = stimme(id), custom = !!world.voices?.[id] || !!draft[id], auf = offen[id] ?? custom;
          return (
            <div key={id} data-testid={`ton-stimme-${id}`}>
              <Zeile name={<><span className="rounded-lg" style={{ boxShadow: `0 0 0 2px ${accentOf(id)}` }}><Portrait id={id} size={26} /></span>{a.name}</>} geaendert={custom}
                hilfe={`${a.profile ? `${a.profile.age} J., ${a.profile.gender} · ` : ""}${v.base} Hz, ${KLANGFARBEN[v.timbre]}`}>
                <button type="button" className="btn" onClick={() => probeStimme(id, text, v)} data-testid={`ton-sprich-${id}`}>▶ Probehören</button>
                <button type="button" className={`btn ${auf ? "on" : ""}`} aria-expanded={auf} onClick={() => setOffen((o) => ({ ...o, [id]: !auf }))} data-testid={`ton-anpassen-${id}`}>Anpassen {auf ? "⌄" : "›"}</button>
                {custom ? <button type="button" className="einst-zurueck" onClick={() => zuruecksetzen(id)} data-testid={`ton-standard-${id}`} title={`Vorschlag: ${standardStimme(id, a.profile).base} Hz, ${KLANGFARBEN[standardStimme(id, a.profile).timbre]}`} aria-label={`Stimme von ${a.name} auf Standard zurücksetzen`}>↺</button> : <span className="einst-zurueck leer" aria-hidden="true">↺</span>}
              </Zeile>
              {auf && (
                <div className="grid gap-1 px-4 pb-3 text-[13px]">
                  {SLIDERS.map(([p, label, min, max, f, fmt]) => (
                    <Slider key={p} label={label} min={min} max={max} value={Math.round((v[p] as number) * f)} fmt={fmt}
                      onChange={(n) => setDraft((d) => ({ ...d, [id]: { ...d[id], [p]: n / f } }))} onCommit={() => commit(id)} />
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-0.5"><span className="text-[11px] text-dim">Klang</span>
                      <select className="einst-feld" value={v.timbre} onChange={(e) => commit(id, { timbre: e.target.value as Klangfarbe })}>
                        {Object.entries(KLANGFARBEN).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                      </select></label>
                    <label className="grid gap-0.5"><span className="text-[11px] text-dim">Art</span>
                      <select className="einst-feld" value={v.style} onChange={(e) => commit(id, { style: e.target.value as Sprechart })}>
                        {Object.entries(SPRECHARTEN).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                      </select></label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Abschnitt>
    </div>
  );
}
