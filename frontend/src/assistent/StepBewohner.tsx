// Schritt 2 des Assistenten: die Bewohner (AP17b). Anzahl mit Tempohinweis, je Bewohner Vorlage, Profilmaske, Würfeln, Wohnen; darunter die Beziehungen.
import { useAssistent } from "./assistentStore";
import { Beziehungen } from "./Beziehungen";
import { houseCount, START_IDS } from "./entwurf";
import { ProfilMaske } from "./ProfilMaske";
import { StimmeFeld } from "./StimmeFeld";

export function StepBewohner() {
  const { draft, sel, templates, limits, preview } = useAssistent();
  const { setN, select, patchResident, takeTemplate, roll, setDiceSeed } = useAssistent.getState();
  const rs = draft.residents, n = rs.length, r = rs[sel] ?? rs[0], start = draft.world.kind === "start";
  if (!r) return <p className="text-dim" data-testid="step-bewohner">Vorlagen werden geladen …</p>;
  const sec = n * limits.secondsPerDecision, max = start ? 2 : limits.maxResidents;
  const wrongStart = start && rs.some((x) => !START_IDS.includes(x.tpl));
  const h = houseCount(draft), taken = (k: number) => rs.filter((x, j) => j !== sel && x.home === k).length;
  const tpls = templates.filter((t) => !start || START_IDS.includes(t.id) || !t.builtin);
  return (
    <div data-testid="step-bewohner">
      <h2 className="mb-1 text-[19px] font-bold">Bewohner</h2>
      <p className="mb-3 text-[13px] text-dim">Wer im Dorf lebt. Jede Figur ist ein gewöhnlicher Bewohner; die Maske ist dieselbe wie im Charaktereditor.</p>
      <section className="mb-3 rounded-xl border border-line bg-black/15 p-3">
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span>Anzahl</span>
          <button type="button" className="btn px-2 py-0" aria-label="Weniger Bewohner" disabled={n <= 1} onClick={() => setN(n - 1)} data-testid="bew-weniger">−</button>
          <b className="w-5 text-center text-base" data-testid="bew-anzahl">{n}</b>
          <button type="button" className="btn px-2 py-0" aria-label="Mehr Bewohner" disabled={n >= max} onClick={() => setN(n + 1)} data-testid="bew-mehr">＋</button>
          <small className="text-dim">1 bis {limits.maxResidents}{start ? " (Startwelt: 2)" : ""}</small>
          <span className="flex-1" />
          <span className={`rounded-full border px-3 py-0.5 text-xs ${n > 4 ? "border-warn text-warn" : "border-ok text-ok"}`} data-testid="bew-tempo">⏱ Eine Runde (jeder entscheidet einmal): etwa <b>{sec.toFixed(1).replace(".", ",")} s</b> bei einem Modell-Slot</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-line"><i className="block h-full bg-ok transition-[width]" style={{ width: `${(n / limits.maxResidents) * 100}%` }} /></div>
        <small className="text-dim">Jeder Bewohner kostet Modellzeit (heute ca. {limits.secondsPerDecision.toString().replace(".", ",")} s je Entscheidung). Mit mehr Bewohnern läuft die Welt entsprechend langsamer.</small>
        {wrongStart && <p role="alert" className="mt-2 text-[13px] text-warn" data-testid="bew-startwelt-warnung">Die Startwelt hat Zimmer nur für Alex und Mira. Für andere Vorlagen bitte „Neues Dorf erzeugen“ wählen.</p>}
      </section>
      <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Bewohner">
        {rs.map((x, i) => <button key={i} type="button" role="tab" aria-selected={i === sel} data-testid={`bew-tab-${i}`} onClick={() => select(i)} className={`btn ${i === sel ? "on" : ""}`}>{x.profile.name || "Neu"}</button>)}
      </div>
      <section className="mb-3 rounded-xl border border-line bg-black/15 p-3" data-testid={`bew-${sel}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
          <label className="flex items-center gap-2 text-dim">Vorlage
            <select className="rounded-md border border-line bg-bg px-2 py-1 text-text" value={r.tpl} data-testid="bew-vorlage" onChange={(e) => takeTemplate(sel, e.target.value)}>
              <option value="">Leer (selbst schreiben)</option>
              {tpls.map((t) => <option key={t.id} value={t.id}>{(t.profile as { name: string }).name}{t.builtin ? "" : " (eigene)"}</option>)}
            </select></label>
          <button type="button" className="btn" data-testid="bew-wuerfeln" onClick={() => roll(sel)}>🎲 Würfeln (Name, Alter, Werte)</button>
          <label className="flex items-center gap-1.5 text-dim">Seed<input type="number" className="w-20 rounded-md border border-line bg-bg px-2 py-1 text-text" value={draft.dice.seed} data-testid="bew-wuerfel-seed" onChange={(e) => setDiceSeed(Math.round(+e.target.value || 0))} /></label>
          <small className="text-dim">Wurf {draft.dice.n}: derselbe Seed und dieselbe Nummer ergeben dasselbe.</small>
        </div>
        <ProfilMaske value={{ profile: r.profile, personality: r.personality, known: r.known }} onChange={(v) => patchResident(sel, { profile: v.profile, personality: v.personality, known: v.known })} tid="maske" stimme={<StimmeFeld profile={r.profile} value={r.voice} onChange={(v) => patchResident(sel, { voice: v })} />}
          home={(
            <div className="mt-3 border-t border-dashed border-line pt-1" data-testid="bew-wohnen">
              <h4 className="sub">Wohnen</h4>
              <label className="grid gap-1 text-xs text-dim">Wohnt schon in
                <select className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[13px] text-text" disabled={start} value={start ? "" : r.home ?? ""} data-testid="bew-haus" onChange={(e) => patchResident(sel, { home: e.target.value ? +e.target.value : null })}>
                  <option value="">offen: sucht sich selbst eine Bleibe</option>
                  {!start && Array.from({ length: h }, (_, k) => k + 1).map((k) => <option key={k} value={k} disabled={taken(k) >= limits.maxPerHouse}>Haus {k}{preview?.houses[k - 1] ? ` (${preview.houses[k - 1].name})` : ""}{taken(k) >= limits.maxPerHouse ? " (voll)" : ""}</option>)}
                </select></label>
              <small className="text-dim">{start ? "In der Startwelt haben Alex und Mira ihre Zimmer. " : ""}Ohne Angabe sucht sich der Bewohner selbst eine Bleibe: wer sich in ein freies Bett legt, dem gehört es. Es gibt keine Zuteilung von außen.</small>
            </div>
          )} />
      </section>
      <section className="rounded-xl border border-line bg-black/15 p-3"><h3 className="sub mt-0">Beziehungen zueinander</h3><Beziehungen /></section>
    </div>
  );
}
