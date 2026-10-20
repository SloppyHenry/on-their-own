// Welt-Werkstatt (AP18e, Mockup Bild 10): ein ganzseitiger Editor auf einer Weltdatei der Bibliothek, nicht auf der laufenden Simulation. Oben Name, „ungespeichert“,
// Speichern, Speichern als und „Damit spielen …“; die Werkzeuge kommen mit AP16. Hier gibt es Zeiger, Startplatz und Gebiet erzeugen (der Generator als Rechteck-Werkzeug).
import { useState } from "react";
import { useAssistent } from "../assistent/assistentStore";
import { AnsichtWahl } from "../settings/Darstellung";
import { useUiStore } from "../store/uiStore";
import { Rueckfrage } from "../ui/Rueckfrage";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { kachelAn, ungespeichert, useWerkstatt, verlasseWerkstatt, type Lake, type Werkzeug } from "./werkstattStore";

const WERKZEUGE: [Werkzeug, string, string][] = [["zeiger", "➤ Zeiger", "Kachel ansehen"], ["startplatz", "⚑ Startplatz", "Wo die Bewohner beginnen"], ["gebiet", "▦ Gebiet erzeugen", "Ein Dorf an die gewählte Ecke setzen"]];
const LAKES: [Lake, string][] = [["auto", "Nach Zufall"], ["east", "Im Osten"], ["south", "Im Süden"]];
const field = "rounded-md border border-line bg-bg px-2 py-1";

export function Werkstatt() {
  const s = useWerkstatt();
  const [frage, setFrage] = useState<"zurueck" | "spielen" | null>(null), [als, setAls] = useState(false), [name, setName] = useState("");
  const dirty = ungespeichert(s), welt = s.welt;
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
  useRueckweg(true, EBENE.Werkstatt, () => { if (als) setAls(false); else gehen("zurueck"); });
  if (!welt || !s.info) return null;
  const k = s.gewaehlt ? kachelAn(welt, s.gewaehlt[0], s.gewaehlt[1]) : null;
  const kein = !welt.startplatz;
  return (
    <aside data-testid="werkstatt" className="relative flex min-h-0 flex-col overflow-y-auto border-l border-line bg-panel">
      <header className="grid gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <input className={`${field} min-w-0 flex-1 text-[15px] font-semibold`} value={welt.name} maxLength={60} aria-label="Name der Welt" data-testid="werkstatt-name" onChange={(e) => s.umbenennen(e.target.value)} />
          <span className={`text-xs ${dirty ? "text-alex" : "text-faint"}`} data-testid="werkstatt-stand">{dirty ? "● ungespeichert" : "gespeichert"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn on" disabled={!dirty || s.busy !== null || !welt.name.trim()} onClick={() => void s.speichern()} data-testid="werkstatt-speichern">Speichern</button>
          <button type="button" className="btn" onClick={() => { setName(`${welt.name} 2`.slice(0, 60)); setAls(true); }} data-testid="werkstatt-speichern-als">Speichern als …</button>
          <button type="button" className="btn" disabled={kein} title={kein ? "Zum Spielen braucht die Welt einen Startplatz" : undefined} onClick={() => gehen("spielen")} data-testid="werkstatt-spielen">Damit spielen …</button>
          <span className="flex-1" />
          <button type="button" className="btn" onClick={() => gehen("zurueck")} data-testid="werkstatt-zurueck">← Zurück zu den Welten</button>
        </div>
      </header>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[13px]" data-testid="view-menu"><span className="text-dim">Ansicht</span><AnsichtWahl /></div>
      <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2" role="toolbar" aria-label="Werkzeuge">
        {WERKZEUGE.map(([id, label, tip]) => <button key={id} type="button" className={`btn ${s.werkzeug === id ? "on" : ""}`} aria-pressed={s.werkzeug === id} title={tip} onClick={() => s.setWerkzeug(id)} data-testid={`werkzeug-${id}`}>{label}</button>)}
      </div>
      <div className="grid gap-3 p-4 text-[13px]">
        <p className="text-dim" data-testid="werkstatt-hilfe">
          {s.werkzeug === "zeiger" && "Klick auf die Welt zeigt die Kachel. Weitere Werkzeuge (Wege, Seen, Häuser) kommen mit dem Gestalten-Paket."}
          {s.werkzeug === "startplatz" && "Klick auf eine begehbare Kachel: dort beginnen die Bewohner. Ohne Startplatz lässt sich die Welt speichern, aber noch nicht starten."}
          {s.werkzeug === "gebiet" && "Erst die linke obere Ecke in der Welt anklicken, dann erzeugen. Wiese und Wald weichen dem Dorf, Wege, Wasser und Häuser nicht."}
        </p>
        <div className="rounded-md border border-line px-3 py-2" data-testid="werkstatt-stand-info">
          <b>{welt.size[0]} × {welt.size[1]} Kacheln</b> · Startplatz: <span data-testid="werkstatt-startplatz">{welt.startplatz ? `${welt.startplatz[0]}, ${welt.startplatz[1]}` : "keiner"}</span>
          {k && s.gewaehlt && <div className="mt-1 text-dim" data-testid="werkstatt-kachel">Kachel {s.gewaehlt[0]}, {s.gewaehlt[1]}: {k.label}{k.begehbar ? "" : " (nicht begehbar)"}</div>}
        </div>
        {s.werkzeug === "gebiet" && (
          <form className="grid gap-2 rounded-md border border-line p-3" onSubmit={(e) => { e.preventDefault(); void s.gebietErzeugen(); }} aria-label="Gebiet erzeugen">
            <label className="grid gap-1">Seed (gleicher Seed, gleiches Dorf)
              <span className="flex gap-2"><input className={`${field} w-28 font-mono`} type="number" min={0} max={2000000000} value={s.seed} data-testid="gebiet-seed" onChange={(e) => s.setSeed(Number(e.target.value))} />
                <button type="button" className="btn" onClick={() => s.setSeed(1 + Math.floor(Math.random() * 99999))}>Würfeln</button></span></label>
            <label className="grid gap-1">Ufer des Sees
              <select className={field} value={s.lake} onChange={(e) => s.setLake(e.target.value as Lake)} data-testid="gebiet-ufer">{LAKES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <button type="submit" className="btn on" disabled={s.busy !== null || !s.gewaehlt} data-testid="gebiet-erzeugen">{s.busy === "gebiet" ? "Wird erzeugt …" : s.gewaehlt ? `Gebiet ab ${s.gewaehlt[0]}, ${s.gewaehlt[1]} erzeugen` : "Erst eine Ecke anklicken"}</button>
          </form>
        )}
        {s.hinweis && <p className="text-ok" role="status" data-testid="werkstatt-hinweis">{s.hinweis}</p>}
        {s.error && <p className="rounded-md border border-warn/60 bg-warn/10 p-2 text-warn" role="alert" data-testid="werkstatt-fehler">{s.error}</p>}
        {s.busy === "vorschau" && <p className="text-dim">Vorschau wird aufgebaut …</p>}
      </div>
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
    </aside>
  );
}
