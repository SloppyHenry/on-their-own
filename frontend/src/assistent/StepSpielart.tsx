// Schritt 1 des Assistenten: die Spielart (AP18d, Mockup Bild 7). Leben: nur die Bewohner verändern die Welt. Gott: du auch, von außen. Die Wahl gehört zum Spielstand
// und lässt sich später unter Menü › Einstellungen › Spielart ändern. Die Bewohner erfahren davon nie etwas.
import { useAssistent } from "./assistentStore";

const KARTEN = [
  { id: "leben", icon: "🌱", titel: "Leben", text: "Du schaust zu. Nur die Bewohner verändern die Welt, mit dem, was das Spiel hergibt: bauen, pflanzen, ernten. Keine Ereignisse von dir, kein Gestalten. Die Welt bringt von selbst Wetter und Ereignisse.", test: "spielart-leben" },
  { id: "gott", icon: "✦", titel: "Gott", text: "Du kannst jederzeit von außen eingreifen: Ereignisse eingeben, die Welt gestalten (die Zeit steht dabei still), Bewohner und Weltregeln bearbeiten. Die Bewohner merken nichts davon.", test: "spielart-gott" },
] as const;

export function StepSpielart() {
  const mode = useAssistent((s) => s.draft.playMode), patch = useAssistent((s) => s.patchDraft);
  return (
    <div data-testid="step-spielart">
      <h2 className="mb-1 text-[19px] font-bold">Spielart</h2>
      <p className="mb-3 text-[13px] text-dim">Wer die Welt verändern darf. Das gilt für diesen Spielstand und lässt sich später im Menü ändern.</p>
      <div className="grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
        {KARTEN.map((k) => (
          <button key={k.id} type="button" aria-pressed={mode === k.id} data-testid={k.test} onClick={() => patch({ playMode: k.id })}
            className={`cursor-pointer rounded-xl border p-4 text-left ${mode === k.id ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
            <span className="text-2xl">{k.icon}</span> <b className="text-base">{k.titel}</b>{k.id === "leben" && <span className="ml-2 rounded-full border border-line px-2 text-[11px] text-dim">Standard</span>}
            <small className="mt-1 block text-xs leading-relaxed text-dim">{k.text}</small>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-dashed border-line bg-black/10 p-3 opacity-60" data-testid="spielart-eigene-figur">
        <b>Leben mit eigener Figur</b><span className="ml-2 rounded-full border border-plan px-2 text-[11px] text-plan">kommt mit Mitleben</span>
        <small className="mt-0.5 block text-xs text-dim">Du spielst einen Bewohner unter Bewohnern: sagen, benutzen, bauen, gehen.</small>
      </div>
    </div>
  );
}
