// Editoren › Welten (AP18e, Mockup Bild 8): die Weltenbibliothek. Welten sind eigene Dateien, getrennt von Spielständen und ohne Bewohner und Gedächtnis.
// Karten mit Öffnen (Werkstatt), Duplizieren, Umbenennen, Export und Löschen; oben Leere Welt, Welt erzeugen, Importieren und „Aus der Simulation sichern“.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../net/api";
import { Brotkrumen } from "../ui/Brotkrumen";
import { Rueckfrage } from "../ui/Rueckfrage";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { useUiStore } from "../store/uiStore";
import type { WorldInfoOut } from "../types/generated";
import { WeltErzeugen } from "./WeltErzeugen";
import { betreteWerkstatt, useWerkstatt } from "./werkstattStore";

const field = "rounded-md border border-line bg-bg px-2 py-1";
const HERKUNFT: Record<string, string> = { mitgeliefert: "mitgeliefert", leer: "leer angelegt", erzeugt: "erzeugt", kopie: "Kopie", import: "importiert", spiel: "aus Simulation" };
type Ansicht = "liste" | "leer" | "erzeugen";
const detail = (e: unknown) => (e instanceof ApiError ? e.detail : "Backend nicht erreichbar");

export function WeltenPane() {
  const setSub = useUiStore((s) => s.setMenuSub), menu = useUiStore((s) => s.menu), sel = useUiStore((s) => s.menuSel);
  const [liste, setListe] = useState<WorldInfoOut[]>([]), [ansicht, setAnsicht] = useState<Ansicht>("liste"), [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<WorldInfoOut | null>(null), [umbenennen, setUmbenennen] = useState<WorldInfoOut | null>(null), [sichern, setSichern] = useState(false);
  const datei = useRef<HTMLInputElement>(null);
  const lade = useCallback(async () => { try { setListe(await api.worlds()); } catch (e) { setFehler(detail(e)); } }, []);
  useEffect(() => { void lade(); }, [lade]);
  useRueckweg(ansicht !== "liste", EBENE.MenueUnter, () => setAnsicht("liste"));
  const tue = async (f: () => Promise<unknown>) => { setFehler(null); try { await f(); await lade(); } catch (e) { setFehler(detail(e)); } };
  const oeffnen = async (w: WorldInfoOut) => {
    if (!menu) return;
    setFehler(null);
    let id = w.id;
    try { if (w.readonly) id = (await api.duplicateWorld(w.id)).id; } catch (e) { setFehler(detail(e)); return; }
    if (!(await betreteWerkstatt(id, { menu, sel, sub: "welten" }))) { setFehler(useWerkstattFehler()); void lade(); }
  };
  const trail = [{ label: "Editoren", onClick: () => (ansicht === "liste" ? setSub(null) : (setAnsicht("liste"), setSub(null))) }, { label: "Welten", onClick: ansicht === "liste" ? undefined : () => setAnsicht("liste") },
    ...(ansicht === "leer" ? [{ label: "Leere Welt" }] : ansicht === "erzeugen" ? [{ label: "Zufallswelt" }] : [])];
  return (
    <div data-testid="welten-pane">
      <Brotkrumen pfad={trail} escZu={ansicht === "liste" ? "zurück zu Editoren" : "zurück zu Welten"} />
      <div className="px-5 pb-5 pt-2">
        {ansicht === "liste" && (
          <>
            <p className="mb-3 text-[13px] text-dim">Welten sind eigene Dateien, getrennt von Spielständen. Eine Welt hat keine Bewohner und kein Gedächtnis; wer darin lebt, bestimmst du beim Anlegen einer Simulation.</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" className="btn on" onClick={() => setAnsicht("leer")} data-testid="welt-leer">＋ Leere Welt</button>
              <button type="button" className="btn" onClick={() => setAnsicht("erzeugen")} data-testid="welt-erzeugen">✦ Zufallswelt</button>
              <button type="button" className="btn" onClick={() => datei.current?.click()} data-testid="welt-import">⤒ Importieren</button>
              <button type="button" className="btn" onClick={() => setSichern(true)} data-testid="welt-sichern" title="Die laufende Welt ohne Bewohner und Gedächtnis als Welt sichern">Aus der Simulation sichern</button>
              <input ref={datei} type="file" accept=".json,application/json" className="hidden" data-testid="welt-import-datei"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void tue(async () => { await api.importWorld(await f.text()); }); }} />
            </div>
            {fehler && <p role="alert" className="mb-3 whitespace-pre-line text-[13px] text-warn" data-testid="welten-fehler">{fehler}</p>}
            <div className="grid grid-cols-2 gap-3 max-[1000px]:grid-cols-1" data-testid="welten-liste">
              {liste.map((w) => <Karte key={w.id} w={w} oeffnen={() => void oeffnen(w)} dupl={() => void tue(() => api.duplicateWorld(w.id))} umbenennen={() => setUmbenennen(w)} loeschen={() => setLoeschen(w)} />)}
            </div>
          </>
        )}
        {ansicht === "leer" && <LeereWelt fertig={async () => { await lade(); setAnsicht("liste"); }} />}
        {ansicht === "erzeugen" && <WeltErzeugen fertig={async () => { await lade(); setAnsicht("liste"); }} />}
      </div>
      {loeschen && <Rueckfrage titel="Welt löschen?" text={`„${loeschen.name}“ wird endgültig gelöscht. Spielstände, die diese Welt benutzen, bleiben unberührt.`} ja="Löschen" nein="Abbrechen" testid="welt-loeschen"
        onNein={() => setLoeschen(null)} onJa={() => { const w = loeschen; setLoeschen(null); void tue(() => api.deleteWorld(w.id)); }} />}
      {umbenennen && <NameDialog titel="Welt umbenennen" start={umbenennen.name} ok="Umbenennen" onAbbruch={() => setUmbenennen(null)} onOk={(n) => { const w = umbenennen; setUmbenennen(null); void tue(() => api.renameWorld(w.id, n)); }} testid="welt-umbenennen" />}
      {sichern && <NameDialog titel="Laufende Welt sichern" start="Gesicherte Welt" ok="Sichern" text="Die Welt der laufenden Simulation kommt ohne Bewohner und Gedächtnis in die Bibliothek." onAbbruch={() => setSichern(false)}
        onOk={(n) => { setSichern(false); void tue(() => api.worldFromSim(n)); }} testid="welt-sichern-dialog" />}
    </div>
  );
}

const useWerkstattFehler = () => useWerkstatt.getState().error ?? "Die Welt lässt sich nicht öffnen.";

function Karte({ w, oeffnen, dupl, umbenennen, loeschen }: { w: WorldInfoOut; oeffnen: () => void; dupl: () => void; umbenennen: () => void; loeschen: () => void }) {
  return (
    <article className="rounded-[14px] border border-line bg-black/20 p-3" data-testid={`welt-${w.id}`}>
      <div className="flex items-baseline gap-2"><b className="text-[15px]">{w.name}</b>
        <span className="rounded-full border border-line px-2 text-[11px] text-dim">{HERKUNFT[w.origin] ?? w.origin}</span></div>
      <small className="mt-1 block text-xs text-dim">{w.size[0]} × {w.size[1]} Kacheln · {w.houses} {w.houses === 1 ? "Haus" : "Häuser"} · {w.lakes} {w.lakes === 1 ? "See" : "Seen"} · {w.startplatz ? "mit Startplatz" : "ohne Startplatz"}</small>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className="btn on" onClick={oeffnen} data-testid={`welt-oeffnen-${w.id}`}>{w.readonly ? "Kopie bearbeiten" : "Öffnen"}</button>
        <button type="button" className="btn" onClick={dupl} data-testid={`welt-dupl-${w.id}`}>Duplizieren</button>
        {!w.readonly && <button type="button" className="btn" onClick={umbenennen} data-testid={`welt-name-${w.id}`}>Umbenennen</button>}
        <a className="btn" href={api.worldExportUrl(w.id)} download data-testid={`welt-export-${w.id}`}>Export</a>
        {!w.readonly && <button type="button" className="btn" onClick={loeschen} data-testid={`welt-del-${w.id}`}>Löschen</button>}
      </div>
    </article>
  );
}

function NameDialog({ titel, start, ok, text, onOk, onAbbruch, testid }: { titel: string; start: string; ok: string; text?: string; onOk: (n: string) => void; onAbbruch: () => void; testid: string }) {
  const [n, setN] = useState(start);
  useRueckweg(true, EBENE.Dialog, () => { onAbbruch(); });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label={titel} data-testid={testid}>
      <form className="w-96 rounded-lg border border-line bg-panel p-5" onSubmit={(e) => { e.preventDefault(); if (n.trim()) onOk(n.trim()); }}>
        <h3 className="text-lg font-semibold">{titel}</h3>
        {text && <p className="mt-2 text-sm text-dim">{text}</p>}
        <input autoFocus className={`${field} mt-3 w-full`} value={n} maxLength={60} onChange={(e) => setN(e.target.value)} aria-label="Name" data-testid={`${testid}-name`} />
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn" onClick={onAbbruch}>Abbrechen</button><button type="submit" className="btn on" disabled={!n.trim()} data-testid={`${testid}-ok`}>{ok}</button></div>
      </form>
    </div>
  );
}

function LeereWelt({ fertig }: { fertig: () => Promise<void> }) {
  const [name, setName] = useState("Neue Welt"), [size, setSize] = useState<"klein" | "mittel" | "gross">("mittel"), [edge, setEdge] = useState<"wald" | "offen">("wald");
  const [busy, setBusy] = useState(false), [fehler, setFehler] = useState<string | null>(null);
  const go = async () => { setBusy(true); setFehler(null); try { await api.blankWorld(name.trim(), size, edge); await fertig(); } catch (e) { setFehler(detail(e)); } finally { setBusy(false); } };
  const seg = <T extends string>(wert: T, set: (v: T) => void, opts: [T, string][], tid: string) => (
    <span className="segment" role="group">{opts.map(([v, l]) => <button key={v} type="button" className={wert === v ? "on" : ""} aria-pressed={wert === v} onClick={() => set(v)} data-testid={`${tid}-${v}`}>{l}</button>)}</span>
  );
  return (
    <form className="grid max-w-xl gap-3 text-[13px]" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void go(); }} data-testid="leere-welt">
      <p className="text-dim">Eine leere Wiese ohne Häuser. In der Werkstatt setzt du den Startplatz, ziehst Wege und Seen, setzt Häuser, Bäume und Gärten und fügst Gebiete hinzu.</p>
      <label className="grid gap-1">Name<input className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} data-testid="leer-name" /></label>
      <div className="flex items-center gap-3"><span className="w-16 text-dim">Größe</span>{seg(size, setSize, [["klein", "Klein 48×32"], ["mittel", "Mittel 96×60"], ["gross", "Groß 128×80"]], "leer-groesse")}</div>
      <div className="flex items-center gap-3"><span className="w-16 text-dim">Rand</span>{seg(edge, setEdge, [["wald", "Waldrand"], ["offen", "Offen"]], "leer-rand")}</div>
      {fehler && <p role="alert" className="text-warn">{fehler}</p>}
      <div><button type="submit" className="btn on" disabled={busy || !name.trim()} data-testid="leer-anlegen">{busy ? "Wird angelegt …" : "Welt anlegen"}</button></div>
    </form>
  );
}
