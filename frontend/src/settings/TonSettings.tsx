// Einstellungen „Ton“ (AP17d, Mockup docs/mockups/klang.html): Mischpult mit Quelle je Kanal (Code oder CC0), Musik und Klänge anhören,
// Stimme je Bewohner wie im Mockup. Mischpult und Quellen gelten für dieses Gerät, die Stimmen gehören zur Welt (Spielstand).
import { useEffect, useRef, useState } from "react";
import { stimmeVon } from "../klang/buehne";
import { useTon, type Quelle, type Regler } from "../klang/einstellungen";
import type { Loop } from "../klang/kern";
import type { Stueck } from "../klang/musik";
import { PROBE_KLAENGE, PROBE_SCHLEIFEN, probeKlang, probeSchleife, probeStimme } from "../klang/probe";
import { freigeben, getMusikProbe, laeuft, setMusikProbe } from "../klang/regie";
import { KLANGFARBEN, SPRECHARTEN, standardStimme, type Klangfarbe, type Sprechart, type Stimme } from "../klang/stimmen";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import type { Voice } from "../types/generated";
import { accentOf } from "../world/art/people";

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
  return (
    <div className="grid gap-5 py-2 text-[13px]" data-testid="ton-settings">
      <section className="grid gap-2">
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-[#e8ac5c]" checked={t.an} onChange={(e) => t.set({ an: e.target.checked })} data-testid="ton-an" />Ton an (dieses Gerät)</label>
        <Slider label="Gesamt" value={Math.round(t.gesamt * 100)} onChange={(v) => t.set({ gesamt: v / 100 })} fmt={(v) => `${v} %`} disabled={!t.an} testid="ton-gesamt" />
        {t.an && now && <p className="text-[11px] text-dim" data-testid="ton-laeuft">Musik: {now}</p>}
        {!t.an && <p className="text-[11px] text-dim">Der Browser spielt Ton erst nach einem Klick in die Seite.</p>}
      </section>
      <section className="grid gap-1">
        <h3 className="font-semibold">Mischpult</h3>
        {KANAL.map(([k, label, help]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3" data-testid={`ton-kanal-${k}`}>
            <Slider label={label} value={Math.round(t.vol[k] * 100)} onChange={(v) => t.setVol(k, v / 100)} fmt={(v) => `${v} %`} disabled={!t.an} help={help} />
            {k === "voice" ? <span className="text-[11px] text-faint">Code</span> : <Quellen value={t.quelle[k]} onChange={(q) => t.setQuelle(k, q)} name={label} />}
          </div>
        ))}
        <p className="text-[11px] leading-snug text-faint">Code: im Browser erzeugt, kein Download. CC0: freie Aufnahmen (Kenney, Juhani Junkala, Freesound u. a., Liste in docs/assets.md), werden beim ersten Mal geladen. Drinnen spielt ein eigenes Lied, die Umgebung von draußen klingt gedämpft.</p>
      </section>
      <MusikProbe />
      <KlangProbe />
      <Stimmen />
    </div>
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
    <section className="grid gap-1.5">
      <h3 className="font-semibold">Musik anhören <span className="font-normal text-faint">(mit der Quelle aus dem Mischpult)</span></h3>
      <div className="flex flex-wrap gap-1">
        {STUECKE.map(([s, label]) => <button key={s} type="button" className={`btn ${on === s ? "on" : ""}`} onClick={() => play(on === s ? null : s)} data-testid={`ton-musik-${s}`}>▶ {label}</button>)}
        {on && <button type="button" className="btn" onClick={() => play(null)}>■ zurück zur Musik im Spiel</button>}
      </div>
    </section>
  );
}

function KlangProbe() {
  const running = useRef(new Map<string, Loop>());
  const [, tick] = useState(0);
  useEffect(() => () => { running.current.forEach((l) => l.stop()); running.current.clear(); }, []);
  const loop = (id: string, q: Quelle) => {
    const key = id + q, cur = running.current.get(key);
    if (cur) { cur.stop(); running.current.delete(key); tick((n) => n + 1); return; }
    const l = probeSchleife(id, q); if (!l) return;
    running.current.set(key, l); tick((n) => n + 1);
    setTimeout(() => { if (running.current.get(key) === l) { l.stop(); running.current.delete(key); tick((n) => n + 1); } }, 12000);
  };
  const cell = "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md border border-line/60 px-2 py-1";
  return (
    <section className="grid gap-1.5" data-testid="ton-klaenge">
      <h3 className="font-semibold">Klänge anhören</h3>
      <div className="grid grid-cols-2 gap-1 max-[560px]:grid-cols-1">
        {PROBE_KLAENGE.map((p) => (
          <div key={p.label} className={cell}>
            <span className="truncate">{p.label}</span>
            <button type="button" className="btn px-1.5 py-0 text-xs" onClick={() => void probeKlang(p, "code")}>▶ Code</button>
            <button type="button" className="btn px-1.5 py-0 text-xs disabled:opacity-30" disabled={!p.cc0} onClick={() => void probeKlang(p, "cc0")} title={p.cc0 ? "" : "nur aus Code"}>▶ CC0</button>
          </div>
        ))}
        {PROBE_SCHLEIFEN.map((s) => (
          <div key={s.id} className={cell}>
            <span className="truncate">{s.label}</span>
            <button type="button" className={`btn px-1.5 py-0 text-xs ${running.current.has(s.id + "code") ? "on" : ""}`} onClick={() => loop(s.id, "code")} data-testid={`ton-schleife-${s.id}`}>▶ Code</button>
            <button type="button" className={`btn px-1.5 py-0 text-xs disabled:opacity-30 ${running.current.has(s.id + "cc0") ? "on" : ""}`} disabled={!s.cc0} onClick={() => loop(s.id, "cc0")}>▶ CC0</button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-faint">Dauerklänge laufen 12 Sekunden oder bis zum zweiten Klick.</p>
    </section>
  );
}

function Stimmen() {
  const world = useSimStore((s) => s.world);
  const [text, setText] = useState(SAETZE[0]);
  const [draft, setDraft] = useState<Record<string, Partial<Stimme>>>({});         // während des Ziehens, bis die Welt die Stimme bestätigt
  const [error, setError] = useState<string | null>(null);
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
    <section className="grid gap-2" data-testid="ton-stimmen">
      <h3 className="font-semibold">Stimmen der Bewohner</h3>
      <p className="text-[11px] leading-snug text-faint">Jede Figur hat eine eigene Stimme (Vorschlag nach Geschlecht und Alter). Sie gehört zur Welt: Sie wird mit dem Spielstand gespeichert und gilt in allen Browsern; die Bewohner merken davon nichts. Der Text bleibt in der Blase und läuft mit der Stimme mit; nach etwa acht Sekunden verklingt die Stimme.</p>
      <div className="flex gap-1">
        <input className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1" value={text} onChange={(e) => setText(e.target.value)} aria-label="Probesatz" data-testid="ton-probesatz" />
      </div>
      <div className="flex flex-wrap gap-1">{SAETZE.map((s, i) => <button key={s} type="button" className="btn px-1.5 py-0 text-xs" onClick={() => setText(s)}>{["Aussage", "Ja/Nein-Frage", "W-Frage", "Ausruf", "Zögern"][i]}</button>)}</div>
      {error && <p role="alert" className="text-[12px] text-warn">{error}</p>}
      {world.agentOrder.map((id) => {
        const a = world.agents[id], v = stimme(id), custom = !!world.voices?.[id] || !!draft[id];
        return (
          <div key={id} className="grid gap-1 rounded-lg border border-line/70 p-2" style={{ borderLeft: `3px solid ${accentOf(id)}` }} data-testid={`ton-stimme-${id}`}>
            <div className="flex items-center gap-2">
              <b style={{ color: accentOf(id) }}>{a.name}</b>
              {a.profile && <span className="text-[11px] text-faint">{a.profile.age} J., {a.profile.gender}</span>}
              <span className="flex-1" />
              {custom && <button type="button" className="text-[11px] text-dim underline hover:text-text" onClick={() => zuruecksetzen(id)} data-testid={`ton-standard-${id}`}>Standard</button>}
              <button type="button" className="btn px-2 py-0 text-xs" onClick={() => probeStimme(id, text, v)} data-testid={`ton-sprich-${id}`}>▶ anhören</button>
            </div>
            {SLIDERS.map(([p, label, min, max, f, fmt]) => (
              <Slider key={p} label={label} min={min} max={max} value={Math.round((v[p] as number) * f)} fmt={fmt}
                onChange={(n) => setDraft((d) => ({ ...d, [id]: { ...d[id], [p]: n / f } }))} onCommit={() => commit(id)} />
            ))}
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-0.5"><span className="text-[11px] text-dim">Klang</span>
                <select className="rounded-md border border-line bg-bg px-2 py-1" value={v.timbre} onChange={(e) => commit(id, { timbre: e.target.value as Klangfarbe })}>
                  {Object.entries(KLANGFARBEN).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                </select></label>
              <label className="grid gap-0.5"><span className="text-[11px] text-dim">Art</span>
                <select className="rounded-md border border-line bg-bg px-2 py-1" value={v.style} onChange={(e) => commit(id, { style: e.target.value as Sprechart })}>
                  {Object.entries(SPRECHARTEN).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                </select></label>
            </div>
            {custom && <p className="text-[11px] text-faint">Vorschlag: {standardStimme(id, a.profile).base} Hz, {KLANGFARBEN[standardStimme(id, a.profile).timbre]}</p>}
          </div>
        );
      })}
    </section>
  );
}
