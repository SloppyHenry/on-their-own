// Inhalte der Menübereiche (AP17a, Brotkrumen und Rückweg AP18a): Neue Simulation, Simulation laden, Editoren, Einstellungen.
// Jeder Bereich beginnt mit den Brotkrumen; die Unterebenen (Assistent, Charaktereditor) melden ihren Rückweg selbst an.
import { useState, type ReactNode } from "react";
import { ResetDialog } from "../controls/ResetDialog";
import { enterEditor } from "../editor/editorStore";
import { ApiError, api } from "../net/api";
import { Assistent } from "../assistent/Assistent";
import { Charaktereditor } from "../assistent/Charaktereditor";
import { SaveLoadDialog } from "../saves/SaveLoadDialog";
import { SettingsContent } from "../settings/ParameterPanel";
import { useUiStore, type MenuStelle } from "../store/uiStore";
import { Brotkrumen, type Krume } from "../ui/Brotkrumen";

/** Wohin Esc auf der obersten Ebene eines Bereichs führt: im Pausenmenü zurück ins Spiel, im Titelbild nirgends. */
export const useEscZuSpiel = () => useUiStore((s) => (s.menu === "pause" ? "zurück zum Spiel" : undefined));

export function Pane({ trail, escZu, lead, children }: { trail: Krume[]; escZu?: string; lead?: string; children: ReactNode }) {
  const spiel = useEscZuSpiel();
  return (
    <>
      <Brotkrumen pfad={trail} escZu={escZu ?? (trail.length === 1 ? spiel : undefined)} />
      {lead && <p className="px-5 pb-2 pt-1 text-[13px] text-dim">{lead}</p>}
      <div className="px-5 pb-5 pt-2">{children}</div>
    </>
  );
}

export function Tile({ img, title, text, onClick, later, testid }: { img: string; title: string; text: string; onClick?: () => void; later?: string; testid?: string }) {
  const body = (
    <>
      <div className={`h-[110px] bg-cover bg-center [image-rendering:pixelated] ${later ? "[filter:grayscale(1)_brightness(.55)]" : ""}`} style={{ backgroundImage: `url(/menue/${img}.jpg)` }} />
      <div className="px-3 pb-2.5 pt-2"><b className="text-[15px]">{title}</b>{later && <span className="ml-2 rounded-full border border-plan px-2 text-[11px] text-plan">{later}</span>}<small className="mt-0.5 block text-xs text-dim">{text}</small></div>
    </>
  );
  return later || !onClick
    ? <div className="overflow-hidden rounded-[14px] border border-dashed border-line bg-black/20" data-testid={testid}>{body}</div>
    : <button type="button" onClick={onClick} data-testid={testid} className="cursor-pointer overflow-hidden rounded-[14px] border border-line bg-black/20 p-0 text-left transition-transform hover:-translate-y-0.5 hover:border-alex">{body}</button>;
}

/** Verlässt das Menü für einen Editor und merkt sich die Stelle, an die Esc zurückführt. */
export function toEditor(kind: "new" | "extend", stelle: MenuStelle) {
  const ui = useUiStore.getState();
  ui.setMenu(null);
  if (kind === "extend") ui.setView("world");
  enterEditor(kind, stelle);
}

export function LoadPane() {
  return <Pane trail={[{ label: "Simulation laden" }]} lead="Die Simulation läuft an der gespeicherten Stelle weiter. Der laufende Stand wird vorher gesichert."><SaveLoadDialog embedded /></Pane>;
}

export function NewSimPane({ stelle, onLoad }: { stelle: MenuStelle; onLoad: () => void }) {
  const setMenu = useUiStore((s) => s.setMenu), setSub = useUiStore((s) => s.setMenuSub);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async (model?: string, keep?: boolean) => {
    setResetting(false); setError(null);
    try { await api.reset(model, keep); setMenu(null); } catch (e) { setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"); }
  };
  return (
    <Pane trail={[{ label: "Neue Simulation" }]} lead="Der bisherige Stand wird vorher als Spielstand gesichert, nicht gelöscht.">
      <div className="grid grid-cols-2 gap-3">
        <Tile img="start" title="Startwelt neu beginnen" text="Das bekannte Dorf, Alex und Mira von vorn." onClick={() => setResetting(true)} testid="newsim-start" />
        <Tile img="dorf" title="Neues Dorf erzeugen (Schnellstart)" text="Seed, Seeufer, Gebäudemix, mit Vorschau." onClick={() => toEditor("new", stelle)} testid="newsim-generate" />
        <Tile img="figuren" title="Selbst definieren" text="Bewohner, Beziehungen, Regeln und Modell: Schritt für Schritt." onClick={() => setSub("define")} testid="newsim-define" />
        <Tile img="welt" title="Selbst gestalten" text="Eigenes Dorf bauen (mit dem Gestalten-Paket)." later="später" />
        <Tile img="haus" title="Aus Spielstand" text="Einen gespeicherten Stand laden." onClick={onLoad} testid="newsim-load" />
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-warn">{error}</p>}
      {resetting && <ResetDialog onCancel={() => setResetting(false)} onConfirm={(m, k) => void confirm(m, k)} />}
    </Pane>
  );
}

export function EditorsPane({ stelle }: { stelle: MenuStelle }) {
  const setSub = useUiStore((s) => s.setMenuSub);
  return (
    <Pane trail={[{ label: "Editoren" }]} lead="Alles zum Gestalten an einem Ort. Im Editor-Modus steht die Zeit still.">
      <div className="grid grid-cols-2 gap-3">
        <Tile img="welt" title="▦ Welt" text="Weitere Dörfer anfügen; Wege, Seen und Häuser folgen mit dem Gestalten-Paket." onClick={() => toEditor("extend", stelle)} testid="editor-world" />
        <Tile img="figuren" title="☺ Figuren" text="Vorlagen für Bewohner anlegen, bearbeiten, exportieren und importieren." onClick={() => setSub("figuren")} testid="editor-figuren" />
        <Tile img="haus" title="⌂ Häuser und Gebäude" text="Eigene Häuser entwerfen: Form, Räume, Aussehen." later="später" />
        <Tile img="ding" title="◆ Dinge und Assets" text="Eigene Objekte zeichnen, mit Wirkungen für die Bewohner." later="später" />
      </div>
    </Pane>
  );
}

export function FigurenPane() {
  const setSub = useUiStore((s) => s.setMenuSub);
  return <Charaktereditor onBack={() => setSub(null)} />;
}

export function DefinePane() {
  const setSub = useUiStore((s) => s.setMenuSub);
  return <Assistent onExit={() => setSub(null)} />;
}

export function SettingsPane() {
  const on = useUiStore((s) => s.titleOnStart), set = useUiStore((s) => s.setTitleOnStart);
  return (
    <>
      <Brotkrumen pfad={[{ label: "Einstellungen" }]} escZu={useEscZuSpiel()} />
      <label className="flex items-center gap-2 px-5 pb-2 pt-1 text-[13px] text-dim"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} data-testid="title-on-start" />Titelbild beim Öffnen zeigen (dieses Gerät)</label>
      <SettingsContent embedded />
    </>
  );
}
