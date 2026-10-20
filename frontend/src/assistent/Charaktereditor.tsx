// Charaktereditor (AP17b): dieselbe Profilmaske wie im Assistenten, ohne laufende Simulation. Vorlagen sind Dateien neben den Spielständen; die mitgelieferten
// sind schreibgeschützt (Duplizieren legt eine eigene an). Export und Import prüfen jedes Feld und melden alle Fehler auf einmal.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../net/api";
import { Brotkrumen } from "../ui/Brotkrumen";
import { Rueckfrage } from "../ui/Rueckfrage";
import { EBENE, useRueckweg } from "../ui/zurueck";
import type { TemplateOut } from "../types/generated";
import { type Personality, type Profile } from "./begrenzung";
import { blankPersonality, blankProfile } from "./entwurf";
import { ProfilMaske, type MaskValue } from "./ProfilMaske";

const lines = (e: unknown) => (e instanceof ApiError ? e.detail.split("\n").filter(Boolean) : ["Backend nicht erreichbar"]);
const toMask = (t: TemplateOut): MaskValue => ({ profile: structuredClone(t.profile) as unknown as Profile, personality: structuredClone(t.personality) as unknown as Personality });

/** `onBack`: zurück zu „Editoren“. Hat die Vorlage ungespeicherte Änderungen, fragt der Editor vorher nach. */
export function Charaktereditor({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<TemplateOut[]>([]);
  const [sel, setSel] = useState<string>("alex");
  const [value, setValue] = useState<MaskValue | null>(null);
  const [dirty, setDirty] = useState(false);
  const [problems, setProblems] = useState<{ title: string; lines: string[] } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const current = list.find((t) => t.id === sel);
  const [asking, setAsking] = useState(false);
  const leave = () => { if (dirty) setAsking(true); else onBack(); };
  useRueckweg(true, EBENE.MenueUnter, leave);

  const reload = useCallback(async (select?: string) => {
    const l = await api.templates();
    setList(l);
    const id = select ?? (l.some((t) => t.id === sel) ? sel : l[0]?.id);
    const t = l.find((x) => x.id === id);
    if (t) { setSel(t.id); setValue(toMask(t)); setDirty(false); }
  }, [sel]);
  useEffect(() => { reload().catch((e) => setProblems({ title: "Vorlagen lassen sich nicht laden", lines: lines(e) })); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (title: string, fn: () => Promise<void>) => {
    setProblems(null); setInfo(null);
    try { await fn(); } catch (e) { setProblems({ title, lines: lines(e) }); }
  };
  const choose = (t: TemplateOut) => { setSel(t.id); setValue(toMask(t)); setDirty(false); setProblems(null); setInfo(null); };
  const download = async () => run("Export nicht möglich", async () => {
    const text = await api.exportTemplate(sel), url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `vorlage-${sel}.json` }).click();
    URL.revokeObjectURL(url);
    setInfo("Exportiert. Die Stimme gehört nicht zur Vorlage; sie gehört zur Figur in der Welt.");
  });
  const upload = async (f: File | undefined) => {
    if (!f) return;
    await run(`${f.name}: nicht importiert`, async () => {
      const r = await api.importTemplate(await f.text());
      await reload(r.template.id);
      setInfo(`✓ ${f.name} importiert (nie über eine bestehende Vorlage geschrieben).${r.warnings.length ? ` Hinweise: ${r.warnings.join(" ")}` : ""}`);
    });
    if (file.current) file.current.value = "";
  };
  return (<>
    <Brotkrumen pfad={[{ label: "Editoren", onClick: leave }, { label: "Charaktereditor" }]} escZu="zurück zu Editoren" />
    {asking && <Rueckfrage titel="Änderungen verwerfen?" text={`Die Vorlage „${value?.profile.name ?? ""}“ hat Änderungen, die noch nicht gespeichert sind.`} ja="Verwerfen und zurück" nein="Weiter bearbeiten" onJa={onBack} onNein={() => setAsking(false)} testid="vorlage-rueckfrage" />}
    <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-4 px-5 pb-5 pt-3 max-[860px]:grid-cols-1" data-testid="charaktereditor">
      <div>
        <div className="grid content-start gap-1.5" data-testid="vorlagen-liste">
          {list.map((t) => { const p = t.profile as unknown as Profile; return (
            <button key={t.id} type="button" onClick={() => choose(t)} data-testid={`vorlage-${t.id}`} aria-pressed={t.id === sel} className={`grid cursor-pointer grid-cols-[1fr_auto] rounded-xl border px-3 py-1.5 text-left ${t.id === sel ? "border-alex bg-alex/10" : "border-line bg-panel2"}`}>
              <b>{p.name}</b><span className={`self-center rounded-full border px-2 text-[11px] ${t.builtin ? "border-line text-dim" : "border-ok text-ok"}`}>{t.builtin ? "mitgeliefert" : "eigene"}</span>
              <small className="text-dim">{p.age} · {p.gender}</small></button>); })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn" data-testid="vorlage-neu" onClick={() => run("Anlegen nicht möglich", async () => { const t = await api.createTemplate(blankProfile("Neu"), blankPersonality()); await reload(t.id); })}>＋ Neue Vorlage</button>
          <button type="button" className="btn" data-testid="vorlage-import" onClick={() => file.current?.click()}>Importieren …</button>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" data-testid="vorlage-datei" onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-dim">Mitgelieferte Vorlagen sind schreibgeschützt: Duplizieren legt eine eigene an. Eigene Vorlagen liegen als Dateien neben den Spielständen.</p>
      </div>
      <div>
        {current && value && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold" data-testid="vorlage-titel">{value.profile.name || "Neu"}</h3>
              {current.builtin && <span className="rounded-full border border-line px-2 text-[11px] text-dim" data-testid="vorlage-geschuetzt">schreibgeschützt</span>}
              <span className="flex-1" />
              <button type="button" className="btn" data-testid="vorlage-duplizieren" onClick={() => run("Duplizieren nicht möglich", async () => { const t = await api.duplicateTemplate(sel); await reload(t.id); })}>Duplizieren</button>
              <button type="button" className="btn" data-testid="vorlage-export" onClick={() => void download()}>Exportieren (Datei)</button>
              {!current.builtin && <>
                <button type="button" className="btn on" disabled={!dirty} data-testid="vorlage-speichern" onClick={() => run("Speichern nicht möglich", async () => { await api.updateTemplate(sel, value.profile, value.personality); await reload(sel); setInfo("Gespeichert."); })}>Speichern</button>
                <button type="button" className="btn" data-testid="vorlage-loeschen" onClick={() => run("Löschen nicht möglich", async () => { await api.deleteTemplate(sel); await reload("alex"); })}>Löschen</button></>}
            </div>
            {problems && <div role="alert" className="mb-2 rounded-xl border border-warn px-3 py-2 text-[13px] text-warn" data-testid="vorlage-fehler"><b>{problems.title}</b>{problems.lines.length > 0 && <ul className="ml-5 list-disc">{problems.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}</div>}
            {info && <p role="status" className="mb-2 text-[13px] text-ok" data-testid="vorlage-info">{info}</p>}
            <section className="rounded-xl border border-line bg-black/15 p-3"><ProfilMaske tid="editor" value={value} readOnly={current.builtin} onChange={(v) => { setValue(v); setDirty(true); }} /></section>
          </>
        )}
      </div>
    </div>
  </>);
}
