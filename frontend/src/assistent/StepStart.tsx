// Schritt 5 des Assistenten: Übersicht und Start (AP17b). Die alte Welt wird vorher als Spielstand gesichert („Vor der neuen Simulation“).
import { useEffect, useState } from "react";
import { clearDraftAfterCreate, requestKey, useAssistent } from "./assistentStore";
import { houseCount, relChanged } from "./entwurf";
import { useUiStore } from "../store/uiStore";

export const START_WORD = "neu starten";
const MODE = { observer: "Verborgen", creator: "Schöpfer", intervention: "Eingriff" };

export function StepStart() {
  const { draft, preview, busy, error, limits } = useAssistent();
  const run = useAssistent((s) => s.runPreview), patch = useAssistent((s) => s.patchDraft);
  const key = requestKey(draft), fresh = preview?.key === key;
  useEffect(() => { if (!fresh && busy === null) void run(); }, [fresh, busy, run]);       // die Übersicht gilt immer für den aktuellen Entwurf
  const rs = draft.residents, n = rs.length;
  const changed = Object.entries(draft.rel).filter(([k, v]) => { const [a, b] = k.split(">").map(Number); return a < n && b < n && relChanged(v); }).length + Object.values(draft.stories).filter((t) => t.trim()).length;
  const homes = rs.filter((r) => r.home);
  const ok = fresh && !!preview?.ok;
  const row = (a: string, b: React.ReactNode) => <><dt className="text-dim">{a}</dt><dd className="m-0">{b}</dd></>;
  return (
    <div data-testid="step-start">
      <h2 className="mb-1 text-[19px] font-bold">Start</h2>
      <p className="mb-3 text-[13px] text-dim">Alles auf einen Blick. Die bisherige Welt wird vorher als Spielstand „Vor der neuen Simulation“ gesichert, nicht gelöscht.</p>
      <section className="mb-3 rounded-xl border border-line bg-black/15 p-3">
        <dl className="grid grid-cols-[110px_1fr] gap-x-3.5 gap-y-1.5 text-[13px]" data-testid="start-uebersicht">
          {row("Spielart", draft.playMode === "leben" ? (draft.player !== null && rs[draft.player] ? `Leben mit eigener Figur: du bist ${rs[draft.player].profile.name}` : "Leben (nur die Bewohner verändern die Welt)") : "Gott (du greifst von außen ein)")}
          {row("Welt", draft.world.kind === "start" ? "Startwelt (Dorf am See, Heimhaus)" : draft.world.kind === "library" ? `Welt aus der Bibliothek: ${preview?.village || draft.world.libraryId}` : `Neues Dorf, Seed ${draft.world.seed}, ${houseCount(draft)} Wohnhäuser mit ${houseCount(draft) * 2} Betten`)}
          {row("Bewohner", `${n}: ${rs.map((r) => r.profile.name).join(", ")}`)}
          {row("Beziehungen", changed ? `${changed} Angaben geändert` : "alle auf Standard")}
          {row("Wohnen", homes.length ? `${homes.map((r) => `${r.profile.name} in ${draft.world.kind === "start" ? "Heimhaus" : `Haus ${r.home}`}`).join(", ")}; die übrigen suchen sich selbst eine Bleibe` : "alle suchen sich selbst eine Bleibe")}
          {row("Regeln", `${draft.rules.preset || "Standard"}, Autonomie ${draft.rules.autonomy ?? "unverändert"}, Knappheit ${draft.rules.scarcity === null ? "unverändert" : `${draft.rules.scarcity} %`}`)}
          {row("Weltregeln", draft.rules.events.length ? `${draft.rules.events.length} ${draft.rules.events.length === 1 ? "Startereignis" : "Startereignisse"}: ${draft.rules.events.map((e) => `„${e.text}“`).join(", ")}` : "keine")}
          {row("Modus", MODE[draft.rules.mode])}
          {row("Modell", draft.model || "bisheriges")}
          {row("Tempo", `etwa ${(n * limits.secondsPerDecision).toFixed(1).replace(".", ",")} s je Runde`)}
        </dl>
      </section>
      {busy === "preview" && <p className="mb-2 text-[13px] text-dim" data-testid="start-pruefung">Entwurf wird geprüft …</p>}
      {fresh && preview && !preview.ok && <div role="alert" className="mb-3 rounded-xl border border-warn px-3 py-2 text-[13px] text-warn" data-testid="start-fehler"><b>Der Entwurf lässt sich noch nicht starten:</b><ul className="ml-5 list-disc">{preview.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {fresh && preview && preview.warnings.length > 0 && <div role="status" className="mb-3 rounded-xl border border-warn/70 px-3 py-2 text-xs text-warn" data-testid="start-warnungen">⚠ Hinweise der Wortprüfung (der Start ist trotzdem möglich):<ul className="ml-5 list-disc">{preview.warnings.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {error && <p role="alert" className="mb-2 text-[13px] text-warn" data-testid="start-api-fehler">{error}</p>}
      <section className="mb-3 flex flex-wrap gap-3 rounded-xl border border-line bg-black/15 p-3 text-[13px]">
        <label className="flex items-center gap-1.5"><input type="radio" name="lauf" checked={draft.run === "paused"} onChange={() => patch({ run: "paused" })} data-testid="lauf-angehalten" />angehalten beginnen</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="lauf" checked={draft.run === "running"} onChange={() => patch({ run: "running" })} data-testid="lauf-laufen" />sofort laufen lassen</label>
      </section>
      <StartKnopf ok={ok} />
    </div>
  );
}

function StartKnopf({ ok }: { ok: boolean }) {
  const [open, setOpen] = useState(false), [word, setWord] = useState("");
  const { busy } = useAssistent(), create = useAssistent((s) => s.create), setMenu = useUiStore((s) => s.setMenu);
  const go = async () => { if (await create()) { setOpen(false); clearDraftAfterCreate(); setMenu(null); } else setOpen(false); };
  return (
    <>
      <button type="button" className="btn on" disabled={!ok || busy !== null} onClick={() => { setWord(""); setOpen(true); }} data-testid="start-anlegen">Simulation anlegen …</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true" aria-label="Neue Simulation anlegen" data-testid="start-dialog">
          <form className="w-96 rounded-lg border border-alex bg-panel p-5" onSubmit={(e) => { e.preventDefault(); if (word.trim().toLowerCase() === START_WORD) void go(); }}>
            <h3 className="text-lg font-semibold">Neue Simulation anlegen?</h3>
            <p className="mt-2 text-sm text-dim">Die bisherige Welt wird als Spielstand „Vor der neuen Simulation“ gesichert. Die neue Simulation beginnt, wie du es gewählt hast.</p>
            <label className="mt-4 block text-sm">Zur Bestätigung „{START_WORD}“ eingeben<input autoFocus className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5" value={word} onChange={(e) => setWord(e.target.value)} data-testid="start-wort" /></label>
            <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn" onClick={() => setOpen(false)}>Abbrechen</button><button type="submit" className="btn on" disabled={word.trim().toLowerCase() !== START_WORD || busy !== null} data-testid="start-bestaetigen">{busy === "apply" ? "Wird angelegt …" : "Anlegen"}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
