// Handlungsleiste unten in der Mitte (AP18h-b1, Mockup docs/mockups/mitleben.html, Bild 1): die Leiste mit den fünf Möglichkeiten deiner Figur und darüber das Band
// „Was deine Figur gerade tut“ mit Abbrechen. Nur in der Spielart Leben mit eigener Figur. Sagen, Benutzen, Bauen und Gepäck kommen mit b2 und b3.
import { activityOf } from "../panels/AgentPanel";
import { useSimStore } from "../store/simStore";
import { EBENE, useRueckweg } from "../ui/zurueck";
import type { World } from "../store/types";
import { pc, usePlayer } from "../world/player/PlayerController";

const KOMMT: [string, string, string, string][] = [["💬", "Sagen", "T", "kommt mit AP18h-b2"], ["✋", "Benutzen", "U", "kommt mit AP18h-b2"], ["🔨", "Bauen", "B", "kommt mit AP18h-b3"]];

/** Wohin es geht, wenn das Ziel eine Kachel ist: der kleinste Ort, der sie enthält („zum See“); sonst nichts. */
function placeAt(w: World, t: unknown): string | null {
  if (!Array.isArray(t) || t.length !== 2) return null;
  const hits = Object.values(w.locations).filter((l) => !l.props.fallback && t[0] >= l.rect[0] && t[0] < l.rect[0] + l.rect[2] && t[1] >= l.rect[1] && t[1] < l.rect[1] + l.rect[3]);
  hits.sort((a, b) => a.rect[2] * a.rect[3] - b.rect[2] * b.rect[3]);
  return hits[0]?.name ?? null;
}

export function Handlungsleiste() {
  const w = useSimStore((s) => s.world), me = w?.player ? w.agents[w.player] : null, estimate = usePlayer((s) => s.minutes);
  const busy = !!me?.action;
  useRueckweg(busy, EBENE.Spiel, () => { void pc.cancel(); });                       // Esc bricht ab, wenn sonst nichts offen ist
  if (!w || !me) return null;
  const act = me.action, end = act ? w.walks[me.id]?.arrive.at(-1) ?? act.ends_at ?? (act.type === "move_to" && estimate != null ? act.started_at + estimate : null) : null;   // beim Gehen steht das Ende im Weg (`arrive`, erst ab dem ersten Schritt), sonst in der Handlung; bis dahin gilt die Schätzung
  const rest = end != null ? Math.max(0, end - w.clock.minute) : null;
  const done = act && end != null && end > act.started_at ? Math.min(100, Math.round(((w.clock.minute - act.started_at) / (end - act.started_at)) * 100)) : 0;
  const ort = act?.type === "move_to" ? placeAt(w, act.params.tile) : null, text = ort ? `geht zu ${ort}` : act ? activityOf(me, w).text : "";
  return (
    <>
      {act && (
        <div className="glas hud-pop pointer-events-auto absolute bottom-[82px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 !rounded-full py-[7px] pl-3.5 pr-2 text-[13px]" data-testid="band" role="status">
          <span>🚶 <b className="text-world">{me.name}</b> {text}{rest != null ? ` · noch ${rest} Min.` : ""}</span>
          <span className="block h-1.5 w-[120px] overflow-hidden rounded-full bg-white/[.08]"><i className="block h-full rounded-full bg-world" style={{ width: `${done}%` }} /></span>
          <button type="button" className="btn" onClick={() => void pc.cancel()} data-testid="abbrechen">Abbrechen <kbd className="kbd">Esc</kbd></button>
        </div>
      )}
      <div className="glas pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 p-1.5" role="group" aria-label="Handlungen" data-testid="handlungsleiste">
        {KOMMT.map(([ic, name, key, hint]) => (
          <button key={name} type="button" disabled title={hint} className="btn !px-4 !py-2 font-semibold">{ic} {name} <kbd className="kbd max-[1320px]:hidden">{key}</kbd></button>
        ))}
        <button type="button" className="btn !px-4 !py-2 font-semibold" title="Klick in die Welt schickt deine Figur dorthin" data-testid="leiste-gehen" onClick={() => undefined}>🧭 Gehen <small className="text-dim font-normal">Klick in die Welt</small></button>
        <button type="button" disabled title="kommt mit AP18h-b3" className="btn !px-4 !py-2 font-semibold">🎒 Gepäck <kbd className="kbd max-[1320px]:hidden">I</kbd></button>
      </div>
    </>
  );
}
