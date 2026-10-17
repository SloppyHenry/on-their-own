// Einstellungen der Weltansicht: Tiefe oder Flach, Mitspieler-Steuerung, Bedienhinweise. Reiter „Ansicht“ der Infoleiste;
// wo die Infoleiste fehlt (Welteditor, Startmenü, eingeklappt), steht dieselbe Auswahl kompakt über der Welt.
import { useUiStore } from "../store/uiStore";

const btn = (on: boolean) => `cursor-pointer rounded-md px-2.5 py-1 ${on ? "bg-white/15 text-white" : "text-dim hover:text-white"}`;

export function viewHint(player: boolean, dorf: boolean): string {
  return `${player ? "Klick: gehen/handeln · Umschalt- oder Rechtsklick: auswählen · Enter: sagen · " : "Klick aufs Haus: hineinschauen · Doppelklick: folgen · "}${dorf ? "Mausrad oder + −: Zoom ¼×–3× · Ziehen oder WASD: fahren" : "Mausrad: Zoom · Ziehen: verschieben"} · F: folgen · 0: Gesamtansicht`;
}

export function ViewControls({ dorf, compact }: { dorf: boolean; compact?: boolean }) {
  const mode = useUiStore((s) => s.worldMode), setMode = useUiStore((s) => s.setWorldMode);
  const player = useUiStore((s) => s.playerPreview), setPlayer = useUiStore((s) => s.setPlayerPreview);
  return (
    <div className={compact ? "flex flex-col items-end gap-1.5 text-xs" : "flex flex-col gap-3 p-4 text-sm"} data-testid="view-menu">
      <div className={compact ? "flex items-center gap-1 rounded-lg bg-bg/80 px-1.5 py-1 text-xs" : "flex flex-wrap items-center gap-x-1 gap-y-2"} role="group" aria-label="Ansicht">
        <span className="px-1 text-dim">Ansicht:</span>
        <button type="button" className={btn(mode === "tiefe")} aria-pressed={mode === "tiefe"} onClick={() => setMode("tiefe")}>Tiefe</button>
        <button type="button" className={btn(mode === "flach")} aria-pressed={mode === "flach"} onClick={() => setMode("flach")}>Flach</button>
        <label className={`${compact ? "ml-2" : "basis-full pt-1"} flex cursor-pointer items-center gap-1.5 px-1 text-dim`}>
          <input type="checkbox" checked={player} onChange={(e) => setPlayer(e.target.checked)} data-testid="player-toggle" />
          Mitspieler-Steuerung (Vorschau)
        </label>
      </div>
      <div className={compact ? "rounded-lg bg-bg/80 px-2.5 py-1.5 text-xs text-dim" : "text-xs leading-relaxed text-dim"}>{viewHint(player, dorf)}</div>
    </div>
  );
}
