// Welt-Werkstatt (AP18e, ausgebaut mit AP16b): ein Editor auf einer Weltdatei der Bibliothek, nicht auf der laufenden Simulation. Der Werkzeugkasten (`gestalten/`) schwebt über der Welt;
// hier stehen nur Kopf (Name, ungespeichert, „Damit spielen …“) und Fuß (Speichern). Alles, was gesetzt wird, ist ein Entwurf aus Aktionen; Speichern schreibt ihn in die Datei.
import { useEffect, useState } from "react";
import { useAssistent } from "../assistent/assistentStore";
import { GestaltenHud } from "../gestalten/GestaltenHud";
import { useGestalten } from "../gestalten/gestaltenStore";
import { Werkzeugteile } from "../gestalten/Kopf";
import { useUiStore } from "../store/uiStore";
import { Rueckfrage } from "../ui/Rueckfrage";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { kachelAn, ungespeichert, useWerkstatt, verlasseWerkstatt, type Lake } from "./werkstattStore";

const LAKES: [Lake, string][] = [["auto", "Nach Zufall"], ["east", "Im Osten"], ["south", "Im Süden"]];
const field = "rounded-md border border-line bg-bg px-2 py-1";

export function Werkstatt() {
  const s = useWerkstatt(), g = useGestalten();
  const [frage, setFrage] = useState<"zurueck" | "spielen" | null>(null), [als, setAls] = useState(false), [name, setName] = useState("");
  const n = g.aktionen.length, dirty = ungespeichert(s) || n > 0, welt = g.rechnung?.welt ?? s.welt;
  const gehen = (art: "zurueck" | "spielen") => { if (dirty) setFrage(art); else fertig(art); };
  const fertig = (art: "zurueck" | "spielen") => {
    const id = s.info?.id;
    verlasseWerkstatt();
    if (art === "spielen" && id) {                                                  // Neue Simulation › Selbst definieren › Welt, mit dieser Welt vorgewählt
      useAssistent.getState().setWorld({ kind: "library", libraryId: id });
      useAssistent.getState().setStep(1);
      const ui = useUiStore.getState();
      ui.setMenu("title"); ui.setMenuSel("newsim"); ui.setMenuSub("define");
    }
  };
  useRueckweg(true, EBENE.Werkstatt, () => { if (useGestalten.getState().innen) return false; if (als) setAls(false); else gehen("zurueck"); });
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void useWerkstatt.getState().speichern(); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  if (!welt || !s.info) return null;
  const k = s.gewaehlt ? kachelAn(s.welt!, s.gewaehlt[0], s.gewaehlt[1]) : null;
  const startplatz = welt.startplatz as [number, number] | null | undefined, kein = !startplatz;
  const fehler = (g.rechnung?.fehler ?? 0) > 0;
  const sperre = kein ? "Zum Spielen braucht die Welt einen Startplatz" : fehler ? "Die Prüfung meldet einen Fehler (✗); „Damit spielen“ geht erst, wenn alles ✓ ist" : undefined;
  const kopf = (
    <>
      <button type="button" className="btn leise" onClick={() => gehen("zurueck")} data-testid="werkstatt-zurueck">← Welten <kbd className="kbd">Esc</kbd></button>
      <input className="name" value={String(welt.name)} maxLength={60} aria-label="Name der Welt" data-testid="werkstatt-name" onChange={(e) => s.umbenennen(e.target.value)} />
      <span className={`text-xs ${dirty ? "text-alex" : "text-faint"}`} data-testid="werkstatt-stand">{dirty ? "● ungespeichert" : "gespeichert"}</span>
      {n > 0 && <span className="text-xs text-dim" data-testid="werkstatt-aktionen">{n} {n === 1 ? "Aktion" : "Aktionen"}</span>}
      <span className="sp" />
      <Werkzeugteile />
      <button type="button" className="btn" disabled={!!sperre} title={sperre} onClick={() => gehen("spielen")} data-testid="werkstatt-spielen">Damit spielen …</button>
    </>
  );
  const fuss = (
    <>
      <div className="mb-3 rounded-md border border-line px-3 py-2 text-[13px]" data-testid="werkstatt-stand-info">
        <b>{(welt.size as number[])[0]} × {(welt.size as number[])[1]} Kacheln</b> · Startplatz: <span data-testid="werkstatt-startplatz">{startplatz ? `${startplatz[0]}, ${startplatz[1]}` : "keiner"}</span>
        {k && s.gewaehlt && <div className="mt-1 text-dim" data-testid="werkstatt-kachel">Kachel {s.gewaehlt[0]}, {s.gewaehlt[1]}: {k.label}{k.begehbar ? "" : " (nicht begehbar)"}</div>}
      </div>
      {s.hinweis && <p className="mb-2 text-[12.5px] text-ok" role="status" data-testid="werkstatt-hinweis">{s.hinweis}</p>}
      {s.error && <p className="mb-2 rounded-md border border-warn/60 bg-warn/10 p-2 text-[12.5px] text-warn" role="alert" data-testid="werkstatt-fehler">{s.error}</p>}
      {s.busy === "vorschau" && <p className="mb-2 text-[12.5px] text-dim">Vorschau wird aufgebaut …</p>}
      <div className="flex gap-1.5">
        <button type="button" className="btn flex-1" onClick={() => { setName(`${welt.name} 2`.slice(0, 60)); setAls(true); }} data-testid="werkstatt-speichern-als">Speichern als …</button>
        <button type="button" className="btn gold flex-1" disabled={!dirty || s.busy !== null || !String(welt.name).trim()} onClick={() => void s.speichern()} data-testid="werkstatt-speichern">Speichern <kbd className="kbd">⌘S</kbd></button>
      </div>
      <p>Speichern schreibt den Entwurf in die Weltdatei; der Entwurf ist danach leer. Ein ✗ in der Prüfung sperrt nur „Damit spielen“.</p>
    </>
  );
  const gebiet = (
    <form className="mt-3 grid gap-2 rounded-md border border-line p-3 text-[13px]" onSubmit={(e) => { e.preventDefault(); void s.gebietErzeugen(); }} aria-label="Gebiet erzeugen">
      <label className="grid gap-1">Seed (gleicher Seed, gleiches Dorf)
        <span className="flex gap-2"><input className={`${field} w-28 font-mono`} type="number" min={0} max={2000000000} value={s.seed} data-testid="gebiet-seed" onChange={(e) => s.setSeed(Number(e.target.value))} />
          <button type="button" className="btn" onClick={() => s.setSeed(1 + Math.floor(Math.random() * 99999))}>Würfeln</button></span></label>
      <label className="grid gap-1">Ufer des Sees
        <select className={field} value={s.lake} onChange={(e) => s.setLake(e.target.value as Lake)} data-testid="gebiet-ufer">{LAKES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <button type="submit" className="btn on" disabled={s.busy !== null || !s.gewaehlt} data-testid="gebiet-erzeugen">{s.busy === "gebiet" ? "Wird erzeugt …" : s.gewaehlt ? `Gebiet ab ${s.gewaehlt[0]}, ${s.gewaehlt[1]} erzeugen` : "Erst eine Ecke anklicken"}</button>
    </form>
  );
  return (
    <>
      <div data-testid="werkstatt" className="pointer-events-none absolute inset-0 z-20"><GestaltenHud kopf={kopf} fuss={fuss} gebiet={gebiet} /></div>
      {als && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Speichern als" data-testid="werkstatt-als">
          <form className="w-96 rounded-lg border border-line bg-panel p-5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void s.speichernAls(name.trim()).then((ok) => ok && setAls(false)); }}>
            <h3 className="text-lg font-semibold">Speichern als</h3>
            <p className="mt-2 text-sm text-dim">Legt eine neue Welt in der Bibliothek an. Die geöffnete Welt bleibt, wie sie zuletzt gespeichert war.</p>
            <input autoFocus className={`${field} mt-3 w-full`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Name der neuen Welt" data-testid="werkstatt-als-name" />
            <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn" onClick={() => setAls(false)}>Abbrechen</button><button type="submit" className="btn on" disabled={!name.trim() || s.busy !== null} data-testid="werkstatt-als-ok">Speichern</button></div>
          </form>
        </div>
      )}
      {frage && (
        <Rueckfrage titel="Ungespeicherte Änderungen" text="Die Welt hat Änderungen, die noch nicht gespeichert sind. Sie gehen verloren, wenn du jetzt gehst." ja="Verwerfen und gehen" nein="Weiter bearbeiten"
          onNein={() => setFrage(null)} onJa={() => { const f = frage; setFrage(null); fertig(f); }} testid="werkstatt-rueckfrage" />
      )}
    </>
  );
}
