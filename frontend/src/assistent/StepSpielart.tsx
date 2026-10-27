// Schritt 1 des Assistenten: die Spielart (AP18d, Mockup Bild 7). Leben: nur die Bewohner verändern die Welt. Gott: du auch, von außen. Die Wahl gehört zum Spielstand
// und lässt sich später unter Menü › Einstellungen › Spielart ändern. Die Bewohner erfahren davon nie etwas.
import { useAssistent } from "./assistentStore";

const KARTEN = [
  { id: "leben", icon: "🌱", titel: "Leben", text: "Du schaust zu. Nur die Bewohner verändern die Welt, mit dem, was das Spiel hergibt: bauen, pflanzen, ernten. Keine Ereignisse von dir, kein Gestalten. Die Welt bringt von selbst Wetter und Ereignisse.", test: "spielart-leben" },
  { id: "gott", icon: "✦", titel: "Gott", text: "Du kannst jederzeit von außen eingreifen: Ereignisse eingeben, die Welt gestalten (die Zeit steht dabei still), Bewohner und Weltregeln bearbeiten. Die Bewohner merken nichts davon.", test: "spielart-gott" },
] as const;

export function StepSpielart() {
  const mode = useAssistent((s) => s.draft.playMode), player = useAssistent((s) => s.draft.player), patch = useAssistent((s) => s.patchDraft);
  return (
    <div data-testid="step-spielart">
      <h2 className="mb-1 text-[19px] font-bold">Spielart</h2>
      <p className="mb-3 text-[13px] text-dim">Wer die Welt verändern darf. Das gilt für diesen Spielstand und lässt sich später im Menü ändern.</p>
      <div className="grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
        {KARTEN.map((k) => (
          <button key={k.id} type="button" aria-pressed={mode === k.id && (k.id !== "leben" || player === null)} data-testid={k.test} onClick={() => patch({ playMode: k.id, player: null })}
            className={`cursor-pointer rounded-xl border p-4 text-left ${mode === k.id && (k.id !== "leben" || player === null) ? "border-alex bg-alex/10" : "border-line bg-black/15"}`}>
            <span className="text-2xl">{k.icon}</span> <b className="text-base">{k.titel}</b>{k.id === "leben" && <span className="ml-2 rounded-full border border-line px-2 text-[11px] text-dim">Standard</span>}
            <small className="mt-1 block text-xs leading-relaxed text-dim">{k.text}</small>
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={mode === "leben" && player !== null} data-testid="spielart-eigene-figur" onClick={() => patch({ playMode: "leben", player: player ?? 0 })}
        className={`mt-3 w-full cursor-pointer rounded-xl border p-3 text-left ${mode === "leben" && player !== null ? "border-world bg-world/10" : "border-line bg-black/15"}`}>
        <span className="text-xl">🧍</span> <b>Leben mit eigener Figur</b>
        <small className="mt-0.5 block text-xs text-dim">Du spielst einen Bewohner unter Bewohnern: sagen, benutzen, bauen, gehen. Für die anderen bist du einer von ihnen. Im nächsten Schritt wählst du, wer du bist.</small>
      </button>
    </div>
  );
}
