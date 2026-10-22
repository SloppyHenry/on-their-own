// Darstellung einer Welt nach Mockup A (`look` aus der Weltdatei). Version 2 (AP12a): Die Welt besteht aus Gebieten (Dörfern), jedes in
// eigenen Dorfkoordinaten wie world.js (Weltpixel = Dorfkoordinaten + `frame`; eine Kachel hat 16 Weltpixel) mit Listen von Wegen, Plätzen,
// Seen, Gärten, Stegen, Bächen und Brücken, mit Deko, Lichtern, der Bildstelle von Dingen (`place`) und beliebig vielen Häusern, jedes mit
// Tür und Innenbereich. Zwischen den Gebieten liegen Landstraßen (`roads`, Weltpixel). Die Startwelt ist ein Gebiet.
// Die alte Form (Version 1, ein Dorf) lädt über `normalizeLook` weiter, damit alte Spielstände und Weltdateien gleich aussehen.
import type { World } from "../../store/types";

export const T = 16;

export type Pt = [number, number];
export interface Room { paper: string; floor: string; curtain: string }
/** Innenbereich eines Hauses in Kacheln [x, y, w, h] und seine Einrichtung (Mockup innen2): Stil je Raum, Wanddeko
 *  [Art, Kachel-x, Raum, Abstand von oben], Möbel [Art, x, y], Teppiche. */
export interface Interior { rect: [number, number, number, number]; rooms?: Record<string, Room>; wall?: [string, number, string, number][]; decor?: [string, number, number][]; rugs?: (string | number)[][] }
export interface HouseLook {
  /** Fußpunkt des Hauses in Dorfkoordinaten und sein Sprite (`house` aus A oder `bh:Breite:Dach:Wand`, `bw`, `bs`, `bb`, `bt`). */
  at: Pt;
  sprite: string;
  /** Haustür: Kachel davor (draußen) und Kachel dahinter (im Innenbereich). */
  door: { outside: Pt; inside: Pt };
  interior: Interior;
  /** Seitlicher Abstand des Schornsteins vom Fußpunkt (Rauch), sonst keiner. */
  smoke: number | null;
}
export interface Shapes {
  paths: number[][][];
  squares: { x: number; y: number; r: number }[];
  lakes: { x: number; y: number; rx: number; ry: number }[];
  gardens: { x0: number; y0: number; x1: number; y1: number; beds: number[][] }[];
  docks: { x0: number; y0: number; x1: number; y1: number }[];
  streams: number[][][];
  bridges: { x0: number; y0: number; x1: number; y1: number }[];
  /** Vorplätze unter Gebäuden [x0, y0, x1, y1]. */
  pads: number[][];
}
export interface Region {
  id: string;
  /** Weltpixel des Dorfpunkts (0, 0). */
  frame: Pt;
  /** Wiese des Dorfs: links/rechts/oben (unten offen, wenn `bottom` fehlt); außerhalb Wildnis. */
  bounds: { left: number; right: number; top: number; bottom?: number };
  shapes: Shapes;
  /** Deko wie wObjects: [Art, x, y, Zusatz]. */
  decor: [string, number, number, number][];
  /** Lichtquellen wie W_LIGHTS: [x, y, Höhe, Stärke]. */
  lights: number[][];
  /** Bildstelle eines Dings oder einer Quelle; `sprite`/`e` wie in `decor`, `more`: weitere Sprites derselben Quelle [x, y, e]. */
  place: Record<string, { at: Pt; sprite?: string; e?: number; more?: [number, number, number][] }>;
  houses: HouseLook[];
}
export interface Look {
  version: 2;
  style: "mockup-a";
  /** Texel = Weltpixel − `texShift` (der Bodenzufall hängt an den Texelkoordinaten, so bleibt Bild A gleich). */
  texShift: Pt;
  /** Block des Bodens, der Zufall (Gräser, Blumen, Seerosen, Beete) wie in Bild A in einer Folge würfelt: Texelrechteck [x, y, b, h]. `plainOutside`: außerhalb
   *  dieses Blocks keine Gräser und Schatten (so zeichnete A; nur für Welten aus Version 1, damit Bild A gleich bleibt). */
  legacy: { rect: [number, number, number, number]; region: string; plainOutside: boolean } | null;
  /** Kamera in der Startlage: Weltpixel am unteren Bildrand in der Mitte (bei A der Dorfplatz). */
  home: Pt;
  regions: Region[];
  /** Landstraßen zwischen Gebieten, Linienzüge in Weltpixeln. */
  roads: number[][][];
  /** Ausgeblendete Einträge im Block `legacy` (AP16a): bleiben in den Listen stehen, damit der Zufall des Bodens gleich bleibt; `normalizeLook` blendet sie aus. */
  mask?: { region: string; liste: string; item: unknown }[];
}

/** Version 1 (ein Dorf, Einzelstücke), wie sie alte Weltdateien und Spielstände enthalten. */
interface LookV1 {
  style: "mockup-a";
  origin: Pt;
  texture: { offset: Pt; size: Pt };
  shapes: { paths: number[][][]; square: { x: number; y: number; r: number }; lake: { x: number; y: number; rx: number; ry: number }; garden: { x0: number; y0: number; x1: number; y1: number }; beds: number[][]; house: { x: number; y: number }; dock: { x0: number; y0: number; x1: number; y1: number } };
  decor: [string, number, number, number][];
  lights: number[][];
  place: Region["place"];
  door: { outside: Pt; inside: Pt; at: Pt };
  interior: Interior;
}

/** Aus Version 1 wird ein Gebiet „dorf“ mit einem Haus; Bild A bleibt Pixel für Pixel gleich. */
function fromV1(o: LookV1): Look {
  const S = o.shapes, H = S.house, at: Pt = [H.x, H.y];
  const region: Region = {
    id: "dorf", frame: o.origin, bounds: { left: 0, right: 256, top: 0, bottom: 232 },
    shapes: { paths: S.paths, squares: [S.square], lakes: [S.lake], gardens: [{ ...S.garden, beds: S.beds }], docks: [S.dock], streams: [], bridges: [], pads: [[H.x - 36, H.y - 30, H.x + 36, H.y]] },
    decor: o.decor.filter((d) => !(d[0] === "house" && d[1] === H.x && d[2] === H.y)),
    lights: o.lights, place: o.place,
    houses: [{ at, sprite: "house", door: { outside: o.door.outside, inside: o.door.inside }, interior: o.interior, smoke: 19 }],
  };
  const [ox, oy] = o.texture.offset, [fx, fy] = o.origin;
  return { version: 2, style: "mockup-a", texShift: [fx - ox, fy - oy], legacy: { rect: [0, 0, o.texture.size[0], o.texture.size[1]], region: "dorf", plainOutside: true }, home: [o.texture.size[0] / 2 + fx - ox, o.texture.size[1] + fy - oy], regions: [region], roads: [] };
}

const cache = new WeakMap<object, Look>();
const seen = new WeakMap<object, Look>();
/** Die Gestaltung der Welt in Version 2 (null, wenn die Welt keine nach Mockup A hat). Alte Formen werden umgewandelt. */
export function lookOf(w: World | null): Look | null {
  const raw = w?.look as unknown as { style?: string; version?: number } | null | undefined;
  if (!raw || raw.style !== "mockup-a") return null;
  return normalizeLook(raw);
}
/** Die Gestaltung in Version 2 samt ausgeblendeter Einträge (zum Ändern, z. B. in den Reducern). */
export function rawLook(raw: object): Look {
  const hit = cache.get(raw);
  if (hit) return hit;
  const l = (raw as { version?: number }).version === 2 ? (raw as Look) : fromV1(raw as LookV1);
  cache.set(raw, l);
  return l;
}
/** Die Gestaltung zum Zeichnen: Version 2, ausgeblendete Einträge sind aus den Listen genommen. */
export function normalizeLook(raw: object): Look {
  const hit = seen.get(raw);
  if (hit) return hit;
  const l = visibleLook(rawLook(raw));
  seen.set(raw, l);
  return l;
}

const SHAPE_LISTS = ["paths", "squares", "lakes", "gardens", "docks", "streams", "bridges", "pads"] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function visibleLook(L: Look): Look {
  if (!L.mask?.length) return L;
  const regions = L.regions.map((r) => {
    const ms = L.mask!.filter((m) => m.region === r.id);
    if (!ms.length) return r;
    const shapes = { ...r.shapes } as unknown as Record<string, unknown[]>;
    let decor: unknown[] = [...r.decor];
    for (const m of ms) {
      const lst = m.liste === "decor" ? decor : shapes[m.liste];
      const i = lst ? lst.findIndex((x) => same(x, m.item)) : -1;
      if (i < 0) continue;
      const rest = lst.filter((_, j) => j !== i);
      if (m.liste === "decor") decor = rest; else shapes[m.liste] = rest;
    }
    return { ...r, shapes: shapes as unknown as Region["shapes"], decor: decor as Region["decor"] };
  });
  return { ...L, regions };
}

/** Eine Änderung an der Gestaltung (Backend: `world/look_ops.py`). */
export type LookOp =
  | { op: "add" | "remove"; region: string; liste: string; item: unknown }
  | { op: "place"; region: string; id: string; value: Region["place"][string] }
  | { op: "unplace"; region: string; id: string }
  | { op: "bounds"; region: string; right?: number | null; bottom?: number | null };

/** Wendet Operationen an, ohne das Eingegebene zu verändern; im Block `legacy` wird nichts aus der Liste gestrichen, sondern in `mask` eingetragen. */
export function applyLookOps(L: Look, ops: LookOp[]): Look {
  let regions = L.regions, mask = L.mask;
  for (const o of ops) {
    const r = regions.find((x) => x.id === o.region);
    if (!r) continue;
    let nr = r;
    const list = (liste: string, f: (l: unknown[]) => unknown[]): Region => {
      if ((SHAPE_LISTS as readonly string[]).includes(liste)) return { ...r, shapes: { ...r.shapes, [liste]: f((r.shapes as unknown as Record<string, unknown[]>)[liste]) } } as Region;
      return { ...r, [liste]: f((r as unknown as Record<string, unknown[]>)[liste]) } as Region;
    };
    if (o.op === "add") nr = list(o.liste, (l) => [...l, o.item]);
    else if (o.op === "remove") {
      if (L.legacy?.region === r.id && (o.liste === "decor" || (SHAPE_LISTS as readonly string[]).includes(o.liste))) { mask = [...(mask ?? []), { region: r.id, liste: o.liste, item: o.item }]; continue; }
      nr = list(o.liste, (l) => { const k = l.findIndex((x) => same(x, o.item)); return k < 0 ? l : l.filter((_, j) => j !== k); });
    } else if (o.op === "place") nr = { ...r, place: { ...r.place, [o.id]: o.value } };
    else if (o.op === "unplace") { const { [o.id]: _gone, ...rest } = r.place; nr = { ...r, place: rest }; }
    else if (o.op === "bounds") {
      const b = r.bounds;
      nr = { ...r, bounds: { ...b, ...(o.right != null && (b.right == null || o.right > b.right) ? { right: o.right } : {}), ...(o.bottom != null && (b.bottom == null || o.bottom > b.bottom) ? { bottom: o.bottom } : {}) } };
    }
    regions = regions.map((x) => (x === r ? nr : x));
  }
  return { ...L, regions, ...(mask ? { mask } : {}) };
}

export const inRect = (r: number[], tx: number, ty: number) => tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3];
/** Gebiet und Haus (Index im Gebiet) eines Innenbereichs, in dem die Kachel liegt; sonst null. */
export function houseAt(L: Look, tx: number, ty: number): { region: Region; i: number } | null {
  for (const region of L.regions) for (let i = 0; i < region.houses.length; i++) if (inRect(region.houses[i].interior.rect, tx, ty)) return { region, i };
  return null;
}
/** Liegt die Kachel im Innenbereich eines Hauses? */
export const isInside = (L: Look, tx: number, ty: number) => houseAt(L, tx, ty) !== null;
/** Alle Häuser mit fortlaufender Nummer (Reihenfolge der Gebiete), wie sie Oberfläche und Ansicht kennen. */
export function housesOf(L: Look): { n: number; region: Region; house: HouseLook }[] {
  const out: { n: number; region: Region; house: HouseLook }[] = [];
  for (const region of L.regions) for (const house of region.houses) out.push({ n: out.length, region, house });
  return out;
}
/** Gebiet, zu dem ein Weltpixel gehört (innerhalb der Wiese samt Rand), sonst null. */
export function regionAt(L: Look, wx: number, wy: number): Region | null {
  for (const r of L.regions) {
    const x = wx - r.frame[0], y = wy - r.frame[1], b = r.bounds;
    if (x >= b.left - 12 && x < b.right + 12 && y >= b.top - 12 && (b.bottom == null || y < b.bottom + 12)) return r;
  }
  return null;
}
/** Bildstelle eines Dings in Weltpixeln: aus `place` des Gebiets, das es führt. */
export function placeOf(L: Look, id: string): { region: Region; p: Region["place"][string] } | null {
  for (const region of L.regions) if (region.place[id]) return { region, p: region.place[id] };
  return null;
}
