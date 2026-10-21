// Schritt 1 des Assistenten: die Welt (AP17b). Startwelt (nur Alex und Mira), ein erzeugtes Dorf nach Maß (Seed, Seeufer, Gebäude) oder später selbst gestaltet.
import { useEffect, useState } from "react";
import { api } from "../net/api";
import type { WorldInfoOut } from "../types/generated";
import { houseCount, otherBuildings } from "./entwurf";
import { requestKey, useAssistent } from "./assistentStore";
import { StellgroessenFeld } from "../welten/StellgroessenFeld";
import { Vorschaufenster } from "./Vorschaufenster";

const MIX: [string, string][] = [["shop", "Läden"], ["workshop", "Werkstätten"], ["barn", "Scheunen"], ["stable", "Ställe"]];

function Stepper({ label, value, onChange, min = 0, max = 12, testid, extra }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; testid: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2.5 text-[13px]" data-testid={testid}>
      <span className="w-28 shrink-0 text-dim">{label}</span>
      <button type="button" className="btn px-2 py-0" aria-label={`${label} weniger`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <b className="w-5 text-center text-base">{value}</b>
      <button type="button" className="btn px-2 py-0" aria-label={`${label} mehr`} disabled={value >= max} onClick={() => onChange(value + 1)}>＋</button>
      {extra && <span className="min-w-0 flex-1">{extra}</span>}
    </div>
  );
}

export function StepWelt() {
  const { draft, preview, busy, error, templates } = useAssistent();
  const set = useAssistent((s) => s.setWorld), run = useAssistent((s) => s.runPreview);
  const w = draft.world, n = draft.residents.length, h = houseCount(draft), beds = h * 2, gen = w.kind === "generated", lib = w.kind === "library";
  const [welten, setWelten] = useState<WorldInfoOut[]>([]);
  useEffect(() => { api.worlds().then((l) => setWelten(l.filter((x) => x.id !== "dorf-am-see"))).catch(() => undefined); }, []);
  const gewaehlt = welten.find((x) => x.id === w.libraryId);
  const zuWenig = gen && beds < n;                                                   // zu wenig Betten: gar nicht erst würfeln
  const key = requestKey(draft), fresh = preview?.key === key;
  // Die Vorschau folgt dem Entwurf (kurz verzögert), damit das Bild immer zum Wunsch passt.
  useEffect(() => {
    if (!n || templates.length === 0 || fresh || zuWenig) return;
    const t = setTimeout(() => { void run(); }, 500);
    return () => clearTimeout(t);
  }, [key, n, fresh, zuWenig, templates.length, run]);
  const mix = otherBuildings(draft);
  const setMix = (k: string, v: number) => set({ mix: { ...mix, [k]: v } });
  const special = MIX.reduce((a, [k]) => a + (mix[k as keyof typeof mix] ?? 0), 0);
  return (
    <div data-testid="step-welt">
      <h2 className="mb-1 text-[19px] font-bold">Welt</h2>
      <p className="mb-3 text-[13px] text-dim">Wo die Simulation spielt. Für die Bewohner ist das Dorf „schon immer da“.</p>
      <div className="mb-3 grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
        <button type="button" aria-pressed={!gen} data-testid="welt-start" onClick={() => set({ kind: "start" })} className={`cursor-pointer rounded-xl border p-3 text-left ${!gen ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
          <b>Startwelt</b><small className="mt-0.5 block text-xs text-dim">Das bekannte Dorf am See mit Heimhaus: Zimmer Alex, Zimmer Mira, Werkstatt, Küche, Wohnzimmer. Nur mit Alex und Mira (1–2 Bewohner).</small>
        </button>
        <button type="button" aria-pressed={gen} data-testid="welt-erzeugt" onClick={() => set({ kind: "generated" })} className={`cursor-pointer rounded-xl border p-3 text-left ${gen ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
          <b>Zufallsdorf</b><small className="mt-0.5 block text-xs text-dim">Ein Zufallsgenerator: aus dem Seed entsteht ein Dorf (Form, Wasser, Wald, Gärten, Häuser für 1 bis 8 Bewohner). Eigene Welten gestaltest du im Editor unter Menü › Editoren › Welten und wählst sie hier bei „Startwelt“.</small>
        </button>
      </div>
      {!gen && <section className="mb-3 rounded-xl border border-line bg-black/15 p-3" data-testid="welt-bibliothek">
        <h3 className="sub mt-0">Aus der Bibliothek</h3>
        <p className="mb-2 text-xs text-dim">Mitgelieferte und eigene Welten. Die Welt wird kopiert, die Bibliothek bleibt unverändert. Eigene Welten legst du unter Editoren › Welten an.</p>
        <div className="flex flex-wrap gap-2">
          {welten.map((x) => (
            <button key={x.id} type="button" aria-pressed={w.libraryId === x.id && lib} data-testid={`welt-lib-${x.id}`} onClick={() => set({ kind: "library", libraryId: x.id })}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-left text-[13px] ${w.libraryId === x.id && lib ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
              <b>{x.name}</b><small className="block text-xs text-dim">{x.size[0]}×{x.size[1]} · {x.houses} Häuser{x.startplatz ? "" : " · ohne Startplatz"}{x.origin === "mitgeliefert" ? " · mitgeliefert" : ""}</small>
            </button>
          ))}
          {welten.length === 0 && <span className="text-xs text-dim">Keine weiteren Welten.</span>}
        </div>
      </section>}
      <div className="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
        <div>
          {gen ? (
            <>
              <section className="mb-3 rounded-xl border border-line bg-black/15 p-3">
                <h3 className="sub mt-0">Wunsch</h3>
                <label className="mb-3 grid gap-1 text-xs text-dim">Seed: gleicher Seed, gleiches Dorf
                  <span className="flex"><input type="number" min={0} max={2000000000} className="w-full rounded-l-md rounded-r-none border border-line bg-bg px-2 py-1.5 text-[13px] text-text" value={w.seed} data-testid="welt-seed" onChange={(e) => set({ seed: Math.max(0, Math.min(2_000_000_000, Math.round(+e.target.value || 0))) })} />
                    <button type="button" className="btn -ml-px shrink-0 rounded-l-none rounded-r-md" data-testid="welt-wuerfeln" title="Neuen Seed würfeln" onClick={() => set({ seed: 1 + Math.floor(Math.random() * 99999) })}>🎲 Würfeln</button></span>
                </label>
                <h3 className="sub">Gebäude</h3>
                <Stepper label="Wohnhäuser" value={h} min={1} testid="welt-haeuser" onChange={(v) => set({ houses: v })} extra={<span className="text-xs text-dim">{w.houses == null ? `automatisch: ${n} Bewohner ÷ 2, aufgerundet` : <>von Hand <button type="button" className="underline" onClick={() => set({ houses: null })} data-testid="welt-haeuser-auto">automatisch</button></>}</span>} />
                {MIX.map(([k, l]) => <Stepper key={k} label={l} value={mix[k as keyof typeof mix] ?? 0} testid={`welt-${k}`} onChange={(v) => setMix(k, v)} />)}
                <small className="text-xs text-dim">Höchstens 2 Personen je Haus, jedes Haus mit 2 Betten ohne Besitzer. Das größere Haus mit mehr Zimmern kommt als eigener Baustein später.</small>
              </section>
              <div className="mb-3"><StellgroessenFeld stil={w.stil} onChange={(stil) => set({ stil })} /></div>
            </>
          ) : lib ? (
            <section className="rounded-xl border border-line bg-black/15 p-3" data-testid="welt-lib-info"><h3 className="sub mt-0">{gewaehlt?.name ?? "Welt aus der Bibliothek"}</h3>
              <p className="text-[13px] text-dim">{gewaehlt ? `${gewaehlt.size[0]}×${gewaehlt.size[1]} Kacheln, ${gewaehlt.houses} Häuser. ` : ""}Die Bewohner beginnen am Startplatz{gewaehlt && !gewaehlt.startplatz ? " (diese Welt hat noch keinen: dann in der Mitte der Karte)" : ""} und suchen sich selbst eine Bleibe.</p></section>
          ) : (
            <section className="rounded-xl border border-line bg-black/15 p-3"><h3 className="sub mt-0">Startwelt</h3><p className="text-[13px] text-dim">Die Startwelt bleibt, wie sie ist (Heimhaus, feste Zimmer). Mit mehr als zwei Bewohnern oder anderen Vorlagen als Alex und Mira bitte „Neues Dorf erzeugen“ wählen.</p></section>
          )}
        </div>
        <div>
          {preview?.world && fresh && preview.ok && !zuWenig ? (
            <Vorschaufenster world={preview.world} level={lib ? 0.5 : !gen || special + h <= 3 ? 1 : special + h <= 6 ? 0.5 : 0.25} caption={<>{gen ? `${preview.village}: ${h} ${h === 1 ? "Wohnhaus" : "Wohnhäuser"}, ${special} Sondergebäude. ` : lib ? `${gewaehlt?.name ?? preview.village}. ` : "Startwelt: Dorf am See. "}Vorschau unter dem Schleier wie in AP12c.<br /><small className="text-dim" data-testid="vorschau-bericht">{preview.checks.length ? `Prüfbericht: ${preview.checks.filter((c) => c.ok).length} von ${preview.checks.length} bestanden` : "Die Welt wird erst beim Start angelegt."}</small></>} />
          ) : (
            <div className="grid h-[300px] place-items-center rounded-xl border-2 border-dashed border-plan/60 p-4 text-center text-[13px] text-dim" data-testid="vorschau-leer">
              {zuWenig ? <span role="alert" className="text-warn" data-testid="zu-wenig-haeuser">Zu wenig Häuser für die Bewohner.</span> : busy === "preview" ? "Vorschau wird erstellt …" : preview && !preview.ok && preview.key === key ? <div role="alert" className="text-warn">{preview.errors.map((e) => <div key={e}>{e}</div>)}</div> : error ? <span role="alert" className="text-warn">{error}</span> : "Die Vorschau erscheint hier."}
            </div>
          )}
          {gen && (
              <section className="mt-3 rounded-xl border border-line bg-black/15 p-3" data-testid="welt-haeuser-liste"><h3 className="sub mt-0">Hinweise</h3>
                <h4 className="mb-1 text-[13px] font-bold">Häuser und Betten</h4>
                <div className="flex flex-wrap gap-1.5">{(preview?.houses.length && fresh ? preview.houses : Array.from({ length: h }, (_, i) => ({ n: i + 1, name: "", beds: 2 }))).map((x) => <span key={x.n} className="rounded-full border border-line bg-black/15 px-2.5 py-0.5 text-xs">⌂ Haus {x.n}{x.name ? ` (${x.name})` : ""} · {x.beds} Betten</span>)}</div>
                <p className={`mt-2 text-[13px] ${beds < n ? "text-warn" : "text-dim"}`}>{beds < n ? "Zu wenig Häuser für die Bewohner." : `${beds} Betten für ${n} Bewohner. Wer wo wohnt, entscheiden die Bewohner selbst.`}</p>
              </section>
          )}
        </div>
      </div>
    </div>
  );
}
