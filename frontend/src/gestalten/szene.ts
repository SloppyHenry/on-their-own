// Was die Cursor-Schicht zeichnet (AP16b), als reine Geometrie in Kachelkoordinaten: Raster um den Zeiger, Geist des Werkzeugs, Schleier „neu im Entwurf“, blockierte Stellen.
// `Szene` kennt keine Bildschirmpixel; die Schicht rechnet die Punkte mit der Projektion der Weltansicht um (Tiefe und Flach).
import { hausPixel, umrissKacheln } from "./entwurf";
import type { Aktion, AktionStatus, Optionen, Punkt, Werkzeug } from "./typen";
import { rechteck, seeRadius } from "./werkzeug";

export type Form = { punkte: Punkt[]; art: "flaeche" | "linie" | "punkte" };
export interface Szene {
  raster: Punkt[][];                      // Linien des Rasters
  geist: Form[];                          // was das Werkzeug gerade setzen würde
  tuer: Punkt | null;                     // Türmarke (Kachel unter der Haustür)
  schleier: { form: Form; text: string }[];
  blockiert: Form[];
  kachel: Form | null;                    // Kachel unter dem Zeiger
  rand: Form[];                           // Karte erweitern: neue Fläche
  gebiet: { form: Form; text: string } | null;
}

const GEBIET: Punkt = [68, 46];            // ein erzeugtes Dorf ist je nach Seed 58–77 × 40–51 Kacheln groß
const kasten = (x0: number, y0: number, x1: number, y1: number): Form => ({ art: "flaeche", punkte: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
const kachel = (t: Punkt): Form => kasten(t[0], t[1], t[0] + 1, t[1] + 1);
const mitte = (t: Punkt): Punkt => [t[0] + 0.5, t[1] + 0.5];

function ellipse(m: Punkt, rx: number, ry: number): Form {
  const c = mitte(m);
  return { art: "flaeche", punkte: Array.from({ length: 40 }, (_, i) => [c[0] + rx * Math.cos((i / 40) * 2 * Math.PI), c[1] + ry * Math.sin((i / 40) * 2 * Math.PI)] as Punkt) };
}

export interface Eingang {
  werkzeug: Werkzeug; opt: Optionen; pending: Punkt[]; hover: Punkt | null; raster: boolean;
  aktionen: Aktion[]; stati: AktionStatus[]; welt: Punkt; gebietEcke: Punkt | null;
}

/** Der Geist des Werkzeugs an der Zeigerkachel (`hover`) mit der angefangenen Form (`pending`). */
function geist(e: Eingang): { geist: Form[]; tuer: Punkt | null } {
  const { werkzeug: w, pending: p, hover: h, opt } = e;
  if (!h) return { geist: [], tuer: null };
  if (w === "weg") return { geist: [{ art: "linie", punkte: [...p, h].map(mitte) }, { art: "punkte", punkte: p.map(mitte) }], tuer: null };
  if (w === "see") { const r = p[0] ? seeRadius(p[0], h) : 3; return { geist: [ellipse(p[0] ?? h, r, r * 0.75)], tuer: null }; }
  if (w === "garten") { if (!p[0]) return { geist: [kachel(h)], tuer: null }; const [x, y, bw, bh] = rechteck(p[0], h); return { geist: [kasten(x, y, x + bw, y + bh)], tuer: null }; }
  if (w === "haus") {
    const half = hausPixel(opt.haus.gebaeude, opt.haus.breite) / 32, c = h[0] + 0.5;
    return { geist: [kasten(c - half, h[1] - 1, c + half, h[1] + 1)], tuer: [h[0], h[1] + 1] };
  }
  if (w === "gebiet") return { geist: [], tuer: null };
  return { geist: [kachel(h)], tuer: null };
}

export function baueSzene(e: Eingang): Szene {
  const h = e.hover, g = geist(e);
  const raster: Punkt[][] = [];
  if (e.raster && h) for (let i = -6; i <= 7; i++) { raster.push([[h[0] + i, h[1] - 6], [h[0] + i, h[1] + 7]], [[h[0] - 6, h[1] + i], [h[0] + 7, h[1] + i]]); }
  const schleier = e.aktionen.map((a, i) => ({ a, i, u: umrissKacheln(a) })).filter((q) => q.u).map(({ u }) => ({ form: kasten(u![0], u![1], u![2] + 1, u![3] + 1), text: "neu im Entwurf" }));
  const blockiert = e.stati.filter((s) => !s.ok && s.ort && s.ort.length === 2).map((s) => kachel([s.ort![0], s.ort![1]]));
  const rand: Form[] = [];
  if (e.werkzeug === "karte") rand.push(kasten(e.welt[0], 0, e.welt[0] + e.opt.karte.ost, e.welt[1]), kasten(0, e.welt[1], e.welt[0], e.welt[1] + e.opt.karte.sued));
  const ecke = e.gebietEcke ?? (e.werkzeug === "gebiet" ? h : null);
  return {
    raster, geist: g.geist, tuer: g.tuer, schleier, blockiert, rand, kachel: h && e.werkzeug !== "zeiger" ? kachel(h) : null,
    gebiet: e.werkzeug === "gebiet" && ecke ? { form: kasten(ecke[0], ecke[1], ecke[0] + GEBIET[0], ecke[1] + GEBIET[1]), text: "Gebiet (je nach Seed 58–77 × 40–51 Kacheln)" } : null,
  };
}
