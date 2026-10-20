// Hilfe auf „?“ statt dauerhafter Hinweiszeile (AP18b, Mockup Hilfe). Beim ersten Start blendet sie sich einmal ein.
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";

const KEYS: [string, string][] = [
  ["Klick auf Bewohner", "Karte öffnen"], ["Doppelklick", "folgen"], ["Klick auf ein Haus", "hineinschauen"], ["Esc", "eine Ebene zurück"], ["Mausrad, + −", "Zoom ¼× bis 3×"], ["Ziehen, WASD", "Kamera fahren"],
  ["F", "folgen an/aus"], ["0", "Gesamtansicht"], ["Leertaste", "Pause oder weiter"], [".", "ein Schritt"], ["T · G", "Tagebuch · Gedächtnis"], ["V", "Tiefe ↔ Flach"], ["?", "diese Hilfe"],
];

export function Hilfe() {
  const open = useUiStore((s) => s.help && s.menu === null && s.appMode === "game"), setHelp = useUiStore((s) => s.setHelp);
  useRueckweg(open, EBENE.Popover, () => setHelp(false));
  if (!open) return null;
  return (
    <div className="glas hud-pop pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[620px] max-w-[94%] -translate-x-1/2 -translate-y-1/2 px-[22px] py-[18px]" role="dialog" aria-label="Steuerung" data-testid="hilfe">
      <div className="mb-2.5 flex items-center"><h3 className="flex-1 text-base font-semibold">Steuerung</h3><button type="button" className="btn rund leise" onClick={() => setHelp(false)} aria-label="Hilfe schließen">✕</button></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
        {KEYS.map(([a, b]) => <div key={a} className="flex justify-between gap-2.5 border-b border-dashed border-line py-1"><span>{a}</span><small className="text-dim">{b}</small></div>)}
      </div>
      <p className="mt-3 text-xs text-dim">Die Hilfe ersetzt die Hinweiszeile über der Welt. Beim ersten Start blendet sie sich einmal ein, danach nur auf <kbd className="kbd">?</kbd>.</p>
    </div>
  );
}
