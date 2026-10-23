// Benutzen (AP18h-b2, Mockup Bild 2): die Liste dessen, was die eigene Figur hier und jetzt tun könnte, aus GET /api/player/choices, also dieselbe Optionsliste, die ein Bewohner bekäme.
// Gruppiert nach Art der Handlung, mit Dauer; Unmögliches bleibt sichtbar und nennt den Grund. Ob es gelingt, entscheidet die Welt.
import { useEffect, useState } from "react";
import { api, type PlayerChoice } from "../net/api";
import { useUiStore } from "../store/uiStore";
import { EBENE, useRueckweg } from "../ui/zurueck";
import { pc } from "../world/player/PlayerController";

const GROUP: Record<string, [string, string]> = {
  move_to: ["🚶", "Gehen"], use: ["✋", "Benutzen"], gather: ["🧺", "Sammeln"], drink: ["💧", "Trinken"], eat: ["🍎", "Essen"], take: ["🤲", "Nehmen"], drop: ["⬇", "Ablegen"],
  give: ["🎁", "Geben"], speak: ["💬", "Sprechen"], build: ["🔨", "Bauen"], water: ["🌱", "Gießen"], plant: ["🌳", "Pflanzen"], wait: ["⏳", "Warten"],
};

export function groupChoices(list: PlayerChoice[]): [string, PlayerChoice[]][] {
  const by = new Map<string, PlayerChoice[]>();
  for (const c of list) by.set(c.action, [...(by.get(c.action) ?? []), c]);
  return [...by.entries()];
}

export function Benutzen() {
  const setPop = useUiStore((s) => s.setPop);
  const [list, setList] = useState<PlayerChoice[] | null>(null), [sel, setSel] = useState(0), [err, setErr] = useState("");
  useRueckweg(true, EBENE.Popover, () => setPop(null));
  useEffect(() => { api.playerChoices().then(setList).catch((e) => setErr(String(e.detail ?? e))); }, []);
  const flat = list ?? [];
  const run = async (c: PlayerChoice) => {
    if (!c.ok) return;
    if (c.action === "speak") { useUiStore.getState().select({ kind: "agent", id: String(c.params.to ?? "") }); setPop("sagen"); return; }
    if (c.utterance_key) return;                                                          // braucht einen Text: kommt mit der Sagen-Zeile
    setPop(null);
    await pc.act(c.action, c.params);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(flat.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
      else if (e.key === "Enter" && flat[sel]) { e.preventDefault(); void run(flat[sel]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  let n = -1;
  return (
    <div className="glas hud-pop pointer-events-auto absolute bottom-[82px] left-1/2 z-20 max-h-[60%] w-[470px] -translate-x-1/2 overflow-auto px-4 py-3.5" data-testid="benutzen" role="menu">
      <h4 className="text-[15px] font-semibold">✋ Benutzen <small className="font-normal text-dim">· hier, jetzt, für dich</small></h4>
      {err && <p className="mt-2 text-xs text-warn">{err}</p>}
      {list === null && !err && <p className="mt-2 text-xs text-dim">Einen Moment …</p>}
      {list?.length === 0 && <p className="mt-2 text-xs text-dim">Gerade gibt es nichts zu tun.</p>}
      {groupChoices(flat).map(([action, items]) => (
        <div key={action}>
          <div className="mt-2.5 text-[11px] font-bold uppercase tracking-[.1em] text-dim">{GROUP[action]?.[0] ?? "•"} {GROUP[action]?.[1] ?? action}</div>
          {items.map((c) => {
            const i = ++n;
            return (
              <button key={`${action}:${c.label}:${i}`} type="button" role="menuitem" aria-disabled={!c.ok} data-testid="benutzen-option" onClick={() => void run(c)} onMouseEnter={() => setSel(i)}
                className={`mt-[5px] flex w-full items-center gap-2.5 rounded-[11px] border px-[11px] py-2 text-left text-[13px] ${sel === i ? "border-alex bg-[#ffd36e]/10" : "border-line bg-white/[.03]"} ${c.ok ? "" : "cursor-not-allowed opacity-50"}`}>
                <b className="font-semibold">{c.label}</b>
                <small className={`ml-auto text-right ${c.ok ? "text-dim" : "text-warn"}`}>{c.ok ? (c.eta ? `etwa ${c.eta} Min.` : "sofort") : c.reason}</small>
              </button>
            );
          })}
        </div>
      ))}
      <div className="mt-2.5 flex items-center gap-2.5 text-[11.5px] text-dim"><span>Genau diese Liste bekäme auch ein Bewohner angeboten.</span><span className="ml-auto"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> wählen · <kbd className="kbd">Enter</kbd> tun · <kbd className="kbd">Esc</kbd> zu</span></div>
    </div>
  );
}
