// Menü (AP17a, Mockup docs/mockups/startmenue.html): links die Liste, rechts der Inhalt des gewählten Punkts, keine Fenster.
// Titelbild beim Öffnen (die echte Welt läuft dahinter), Pausenmenü mit Esc im Spiel. Die Simulation läuft in beiden weiter;
// das Menü betrifft nur diesen Browser. Gewählt wird mit Pfeiltasten oder Maus, Enter öffnet, Esc geht zurück.
import { useEffect, useMemo, useState } from "react";
import { ResetDialog } from "../controls/ResetDialog";
import { enterEditor } from "../editor/editorStore";
import { ApiError, api } from "../net/api";
import { SaveLoadDialog } from "../saves/SaveLoadDialog";
import { SettingsContent } from "../settings/ParameterPanel";
import { activityOf } from "../panels/AgentPanel";
import { useSimStore } from "../store/simStore";
import { useUiStore, type MenuPane } from "../store/uiStore";

interface Item { id: string; label: string; icon: string; pane?: MenuPane; hint?: string; resume?: boolean }

const TITLE_ITEMS = (running: boolean): (Item | "sep")[] => [
  ...(running ? [{ id: "resume", label: "Fortsetzen", icon: "▶", resume: true } as Item] : []),
  { id: "newsim", label: "Neue Simulation", icon: "✦", pane: "newsim", hint: "Startwelt oder neues Dorf" },
  { id: "load", label: "Simulation laden", icon: "⤓", pane: "load", hint: "Spielstände" },
  "sep",
  { id: "editors", label: "Editoren", icon: "✎", pane: "editors", hint: "Welt · Figuren · Bausteine" },
  { id: "settings", label: "Einstellungen", icon: "⚙", pane: "settings", hint: "Regler, Presets, Status" },
];
const PAUSE_ITEMS: (Item | "sep")[] = [
  { id: "resume", label: "Zurück zum Spiel", icon: "▶", hint: "Esc" },
  { id: "load", label: "Speichern und laden", icon: "⤓", pane: "load" },
  { id: "editors", label: "Editoren", icon: "✎", pane: "editors", hint: "Welt gestalten" },
  { id: "settings", label: "Einstellungen", icon: "⚙", pane: "settings" },
  { id: "title", label: "Hauptmenü", icon: "☰", hint: "Die Simulation läuft weiter" },
];

export function StartMenu() {
  const menu = useUiStore((s) => s.menu), setMenu = useUiStore((s) => s.setMenu);
  const ready = useSimStore((s) => s.world !== null);
  const items = useMemo(() => (menu === "pause" ? PAUSE_ITEMS : TITLE_ITEMS(ready)), [menu, ready]);
  const real = items.filter((i): i is Item => i !== "sep");
  const [sel, setSel] = useState<string>(real[0]?.id ?? "");
  const [sub, setSub] = useState<string | null>(null);        // zweite Ebene innerhalb eines Bereichs (z. B. „Neues Dorf“)
  useEffect(() => { setSel(real[0]?.id ?? ""); }, [menu]);   // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id: string, commit = false) => {
    const it = real.find((i) => i.id === id); if (!it) return;
    if (commit && it.id === "resume") return setMenu(null);
    if (commit && it.id === "title") return setMenu("title");
    setSel(id);
  };

  // Esc: im Spiel das Pausenmenü öffnen (nur, wenn nichts anderes Esc braucht); im Menü eine Ebene zurück oder fortsetzen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      const typing = (e.target as HTMLElement)?.matches?.("input, textarea, select");
      if (ui.menu === null) {
        if (e.key === "Escape" && !e.defaultPrevented && !typing && ui.appMode === "game" && ui.view === "world" && !ui.settingsOpen && !ui.selection && useSimStore.getState().world) {
          setTimeout(() => { if (!e.defaultPrevented && useUiStore.getState().menu === null) setMenu("pause"); }, 0);        // andere Esc-Behandler (Innenansicht, Schließen) dürfen zuerst
        }
        return;
      }
      if (typing) { if (e.key === "Escape") (e.target as HTMLElement).blur(); return; }
      if (e.key === "Escape") { e.preventDefault(); if (sub) setSub(null); else if (ui.menu === "pause") setMenu(null); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const i = real.findIndex((x) => x.id === sel), n = real[(i + (e.key === "ArrowDown" ? 1 : -1) + real.length) % real.length];
        choose(n.id); setSub(null); e.preventDefault();
      } else if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") choose(sel, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });                                                          // ohne Abhängigkeiten: liest immer den aktuellen Stand

  if (menu === null) return null;
  const item = real.find((i) => i.id === sel);
  return (
    <div data-testid="start-menu" data-mode={menu} className={`absolute inset-0 z-30 grid items-center gap-7 px-[5vw] pl-[6vw] max-[900px]:grid-cols-1 min-[901px]:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] ${menu === "title" ? "bg-[linear-gradient(90deg,rgba(20,12,28,.92),rgba(20,12,28,.72)_30%,rgba(20,12,28,.25)_58%,transparent)]" : "bg-black/50"}`}>
      <div>
        {menu === "title" && (
          <div className="mb-5">
            <div className="flex items-center gap-3.5 text-[38px] font-bold tracking-[0.24em] [text-shadow:0_3px_0_#0007]"><Logo />SIMULACRA</div>
            <div className="mt-1 text-[13px] tracking-[0.04em] text-dim">Ein Dorf, in dem sich Menschen von selbst entwickeln.</div>
          </div>
        )}
        <div role="menu" aria-label="Menü" className="grid gap-0.5">
          {items.map((it, i) => it === "sep" ? <div key={i} className="mx-3 my-2 h-px bg-line/70" /> : it.resume && menu === "title" ? (
            <ResumeCard key={it.id} selected={sel === it.id} onSelect={() => choose(it.id)} onGo={() => setMenu(null)} />
          ) : (
            <button key={it.id} role="menuitem" data-testid={`menu-${it.id}`} aria-selected={sel === it.id} onClick={() => { choose(it.id, true); setSub(null); }} onMouseEnter={() => { if (!it.resume && it.id !== "title") { choose(it.id); setSub(null); } }}
              className={`grid cursor-pointer grid-cols-[28px_1fr] items-center gap-x-2 rounded-r-[10px] border-l-[3px] bg-transparent px-3 py-2 text-left text-base transition-all ${sel === it.id ? "translate-x-1.5 border-alex bg-[linear-gradient(90deg,rgba(255,211,110,.16),transparent)] text-text" : "border-transparent text-dim hover:text-text"}`}>
              <span className="text-lg opacity-80">{it.icon}</span><span>{it.label}</span>
              {sel === it.id && it.hint && <small className="col-start-2 text-xs text-dim">{it.hint}</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        {item?.pane && (
          <section key={item.pane} data-testid={`menu-pane-${item.pane}`} className="max-h-[84vh] overflow-auto rounded-2xl border border-line bg-[rgba(30,22,38,.92)] shadow-[0_20px_60px_#0009] backdrop-blur-md [animation:menu-in_.22s_ease-out]">
            {item.pane === "newsim" && <NewSimPane onLoad={() => setSel("load")} />}
            {item.pane === "load" && <Pane title="Simulation laden" lead="Die Simulation läuft an der gespeicherten Stelle weiter. Der laufende Stand wird vorher gesichert."><SaveLoadDialog embedded /></Pane>}
            {item.pane === "editors" && <EditorsPane />}
            {item.pane === "settings" && <SettingsPane />}
          </section>
        )}
      </div>
      {menu === "title" && <div className="absolute bottom-4 left-[6vw] flex gap-4 text-xs text-dim max-[900px]:hidden"><span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> wählen</span><span><kbd className="kbd">Enter</kbd> öffnen</span><span><kbd className="kbd">Esc</kbd> zurück</span></div>}
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 8 8" shapeRendering="crispEdges" className="size-[38px] shrink-0" aria-hidden="true">
      <path fill="#ffd36e" d="M1 4h1v3H1zM2 3h1v1H2zM3 2h2v1H3zM5 3h1v1H5zM6 4h1v3H6z" /><path fill="#fff8ec" d="M2 4h4v3H2z" /><path fill="#8a5a3c" d="M3 5h1v2H3z" />
    </svg>
  );
}

/** Fortsetzen: zeigt, was gerade im Dorf passiert (dieselben Texte wie die Schilder). */
function ResumeCard({ selected, onSelect, onGo }: { selected: boolean; onSelect: () => void; onGo: () => void }) {
  const w = useSimStore((s) => s.world);
  const lines = w ? w.agentOrder.slice(0, 4).map((id) => `${w.agents[id].name}: ${activityOf(w.agents[id], w).text}`) : [];
  const names = w ? w.agentOrder.map((id) => w.agents[id].name).join(", ") : "";
  return (
    <button role="menuitem" data-testid="menu-resume" aria-selected={selected} onClick={onGo} onMouseEnter={onSelect}
      className={`mb-2 grid cursor-pointer gap-1 rounded-2xl border-2 bg-alex px-4 py-3.5 text-left text-[17px] text-[#2b2233] ${selected ? "border-white shadow-[0_6px_24px_#0008]" : "border-transparent"}`}>
      <b>▶ Fortsetzen</b>
      {w && <small className="text-xs text-[#5a4a3a]">{w.worldName ? `${w.worldName} · ` : ""}Tag {w.clock.day}, {w.clock.time} · {names}</small>}
      {lines.length > 0 && <span className="mt-1 grid gap-px border-t border-[#2b223340] pt-1.5 text-xs font-semibold" data-testid="resume-live">{lines.map((l) => <span key={l} className="truncate">{l}</span>)}</span>}
    </button>
  );
}

function Pane({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="px-5 pb-1 pt-4 text-[19px] font-bold">{title}</h2>
      {lead && <p className="px-5 pb-2 text-[13px] text-dim">{lead}</p>}
      <div className="px-5 pb-5 pt-1">{children}</div>
    </>
  );
}

function Tile({ img, title, text, onClick, later, testid }: { img: string; title: string; text: string; onClick?: () => void; later?: string; testid?: string }) {
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

function NewSimPane({ onLoad }: { onLoad: () => void }) {
  const setMenu = useUiStore((s) => s.setMenu);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async (model?: string, keep?: boolean) => {
    setResetting(false); setError(null);
    try { await api.reset(model, keep); setMenu(null); } catch (e) { setError(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"); }
  };
  return (
    <Pane title="Neue Simulation" lead="Der bisherige Stand wird vorher als Spielstand gesichert, nicht gelöscht.">
      <div className="grid grid-cols-2 gap-3">
        <Tile img="start" title="Startwelt neu beginnen" text="Das bekannte Dorf, Alex und Mira von vorn." onClick={() => setResetting(true)} testid="newsim-start" />
        <Tile img="dorf" title="Neues Dorf erzeugen" text="Seed, Seeufer, Gebäudemix, mit Vorschau." onClick={() => { setMenu(null); enterEditor("new"); }} testid="newsim-generate" />
        <Tile img="welt" title="Selbst gestalten" text="Eigenes Dorf bauen (mit dem Gestalten-Paket)." later="später" />
        <Tile img="haus" title="Aus Spielstand" text="Einen gespeicherten Stand laden." onClick={onLoad} testid="newsim-load" />
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-warn">{error}</p>}
      <p className="mt-3 text-[13px] text-dim">Bewohner, Regeln und Modell frei zusammenstellen folgt mit dem Paket „Simulation selbst definieren“.</p>
      {resetting && <ResetDialog onCancel={() => setResetting(false)} onConfirm={(m, k) => void confirm(m, k)} />}
    </Pane>
  );
}

function EditorsPane() {
  const setMenu = useUiStore((s) => s.setMenu), setView = useUiStore((s) => s.setView);
  return (
    <Pane title="Editoren" lead="Alles zum Gestalten an einem Ort. Im Editor-Modus steht die Zeit still.">
      <div className="grid grid-cols-2 gap-3">
        <Tile img="welt" title="▦ Welt" text="Weitere Dörfer anfügen; Wege, Seen und Häuser folgen mit dem Gestalten-Paket." onClick={() => { setView("world"); setMenu(null); enterEditor("extend"); }} testid="editor-world" />
        <Tile img="figuren" title="☺ Figuren" text="Bewohner anlegen und bearbeiten." later="später" />
        <Tile img="haus" title="⌂ Häuser und Gebäude" text="Eigene Häuser entwerfen: Form, Räume, Aussehen." later="später" />
        <Tile img="ding" title="◆ Dinge und Assets" text="Eigene Objekte zeichnen, mit Wirkungen für die Bewohner." later="später" />
      </div>
    </Pane>
  );
}

function SettingsPane() {
  const on = useUiStore((s) => s.titleOnStart), set = useUiStore((s) => s.setTitleOnStart);
  return (
    <>
      <h2 className="px-5 pb-1 pt-4 text-[19px] font-bold">Einstellungen</h2>
      <label className="flex items-center gap-2 px-5 pb-2 text-[13px] text-dim"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} data-testid="title-on-start" />Titelbild beim Öffnen zeigen (dieses Gerät)</label>
      <SettingsContent embedded />
    </>
  );
}
