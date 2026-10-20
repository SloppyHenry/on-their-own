// Einstellungen › Darstellung (AP18b): Tiefe oder Flach (auch Taste V), Titelbild beim Öffnen, Hilfe beim Start, Mitspieler-Vorschau. Alles gilt je Gerät.
import { useUiStore } from "../store/uiStore";

const row = "flex items-center gap-3 py-2 text-[13px]";

/** Tiefe oder Flach als Schalter (Einstellungen › Darstellung und im Welteditor, wo es kein Menü gibt). */
export function AnsichtWahl() {
  const mode = useUiStore((s) => s.worldMode), setMode = useUiStore((s) => s.setWorldMode);
  return (
    <span className="segment" role="group" aria-label="Ansicht">
      <button type="button" className={mode === "tiefe" ? "on" : ""} aria-pressed={mode === "tiefe"} onClick={() => setMode("tiefe")}>Tiefe</button>
      <button type="button" className={mode === "flach" ? "on" : ""} aria-pressed={mode === "flach"} onClick={() => setMode("flach")}>Flach</button>
    </span>
  );
}

export function Darstellung() {
  const title = useUiStore((s) => s.titleOnStart), setTitle = useUiStore((s) => s.setTitleOnStart);
  const player = useUiStore((s) => s.playerPreview), setPlayer = useUiStore((s) => s.setPlayerPreview);
  const wenig = useUiStore((s) => s.wenigText), setWenig = useUiStore((s) => s.setWenigText);
  return (
    <div data-testid="view-menu" className="max-w-xl">
      <div className={row}><span className="w-44">Ansicht der Welt</span>
        <AnsichtWahl /><kbd className="kbd">V</kbd></div>
      <label className={`${row} cursor-pointer`}><input type="checkbox" checked={title} onChange={(e) => setTitle(e.target.checked)} data-testid="title-on-start" />Titelbild beim Öffnen zeigen (dieses Gerät)</label>
      <label className={`${row} cursor-pointer`}><input type="checkbox" checked={wenig} onChange={(e) => setWenig(e.target.checked)} data-testid="wenig-text" />Wenig Text in der Welt: nur ein Zeichen über dem Kopf, der Gedanke erscheint beim Daraufzeigen (dieses Gerät)</label>
      <label className={`${row} cursor-pointer`}><input type="checkbox" checked={player} onChange={(e) => setPlayer(e.target.checked)} data-testid="player-toggle" />Mitspieler-Steuerung (Vorschau): Klick geht und handelt, schickt aber nichts an die Simulation</label>
      <p className="mt-2 text-xs text-dim">Die Hilfe mit allen Tasten öffnet sich mit <kbd className="kbd">?</kbd>; beim allerersten Start blendet sie sich einmal ein.</p>
    </div>
  );
}
