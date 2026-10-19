import { useEffect, useMemo, useState } from "react";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";
import { ParamGroup } from "./ParamGroup";
import { PresetManager } from "./PresetManager";
import { StatusPanels } from "./StatusPanels";
import { TonSettings } from "./TonSettings";
import { useParamStore } from "./paramStore";

/** Gruppen, die zusammen auf einer Seite stehen (Persönlichkeit und Charakter gehören zum Agenten). */
const PAGES: { id: string; label: string; groups: string[] }[] = [
  { id: "autonomy", label: "Autonomie", groups: ["autonomy"] },
  { id: "agents", label: "Agenten", groups: ["personality", "persona"] },
  { id: "memory", label: "Gedächtnis", groups: ["memory"] },
  { id: "world", label: "Welt", groups: ["world"] },
  { id: "llm", label: "Modell", groups: ["llm"] },
  { id: "sim", label: "Tempo", groups: ["sim"] },
  { id: "mode", label: "Modus", groups: ["mode"] },
];
const EXTRA = [{ id: "ton", label: "Ton" }, { id: "presets", label: "Presets" }, { id: "status", label: "Status" }];

/** Schublade über der Welt: Regler nach dem Schema des Backends, Presets und Status. Die Welt bleibt sichtbar, damit man Wirkungen sieht. */
export function ParameterPanel() {
  const open = useUiStore((s) => s.settingsOpen);
  const close = useUiStore((s) => s.closeSettings);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  if (!open) return null;
  return (
    <aside className="absolute inset-y-0 right-0 z-40 flex w-[min(660px,100%)] flex-col border-l border-line bg-panel shadow-2xl" role="complementary" aria-label="Einstellungen" data-testid="settings">
      <SettingsContent onClose={close} />
    </aside>
  );
}

/** Der Inhalt der Einstellungen (Suche, Bereiche, Regler); in der Schublade und im Menü (AP17a) gleich. */
export function SettingsContent({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const tab = useUiStore((s) => s.settingsTab);
  const openSettings = useUiStore((s) => s.openSettings);
  const { specs, values, error, load, refresh, reset } = useParamStore();
  const version = useSimStore((s) => s.paramVersion);
  const [query, setQuery] = useState("");

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (specs.length) void refresh(); }, [version]);               // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  const found = useMemo(() => (q ? specs.filter((s) => `${s.label} ${s.key} ${s.help}`.toLowerCase().includes(q)) : []), [q, specs]);
  const page = PAGES.find((p) => p.id === tab);
  const pageSpecs = page ? specs.filter((s) => page.groups.includes(s.group)) : [];

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        {!embedded && <h2 className="text-[15px] font-semibold">Einstellungen</h2>}
        <input type="search" className="flex-1 rounded-md border border-line bg-bg px-2 py-1 text-[13px]" placeholder="Einstellung suchen …" aria-label="Einstellungen durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        {onClose && <button className="btn" onClick={onClose} aria-label="Einstellungen schließen">✕</button>}
      </header>
      {!q && (
        <nav className="flex flex-wrap gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Bereiche">
          {[...PAGES, ...EXTRA].map((p) => (
            <button key={p.id} role="tab" aria-selected={tab === p.id} className={`btn ${tab === p.id ? "on" : ""}`} onClick={() => openSettings(p.id)}>{p.label}</button>
          ))}
        </nav>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 pt-2">
        {error && <p role="alert" className="mb-2 text-[13px] text-warn">{error}</p>}
        {tab === "ton" && !q ? <TonSettings /> : !values ? <p className="text-dim">Lade Einstellungen …</p> : q ? (
          found.length ? <ParamGroup specs={found} compact /> : <p className="text-dim">Nichts gefunden für „{query}“.</p>
        ) : tab === "presets" ? <PresetManager /> : tab === "status" ? <StatusPanels /> : (
          <>
            {pageSpecs.some((s) => s.scope === "global") && (
              <div className="flex justify-end"><button className="btn" onClick={() => void reset({ group: page!.groups[0] })}>Gruppe auf Standard</button></div>
            )}
            {tab === "mode" && <p className="my-2 text-[13px] text-dim">Der Modus bestimmt, was die Agenten über dich erfahren. Er gilt ab der nächsten Entscheidung und ändert keine Erinnerungen.</p>}
            <ParamGroup specs={pageSpecs} />
          </>
        )}
      </div>
    </>
  );
}
