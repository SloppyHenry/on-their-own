// Menü (AP17a, Mockup docs/mockups/startmenue.html): links die Liste, rechts der Inhalt des gewählten Punkts, keine Fenster.
// Titelbild beim Öffnen (die echte Welt läuft dahinter), Pausenmenü mit Esc im Spiel. Die Simulation läuft in beiden weiter;
// das Menü betrifft nur diesen Browser. Gewählt wird mit Pfeiltasten oder Maus, Enter öffnet, Esc geht (AP18a) genau eine Ebene zurück.
import { useEffect, useMemo } from "react";
import { activityOf } from "../panels/AgentPanel";
import { useSimStore } from "../store/simStore";
import { useUiStore, type MenuPane } from "../store/uiStore";
import { EBENE, anmelden, useRueckweg } from "../ui/zurueck";
import { DefinePane, EditorsPane, FigurenPane, LoadPane, NewSimPane, SettingsPane, WeltenSeite } from "./MenuPanes";

interface Item { id: string; label: string; icon: string; pane?: MenuPane; hint?: string; resume?: boolean }

const TITLE_ITEMS = (running: boolean): (Item | "sep")[] => [
  ...(running ? [{ id: "resume", label: "Fortsetzen", icon: "▶", resume: true } as Item] : []),
  { id: "newsim", label: "Neue Simulation", icon: "✦", pane: "newsim", hint: "Schnellstart oder selbst definieren" },
  { id: "load", label: "Simulation laden", icon: "⤓", pane: "load", hint: "Spielstände" },
  "sep",
  { id: "editors", label: "Editoren", icon: "✎", pane: "editors", hint: "Welten · Figuren · Bausteine" },
  { id: "settings", label: "Einstellungen", icon: "⚙", pane: "settings", hint: "Regler, Presets, Status" },
];
const PAUSE_ITEMS: (Item | "sep")[] = [
  { id: "resume", label: "Zurück zum Spiel", icon: "▶", hint: "Esc" },
  { id: "load", label: "Speichern und laden", icon: "⤓", pane: "load" },
  { id: "editors", label: "Editoren", icon: "✎", pane: "editors", hint: "Welten · Figuren" },
  { id: "settings", label: "Einstellungen", icon: "⚙", pane: "settings" },
  { id: "title", label: "Hauptmenü", icon: "☰", hint: "Die Simulation läuft weiter" },
];

export function StartMenu() {
  const menu = useUiStore((s) => s.menu), setMenu = useUiStore((s) => s.setMenu);
  const menuSel = useUiStore((s) => s.menuSel), setMenuSel = useUiStore((s) => s.setMenuSel);
  const sub = useUiStore((s) => s.menuSub), setSub = useUiStore((s) => s.setMenuSub);
  const ready = useSimStore((s) => s.world !== null);
  const items = useMemo(() => (menu === "pause" ? PAUSE_ITEMS : TITLE_ITEMS(ready)), [menu, ready]);
  const real = items.filter((i): i is Item => i !== "sep");
  const sel = menuSel ?? real[0]?.id ?? "";

  const choose = (id: string, commit = false) => {
    const it = real.find((i) => i.id === id); if (!it) return;
    if (commit && it.id === "resume") return setMenu(null);
    if (commit && it.id === "title") return setMenu("title");
    setMenuSel(id);
  };

  // Rückweg (zurueck.ts): im Menü eine Ebene zurück. Unterebenen (Assistent, Charaktereditor) melden sich selbst darüber an. Auf der Liste schließt Esc
  // das Pausenmenü; das Titelbild bleibt stehen, damit Esc nie aus Versehen ins Spiel führt.
  useRueckweg(menu !== null, EBENE.Menue, () => { if (sub) setSub(null); else if (menu === "pause") setMenu(null); });
  // Im Spiel öffnet Esc das Pausenmenü, wenn keine andere Ebene Esc braucht.
  useEffect(() => anmelden(EBENE.Spiel, () => {
    const ui = useUiStore.getState();
    if (ui.menu !== null || ui.appMode !== "game" || !useSimStore.getState().world) return false;
    ui.setMenu("pause");
    return true;
  }), []);

  useEffect(() => {
    if (menu === null) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.("input, textarea, select") || e.defaultPrevented) return;
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
            {item.pane === "newsim" && (sub === "define" ? <DefinePane /> : <NewSimPane onLoad={() => setMenuSel("load")} />)}
            {item.pane === "load" && <LoadPane />}
            {item.pane === "editors" && (sub === "figuren" ? <FigurenPane /> : sub === "welten" ? <WeltenSeite /> : <EditorsPane />)}
            {item.pane === "settings" && <SettingsPane />}
          </section>
        )}
      </div>
      {menu === "title" && <div className="absolute bottom-4 left-[6vw] flex gap-4 text-xs text-dim max-[900px]:hidden"><span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> wählen</span><span><kbd className="kbd">Enter</kbd> öffnen</span><span><kbd className="kbd">Esc</kbd> eine Ebene zurück</span></div>}
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
