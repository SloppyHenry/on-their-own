// Cursor-Schicht des Gestaltens (AP16b): Raster um den Zeiger, Geist des Werkzeugs (grün = geht, rot = geht nicht, mit Grund am Cursor), Türmarke, der Schleier
// „neu im Entwurf“ (violett gestrichelt) und blockierte Stellen. Liegt als SVG über der Weltfläche, nimmt keine Zeigerereignisse und folgt der Kamera im Bildtakt.
import { useEffect, useState } from "react";
import type { WorldBridge } from "../world/worldBridge";
import { useGestalten } from "./gestaltenStore";
import { baueSzene, type Form, type Szene } from "./szene";
import type { Punkt, Werkzeug } from "./typen";

const T = 16;
type Pix = { x: number; y: number }[];
interface Gezeichnet { raster: string; geist: { d: string; art: Form["art"]; pts: Pix }[]; tuer: string; schleier: { d: string; x: number; y: number; text: string }[]; blockiert: string[]; kachel: string; rand: string[]; gebiet: { d: string; x: number; y: number; text: string } | null; tip: { x: number; y: number } | null }

const pfad = (p: Pix, zu = true) => (p.length ? `M${p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join("L")}${zu ? "Z" : ""}` : "");

function zeichne(s: Szene, hover: Punkt | null, proj: (p: Punkt) => { x: number; y: number } | null): Gezeichnet | null {
  const form = (f: Form) => f.punkte.map(proj).filter((q): q is { x: number; y: number } => !!q);
  const flaeche = (f: Form) => { const q = form(f); return q.length === f.punkte.length ? pfad(q, f.art === "flaeche") : ""; };
  const oben = (f: Form) => { const q = form(f); return q.length ? q.reduce((a, b) => (b.y < a.y ? b : a)) : { x: 0, y: 0 }; };
  const c = hover ? proj([hover[0] + 0.5, hover[1] + 0.5]) : null;
  const tu = s.tuer ? proj([s.tuer[0] + 0.5, s.tuer[1] + 0.5]) : null;
  return {
    raster: s.raster.map((l) => { const q = l.map(proj); return q[0] && q[1] ? `M${q[0].x.toFixed(1)} ${q[0].y.toFixed(1)}L${q[1].x.toFixed(1)} ${q[1].y.toFixed(1)}` : ""; }).join(""),
    geist: s.geist.map((f) => ({ d: f.art === "punkte" ? "" : flaeche(f), art: f.art, pts: f.art === "punkte" ? form(f) : [] })),
    tuer: tu ? `M${(tu.x - 9).toFixed(1)} ${(tu.y - 4).toFixed(1)}h18v8h-18z` : "",
    schleier: s.schleier.map((q) => ({ d: flaeche(q.form), ...oben(q.form), text: q.text })),
    blockiert: s.blockiert.map(flaeche),
    kachel: s.kachel ? flaeche(s.kachel) : "",
    rand: s.rand.map(flaeche),
    gebiet: s.gebiet ? { d: flaeche(s.gebiet.form), ...oben(s.gebiet.form), text: s.gebiet.text } : null,
    tip: c,
  };
}

export function CursorSchicht({ bridge }: { bridge: WorldBridge }) {
  const [z, setZ] = useState<Gezeichnet | null>(null);
  const probe = useGestalten((s) => s.probe), pending = useGestalten((s) => s.pending.length), katalog = useGestalten((s) => s.katalog), werkzeug = useGestalten((s) => s.werkzeug), opt = useGestalten((s) => s.opt), raster = useGestalten((s) => s.raster);
  useEffect(() => {
    let last = "";
    return bridge.onFrame(() => {
      const w = bridge.world(), g = useGestalten.getState(), p = bridge.commands.punktCss;
      if (!w || !p) return;
      const wp = (q: Punkt) => p(q[0] * T, q[1] * T);
      const gebietEcke = bridge.markierung?.() ?? null;
      const s = baueSzene({ werkzeug: g.werkzeug, opt: g.opt, pending: g.pending, hover: g.hover, raster: g.raster, aktionen: g.aktionen, stati: g.rechnung?.stati ?? [], welt: [w.map.width, w.map.height], gebietEcke: g.werkzeug === "gebiet" ? gebietEcke : null });
      const out = zeichne(s, g.hover, wp);
      const key = JSON.stringify(out);
      if (key !== last) { last = key; setZ(out); }
    });
  }, [bridge]);
  const bad = !!probe && !probe.ok, farbe = bad ? "#e0806f" : "#93c79f";
  const hinweis = bad ? `✗ ${probe.grund ?? "Das geht dort nicht."}` : tipText(werkzeug, pending, katalog?.haeuser.find((h) => h.gebaeude === opt.haus.gebaeude)?.name ?? "Haus");
  return (
    <>
    <svg className="pointer-events-none absolute inset-0 z-[3] size-full" aria-hidden="true" data-testid="cursor-schicht" data-werkzeug={werkzeug} data-haus={opt.haus.gebaeude}>
      {z && (
        <>
          {raster && <path d={z.raster} stroke="#ffffff" strokeOpacity=".16" strokeWidth="1" fill="none" />}
          {z.rand.map((d, i) => <path key={i} d={d} fill="#d9c8ff" fillOpacity=".18" stroke="#d9c8ff" strokeWidth="2" strokeDasharray="8 6" />)}
          {z.schleier.map((q, i) => (
            <g key={i}><path d={q.d} fill="#9678dc" fillOpacity=".16" stroke="#d9c8ff" strokeWidth="2" strokeDasharray="8 6" data-testid="entwurf-schleier" />
              <text x={q.x + 6} y={q.y - 5} fontSize="10.5" fontWeight="700" fill="#e9ddff" stroke="#2b2233" strokeWidth="3" paintOrder="stroke">{q.text}</text></g>
          ))}
          {z.blockiert.map((d, i) => <path key={i} d={d} fill="#e0806f" fillOpacity=".4" stroke="#e0806f" strokeWidth="2" />)}
          {z.gebiet && <g data-testid="gebiet-rahmen"><path d={z.gebiet.d} fill="#9678dc" fillOpacity=".12" stroke="#d9c8ff" strokeWidth="2.5" strokeDasharray="12 8" /><text x={z.gebiet.x + 8} y={z.gebiet.y - 6} fontSize="12" fontWeight="700" fill="#e9ddff" stroke="#2b2233" strokeWidth="3" paintOrder="stroke">{z.gebiet.text}</text></g>}
          {z.geist.map((g, i) => g.art === "linie" ? <path key={i} d={g.d} fill="none" stroke={bad ? "#e0806f" : "#d9c8ff"} strokeOpacity=".9" strokeWidth="3" strokeDasharray="10 7" data-testid="geist" data-ok={bad ? "nein" : "ja"} /> : g.art === "punkte" ? <g key={i}>{g.pts.map((q, k) => <circle key={k} cx={q.x} cy={q.y} r="6" fill="#d9c8ff" stroke="#000" strokeOpacity=".5" strokeWidth="2" />)}</g> : <path key={i} d={g.d} fill={farbe} fillOpacity=".2" stroke={farbe} strokeWidth="2.5" strokeDasharray="7 5" data-testid="geist" data-ok={bad ? "nein" : "ja"} />)}
          {z.tuer && <path d={z.tuer} fill={farbe} stroke="#000" strokeOpacity=".4" data-testid="tuermarke" />}
          {z.kachel && <path d={z.kachel} fill="none" stroke={bad ? "#e0806f" : "#ffd36e"} strokeWidth="2" data-testid="cursor-kachel" />}
        </>
      )}
    </svg>
    {z?.tip && hinweis && <div className={`gs-tip ${bad ? "bad" : "ok"}`} style={{ left: z.tip.x + 22, top: z.tip.y - 8 }} data-testid="cursor-tip" role="status">{hinweis}</div>}
    </>
  );
}

function tipText(w: Werkzeug, pending: number, name: string): string {
  switch (w) {
    case "weg": return pending ? "Klick setzt einen Punkt · Doppelklick oder Enter beendet · Esc bricht ab" : "Klick setzt den ersten Punkt";
    case "see": return pending ? "Klick setzt den Rand" : "Klick setzt die Mitte";
    case "garten": return pending ? "Klick setzt die zweite Ecke" : "Klick setzt die erste Ecke";
    case "haus": return `✓ ${name} · Tür nach Süden`;
    case "natur": return "Klick setzt";
    case "loeschen": return "Klick löscht";
    case "startplatz": return "Klick setzt den Startplatz";
    case "gebiet": return "Klick setzt die linke obere Ecke";
    default: return "";
  }
}
