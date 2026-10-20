// Einstellungen › Spielart (AP18d): Leben oder Gott. Gehört zum Spielstand. Wechseln geht in beide Richtungen, mit Bestätigung; die Bewohner merken nichts davon.
import { useState } from "react";
import { ApiError, api } from "../net/api";
import { useSimStore } from "../store/simStore";
import { Rueckfrage } from "../ui/Rueckfrage";

const ARTEN = [
  { id: "leben", icon: "🌱", titel: "Leben", text: "Nur die Bewohner verändern die Welt. Keine Ereignisse von dir, kein Gestalten. Zuschauen, Zeit steuern, Einblicke." },
  { id: "gott", icon: "✦", titel: "Gott", text: "Du kannst von außen eingreifen: Ereignisse eingeben, die Welt gestalten (die Zeit steht dabei still), Bewohner und Weltregeln bearbeiten." },
] as const;

export function SpielartSeite() {
  const aktuell = useSimStore((s) => s.world?.playMode ?? "gott");
  const [frage, setFrage] = useState<"leben" | "gott" | null>(null), [fehler, setFehler] = useState<string | null>(null);
  const wechseln = async (m: "leben" | "gott") => { setFrage(null); setFehler(null); try { await api.setPlayMode(m); } catch (e) { setFehler(e instanceof ApiError ? e.detail : "Backend nicht erreichbar"); } };
  return (
    <div data-testid="spielart-seite" className="max-w-2xl">
      <p className="mb-3 text-[13px] text-dim">Die Spielart bestimmt, wer die Welt verändern darf. Sie gehört zu diesem Spielstand. Die Bewohner erfahren nie davon; im Protokoll der Leitstelle steht nur der Wechsel.</p>
      <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
        {ARTEN.map((k) => (
          <button key={k.id} type="button" aria-pressed={aktuell === k.id} data-testid={`spielart-${k.id}`} disabled={aktuell === k.id} onClick={() => setFrage(k.id)}
            className={`rounded-xl border p-4 text-left ${aktuell === k.id ? "border-alex bg-alex/10" : "cursor-pointer border-line bg-black/15 hover:border-alex"}`}>
            <span className="text-2xl">{k.icon}</span> <b className="text-base">{k.titel}</b>{aktuell === k.id && <span className="ml-2 text-xs text-alex">aktuell</span>}
            <small className="mt-1 block text-xs leading-relaxed text-dim">{k.text}</small>
          </button>
        ))}
      </div>
      {fehler && <p role="alert" className="mt-3 text-[13px] text-warn">{fehler}</p>}
      {frage && (
        <Rueckfrage titel={`Spielart „${frage === "leben" ? "Leben" : "Gott"}“ wählen?`} testid="spielart-frage"
          text={frage === "leben" ? "Ab jetzt verändern nur noch die Bewohner die Welt. Die Werkzeuge Ereignis und Gestalten verschwinden. Bereits Geschehenes bleibt." : "Ab jetzt kannst du von außen eingreifen: Ereignisse eingeben und die Welt gestalten. Die Bewohner merken nichts davon."}
          ja="Spielart wechseln" nein="Abbrechen" onNein={() => setFrage(null)} onJa={() => void wechseln(frage)} />
      )}
    </div>
  );
}
